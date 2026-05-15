import {ApiError, formatErrorDetail} from '../../deploy-models/errors';
import type {
    AuditEventListResponse,
    FeaturePolicyListResponse,
    FeaturePolicyRecord,
    ListAuditEventsParams,
    ListFeaturePoliciesParams,
    ListPoliciesParams,
    ListPolicyTypesParams,
    ListRuntimeConfigCatalogConceptsParams,
    ListRuntimeConfigCatalogItemsParams,
    ListRuntimeConfigCatalogsParams,
    ListRuntimeConfigPoliciesParams,
    PolicyApiClient,
    PolicyListResponse,
    PolicyRecord,
    PolicyTypeListResponse,
    PolicyTypeRecord,
    RuntimeConfigCatalogConceptListResponse,
    RuntimeConfigCatalogImportRequest,
    RuntimeConfigCatalogItemListResponse,
    RuntimeConfigCatalogListResponse,
    RuntimeConfigCatalogRecord,
    RuntimeConfigPolicyExport,
    RuntimeConfigPolicyListResponse,
    RuntimeConfigPolicyMigrationResponse,
    RuntimeConfigPolicyRecord,
    RuntimeConfigRoleSchemaListResponse,
    RuntimeConfigRoleSchemaRecord
} from './types';

const BASE_URL = '/api/ai-service';
const REQUEST_ID_HEADER = 'X-Request-ID';
const TRACE_ID_HEADER = 'X-Trace-ID';

function appendQuery(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const qs = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
            qs.set(key, String(value));
        }
    });
    const query = qs.toString();
    return query ? `${path}?${query}` : path;
}

