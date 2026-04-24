import React, {useCallback, useEffect, useRef, useState} from 'react';

import {listJobs} from '../api';
import {getRunStatusDescriptor, getStatusToneClass} from '../jobState';
import {useAppContext} from './AppContext';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';
import {IDLE_POLL_RECOVERY, POLLING_CONFIG, buildPollRecoveryState, formatPollRecoveryMessage, type PollRecoveryState} from '../polling';
import type {JobSummary} from '../types';

interface RecentRunsPanelProps {
    selectedJobId: string | null;
    onSelectJob: (jobId: string) => void;
}

function formatTimestamp(value: string): string {
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function RecentRunsPanel({selectedJobId, onSelectJob}: RecentRunsPanelProps) {
    const {appName} = useAppContext();
    const [jobs, setJobs] = useState<JobSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown | null>(null);
    const [pollRecovery, setPollRecovery] = useState<PollRecoveryState>(IDLE_POLL_RECOVERY);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const failureCountRef = useRef(0);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const load = useCallback(
        async (silent = false) => {
            if (!silent) {
                setLoading(true);
            }
            try {
                const response = await listJobs({appName, limit: 8});
                setJobs(response.jobs);
                setError(null);
                failureCountRef.current = 0;
                setPollRecovery(IDLE_POLL_RECOVERY);
                clearTimer();
                timerRef.current = setTimeout(() => {
                    void load(true);
                }, POLLING_CONFIG.recentRuns.baseMs);
            } catch (err) {
                setError(err);
                const nextRecovery = buildPollRecoveryState(err, ++failureCountRef.current, POLLING_CONFIG.recentRuns);
                setPollRecovery(nextRecovery);
                clearTimer();
                if (!nextRecovery.exhausted && nextRecovery.nextDelayMs != null) {
                    timerRef.current = setTimeout(() => {
                        void load(true);
                    }, nextRecovery.nextDelayMs);
                }
            } finally {
                if (!silent) {
                    setLoading(false);
                }
            }
        },
        [appName, clearTimer]
    );

    useEffect(() => {
        clearTimer();
        failureCountRef.current = 0;
        setPollRecovery(IDLE_POLL_RECOVERY);
        void load();
        return clearTimer;
    }, [clearTimer, load]);

    function handleRefresh() {
        clearTimer();
        failureCountRef.current = 0;
        setPollRecovery(IDLE_POLL_RECOVERY);
        void load();
    }

    return (
        <div className='deploy-models__result-section deploy-models__runs-panel'>
            <div className='deploy-models__result-header'>
                <div>
                    <div className='deploy-models__result-title'>Recent Runs</div>
                    <div className='deploy-models__secondary-text'>Runs for this application, including teammate-triggered deploys in the same Argo CD app.</div>
                </div>
                <button type='button' className='argo-button argo-button--base-o' onClick={handleRefresh} disabled={loading}>
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {(pollRecovery.reconnecting || pollRecovery.exhausted) && (
                <NoticeAlert
                    variant='warning'
                    message={formatPollRecoveryMessage('Recent runs are temporarily unavailable', pollRecovery)}
                    actionLabel={pollRecovery.exhausted ? 'Retry now' : undefined}
                    onAction={pollRecovery.exhausted ? handleRefresh : undefined}
                />
            )}
            {!pollRecovery.reconnecting && !pollRecovery.exhausted && error && <ErrorAlert error={error} prefix='Unable to load recent runs' />}
            {!error && jobs.length === 0 && !loading && <div className='deploy-models__muted-text'>No runs yet for this application.</div>}

            {jobs.length > 0 && (
                <div className='deploy-models__runs-list'>
                    {jobs.map(job => {
                        const status = getRunStatusDescriptor(job);
                        return (
                            <button
                                key={job.job_id}
                                type='button'
                                className={`deploy-models__run-card${selectedJobId === job.job_id ? ' is-selected' : ''}`}
                                onClick={() => onSelectJob(job.job_id)}>
                                <div className='deploy-models__run-card-header'>
                                    <span className={`deploy-models__status-pill ${getStatusToneClass(status.tone)}`}>{status.label}</span>
                                    <span className='deploy-models__muted-text'>Job {job.job_id.slice(0, 8)}…</span>
                                </div>
                                <div className='deploy-models__run-card-meta'>
                                    <span>{formatTimestamp(job.created_at)}</span>
                                    {job.triggered_by && <span>{job.triggered_by}</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
