{{/* vim: set filetype=mustache: */}}
{{/*
Create controller name and version as used by the chart label.
Truncated at 52 chars because StatefulSet label 'controller-revision-hash' is limited
to 63 chars and it includes 10 chars of hash and a separating '-'.
*/}}
{{- define "argo-cd.controller.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.controller.name | trunc 52 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the controller service account to use
*/}}
{{- define "argo-cd.controller.serviceAccountName" -}}
{{- if .Values.controller.serviceAccount.create -}}
    {{ default (include "argo-cd.controller.fullname" .) .Values.controller.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.controller.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create dex name and version as used by the chart label.
*/}}
{{- define "argo-cd.dex.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.dex.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create Dex server endpoint
*/}}
{{- define "argo-cd.dex.server" -}}
{{- $insecure := index .Values.configs.params "dexserver.disable.tls" | toString -}}
{{- $scheme := (eq $insecure "true") | ternary "http" "https" -}}
{{- $host := include "argo-cd.dex.fullname" . -}}
{{- $port := int .Values.dex.servicePortHttp -}}
{{- printf "%s://%s:%d" $scheme $host $port }}
{{- end }}

{{/*
Create the name of the dex service account to use
*/}}
{{- define "argo-cd.dex.serviceAccountName" -}}
{{- if .Values.dex.serviceAccount.create -}}
    {{ default (include "argo-cd.dex.fullname" .) .Values.dex.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.dex.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create redis name and version as used by the chart label.
*/}}
{{- define "argo-cd.redis.fullname" -}}
{{- $redisHa := (index .Values "redis-ha") -}}
{{- $redisHaContext := dict "Chart" (dict "Name" "redis-ha") "Release" .Release "Values" $redisHa -}}
{{- if $redisHa.enabled -}}
    {{- if $redisHa.haproxy.enabled -}}
        {{- printf "%s-haproxy" (include "redis-ha.fullname" $redisHaContext) | trunc 63 | trimSuffix "-" -}}
    {{- end -}}
{{- else -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.redis.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Return Redis server endpoint
*/}}
{{- define "argo-cd.redis.server" -}}
{{- $redisHa := (index .Values "redis-ha") -}}
{{- if or (and .Values.redis.enabled (not $redisHa.enabled)) (and $redisHa.enabled $redisHa.haproxy.enabled) }}
    {{- printf "%s:%s" (include "argo-cd.redis.fullname" .)  (toString .Values.redis.servicePort) }}
{{- else if and .Values.externalRedis.host .Values.externalRedis.port }}
    {{- printf "%s:%s" .Values.externalRedis.host (toString .Values.externalRedis.port) }}
{{- end }}
{{- end -}}

{{/*
Create the name of the redis service account to use
*/}}
{{- define "argo-cd.redis.serviceAccountName" -}}
{{- if .Values.redis.serviceAccount.create -}}
    {{ default (include "argo-cd.redis.fullname" .) .Values.redis.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.redis.serviceAccount.name }}
{{- end -}}
{{- end -}}


