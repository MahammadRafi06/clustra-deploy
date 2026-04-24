import React from 'react';

import {Spinner} from '../../shared/components';

import {formatPollRecoveryMessage, type PollRecoveryState} from '../polling';
import {getRunStatusDescriptor, getStatusToneClass} from '../jobState';
import type {AuditTrailResponse, JobResult} from '../types';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

interface JobResultViewProps {
    job: JobResult;
    audit: AuditTrailResponse | null;
    auditError: unknown | null;
    auditLoading: boolean;
    auditRecovery: PollRecoveryState;
    onRetryAudit: () => void;
}

function renderValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    return String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function formatTimestamp(value: string): string {
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });
}

function eventLabel(eventType: string): string {
    switch (eventType) {
        case 'request_accepted':
            return 'Run accepted';
        case 'job_started':
            return 'Execution started';
        case 'artifacts_generated':
            return 'Artifacts generated';
        case 'job_waiting_for_gitops':
            return 'Waiting on repo commit';
        case 'gitops_commit_completed':
            return 'Repo commit completed';
        case 'gitops_commit_queued':
            return 'Repo commit queued';
        case 'gitops_retry_started':
            return 'Retry started';
        case 'gitops_retry_completed':
            return 'Retry completed';
        case 'gitops_retry_released':
            return 'Retry deferred';
        case 'gitops_retry_failed':
            return 'Retry failed';
        case 'job_succeeded':
            return 'Run succeeded';
        case 'job_failed':
            return 'Run failed';
        case 'job_cancelled':
            return 'Run cancelled';
        default:
            return eventType.replace(/_/g, ' ');
    }
}

function MetricGrid({items}: {items: Array<{label: string; value: string | number}>}) {
    return (
        <div className='deploy-models__metric-grid'>
            {items.map(({label, value}) => (
                <div key={label} className='deploy-models__metric'>
                    <div className='deploy-models__metric-label'>{label}</div>
                    <div className='deploy-models__metric-value'>{value}</div>
                </div>
            ))}
        </div>
    );
}

function DetailGrid({items}: {items: Array<{label: string; value: string}>}) {
    return (
        <div className='deploy-models__detail-grid'>
            {items.map(({label, value}) => (
                <div key={label} className='deploy-models__detail-item'>
                    <div className='deploy-models__metric-label'>{label}</div>
                    <div className='deploy-models__detail-value'>{value}</div>
                </div>
            ))}
        </div>
    );
}

