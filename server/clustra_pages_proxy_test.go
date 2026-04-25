package server

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/argoproj/argo-cd/v3/server/extension"
)

func TestBuildClustraProxySignatureMatchesVerifierPayload(t *testing.T) {
	assert.Equal(
		t,
		"92f99dab71d24f1b15b07d74d52d2aae83420060ae0219d01d61992690d819c2",
		buildClustraProxySignature(
			"shared-secret",
			"some-user",
			"some-user-id",
			"group1,group2",
			"clustra:modeldeploy",
			"default",
			"1700000000",
		),
	)
}

func TestApplyProxySignatureHeadersSignsClustraPageRequests(t *testing.T) {
	t.Setenv(extension.EnvProxySignatureSecret, "shared-secret")
	req, err := http.NewRequest(http.MethodGet, "/api/ai-service/jobs", nil)
	require.NoError(t, err)
	req.Header.Set(extension.HeaderArgoCDUsername, "some-user")
	req.Header.Set(extension.HeaderArgoCDUserId, "some-user-id")
	req.Header.Set(extension.HeaderArgoCDGroups, "group1,group2")
	req.Header.Set(extension.HeaderArgoCDApplicationName, "clustra:modeldeploy")
	req.Header.Set(extension.HeaderArgoCDProjectName, "default")

	applyProxySignatureHeaders(req)

	timestamp := req.Header.Get(extension.HeaderProxyTimestamp)
	require.NotEmpty(t, timestamp)
	assert.Equal(
		t,
		buildClustraProxySignature(
			"shared-secret",
			"some-user",
			"some-user-id",
			"group1,group2",
			"clustra:modeldeploy",
			"default",
			timestamp,
		),
		req.Header.Get(extension.HeaderProxySignature),
	)
}

func TestClearArgoProxyHeadersClearsStaleSignatureHeaders(t *testing.T) {
	headers := http.Header{}
	headers.Set(extension.HeaderArgoCDUsername, "some-user")
	headers.Set(extension.HeaderProxyTimestamp, "1700000000")
	headers.Set(extension.HeaderProxySignature, "bad-signature")

	clearArgoProxyHeaders(headers)

	assert.Empty(t, headers.Get(extension.HeaderArgoCDUsername))
	assert.Empty(t, headers.Get(extension.HeaderProxyTimestamp))
	assert.Empty(t, headers.Get(extension.HeaderProxySignature))
}
