/**
 * API client for clustra-ai-service.
 *
 * All requests go through the first-party Argo CD proxy path:
 *   /api/ai-service/<path>
 *
 * ArgoCD authenticates the browser request via cookie auth and expects
 * the page to declare the current Application + Project context.
 */

import {ApiError, formatErrorDetail} from './errors';
import type {
    Application,
    ApplicationListResponse,
    AuditTrailResponse,
    DefaultRequest,
    DeploymentListResponse,
    JobAccepted,
    JobListResponse,
    JobResult,
    Project,
    ProjectListResponse,
    UndeployResult
} from './types';

const BASE = '/api/ai-service';

export interface ProxyContext {
    // Repo-per-team flow is project-scoped: only the project is required. The
    // app fields are sent only for the legacy app-selected flow.
    applicationName?: string;
    applicationNamespace?: string;
    projectName: string;
}

let proxyContext: ProxyContext | null = null;
const REQUEST_ID_HEADER = 'X-Request-ID';
const TRACE_ID_HEADER = 'X-Trace-ID';

export function setArgoProxyContext(context: ProxyContext | null): void {
    proxyContext = context;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _buildApiError(resp: Response): Promise<ApiError> {
    let payload: Record<string, unknown> | null = null;
    try {
        payload = (await resp.json()) as Record<string, unknown>;
    } catch {
        payload = null;
    }

    const requestId = (typeof payload?.request_id === 'string' ? payload.request_id : null) || resp.headers.get(REQUEST_ID_HEADER);
    const traceId = (typeof payload?.trace_id === 'string' ? payload.trace_id : null) || resp.headers.get(TRACE_ID_HEADER);
    const detail = payload?.detail ?? payload?.message ?? payload?.error;
    const message = formatErrorDetail(detail, `HTTP ${resp.status}`);

    return new ApiError({
        message,
        status: resp.status,
        requestId,
        traceId
    });
}

async function _request<T>(method: string, path: string, body?: unknown, contextOverride?: ProxyContext): Promise<T> {
    const headers: Record<string, string> = body !== undefined ? {'Content-Type': 'application/json'} : {};
    const context = contextOverride ?? proxyContext;
    if (!context?.projectName) {
        throw new Error('Missing Argo CD project context for extension request.');
    }

    // Legacy app-selected flow sends the Application header; the repo-per-team
    // flow is project-scoped (project only) and the proxy signs it without an app.
    if (context.applicationName && context.applicationNamespace) {
        headers['Argocd-Application-Name'] = `${context.applicationNamespace}:${context.applicationName}`;
    }
    headers['Argocd-Project-Name'] = context.projectName;

    const resp = await fetch(`${BASE}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (!resp.ok) {
        throw await _buildApiError(resp);
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
        throw await _buildApiError(resp);
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

export function listJobs(params: {status?: string; appName?: string; limit?: number; offset?: number}, context?: ProxyContext): Promise<JobListResponse> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.appName) qs.set('app_name', params.appName);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return _request('GET', `/jobs${query ? `?${query}` : ''}`, undefined, context);
}

export function getJobAudit(jobId: string): Promise<AuditTrailResponse> {
    return _request('GET', `/jobs/${jobId}/audit`);
}

// ---------------------------------------------------------------------------
// Deployment management
//
// The clustra pages proxy surfaces /api/v1/deployments as a GLOBAL (owner-
// scoped) path, so these calls need no Argo CD application context — the proxy
// injects the caller identity and the service filters to the user's own
// deployments. That lets the Model Deployments page list every deployment
// without first pinning an application. Deletion is GitOps-only: it removes the
// manifests from Git and Argo CD prunes the live resources (no direct k8s
// delete); the DELETE runs the git removal synchronously and can take ~2 min.
// ---------------------------------------------------------------------------

// Request helper for globally-scoped (no app context) endpoints. The session
// cookie authenticates; the proxy adds the user identity.
async function _globalRequest<T>(method: string, path: string): Promise<T> {
    const resp = await fetch(`${BASE}${path}`, {method, credentials: 'same-origin'});
    if (!resp.ok) {
        throw await _buildApiError(resp);
    }
    return resp.json() as Promise<T>;
}

export function listDeployments(
    params: {appName?: string; jobId?: string; status?: string; includeRemoved?: boolean; limit?: number; offset?: number} = {}
): Promise<DeploymentListResponse> {
    const qs = new URLSearchParams();
    if (params.jobId) qs.set('job_id', params.jobId);
    if (params.appName) qs.set('app_name', params.appName);
    if (params.status) qs.set('status', params.status);
    if (params.includeRemoved) qs.set('include_removed', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return _globalRequest('GET', `/api/v1/deployments${query ? `?${query}` : ''}`);
}

export function deleteDeployment(deploymentId: string): Promise<UndeployResult> {
    return _globalRequest('DELETE', `/api/v1/deployments/${encodeURIComponent(deploymentId)}`);
}
