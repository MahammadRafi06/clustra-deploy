package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
	"github.com/argoproj/argo-cd/v3/server/extension"
	"github.com/argoproj/argo-cd/v3/util/env"
	"github.com/argoproj/argo-cd/v3/util/rbac"
	"github.com/argoproj/argo-cd/v3/util/session"
)

const (
	modelCacheBackendURLEnv = "ARGOCD_MODEL_CACHE_BACKEND_URL"
	aiServiceBackendURLEnv  = "ARGOCD_AI_SERVICE_BACKEND_URL"
)

type clustraPageProxyConfig struct {
	pageName          string
	pathPrefix        string
	backendURLEnv     string
	telemetryEndpoint string
	requireAppContext bool
}

func (server *ArgoCDServer) registerClustraPageProxies(mux *http.ServeMux) {
	authMiddleware := server.sessionMgr.AuthMiddlewareFunc(server.DisableAuth, server.settings.IsSSOConfigured(), server.ssoClientApp)
	proxies := []clustraPageProxyConfig{
		{
			pageName:          "model-cache",
			pathPrefix:        "/api/model-cache",
			backendURLEnv:     modelCacheBackendURLEnv,
			telemetryEndpoint: "server.ArgoCDServer/model-cache-proxy",
		},
		{
			pageName:          "deploy-models",
			pathPrefix:        "/api/ai-service",
			backendURLEnv:     aiServiceBackendURLEnv,
			telemetryEndpoint: "server.ArgoCDServer/ai-service-proxy",
			requireAppContext: true,
		},
	}

	for _, proxyConfig := range proxies {
		handler := otelhttp.NewHandler(authMiddleware(server.newClustraPageProxyHandler(proxyConfig)), proxyConfig.telemetryEndpoint)
		mux.Handle(proxyConfig.pathPrefix, handler)
		mux.Handle(proxyConfig.pathPrefix+"/", handler)
	}
}

func (server *ArgoCDServer) newClustraPageProxyHandler(proxyConfig clustraPageProxyConfig) http.Handler {
	backendURL := strings.TrimSpace(env.StringFromEnv(proxyConfig.backendURLEnv, ""))
	if backendURL == "" {
		server.log.Warnf("Clustra page backend for %s is not configured; expected %s", proxyConfig.pageName, proxyConfig.backendURLEnv)
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, fmt.Sprintf("%s backend is not configured", proxyConfig.pageName), http.StatusServiceUnavailable)
		})
	}

	targetURL, err := url.Parse(backendURL)
	if err != nil || targetURL.Scheme == "" || targetURL.Host == "" {
		server.log.WithError(err).Errorf("Invalid backend URL %q configured in %s", backendURL, proxyConfig.backendURLEnv)
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, fmt.Sprintf("%s backend URL is invalid", proxyConfig.pageName), http.StatusServiceUnavailable)
		})
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.URL.Path = joinProxyPath(targetURL.Path, strings.TrimPrefix(req.URL.Path, proxyConfig.pathPrefix))
		req.Host = targetURL.Host
		req.Header.Set("Host", targetURL.Host)
		req.Header.Del("Authorization")
		req.Header.Del("Cookie")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		server.log.WithError(err).WithField("page", proxyConfig.pageName).Error("clustra page proxy request failed")
		http.Error(w, "Upstream request failed", http.StatusBadGateway)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := server.enf.EnforceErr(r.Context().Value("claims"), rbac.ResourceClustraPages, clustraPageActionForMethod(r.Method), proxyConfig.pageName); err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		var selectedApp *v1alpha1.Application
		if proxyConfig.requiresApplicationContext(r.URL.Path) {
			app, statusCode, err := server.resolveSelectedApplication(r)
			if err != nil {
				server.log.WithFields(log.Fields{"page": proxyConfig.pageName, "path": r.URL.Path}).WithError(err).Warn("invalid clustra page application context")
				http.Error(w, err.Error(), statusCode)
				return
			}
			selectedApp = app
		}

		clearArgoProxyHeaders(r.Header)
		applyUserHeaders(r, server.Namespace, server.policyEnforcer.GetScopes())
		if selectedApp != nil {
			applyApplicationHeaders(r, selectedApp)
		}
		applyProxySignatureHeaders(r)

		proxy.ServeHTTP(w, r)
	})
}

func (proxyConfig clustraPageProxyConfig) requiresApplicationContext(requestPath string) bool {
	if !proxyConfig.requireAppContext {
		return false
	}

	return !isAIConfiguratorPolicyProxyPath(strings.TrimPrefix(requestPath, proxyConfig.pathPrefix))
}

func isAIConfiguratorPolicyProxyPath(path string) bool {
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	for _, prefix := range []string{"/api/v1/policies", "/api/v1/feature-policies", "/api/v1/policy-types"} {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}
	return false
}

