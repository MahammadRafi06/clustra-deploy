import type {GitOpsStatus, JobResult, JobStatus, JobSummary} from './types';

type RunLike = Pick<JobSummary, 'status' | 'gitops_status'> | Pick<JobResult, 'status' | 'gitops_status' | 'result'>;
type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'muted';

const TERMINAL_JOB_STATUSES = new Set<JobStatus>(['success', 'failed', 'cancelled']);
const PENDING_GITOPS_STATUSES = new Set<GitOpsStatus>(['queued', 'retrying']);

export function getGitOpsStatus(job: RunLike | null): GitOpsStatus | null {
    if (!job) {
        return null;
    }
    if (job.gitops_status) {
        return job.gitops_status;
    }
    const resultStatus = 'result' in job ? job.result?.gitops_status : null;
    return typeof resultStatus === 'string' ? (resultStatus as GitOpsStatus) : null;
}

export function isJobSettled(job: JobResult | null): boolean {
    if (!job) {
        return false;
    }
    return TERMINAL_JOB_STATUSES.has(job.status) && !PENDING_GITOPS_STATUSES.has(getGitOpsStatus(job) as GitOpsStatus);
}

export function getRunStatusDescriptor(job: RunLike | null): {label: string; tone: StatusTone} {
    if (!job) {
        return {label: 'Unknown', tone: 'muted'};
    }

    if (job.status === 'failed') {
        return {label: 'Failed', tone: 'error'};
    }
    if (job.status === 'cancelled') {
        return {label: 'Cancelled', tone: 'warning'};
    }

    switch (getGitOpsStatus(job)) {
        case 'queued':
            return {label: 'Commit queued', tone: 'warning'};
        case 'retrying':
            return {label: 'Retrying commit', tone: 'info'};
        case 'failed':
            return {label: 'Commit failed', tone: 'error'};
        case 'committed':
            return {label: 'Committed', tone: 'success'};
        case 'noop':
            return {label: 'No repo changes', tone: 'muted'};
    }

    switch (job.status) {
        case 'pending':
            return {label: 'Queued', tone: 'info'};
        case 'running':
            return {label: 'Running', tone: 'info'};
        default:
            return {label: 'Completed', tone: 'success'};
    }
}

export function getStatusToneClass(tone: StatusTone): string {
    switch (tone) {
        case 'success':
            return 'deploy-models__status-pill--success';
        case 'warning':
            return 'deploy-models__status-pill--warning';
        case 'error':
            return 'deploy-models__status-pill--error';
        case 'muted':
            return 'deploy-models__status-pill--muted';
        default:
            return 'deploy-models__status-pill--info';
    }
}

export function getJobStatusCopy(job: JobResult): string {
    if (getGitOpsStatus(job) === 'failed') {
        return 'Artifacts were generated, but the repo commit failed after repeated retries.';
    }
    if (job.status === 'failed') {
        return 'This run failed before the deployment workflow completed.';
    }
    if (job.status === 'cancelled') {
        return 'This run was cancelled before the deployment workflow completed.';
    }

    switch (getGitOpsStatus(job)) {
        case 'queued':
            return 'Artifacts are ready. The repo commit is queued for retry.';
        case 'retrying':
            return 'Artifacts are ready. The repo commit is retrying in the background.';
        case 'committed':
            return 'Artifacts were generated and committed to the target repo.';
        case 'noop':
            return 'Artifacts were generated. The target repo was already up to date.';
        default:
            break;
    }

    switch (job.status) {
        case 'pending':
            return 'This run is queued and waiting for execution.';
        case 'running':
            return 'This run is generating artifacts and evaluating deployment options.';
        default:
            return 'This run completed successfully.';
    }
}
