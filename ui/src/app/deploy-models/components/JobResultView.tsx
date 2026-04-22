import React from 'react';

import type {JobResult} from '../types';

interface JobResultViewProps {
    job: JobResult;
}

function renderValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '—';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    return String(value);
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

function GitStatus({result}: {result: Record<string, unknown>}) {
    const committed = result.git_committed;
    if (committed === null || committed === undefined) {
        return null;
    }

    const label =
        committed === true
            ? 'Committed to repo'
            : typeof result.git_commit_error === 'string'
              ? 'Commit queued for retry'
              : (result.git_commit_message as string) || 'Nothing committed';

    const badgeClass =
        committed === true
            ? 'deploy-models__status-pill--success'
            : typeof result.git_commit_error === 'string'
              ? 'deploy-models__status-pill--warning'
              : 'deploy-models__status-pill--muted';

    return (
        <div className='deploy-models__git-row'>
            <i className='fa fa-code-fork' />
            <span className={`deploy-models__status-pill ${badgeClass}`}>{label}</span>
            {typeof result.git_repo_artifact_name === 'string' && <span className='deploy-models__muted-text'>{result.git_repo_artifact_name}</span>}
        </div>
    );
}

export function JobResultView({job}: JobResultViewProps) {
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
                    <div className='deploy-models__result-title'>Best Throughput (tokens/s)</div>
                    <MetricGrid
                        items={Object.entries(throughputs).map(([mode, value]) => ({
                            label: mode.toUpperCase(),
                            value: typeof value === 'number' ? value.toFixed(1) : '—'
                        }))}
                    />
                </div>
            )}

            {latencies && Object.keys(latencies).length > 0 && (
                <div className='deploy-models__result-section'>
                    <div className='deploy-models__result-title'>Best Latency (ms)</div>
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

            <div className='deploy-models__result-section'>
                <GitStatus result={result} />
            </div>
        </div>
    );
}