{{/*
Create Redis secret-init name
*/}}
{{- define "argo-cd.redisSecretInit.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.redisSecretInit.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the Redis secret-init service account to use
*/}}
{{- define "argo-cd.redisSecretInit.serviceAccountName" -}}
{{- if .Values.redisSecretInit.serviceAccount.create -}}
    {{ default (include "argo-cd.redisSecretInit.fullname" .) .Values.redisSecretInit.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.redisSecretInit.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd server name and version as used by the chart label.
*/}}
{{- define "argo-cd.server.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.server.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the Argo CD server service account to use
*/}}
{{- define "argo-cd.server.serviceAccountName" -}}
{{- if .Values.server.serviceAccount.create -}}
    {{ default (include "argo-cd.server.fullname" .) .Values.server.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.server.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd repo-server name and version as used by the chart label.
*/}}
{{- define "argo-cd.repoServer.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.repoServer.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the repo-server service account to use
*/}}
{{- define "argo-cd.repoServer.serviceAccountName" -}}
{{- if .Values.repoServer.serviceAccount.create -}}
    {{ default (include "argo-cd.repoServer.fullname" .) .Values.repoServer.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.repoServer.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd application set name and version as used by the chart label.
*/}}
{{- define "argo-cd.applicationSet.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.applicationSet.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the application set service account to use
*/}}
{{- define "argo-cd.applicationSet.serviceAccountName" -}}
{{- if .Values.applicationSet.serviceAccount.create -}}
    {{ default (include "argo-cd.applicationSet.fullname" .) .Values.applicationSet.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.applicationSet.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd notifications name and version as used by the chart label.
*/}}
{{- define "argo-cd.notifications.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.notifications.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the notifications service account to use
*/}}
{{- define "argo-cd.notifications.serviceAccountName" -}}
{{- if .Values.notifications.serviceAccount.create -}}
    {{ default (include "argo-cd.notifications.fullname" .) .Values.notifications.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.notifications.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd commit-server name and version as used by the chart label.
*/}}
{{- define "argo-cd.commitServer.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.commitServer.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the commit-server service account to use
*/}}
{{- define "argo-cd.commitServer.serviceAccountName" -}}
{{- if .Values.commitServer.serviceAccount.create -}}
    {{ default (include "argo-cd.commitServer.fullname" .) .Values.commitServer.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.commitServer.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Resolve the default Secret key used for generated OIDC client secrets.
*/}}
{{- define "argo-cd.sso.clientSecretKey" -}}
{{- $sso := .Values.sso | default dict -}}
{{- $provider := lower ($sso.provider | default "oidc") -}}
{{- $clientSecret := $sso.clientSecret | default dict -}}
{{- default (printf "oidc.%s.clientSecret" $provider) $clientSecret.key -}}
{{- end -}}

{{/*
Resolve the Argo CD OIDC clientSecret reference string.
*/}}
{{- define "argo-cd.sso.clientSecretRef" -}}
{{- $sso := .Values.sso | default dict -}}
{{- $clientSecret := $sso.clientSecret | default dict -}}
{{- $key := include "argo-cd.sso.clientSecretKey" . -}}
{{- $ref := $clientSecret.ref | default "" -}}
{{- if ne $ref "" -}}
{{- printf "$%s:%s" $ref $key -}}
{{- else -}}
{{- printf "$%s" $key -}}
{{- end -}}
{{- end -}}