async function buildApiError(resp: Response): Promise<ApiError> {
    let payload: Record<string, unknown> | null = null;
    try {
        payload = (await resp.json()) as Record<string, unknown>;
    } catch {
        payload = null;
    }

    const requestId = (typeof payload?.request_id === 'string' ? payload.request_id : null) || resp.headers.get(REQUEST_ID_HEADER);
    const traceId = (typeof payload?.trace_id === 'string' ? payload.trace_id : null) || resp.headers.get(TRACE_ID_HEADER);
    const detail = payload?.detail ?? payload?.message ?? payload?.error;
    // RFC 7807 extension fields surfaced by the service for structured handling.
    const code = typeof payload?.code === 'string' ? payload.code : null;
    const fieldPath = typeof payload?.field_path === 'string' ? payload.field_path : null;
    const statusLabel: Record<number, string> = {
        401: 'Unauthorized',
        403: 'Forbidden',
        409: 'Conflict',
        422: 'Validation error'
    };
    const fallback = statusLabel[resp.status] ? `${resp.status} ${statusLabel[resp.status]}` : `HTTP ${resp.status}`;

    return new ApiError({
        message: formatErrorDetail(detail, fallback),
        status: resp.status,
        requestId,
        traceId,
        code,
        fieldPath
    });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = body !== undefined ? {'Content-Type': 'application/json'} : {};
    const resp = await fetch(`${BASE_URL}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (!resp.ok) {
        throw await buildApiError(resp);
    }

    if (resp.status === 204) {
        return undefined as T;
    }

    const contentType = resp.headers.get('content-type') || '';
    if (contentType && !contentType.includes('application/json')) {
        return undefined as T;
    }

    return resp.json() as Promise<T>;
}

export function listPolicyTypes(params: ListPolicyTypesParams = {}) {
    return request<PolicyTypeListResponse>('GET', appendQuery('/api/v1/policy-types', {active: params.active, limit: params.limit, offset: params.offset}));
}

export function getPolicyType(policyType: string) {
    return request<PolicyTypeRecord>('GET', `/api/v1/policy-types/${encodeURIComponent(policyType)}`);
}

export function listPolicies(params: ListPoliciesParams = {}) {
    return request<PolicyListResponse>(
        'GET',
        appendQuery('/api/v1/policies', {
            type: params.type,
            active: params.active,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export function getPolicy(policyId: string) {
    return request<PolicyRecord>('GET', `/api/v1/policies/${encodeURIComponent(policyId)}`);
}

export function createPolicy(document: Record<string, unknown>) {
    return request<PolicyRecord>('POST', '/api/v1/policies', document);
}

export function updatePolicy(policyId: string, document: Record<string, unknown>) {
    return request<PolicyRecord>('PUT', `/api/v1/policies/${encodeURIComponent(policyId)}`, document);
}

export function deletePolicy(policyId: string) {
    return request<void>('DELETE', `/api/v1/policies/${encodeURIComponent(policyId)}`);
}

export function listFeaturePolicies(params: ListFeaturePoliciesParams = {}) {
    return request<FeaturePolicyListResponse>(
        'GET',
        appendQuery('/api/v1/feature-policies', {
            backend: params.backend,
            active: params.active,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export function getFeaturePolicy(policyId: string) {
    return request<FeaturePolicyRecord>('GET', `/api/v1/feature-policies/${encodeURIComponent(policyId)}`);
}

export function createFeaturePolicy(document: Record<string, unknown>) {
    return request<FeaturePolicyRecord>('POST', '/api/v1/feature-policies', document);
}

export function updateFeaturePolicy(policyId: string, document: Record<string, unknown>) {
    return request<FeaturePolicyRecord>('PUT', `/api/v1/feature-policies/${encodeURIComponent(policyId)}`, document);
}

export function deleteFeaturePolicy(policyId: string) {
    return request<void>('DELETE', `/api/v1/feature-policies/${encodeURIComponent(policyId)}`);
}

export function listRuntimeConfigPolicies(params: ListRuntimeConfigPoliciesParams = {}) {
    return request<RuntimeConfigPolicyListResponse>(
        'GET',
        appendQuery('/api/v1/runtime-config-policies', {
            engine: params.engine,
            dynamo_version: params.dynamo_version,
            deployment_type: params.deployment_type,
            active: params.active,
            has_drift: params.has_drift,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export function getRuntimeConfigPolicy(policyId: string) {
    return request<RuntimeConfigPolicyRecord>('GET', `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}`);
}

export function createRuntimeConfigPolicy(document: Record<string, unknown>) {
    return request<RuntimeConfigPolicyRecord>('POST', '/api/v1/runtime-config-policies', document);
}

export function updateRuntimeConfigPolicy(policyId: string, document: Record<string, unknown>) {
    return request<RuntimeConfigPolicyRecord>('PUT', `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}`, document);
}

export function deleteRuntimeConfigPolicy(policyId: string) {
    return request<void>('DELETE', `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}`);
}

export function exportRuntimeConfigPolicy(policyId: string) {
    return request<RuntimeConfigPolicyExport>('GET', `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}/export`);
}

export function resolveRuntimeConfigPolicy(policyId: string) {
    return request<RuntimeConfigPolicyExport>('GET', `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}/resolve`);
}

export function listRuntimeConfigRoleSchemas(params: {active?: boolean; limit?: number; offset?: number} = {}) {
    return request<RuntimeConfigRoleSchemaListResponse>(
        'GET',
        appendQuery('/api/v1/runtime-config-role-schemas', {
            active: params.active,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export function getRuntimeConfigRoleSchema(deploymentType: 'agg' | 'disagg') {
    return request<RuntimeConfigRoleSchemaRecord>('GET', `/api/v1/runtime-config-role-schemas/${encodeURIComponent(deploymentType)}`);
}

export function updateRuntimeConfigRoleSchema(deploymentType: 'agg' | 'disagg', schema: Record<string, unknown>) {
    return request<RuntimeConfigRoleSchemaRecord>('PUT', `/api/v1/runtime-config-role-schemas/${encodeURIComponent(deploymentType)}`, schema);
}

export function listRuntimeConfigCatalogs(params: ListRuntimeConfigCatalogsParams = {}) {
    return request<RuntimeConfigCatalogListResponse>(
        'GET',
        appendQuery('/api/v1/runtime-config-catalogs', {
            engine: params.engine,
            dynamo_version: params.dynamo_version,
            kind: params.kind,
            active: params.active,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export function deleteRuntimeConfigCatalog(catalogId: string) {
    return request<RuntimeConfigCatalogRecord>('DELETE', `/api/v1/runtime-config-catalogs/${encodeURIComponent(catalogId)}`);
}

export function listRuntimeConfigCatalogItems(params: ListRuntimeConfigCatalogItemsParams = {}) {
    return request<RuntimeConfigCatalogItemListResponse>(
        'GET',
        appendQuery('/api/v1/runtime-config-catalog-items', {
            engine: params.engine,
            version: params.version,
            engine_version: params.engine_version,
            dynamo_version: params.dynamo_version,
            kind: params.kind,
            deployment_type: params.deployment_type,
            role: params.role,
            ui: params.ui,
            q: params.q,
            concept: params.concept,
            active: params.active,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export function importRuntimeConfigCatalogs(payload: RuntimeConfigCatalogImportRequest) {
    return request<RuntimeConfigCatalogListResponse>('POST', '/api/v1/runtime-config-catalogs/import', payload);
}

export function listRuntimeConfigCatalogConcepts(params: ListRuntimeConfigCatalogConceptsParams = {}) {
    return request<RuntimeConfigCatalogConceptListResponse>(
        'GET',
        appendQuery('/api/v1/runtime-config-catalog-concepts', {
            engine: params.engine,
            kind: params.kind
        })
    );
}

export function patchRuntimeConfigPolicy(policyId: string, patch: Record<string, unknown>) {
    return request<RuntimeConfigPolicyRecord>('PATCH', `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}`, patch);
}

export function migrateRuntimeConfigPolicy(policyId: string, apply: boolean) {
    return request<RuntimeConfigPolicyMigrationResponse>(
        'POST',
        `/api/v1/runtime-config-policies/${encodeURIComponent(policyId)}/migrate`,
        {apply}
    );
}

export function listAuditEvents(params: ListAuditEventsParams = {}) {
    return request<AuditEventListResponse>(
        'GET',
        appendQuery('/audit-events', {
            request_id: params.request_id,
            job_id: params.job_id,
            endpoint: params.endpoint,
            event_type: params.event_type,
            triggered_by: params.triggered_by,
            policy_id: params.policy_id,
            since: params.since,
            until: params.until,
            limit: params.limit,
            offset: params.offset
        })
    );
}

export const policyApiClient: PolicyApiClient = {
    listPolicyTypes,
    getPolicyType,
    listPolicies,
    getPolicy,
    createPolicy,
    updatePolicy,
    deletePolicy,
    listFeaturePolicies,
    getFeaturePolicy,
    createFeaturePolicy,
    updateFeaturePolicy,
    deleteFeaturePolicy,
    listRuntimeConfigPolicies,
    getRuntimeConfigPolicy,
    createRuntimeConfigPolicy,
    updateRuntimeConfigPolicy,
    deleteRuntimeConfigPolicy,
    exportRuntimeConfigPolicy,
    resolveRuntimeConfigPolicy,
    listRuntimeConfigRoleSchemas,
    getRuntimeConfigRoleSchema,
    updateRuntimeConfigRoleSchema,
    listRuntimeConfigCatalogs,
    deleteRuntimeConfigCatalog,
    listRuntimeConfigCatalogItems,
    listRuntimeConfigCatalogConcepts,
    importRuntimeConfigCatalogs,
    patchRuntimeConfigPolicy,
    migrateRuntimeConfigPolicy,
    listAuditEvents
};
