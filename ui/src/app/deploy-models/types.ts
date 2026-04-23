// TypeScript interfaces mirroring Pydantic schemas in app.py
// and ArgoCD Application types from the extensions API.

// ---------------------------------------------------------------------------
// ArgoCD types (minimal — only what we use from the extension props)
// ---------------------------------------------------------------------------

export interface ApplicationSource {
    repoURL: string;
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
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
}

export interface Application {
    metadata: ApplicationMetadata;
    spec: ApplicationSpec;
}

export interface ApplicationTree {
    nodes?: unknown[];
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

export interface ApplicationListResponse {
    items?: Application[];
}

export interface ProjectListResponse {
    items?: Project[];
}

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type GitOpsStatus = 'queued' | 'retrying' | 'committed' | 'noop' | 'failed' | 'cancelled';

export interface JobSummary {
    job_id: string;
    status: JobStatus;
    created_at: string;
    completed_at: string | null;
    triggered_by: string | null;
    app_name: string | null;
    gitops_status: GitOpsStatus | null;
    can_cancel: boolean | null;
}

export interface JobResult {
    job_id: string;
    status: JobStatus;
    created_at: string;
    completed_at: string | null;
    result: Record<string, unknown> | null;
    error: string | null;
    triggered_by: string | null;
    app_name: string | null;
    gitops_status: GitOpsStatus | null;
    can_cancel: boolean | null;
}

export interface JobAccepted {
    job_id: string;
    status: JobStatus;
    poll_url: string;
}

export interface JobListResponse {
    jobs: JobSummary[];
    total: number;
}

export interface AuditEvent {
    request_id: string;
    job_id: string | null;
    endpoint: string;
    event_type: string;
    triggered_by: string | null;
    created_at: string;
    payload: Record<string, unknown>;
}

export interface AuditTrailResponse {
    job_id: string;
    events: AuditEvent[];
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export type DeployMode = 'agg' | 'disagg';

export interface DeployFields {
    mode?: DeployMode;
    application_name?: string;
}

export interface DefaultRequest extends DeployFields {
    model_path: string;
    total_gpus: number;
    system?: string;
    instance_type?: string;
    // Advanced
    decode_system?: string;
    decode_instance_type?: string;
    backend?: string;
    backend_version?: string;
    database_mode?: string;
    isl?: number;
    osl?: number;
    ttft?: number;
    tpot?: number;
    request_latency?: number;
    prefix?: number;
    free_gpu_memory_fraction?: number;
    max_seq_len?: number;
    generator_set?: string[];
    generator_config?: string;
    generator_dynamo_version?: string;
    top_n?: number;
    save_dir?: string;
}

export interface ExpRequest extends DeployFields {
    yaml_path?: string;
    config?: Record<string, unknown>;
    top_n?: number;
    save_dir?: string;
}

export interface GenerateRequest extends DeployFields {
    model_path: string;
    total_gpus: number;
    system?: string;
    instance_type?: string;
    backend?: string;
    backend_version?: string;
    output_dir?: string;
}

export interface SupportRequest {
    model_path: string;
    system?: string;
    instance_type?: string;
    backend?: string;
    backend_version?: string;
}

export type EstimateMode = 'agg' | 'disagg';

export interface EstimateRequest {
    model_path: string;
    system?: string;
    instance_type?: string;
    estimate_mode?: EstimateMode;
    backend?: string;
    backend_version?: string;
    database_mode?: string;
    isl?: number;
    osl?: number;
    batch_size?: number;
    ctx_tokens?: number;
    tp_size?: number;
    pp_size?: number;
    attention_dp_size?: number;
    moe_tp_size?: number;
    moe_ep_size?: number;
    gemm_quant_mode?: string;
    kvcache_quant_mode?: string;
    fmha_quant_mode?: string;
    moe_quant_mode?: string;
    comm_quant_mode?: string;
    decode_system?: string;
    decode_instance_type?: string;
    prefill_tp_size?: number;
    prefill_pp_size?: number;
    prefill_attention_dp_size?: number;
    prefill_moe_tp_size?: number;
    prefill_moe_ep_size?: number;
    prefill_batch_size?: number;
    prefill_num_workers?: number;
    decode_tp_size?: number;
    decode_pp_size?: number;
    decode_attention_dp_size?: number;
    decode_moe_tp_size?: number;
    decode_moe_ep_size?: number;
    decode_batch_size?: number;
    decode_num_workers?: number;
    free_gpu_memory_fraction?: number;
    max_seq_len?: number;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface SupportResponse {
    model_path: string;
    system: string;
    backend: string;
    agg_supported: boolean;
    disagg_supported: boolean;
    check_kind: string;
    exact_match: boolean;
    inferred_from_architecture: boolean;
    architecture: string | null;
    note: string;
}

export type PreflightSeverity = 'info' | 'warning' | 'error';
export type PreflightStatus = 'ready' | 'warning' | 'failed';

export interface PreflightMessage {
    severity: PreflightSeverity;
    code: string;
    message: string;
}

export interface DefaultPreflightResponse {
    status: PreflightStatus;
    can_run_anyway: boolean;
    mode: string | null;
    system: string;
    backend: string;
    database_mode: string;
    total_gpus: number;
    compatibility: SupportResponse | null;
    messages: PreflightMessage[];
    recommended_database_mode: string | null;
}

export interface EstimateResponse {
    model_path: string;
    system_name: string;
    decode_system: string | null;
    backend_name: string;
    backend_version: string;
    mode: string;
    ttft: number;
    tpot: number;
    request_latency: number;
    power_w: number;
    isl: number;
    osl: number;
    batch_size: number;
    ctx_tokens: number;
    tp_size: number;
    pp_size: number;
    tokens_per_second: number;
    tokens_per_second_per_gpu: number;
    tokens_per_second_per_user: number;
    seq_per_second: number;
    concurrency: number;
    num_total_gpus: number;
    kv_cache_warning: string | null;
    per_ops_data: unknown;
    raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ArgoCD application-page extension props
// ---------------------------------------------------------------------------

export interface AppViewExtensionComponentProps {
    application: Application;
    tree: ApplicationTree;
}

export interface TopBarActionMenuExtComponentProps {
    application: Application;
    tree: ApplicationTree;
    openFlyout: () => void;
}

export interface TopBarActionMenuExtFlyoutProps {
    application: Application;
    tree: ApplicationTree;
}