{{/*
Validate high-level Clustra SSO configuration.
*/}}
{{- define "argo-cd.sso.validate" -}}
{{- $sso := .Values.sso | default dict -}}
{{- if ($sso.enabled | default false) -}}
{{- if not (.Values.configs.cm.create | default false) -}}
{{- fail "sso.enabled requires configs.cm.create=true so the generated oidc.config can be rendered" -}}
{{- end -}}
{{- if not (.Values.configs.rbac.create | default false) -}}
{{- fail "sso.enabled requires configs.rbac.create=true so generated group RBAC can be rendered" -}}
{{- end -}}
{{- if or (index .Values.configs.cm "oidc.config") (index .Values.configs.cm "dex.config") -}}
{{- fail "sso.enabled cannot be used together with raw configs.cm.oidc.config or configs.cm.dex.config; disable sso or remove the raw SSO config" -}}
{{- end -}}
{{- $provider := lower (required "sso.provider must be one of azure, okta, or oidc when sso.enabled=true" ($sso.provider | default "")) -}}
{{- if and (ne $provider "azure") (ne $provider "okta") (ne $provider "oidc") -}}
{{- fail (printf "unsupported sso.provider %q; expected azure, okta, or oidc" $sso.provider) -}}
{{- end -}}
{{- $_ := required "sso.clientID is required when sso.enabled=true" ($sso.clientID | default "") -}}
{{- $clientSecret := $sso.clientSecret | default dict -}}
{{- $azure := $sso.azure | default dict -}}
{{- if eq $provider "azure" -}}
{{- $_ := required "sso.azure.tenantID is required when sso.provider=azure" ($azure.tenantID | default "") -}}
{{- end -}}
{{- if eq $provider "okta" -}}
{{- $okta := $sso.okta | default dict -}}
{{- $_ := required "sso.okta.issuer is required when sso.provider=okta" ($okta.issuer | default "") -}}
{{- end -}}
{{- if eq $provider "oidc" -}}
{{- $oidc := $sso.oidc | default dict -}}
{{- $_ := required "sso.oidc.issuer is required when sso.provider=oidc" ($oidc.issuer | default "") -}}
{{- end -}}
{{- if and (eq $provider "azure") ($azure.useWorkloadIdentity | default false) -}}
{{- if or ($clientSecret.value | default "") ($clientSecret.ref | default "") ($clientSecret.key | default "") -}}
{{- fail "sso.clientSecret.* must be empty when sso.azure.useWorkloadIdentity=true; Argo CD will use Azure Workload Identity instead of a client secret" -}}
{{- end -}}
{{- if not (.Values.server.serviceAccount.create | default false) -}}
{{- fail "sso.azure.useWorkloadIdentity=true requires server.serviceAccount.create=true so the workload identity annotation can be rendered" -}}
{{- end -}}
{{- else -}}
{{- if and ($clientSecret.value | default "") ($clientSecret.ref | default "") -}}
{{- fail "sso.clientSecret.value and sso.clientSecret.ref are mutually exclusive" -}}
{{- end -}}
{{- if and ($clientSecret.value | default "") (not (.Values.configs.secret.createSecret | default false)) -}}
{{- fail "sso.clientSecret.value requires configs.secret.createSecret=true so the inline value can be rendered into argocd-secret" -}}
{{- end -}}
{{- $secretKey := include "argo-cd.sso.clientSecretKey" . -}}
{{- if and ($clientSecret.value | default "") (hasKey (.Values.configs.secret.extra | default dict) $secretKey) -}}
{{- fail (printf "sso.clientSecret.value would render duplicate argocd-secret key %q; remove configs.secret.extra for that key or use an external secret reference" $secretKey) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Generate direct OIDC configuration from high-level Clustra SSO values.
*/}}
{{- define "argo-cd.sso.oidcConfig" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $sso := .Values.sso | default dict -}}
{{- if ($sso.enabled | default false) -}}
{{- $provider := lower ($sso.provider | default "") -}}
{{- $azure := $sso.azure | default dict -}}
{{- $okta := $sso.okta | default dict -}}
{{- $oidc := $sso.oidc | default dict -}}
{{- $config := dict -}}
{{- $defaultName := "OIDC" -}}
{{- if eq $provider "azure" -}}
{{- $defaultName = "Azure" -}}
{{- else if eq $provider "okta" -}}
{{- $defaultName = "Okta" -}}
{{- end -}}
{{- $_ := set $config "name" (default $defaultName $sso.name) -}}
{{- if eq $provider "azure" -}}
{{- $_ := set $config "issuer" (printf "https://login.microsoftonline.com/%s/v2.0" $azure.tenantID) -}}
{{- else if eq $provider "okta" -}}
{{- $_ := set $config "issuer" $okta.issuer -}}
{{- else -}}
{{- $_ := set $config "issuer" $oidc.issuer -}}
{{- end -}}
{{- $_ := set $config "clientID" $sso.clientID -}}
{{- if and (eq $provider "azure") ($azure.useWorkloadIdentity | default false) -}}
{{- $_ := set $config "azure" (dict "useWorkloadIdentity" true) -}}
{{- else -}}
{{- $_ := set $config "clientSecret" (include "argo-cd.sso.clientSecretRef" .) -}}
{{- end -}}
{{- with ($sso.requestedScopes | default list) -}}
{{- $_ := set $config "requestedScopes" . -}}
{{- end -}}
{{- with ($sso.requestedIDTokenClaims | default dict) -}}
{{- $_ := set $config "requestedIDTokenClaims" . -}}
{{- end -}}
{{- with ($sso.cliClientID | default "") -}}
{{- $_ := set $config "cliClientID" . -}}
{{- end -}}
{{- with ($sso.allowedAudiences | default list) -}}
{{- $_ := set $config "allowedAudiences" . -}}
{{- end -}}
{{- if ($sso.enablePKCEAuthentication | default false) -}}
{{- $_ := set $config "enablePKCEAuthentication" true -}}
{{- end -}}
{{- with ($sso.logoutURL | default "") -}}
{{- $_ := set $config "logoutURL" . -}}
{{- end -}}
{{- if eq $provider "azure" -}}
{{- with ($azure.domainHint | default "") -}}
{{- $_ := set $config "domainHint" . -}}
{{- end -}}
{{- end -}}
{{- if eq $provider "okta" -}}
{{- $enableUserInfoGroups := true -}}
{{- if hasKey $okta "enableUserInfoGroups" -}}
{{- $enableUserInfoGroups = $okta.enableUserInfoGroups -}}
{{- end -}}
{{- if $enableUserInfoGroups -}}
{{- $_ := set $config "enableUserInfoGroups" true -}}
{{- $_ := set $config "userInfoPath" (default "/userinfo" $okta.userInfoPath) -}}
{{- $_ := set $config "userInfoCacheExpiration" (default "5m" $okta.userInfoCacheExpiration) -}}
{{- end -}}
{{- end -}}
{{- toYaml $config | trim -}}
{{- end -}}
{{- end -}}

