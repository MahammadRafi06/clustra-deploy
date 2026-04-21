/**
 * API client for clustra-ai-service.
 *
 * All requests go through the first-party Argo CD proxy path:
 *   /api/ai-service/<path>
 *
 * ArgoCD authenticates the browser request via cookie auth and expects
 * the page to declare the current Application + Project context.
 */

import type {
    Application,
    ApplicationListResponse,
    DefaultRequest,
    DefaultPreflightResponse,
    EstimateRequest,
    EstimateResponse,
    ExpRequest,
    GenerateRequest,
    JobAccepted,
    JobListResponse,
    JobResult,
    Project,
    ProjectListResponse,
    SupportRequest,
    SupportResponse
} from './types';

const BASE = '/api/ai-service';

interface ProxyContext {
    applicationName: string;
    applicationNamespace: string;
    projectName: string;
}

let proxyContext: ProxyContext | null = null;

export function setArgoProxyContext(context: ProxyContext | null): void {
    proxyContext = context;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = body !== undefined ? {'Content-Type': 'application/json'} : {};
    if (proxyContext?.applicationName && proxyContext?.applicationNamespace && proxyContext?.projectName) {
        headers['Argocd-Application-Name'] = `${proxyContext.applicationNamespace}:${proxyContext.applicationName}`;
        headers['Argocd-Project-Name'] = proxyContext.projectName;
    } else if (typeof window !== 'undefined' && typeof (window as {extensionsAPI?: unknown}).extensionsAPI !== 'undefined') {
        throw new Error('Missing Argo CD application context for extension request.');
    }

    const resp = await fetch(`${BASE}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
            const err = await resp.json();
            detail = err.detail ?? err.message ?? detail;
        } catch {
            // ignore parse errors
        }
        throw new Error(detail);
    }

    return resp.json() as Promise<T>;
}

async function _argoRequest<T>(path: string, params?: Record<string, string | string[] | undefined>): Promise<T> {
    const search = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(item => search.append(key, item));
            return;
        }
        if (value) {
            search.set(key, value);
        }
    });

    const resp = await fetch(`${path}${search.toString() ? `?${search.toString()}` : ''}`, {
        method: 'GET',
        credentials: 'same-origin'
    });

    if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
            const err = await resp.json();
            detail = err.error ?? err.message ?? err.detail ?? detail;
        } catch {
            // ignore parse errors
        }
        throw new Error(detail);
    }

    return resp.json() as Promise<T>;
}

function _stripUndefined(obj: unknown): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

// ---------------------------------------------------------------------------
// Async job endpoints
// ---------------------------------------------------------------------------

export function submitDefault(req: DefaultRequest): Promise<JobAccepted> {
    return _request('POST', '/api/v1/default', _stripUndefined(req));
}

export function submitDefaultPreflight(req: DefaultRequest): Promise<DefaultPreflightResponse> {
    return _request('POST', '/api/v1/default/preflight', _stripUndefined(req));
}

export function submitExp(req: ExpRequest): Promise<JobAccepted> {
    return _request('POST', '/api/v1/exp', _stripUndefined(req));
}

export function submitGenerate(req: GenerateRequest): Promise<JobAccepted> {
    return _request('POST', '/api/v1/generate', _stripUndefined(req));
}

// ---------------------------------------------------------------------------
// Sync endpoints
// ---------------------------------------------------------------------------

export function submitSupport(req: SupportRequest): Promise<SupportResponse> {
    return _request('POST', '/api/v1/support', _stripUndefined(req));
}

export function submitEstimate(req: EstimateRequest): Promise<EstimateResponse> {
    return _request('POST', '/api/v1/estimate', _stripUndefined(req));
}

// ---------------------------------------------------------------------------
// Argo CD context discovery for the system-level sidebar extension
// ---------------------------------------------------------------------------

export async function listArgoProjects(): Promise<Project[]> {
    const resp = await _argoRequest<ProjectListResponse>('/api/v1/projects');
    return (resp.items ?? []).slice().sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
}

export async function listArgoApplications(projectName?: string): Promise<Application[]> {
    const resp = await _argoRequest<ApplicationListResponse>('/api/v1/applications', {
        ...(projectName ? {projects: [projectName]} : {})
    });
    return (resp.items ?? []).slice().sort((left, right) => {
        const leftKey = `${left.metadata.namespace ?? ''}/${left.metadata.name}`;
        const rightKey = `${right.metadata.namespace ?? ''}/${right.metadata.name}`;
        return leftKey.localeCompare(rightKey);
    });
}

// ---------------------------------------------------------------------------
// Job management
// ---------------------------------------------------------------------------

export function getJob(jobId: string): Promise<JobResult> {
    return _request('GET', `/jobs/${jobId}`);
}

export function cancelJob(jobId: string): Promise<JobResult> {
    return _request('DELETE', `/jobs/${jobId}`);
}

export function listJobs(params: {status?: string; limit?: number; offset?: number}): Promise<JobListResponse> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return _request('GET', `/jobs${query ? `?${query}` : ''}`);
}
