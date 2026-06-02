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
	"github.com/argoproj/argo-cd/v3/util/argo"
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
		var selectedProject string
		if proxyConfig.requiresApplicationContext(r.URL.Path) {
			if r.Header.Get(extension.HeaderArgoCDApplicationName) != "" {
				// App-scoped (legacy): a pre-existing Application is selected.
				app, statusCode, err := server.resolveSelectedApplication(r)
				if err != nil {
					server.log.WithFields(log.Fields{"page": proxyConfig.pageName, "path": r.URL.Path}).WithError(err).Warn("invalid clustra page application context")
					http.Error(w, err.Error(), statusCode)
					return
				}
				selectedApp = app
			} else {
				// Project-scoped (repo-per-team): no Application, just a project.
				project, statusCode, err := server.resolveSelectedProject(r)
				if err != nil {
					server.log.WithFields(log.Fields{"page": proxyConfig.pageName, "path": r.URL.Path}).WithError(err).Warn("invalid clustra page project context")
					http.Error(w, err.Error(), statusCode)
					return
				}
				selectedProject = project
			}
		}

		clearArgoProxyHeaders(r.Header)
		applyUserHeaders(r, server.Namespace, server.policyEnforcer.GetScopes())
		if selectedApp != nil {
			applyApplicationHeaders(r, selectedApp)
		} else if selectedProject != "" {
			r.Header.Set(extension.HeaderArgoCDProjectName, selectedProject)
		}
		if err := applyProxySignatureHeaders(r); err != nil {
			server.log.WithError(err).WithField("page", proxyConfig.pageName).Error("refusing unsigned clustra page proxy request")
			http.Error(w, "Proxy is not configured for signed requests", http.StatusInternalServerError)
			return
		}

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

	for _, prefix := range []string{
		// Deployment records are owner-scoped (the service filters to the
		// caller's own deployments), so the management list/get/delete do not
		// belong to any single Argo CD application — surface them globally so
		// the Model Deployments page can show every deployment without first
		// pinning an application.
		"/api/v1/deployments",
		"/api/v1/feature-policies",
		"/api/v1/overlays",
		"/api/v1/policies",
		"/api/v1/policy-types",
		// Runtime-config admin surfaces are globally scoped (catalogs, role
		// schemas, cross-engine concept browser, per-policy CRUD/migrate/
		// audit). They don't belong to any single Argo CD application.
		"/api/v1/runtime-config-catalog-concepts",
		"/api/v1/runtime-config-catalog-items",
		"/api/v1/runtime-config-catalogs",
		"/api/v1/runtime-config-policies",
		"/api/v1/runtime-config-role-schemas",
		"/audit-events",
	} {
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

// resolveSelectedProject validates a PROJECT-scoped (app-less) request: the
// client supplies the target project and the user must be permitted to CREATE
// applications in it. Used by the repo-per-team deploy flow where there is no
// pre-existing Application — the project plus a typed deployment name are enough.
func (server *ArgoCDServer) resolveSelectedProject(r *http.Request) (string, int, error) {
	project := r.Header.Get(extension.HeaderArgoCDProjectName)
	if project == "" {
		return "", http.StatusBadRequest, fmt.Errorf("header %q must be provided", extension.HeaderArgoCDProjectName)
	}
	if !argo.IsValidProjectName(project) {
		return "", http.StatusBadRequest, fmt.Errorf("invalid value for project name")
	}
	if err := server.enf.EnforceErr(r.Context().Value("claims"), rbac.ResourceApplications, rbac.ActionCreate, project+"/*"); err != nil {
		return "", http.StatusForbidden, fmt.Errorf("project access denied")
	}
	return project, http.StatusOK, nil
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

func applyProxySignatureHeaders(r *http.Request) error {
	secret := os.Getenv(extension.EnvProxySignatureSecret)
	if secret == "" {
		// Fail closed: never forward unsigned (forgeable) identity headers when
		// signing is required. Shares the require-decision with the extension
		// proxy so both signing paths fail closed consistently.
		if extension.ProxySignatureRequired() {
			return fmt.Errorf("%s is required but not configured; refusing to forward unsigned identity headers", extension.EnvProxySignatureSecret)
		}
		return nil
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
	return nil
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