{{/*
Generate Secret data for inline SSO client secrets.
*/}}
{{- define "argo-cd.sso.secretData" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $data := dict -}}
{{- $sso := .Values.sso | default dict -}}
{{- if ($sso.enabled | default false) -}}
{{- $provider := lower ($sso.provider | default "") -}}
{{- $azure := $sso.azure | default dict -}}
{{- $clientSecret := $sso.clientSecret | default dict -}}
{{- if not (and (eq $provider "azure") ($azure.useWorkloadIdentity | default false)) -}}
{{- with ($clientSecret.value | default "") -}}
{{- $_ := set $data (include "argo-cd.sso.clientSecretKey" $) . -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- toYaml $data -}}
{{- end -}}

{{/*
Generate workload identity labels for the Argo CD server pod.
*/}}
{{- define "argo-cd.sso.serverPodLabels" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $labels := dict -}}
{{- $sso := .Values.sso | default dict -}}
{{- $azure := $sso.azure | default dict -}}
{{- if and ($sso.enabled | default false) (eq (lower ($sso.provider | default "")) "azure") ($azure.useWorkloadIdentity | default false) -}}
{{- $_ := set $labels "azure.workload.identity/use" "true" -}}
{{- end -}}
{{- toYaml $labels -}}
{{- end -}}

{{/*
Generate workload identity annotations for the Argo CD server service account.
*/}}
{{- define "argo-cd.sso.serverServiceAccountAnnotations" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $annotations := dict -}}
{{- $sso := .Values.sso | default dict -}}
{{- $azure := $sso.azure | default dict -}}
{{- if and ($sso.enabled | default false) (eq (lower ($sso.provider | default "")) "azure") ($azure.useWorkloadIdentity | default false) -}}
{{- $_ := set $annotations "azure.workload.identity/client-id" $sso.clientID -}}
{{- end -}}
{{- toYaml $annotations -}}
{{- end -}}

{{/*
Argo Configuration Preset Values (Influenced by Values configuration)
*/}}
{{- define "argo-cd.config.cm.presets" -}}
{{- $presets := dict -}}
{{- $_ := set $presets "url" (printf "https://%s" .Values.global.domain) -}}
{{- if eq (toString (index .Values.configs.cm "statusbadge.enabled")) "true" -}}
{{- $_ := set $presets "statusbadge.url" (printf "https://%s/" .Values.global.domain) -}}
{{- end -}}
{{- if .Values.configs.styles -}}
{{- $_ := set $presets "ui.cssurl" "./custom/custom.styles.css" -}}
{{- end -}}
{{- toYaml $presets }}
{{- end -}}

{{/*
Merge Argo Configuration with Preset Configuration
*/}}
{{- define "argo-cd.config.cm" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $config := deepCopy (omit .Values.configs.cm "create" "annotations") -}}
{{- $sso := .Values.sso | default dict -}}
{{- if ($sso.enabled | default false) -}}
{{- $_ := set $config "oidc.config" (include "argo-cd.sso.oidcConfig" .) -}}
{{- if ($sso.disableLocalAdmin | default false) -}}
{{- $_ := set $config "admin.enabled" false -}}
{{- end -}}
{{- end -}}
{{- $generatedExtensionConfig := include "argo-cd.platformExtensions.proxyConfig" . | fromYaml | default dict -}}
{{- $manualExtensionConfig := (get $config "extension.config" | default "" | fromYaml) | default dict -}}
{{- $generatedExtensions := get $generatedExtensionConfig "extensions" | default list -}}
{{- $manualExtensions := get $manualExtensionConfig "extensions" | default list -}}
{{- if gt (len (concat $generatedExtensions $manualExtensions)) 0 -}}
{{- $_ := set $config "extension.config" ((dict "extensions" (concat $generatedExtensions $manualExtensions)) | toYaml | trim) -}}
{{- end -}}
{{- $preset := include "argo-cd.config.cm.presets" . | fromYaml | default dict -}}
{{- range $key, $value := mergeOverwrite $preset $config }}
{{- $fmted := $value | toString }}
{{- if not (eq $fmted "") }}
{{ $key }}: {{ $fmted | toYaml }}
{{- end }}
{{- end }}
{{- end -}}