export function JobResultView({job, audit, auditError, auditLoading, auditRecovery, onRetryAudit}: JobResultViewProps) {
    const {result, error} = job;

    if (error) {
        return (
            <div className='deploy-models__result'>
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Error</div>
                    <pre className='deploy-models__result-error'>{error}</pre>
                </div>
            </div>
        );
    }

    if (!result) {
        return null;
    }

    const chosen = result.chosen_exp as string | undefined;
    const throughputs = result.best_throughputs as Record<string, number> | undefined;
    const latencies = result.best_latencies as Record<string, Record<string, number>> | undefined;
    const auditPayload = asRecord(result.audit);
    const requestPayload = asRecord(auditPayload?.request);
    const gitopsPayload = asRecord(auditPayload?.gitops);
    const generatedFiles = asStringArray(auditPayload?.generated_files);
    const gitopsStatus = getRunStatusDescriptor(job);

    const runSummary = [
        {label: 'Model', value: renderValue(requestPayload?.model_path)},
        {label: 'GPUs', value: renderValue(requestPayload?.total_gpus)},
        {label: 'Mode', value: renderValue(requestPayload?.mode)},
        {label: 'Backend', value: renderValue(requestPayload?.backend)},
        {label: 'Database Mode', value: renderValue(requestPayload?.database_mode)},
        {label: 'Storage Root', value: renderValue(auditPayload?.storage_root)}
    ].filter(item => item.value !== '—');

    const gitopsSummary = [
        {label: 'Repo URL', value: renderValue(gitopsPayload?.repo_url)},
        {label: 'Branch', value: renderValue(gitopsPayload?.branch)},
        {label: 'Target Path', value: renderValue(gitopsPayload?.repo_target_subdir ?? result.git_repo_target_subdir)},
        {label: 'Artifact', value: renderValue(gitopsPayload?.repo_artifact_name ?? result.git_repo_artifact_name)},
        {label: 'Source Manifest', value: renderValue(gitopsPayload?.source_manifest)}
    ].filter(item => item.value !== '—');

    return (
        <div className='deploy-models__result'>
            {chosen && (
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Recommendation</div>
                    <div className='deploy-models__result-inline'>
                        <span className='deploy-models__status-pill deploy-models__status-pill--success'>{chosen.toUpperCase()}</span>
                        <span className='deploy-models__secondary-text'>selected deployment mode</span>
                    </div>
                </div>
            )}

            {throughputs && Object.keys(throughputs).length > 0 && (
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Best Throughput</div>
                    <MetricGrid
                        items={Object.entries(throughputs).map(([mode, value]) => ({
                            label: `${mode.toUpperCase()} tokens/s`,
                            value: typeof value === 'number' ? value.toFixed(1) : '—'
                        }))}
                    />
                </div>
            )}

            {latencies && Object.keys(latencies).length > 0 && (
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Best Latency</div>
                    <MetricGrid
                        items={Object.entries(latencies).flatMap(([mode, metrics]) =>
                            Object.entries(metrics || {}).map(([metric, value]) => ({
                                label: `${mode.toUpperCase()} ${metric.toUpperCase()}`,
                                value: renderValue(value)
                            }))
                        )}
                    />
                </div>
            )}

            {runSummary.length > 0 && (
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Run Summary</div>
                    <DetailGrid items={runSummary} />
                </div>
            )}

            <div className='deploy-models__result-section'>
                <div className='deploy-models__result-header'>
                    <div>
                        <div className='deploy-models__result-title'>GitOps Status</div>
                        <div className='deploy-models__secondary-text'>{renderValue(result.git_commit_message)}</div>
                    </div>
                    <span className={`deploy-models__status-pill ${getStatusToneClass(gitopsStatus.tone)}`}>{gitopsStatus.label}</span>
                </div>
                {gitopsSummary.length > 0 && <DetailGrid items={gitopsSummary} />}
            </div>

            {generatedFiles.length > 0 && (
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Generated Files</div>
                    <div className='deploy-models__file-list'>
                        {generatedFiles.map(file => (
                            <code key={file} className='deploy-models__file-chip'>
                                {file}
                            </code>
                        ))}
                    </div>
                </div>
            )}

            <div className='deploy-models__result-section'>
                <div className='deploy-models__result-title'>Activity</div>
                {auditLoading && (
                    <div className='deploy-models__status-copy deploy-models__status-copy--inline'>
                        <span className='deploy-models__status-spinner'>
                            <Spinner show={true} />
                        </span>
                        <div className='deploy-models__muted-text'>Loading audit trail…</div>
                    </div>
                )}
                {(auditRecovery.reconnecting || auditRecovery.exhausted) && (
                    <NoticeAlert
                        variant='warning'
                        message={formatPollRecoveryMessage('Audit updates are delayed', auditRecovery)}
                        actionLabel={auditRecovery.exhausted ? 'Retry now' : undefined}
                        onAction={auditRecovery.exhausted ? onRetryAudit : undefined}
                    />
                )}
                {!auditRecovery.reconnecting && !auditRecovery.exhausted && auditError && <ErrorAlert error={auditError} prefix='Unable to load audit trail' />}
                {!auditLoading && !auditError && (!audit || audit.events.length === 0) && <div className='deploy-models__muted-text'>No audit events recorded yet.</div>}
                {audit && audit.events.length > 0 && (
                    <div className='deploy-models__timeline' role='log' aria-live='polite' aria-busy={auditLoading}>
                        {audit.events.map(event => (
                            <div key={`${event.created_at}-${event.event_type}`} className='deploy-models__timeline-item'>
                                <div className='deploy-models__timeline-header'>
                                    <span className='deploy-models__timeline-title'>{eventLabel(event.event_type)}</span>
                                    <span className='deploy-models__muted-text'>{formatTimestamp(event.created_at)}</span>
                                </div>
                                {typeof event.payload.error === 'string' && <div className='deploy-models__timeline-detail'>{event.payload.error}</div>}
                                {!event.payload.error && (
                                    <div className='deploy-models__timeline-detail'>
                                        {renderValue(event.payload.application_name ?? event.payload.storage_root ?? event.payload.status ?? 'Recorded')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