func (server *ArgoCDServer) resolveSelectedApplication(r *http.Request) (*v1alpha1.Application, int, error) {
	requestResources, err := extension.ValidateHeaders(r)
	if err != nil {
		return nil, http.StatusBadRequest, fmt.Errorf("invalid target selection: %w", err)
	}

	app, err := server.appLister.Applications(requestResources.ApplicationNamespace).Get(requestResources.ApplicationName)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, http.StatusNotFound, fmt.Errorf("application %s/%s not found", requestResources.ApplicationNamespace, requestResources.ApplicationName)
		}
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to load application: %w", err)
	}

	if app.Spec.GetProject() != requestResources.ProjectName {
		return nil, http.StatusBadRequest, fmt.Errorf("application %s/%s does not belong to project %q", app.Namespace, app.Name, requestResources.ProjectName)
	}

	if err := server.enf.EnforceErr(r.Context().Value("claims"), rbac.ResourceApplications, rbac.ActionGet, app.RBACName(server.Namespace)); err != nil {
		return nil, http.StatusForbidden, fmt.Errorf("application access denied")
	}

	return app, 0, nil
}

func clustraPageActionForMethod(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return rbac.ActionGet
	case http.MethodPost:
		return rbac.ActionCreate
	case http.MethodPut, http.MethodPatch:
		return rbac.ActionUpdate
	case http.MethodDelete:
		return rbac.ActionDelete
	default:
		return rbac.ActionGet
	}
}

func clearArgoProxyHeaders(headers http.Header) {
	headers.Del(extension.HeaderArgoCDNamespace)
	headers.Del(extension.HeaderArgoCDApplicationName)
	headers.Del(extension.HeaderArgoCDProjectName)
	headers.Del(extension.HeaderArgoCDTargetClusterName)
	headers.Del(extension.HeaderArgoCDTargetClusterURL)
	headers.Del(extension.HeaderArgoCDUsername)
	headers.Del(extension.HeaderArgoCDUserId)
	headers.Del(extension.HeaderArgoCDGroups)
	headers.Del(extension.HeaderProxySignature)
	headers.Del(extension.HeaderProxyTimestamp)
}

func applyUserHeaders(r *http.Request, namespace string, scopes []string) {
	r.Header.Set(extension.HeaderArgoCDNamespace, namespace)

	if userID := session.GetUserIdentifier(r.Context()); userID != "" {
		r.Header.Set(extension.HeaderArgoCDUserId, userID)
	}
	if username := session.Username(r.Context()); username != "" {
		r.Header.Set(extension.HeaderArgoCDUsername, username)
	}
	if groups := session.Groups(r.Context(), scopes); len(groups) > 0 {
		r.Header.Set(extension.HeaderArgoCDGroups, strings.Join(groups, ","))
	}
}

func applyApplicationHeaders(r *http.Request, app *v1alpha1.Application) {
	r.Header.Set(extension.HeaderArgoCDApplicationName, fmt.Sprintf("%s:%s", app.Namespace, app.Name))
	r.Header.Set(extension.HeaderArgoCDProjectName, app.Spec.GetProject())
	if app.Spec.Destination.Name != "" {
		r.Header.Set(extension.HeaderArgoCDTargetClusterName, app.Spec.Destination.Name)
	}
	if app.Spec.Destination.Server != "" {
		r.Header.Set(extension.HeaderArgoCDTargetClusterURL, app.Spec.Destination.Server)
	}
}

func applyProxySignatureHeaders(r *http.Request) {
	secret := os.Getenv(extension.EnvProxySignatureSecret)
	if secret == "" {
		return
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := buildClustraProxySignature(
		secret,
		r.Header.Get(extension.HeaderArgoCDUsername),
		r.Header.Get(extension.HeaderArgoCDUserId),
		r.Header.Get(extension.HeaderArgoCDGroups),
		r.Header.Get(extension.HeaderArgoCDApplicationName),
		r.Header.Get(extension.HeaderArgoCDProjectName),
		timestamp,
	)
	r.Header.Set(extension.HeaderProxyTimestamp, timestamp)
	r.Header.Set(extension.HeaderProxySignature, signature)
}

func buildClustraProxySignature(secret string, username string, userID string, groups string, application string, project string, timestamp string) string {
	payload := strings.Join([]string{
		username,
		userID,
		groups,
		application,
		project,
		timestamp,
	}, "\n")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func joinProxyPath(basePath, requestPath string) string {
	switch {
	case requestPath == "":
		requestPath = "/"
	case !strings.HasPrefix(requestPath, "/"):
		requestPath = "/" + requestPath
	}

	switch {
	case basePath == "", basePath == "/":
		return requestPath
	case requestPath == "/":
		return basePath
	case strings.HasSuffix(basePath, "/"):
		return strings.TrimSuffix(basePath, "/") + requestPath
	default:
		return basePath + requestPath
	}
}