{{/*
Generate environment variables for built-in Clustra first-party page proxies.
Explicit env values in global.env/server.env win to avoid duplicate names.
*/}}
{{- define "argo-cd.clustraPages.env" -}}
{{- $env := list -}}
{{- $envNames := dict -}}
{{- range (concat (.Values.global.env | default list) (.Values.server.env | default list)) -}}
  {{- if .name -}}
    {{- $_ := set $envNames .name true -}}
  {{- end -}}
{{- end -}}
{{- $pages := .Values.clustraPages | default dict -}}
{{- if ($pages.enabled | default false) -}}
  {{- $deployModels := $pages.deployModels | default dict -}}
  {{- if and ($deployModels.enabled | default false) $deployModels.backendUrl (not (hasKey $envNames "ARGOCD_AI_SERVICE_BACKEND_URL")) -}}
    {{- $env = append $env (dict "name" "ARGOCD_AI_SERVICE_BACKEND_URL" "value" $deployModels.backendUrl) -}}
  {{- end -}}
  {{- $modelCache := $pages.modelCache | default dict -}}
  {{- if and ($modelCache.enabled | default false) $modelCache.backendUrl (not (hasKey $envNames "ARGOCD_MODEL_CACHE_BACKEND_URL")) -}}
    {{- $env = append $env (dict "name" "ARGOCD_MODEL_CACHE_BACKEND_URL" "value" $modelCache.backendUrl) -}}
  {{- end -}}
{{- end -}}
{{ toYaml $env }}
{{- end -}}

