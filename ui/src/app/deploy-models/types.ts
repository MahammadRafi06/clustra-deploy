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

export interface DeployFields {
    application_name?: string;
    public_model_name?: string;
}

export interface DefaultPolicySelection {
    workload?: string[];
    infrastructure: string[];
    serving: string[];
    [policyType: string]: string[] | undefined;
}

export interface DefaultRequest extends DeployFields {
    model_path: string;
    total_gpus: number;
    policies: DefaultPolicySelection;
    runtime_config_policy_id: string;
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
