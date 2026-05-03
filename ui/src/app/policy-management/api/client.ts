import {ApiError, formatErrorDetail} from '../../deploy-models/errors';
import type {
    FeaturePolicyListResponse,
    FeaturePolicyRecord,
    ListFeaturePoliciesParams,
    ListPoliciesParams,
    ListPolicyTypesParams,
    PolicyApiClient,
    PolicyListResponse,
    PolicyRecord,
    PolicyTypeListResponse,
    PolicyTypeRecord
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
        traceId
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
    deleteFeaturePolicy
};
