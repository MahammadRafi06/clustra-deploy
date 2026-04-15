import type {
  Application,
  ApplicationListResponse,
  BulkActionRequest,
  DownloadRequest,
  JobDetail,
  JobSummary,
  ModelDetail,
  ModelSummary,
  NodeInfo,
  AuditLogEntry,
  PaginatedResponse,
  PresetApplyResult,
  PresetCreate,
  PresetDetail,
  PresetSummary,
  Project,
  ProjectListResponse,
  RelatedModel,
  SystemHealth,
} from "./types";
const BASE_URL = "/api/model-cache/api/v1";

function buildHeaders(options?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (options?.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = buildHeaders(options);

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "same-origin",
    headers,
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(body.detail || `Request failed: ${resp.status}`);
  }

  return resp.json();
}

async function argoRequest<T>(
  path: string,
  params?: Record<string, string | string[] | undefined>,
): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => qs.append(key, item));
      return;
    }
    if (value) {
      qs.set(key, value);
    }
  });

  const resp = await fetch(`${path}${qs.toString() ? `?${qs.toString()}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(body.detail || body.message || `Request failed: ${resp.status}`);
  }

  return resp.json();
}

function buildJobLogsPath(id: string): string {
  return `${BASE_URL}/jobs/${id}/logs`;
}

type LogStreamHandlers = {
  onOpen?: () => void;
  onMessage: (line: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

function consumeSseChunk(chunk: string, handlers: LogStreamHandlers): boolean {
  const normalized = chunk.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return false;
  }

  let eventName = "message";
  const dataLines: string[] = [];

  normalized.split("\n").forEach((line) => {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  const payload = dataLines.join("\n");
  if (eventName === "done") {
    handlers.onDone?.();
    return true;
  }

  if (payload) {
    handlers.onMessage(payload);
  }
  return false;
}

export function streamJobLogs(id: string, handlers: LogStreamHandlers): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const resp = await fetch(buildJobLogsPath(id), {
        method: "GET",
        credentials: "same-origin",
        headers: buildHeaders(),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(body.detail || `Request failed: ${resp.status}`);
      }

      handlers.onOpen?.();

      if (!resp.body) {
        handlers.onDone?.();
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex >= 0) {
          const eventChunk = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          if (consumeSseChunk(eventChunk, handlers)) {
            return;
          }
          separatorIndex = buffer.indexOf("\n\n");
        }
      }

      if (buffer.trim()) {
        consumeSseChunk(buffer, handlers);
      }

      handlers.onDone?.();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      handlers.onError?.(error instanceof Error ? error.message : String(error));
    }
  })();

  return () => controller.abort();
}

export function listArgoProjects(): Promise<Project[]> {
  return argoRequest<ProjectListResponse>("/api/v1/projects").then((resp) =>
    (resp.items ?? [])
      .slice()
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name)),
  );
}

export function listArgoApplications(projectName?: string): Promise<Application[]> {
  return argoRequest<ApplicationListResponse>("/api/v1/applications", {
    ...(projectName ? { projects: [projectName] } : {}),
  }).then((resp) =>
    (resp.items ?? [])
      .slice()
      .sort((left, right) => {
        const leftKey = `${left.metadata.namespace ?? ""}/${left.metadata.name}`;
        const rightKey = `${right.metadata.namespace ?? ""}/${right.metadata.name}`;
        return leftKey.localeCompare(rightKey);
      }),
  );
}

// Models
export interface ModelListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  source?: string;
  sort_by?: string;
  sort_order?: string;
  pinned?: boolean;
  stale_days?: number;
}

export function listModels(params: ModelListParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  });
  return request<PaginatedResponse<ModelSummary>>(`/models?${qs}`);
}

export function getModel(id: string) {
  return request<ModelDetail>(`/models/${id}`);
}

export function downloadModel(req: DownloadRequest) {
  return request<JobSummary>("/models/download", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function softDeleteModel(id: string) {
  return request<ModelSummary>(`/models/${id}/soft-delete`, { method: "POST" });
}

export function hardDeleteModel(id: string) {
  return request<JobSummary>(`/models/${id}/hard-delete`, { method: "POST" });
}

export function restoreModel(id: string) {
  return request<ModelSummary>(`/models/${id}/restore`, { method: "POST" });
}

export function updateModel(id: string, data: { display_name?: string; labels?: Record<string, string>; pinned?: boolean }) {
  return request<ModelSummary>(`/models/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function integrityCheck(id: string) {
  return request<JobSummary>(`/models/${id}/integrity-check`, { method: "POST" });
}

export function touchModel(id: string) {
  return request<ModelSummary>(`/models/${id}/touch`, { method: "POST" });
}

export function checkModelVersion(id: string) {
  return request<ModelDetail>(`/models/${id}/check-version`, { method: "POST" });
}

export function getRelatedModels(id: string) {
  return request<RelatedModel[]>(`/models/${id}/related`);
}

export function bulkAction(req: BulkActionRequest) {
  return request<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> }>("/models/bulk-action", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Jobs
export function listJobs(params: { page?: number; page_size?: number; kind?: string; status?: string; model_id?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  });
  return request<PaginatedResponse<JobSummary>>(`/jobs?${qs}`);
}

export function getJob(id: string) {
  return request<JobDetail>(`/jobs/${id}`);
}

export function cancelJob(id: string) {
  return request<JobSummary>(`/jobs/${id}/cancel`, { method: "POST" });
}

export function retryJob(id: string) {
  return request<JobSummary>(`/jobs/${id}/retry`, { method: "POST" });
}

// Nodes
export function listNodes() {
  return request<NodeInfo[]>("/nodes");
}

export function getNode(name: string) {
  return request<NodeInfo>(`/nodes/${name}`);
}

export function rescanNode(name: string) {
  return request<{ message: string }>(`/nodes/${name}/rescan`, { method: "POST" });
}

export function rescanAll() {
  return request<{ triggered: string[]; failed: Array<{ pod: string; reason: string }> }>("/nodes/rescan", { method: "POST" });
}

// Audit
export function listAuditLogs(params: { page?: number; page_size?: number; actor?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  });
  return request<PaginatedResponse<AuditLogEntry>>(`/audit?${qs}`);
}

export function modelAuditTrail(modelId: string, params: { page?: number } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  });
  return request<PaginatedResponse<AuditLogEntry>>(`/audit/model/${modelId}?${qs}`);
}

// Health
export function getSystemHealth() {
  return request<SystemHealth>("/health/status");
}

// Presets
export function listPresets() {
  return request<PresetSummary[]>("/presets");
}

export function getPreset(id: string) {
  return request<PresetDetail>(`/presets/${id}`);
}

export function createPreset(req: PresetCreate) {
  return request<PresetSummary>("/presets", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function deletePreset(id: string) {
  return request<void>(`/presets/${id}`, { method: "DELETE" });
}

export function applyPreset(id: string) {
  return request<PresetApplyResult>(`/presets/${id}/apply`, { method: "POST" });
}
