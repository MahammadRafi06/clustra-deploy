export type ModelStatus = 'available' | 'downloading' | 'download_failed' | 'soft_deleted' | 'hard_deleting' | 'purged' | 'integrity_error';

export type JobKind = 'download' | 'hard_delete' | 'integrity_check' | 'rescan';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ApplicationSource {
    repoURL?: string;
    targetRevision?: string;
    path?: string;
}

export interface ApplicationSpec {
    project?: string;
    source?: ApplicationSource;
    sources?: ApplicationSource[];
}

export interface ApplicationMetadata {
    name: string;
    namespace?: string;
}

export interface Application {
    metadata: ApplicationMetadata;
    spec: ApplicationSpec;
}

export interface ApplicationListResponse {
    items?: Application[];
}

export interface ProjectMetadata {
    name: string;
    namespace?: string;
}

export interface ProjectSpec {
    description?: string;
}

export interface Project {
    metadata: ProjectMetadata;
    spec?: ProjectSpec;
}

export interface ProjectListResponse {
    items?: Project[];
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ModelSummary {
    id: string;
    repo_id: string;
    source: string;
    revision: string;
    display_name: string | null;
    status: ModelStatus;
    total_size_bytes: number | null;
    file_count: number | null;
    format: string | null;
    task_type: string | null;
    is_complete: boolean;
    labels: Record<string, string>;
    pinned: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    last_used_at: string | null;
    update_available: boolean;
    model_kind: string | null;
    base_model: string | null;
    duplicate_count: number;
}

export interface RelatedModel {
    id: string;
    repo_id: string;
    revision: string;
    model_kind: string | null;
    status: string;
    relationship: 'duplicate' | 'base' | 'adapter' | 'sibling';
}

export interface ModelDetail extends ModelSummary {
    sha256: string | null;
    disk_path: string | null;
    last_scanned_at: string | null;
    deleted_at: string | null;
    upstream_sha256: string | null;
    upstream_checked_at: string | null;
}

export interface JobSummary {
    id: string;
    model_id: string | null;
    kind: JobKind;
    status: JobStatus;
    k8s_job_name: string | null;
    parameters: Record<string, unknown>;
    result_message: string | null;
    created_by: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
}

export interface JobDetail extends JobSummary {
    log_tail: string | null;
    retries: number;
    max_retries: number;
    k8s_namespace: string;
    target_node: string | null;
}

export interface NodeInfo {
    node_name: string;
    agent_version: string;
    scan_duration_ms: number | null;
    models_found: number;
    disk_total_bytes: number | null;
    disk_used_bytes: number | null;
    disk_free_bytes: number | null;
    error_message: string | null;
    last_heartbeat: string;
    is_healthy: boolean;
}

export interface AuditLogEntry {
    id: number;
    action: string;
    actor: string;
    model_id: string | null;
    job_id: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
}

export interface SystemHealth {
    db_connected: boolean;
    k8s_connected: boolean;
    airgapped: boolean;
    total_models: number;
    models_by_status: Record<string, number>;
    active_jobs: number;
    nodes_total: number;
    nodes_healthy: number;
    nodes_stale: number;
    models_total_size_bytes: number;
    storage_total_bytes: number;
    storage_used_bytes: number;
    storage_free_bytes: number;
    storage_pressure: 'ok' | 'warning' | 'critical' | 'emergency';
    storage_usage_percent: number;
    default_pvc_name: string;
    default_namespace: string;
}

export interface PresetSummary {
    id: string;
    name: string;
    description: string | null;
    auto_apply: boolean;
    model_count: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface PresetModelEntry {
    id: string;
    repo_id: string;
    source: string;
    revision: string;
}

export interface PresetDetail extends PresetSummary {
    models: PresetModelEntry[];
}

export interface PresetCreate {
    name: string;
    description?: string;
    auto_apply?: boolean;
    models?: {repo_id: string; source?: string; revision?: string}[];
}

export interface PresetApplyResult {
    triggered: string[];
    skipped: {repo_id: string; reason: string}[];
    failed: {repo_id: string; reason: string}[];
}

export interface DownloadRequest {
    repo_id: string;
    source?: string;
    revision?: string;
    target_pvc?: string;
    target_namespace?: string;
    labels?: Record<string, string>;
    display_name?: string;
}

export interface BulkActionRequest {
    model_ids: string[];
    action: 'soft_delete' | 'hard_delete' | 'label' | 'pin' | 'unpin';
    labels?: Record<string, string>;
}