{{/*
Generate proxy extension configuration from declarative platform extensions
*/}}
{{- define "argo-cd.platformExtensions.proxyConfig" -}}
{{- $extensions := list -}}
{{- if .Values.platformExtensions.enabled -}}
  {{- range $item := (.Values.platformExtensions.items | default list) -}}
    {{- if and $item.name $item.backend -}}
      {{- $extensions = append $extensions (dict "name" $item.name "backend" $item.backend) -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{- if gt (len $extensions) 0 -}}
extensions:
{{- range $extension := $extensions }}
  - name: {{ $extension.name }}
    backend:
{{ toYaml $extension.backend | nindent 6 }}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Generate installer init container entries for declarative platform extensions
*/}}
{{- define "argo-cd.server.extensions.list" -}}
{{- $extensions := list -}}
{{- range $item := (.Values.server.extensions.extensionList | default list) -}}
  {{- $extensions = append $extensions $item -}}
{{- end -}}
{{- if .Values.platformExtensions.enabled -}}
  {{- range $item := (.Values.platformExtensions.items | default list) -}}
    {{- $ui := ($item.ui | default dict) -}}
    {{- $extensionUrl := (get $ui "extensionUrl" | default "") -}}
    {{- if and $item.name (ne $extensionUrl "") -}}
      {{- $env := list (dict "name" "EXTENSION_URL" "value" $extensionUrl) -}}
      {{- $checksumUrl := (get $ui "checksumUrl" | default "") -}}
      {{- if ne $checksumUrl "" -}}
        {{- $env = append $env (dict "name" "EXTENSION_CHECKSUM_URL" "value" $checksumUrl) -}}
      {{- end -}}
      {{- range $extraEnv := (get $ui "env" | default list) -}}
        {{- $env = append $env $extraEnv -}}
      {{- end -}}
      {{- $extensions = append $extensions (dict "name" $item.name "env" $env) -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{ toYaml $extensions }}
{{- end -}}

{{/*
Generate extension RBAC lines for declarative platform extensions
*/}}
{{- define "argo-cd.platformExtensions.rbacPolicy" -}}
{{- $lines := list -}}
{{- if .Values.platformExtensions.enabled -}}
  {{- range $item := (.Values.platformExtensions.items | default list) -}}
    {{- $rbac := ($item.rbac | default dict) -}}
    {{- range $role := (get $rbac "allowRoles" | default list) -}}
      {{- $lines = append $lines (printf "p, %s, extensions, invoke, %s, allow" $role $item.name) -}}
    {{- end -}}
    {{- range $policy := (get $rbac "policy" | default list) -}}
      {{- $lines = append $lines $policy -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{ join "\n" $lines }}
{{- end -}}

{{/*
Generate RBAC lines for high-level Clustra SSO group bindings.
*/}}
{{- define "argo-cd.sso.rbacPolicy" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $lines := list -}}
{{- $sso := .Values.sso | default dict -}}
{{- if ($sso.enabled | default false) -}}
{{- $rbac := $sso.rbac | default dict -}}
{{- range ($rbac.adminGroups | default list) -}}
{{- $lines = append $lines (printf "g, %s, role:admin" .) -}}
{{- end -}}
{{- range ($rbac.readonlyGroups | default list) -}}
{{- $lines = append $lines (printf "g, %s, role:readonly" .) -}}
{{- end -}}
{{- with ($rbac.extraPolicyCsv | default "" | trim) -}}
{{- $lines = append $lines . -}}
{{- end -}}
{{- end -}}
{{ join "\n" $lines }}
{{- end -}}

{{/*
Generate RBAC lines for built-in Clustra first-party pages.
*/}}
{{- define "argo-cd.clustraPages.rbacPolicy" -}}
{{- $lines := list -}}
{{- $pages := .Values.clustraPages | default dict -}}
{{- if ($pages.enabled | default false) -}}
  {{- $deployModels := $pages.deployModels | default dict -}}
  {{- if ($deployModels.enabled | default false) -}}
    {{- range ($deployModels.rbacPolicy | default list) -}}
      {{- $lines = append $lines . -}}
    {{- end -}}
  {{- end -}}
  {{- $modelCache := $pages.modelCache | default dict -}}
  {{- if ($modelCache.enabled | default false) -}}
    {{- range ($modelCache.rbacPolicy | default list) -}}
      {{- $lines = append $lines . -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{ join "\n" $lines }}
{{- end -}}

{{/*
Merge RBAC configuration with generated extension policies
*/}}
{{- define "argo-cd.config.rbac" -}}
{{- include "argo-cd.sso.validate" . -}}
{{- $config := deepCopy (omit .Values.configs.rbac "create" "annotations") -}}
{{- $sso := .Values.sso | default dict -}}
{{- if ($sso.enabled | default false) -}}
{{- $ssoRbac := $sso.rbac | default dict -}}
{{- $_ := set $config "policy.default" ($ssoRbac.policyDefault | default "") -}}
{{- $_ := set $config "scopes" (default "[groups]" $ssoRbac.scopes) -}}
{{- end -}}
{{- $generatedPolicies := list -}}
{{- $clustraPagePolicy := include "argo-cd.clustraPages.rbacPolicy" . | trim -}}
{{- if ne $clustraPagePolicy "" -}}
{{- $generatedPolicies = append $generatedPolicies $clustraPagePolicy -}}
{{- end -}}
{{- $ssoPolicy := include "argo-cd.sso.rbacPolicy" . | trim -}}
{{- if ne $ssoPolicy "" -}}
{{- $generatedPolicies = append $generatedPolicies $ssoPolicy -}}
{{- end -}}
{{- $platformExtensionPolicy := include "argo-cd.platformExtensions.rbacPolicy" . | trim -}}
{{- if ne $platformExtensionPolicy "" -}}
{{- $generatedPolicies = append $generatedPolicies $platformExtensionPolicy -}}
{{- end -}}
{{- $generatedPolicy := join "\n" $generatedPolicies | trim -}}
{{- if ne $generatedPolicy "" -}}
{{- $manualPolicy := get $config "policy.csv" | default "" -}}
{{- $_ := set $config "policy.csv" (trim (printf "%s\n%s" $generatedPolicy $manualPolicy)) -}}
{{- end -}}
{{ toYaml $config }}
{{- end -}}

{{/*
Argo Params Default Configuration Presets
NOTE: Configuration keys must be stored as dict because YAML treats dot as separator
*/}}
{{- define "argo-cd.config.params.presets" -}}
{{- $presets := dict -}}
{{- $_ := set $presets "repo.server" (printf "%s:%s" (include "argo-cd.repoServer.fullname" .) (.Values.repoServer.service.port | toString)) -}}
{{- $_ := set $presets "server.repo.server.strict.tls" (.Values.repoServer.certificateSecret.enabled | toString ) -}}
{{- $_ := set $presets "redis.server" (include "argo-cd.redis.server" .) -}}
{{- $_ := set $presets "applicationsetcontroller.enable.leader.election" (gt ((.Values.applicationSet.replicas | default .Values.applicationSet.replicaCount) | int64) 1) -}}
{{- if .Values.dex.enabled -}}
{{- $_ := set $presets "server.dex.server" (include "argo-cd.dex.server" .) -}}
{{- $_ := set $presets "server.dex.server.strict.tls" .Values.dex.certificateSecret.enabled -}}
{{- end -}}
{{- if .Values.commitServer.enabled -}}
{{- $_ := set $presets "commit.server" (printf "%s:%s" (include "argo-cd.commitServer.fullname" .) (.Values.commitServer.service.port | toString)) -}}
{{- end -}}
{{- range $component := tuple "applicationsetcontroller" "controller" "server" "reposerver" "notificationscontroller" "dexserver" "commitserver" -}}
{{- $_ := set $presets (printf "%s.log.format" $component) $.Values.global.logging.format -}}
{{- $_ := set $presets (printf "%s.log.level" $component) $.Values.global.logging.level -}}
{{- end -}}
{{- toYaml $presets }}
{{- end -}}

{{/*
Merge Argo Params Configuration with Preset Configuration
*/}}
{{- define "argo-cd.config.params" -}}
{{- $config := omit .Values.configs.params "create" "annotations" }}
{{- $preset := include "argo-cd.config.params.presets" . | fromYaml | default dict -}}
{{- range $key, $value := mergeOverwrite $preset $config }}
{{ $key }}: {{ toString $value | toYaml }}
{{- end }}
{{- end -}}

{{/*
Expand the namespace of the release.
Allows overriding it for multi-namespace deployments in combined charts.
*/}}
{{- define "argo-cd.namespace" -}}
{{- default .Release.Namespace .Values.namespaceOverride | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Dual stack definition
*/}}
{{- define "argo-cd.dualStack" -}}
{{- with .Values.global.dualStack.ipFamilyPolicy }}
ipFamilyPolicy: {{ . }}
{{- end }}
{{- with .Values.global.dualStack.ipFamilies }}
ipFamilies: {{ toYaml . | nindent 4 }}
{{- end }}
{{- end }}

{{/*
secretKeyRef of env variable REDIS_USERNAME
*/}}
{{- define "argo-cd.redisUsernameSecretRef" -}}
    {{- if .Values.externalRedis.host -}}
name: {{ default "argocd-redis" .Values.externalRedis.existingSecret }}
key: redis-username
optional: {{ if .Values.externalRedis.username }}false{{ else }}true{{ end }}

    {{- else -}}
name: "argocd-redis"
key: redis-username
optional: true
    {{- end -}}
{{- end -}}

{{/*
secretKeyRef of env variable REDIS_PASSWORD
*/}}
{{- define "argo-cd.redisPasswordSecretRef" -}}
    {{- if .Values.externalRedis.host -}}
    {{- /* External Redis use case */ -}}
    {{- /* Secret is required when specifying existingSecret or a password, otherwise it is optional */ -}}
name: {{ default "argocd-redis" .Values.externalRedis.existingSecret }}
key: redis-password
optional: {{ if or .Values.externalRedis.existingSecret .Values.externalRedis.password }}false{{ else }}true{{ end }}

    {{- else if and .Values.redisSecretInit.enabled -}}
    {{- /* Default case where Secret is generated by the Job with Helm pre-install hooks */ -}}
name: "argocd-redis" # hard-coded in Job command and embedded Redis deployments (standalone and redis-ha)
key: auth
optional: false # Secret is not optional in this case !

    {{- else -}}
    {{- /* All other use cases (e.g. disabled pre-install Job) */ -}}
name: "argocd-redis"
key: auth
optional: true
    {{- end -}}
{{- end -}}

{{/*
Return the target Kubernetes version
*/}}
{{- define "argo-cd.kubeVersion" -}}
  {{- default .Capabilities.KubeVersion.Version .Values.kubeVersionOverride }}
{{- end -}}

{{/*
Return the appropriate apiVersion for monitoring CRDs
*/}}
{{- define "argo-cd.apiVersions.monitoring" -}}
{{- if .Values.apiVersionOverrides.monitoring -}}
{{- print .Values.apiVersionOverrides.monitoring -}}
{{- else -}}
{{- print "monitoring.coreos.com/v1" -}}
{{- end -}}
{{- end -}}
