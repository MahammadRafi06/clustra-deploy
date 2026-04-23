import React, {useCallback, useEffect, useRef, useState} from 'react';

import {listJobs} from '../api';
import {getRunStatusDescriptor, getStatusToneClass} from '../jobState';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';
import {IDLE_POLL_RECOVERY, formatPollRecoveryMessage, nextPollDelayMs, type PollRecoveryState} from '../polling';
import type {JobSummary} from '../types';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_INTERVAL_MS = 25000;

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
                const response = await listJobs({limit: 8});
                setJobs(response.jobs);
                setError(null);
                failureCountRef.current = 0;
                setPollRecovery(IDLE_POLL_RECOVERY);
                clearTimer();
                timerRef.current = setTimeout(() => {
                    void load(true);
                }, POLL_INTERVAL_MS);
            } catch (err) {
                const nextDelayMs = nextPollDelayMs(++failureCountRef.current, POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
                setError(err);
                setPollRecovery({
                    reconnecting: true,
                    retryCount: failureCountRef.current,
                    nextDelayMs,
                    error: err
                });
                clearTimer();
                timerRef.current = setTimeout(() => {
                    void load(true);
                }, nextDelayMs);
            } finally {
                if (!silent) {
                    setLoading(false);
                }
            }
        },
        [clearTimer]
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

            {pollRecovery.reconnecting && <NoticeAlert variant='warning' message={formatPollRecoveryMessage('Recent runs are temporarily unavailable', pollRecovery)} />}
            {!pollRecovery.reconnecting && error && <ErrorAlert error={error} prefix='Unable to load recent runs' />}
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
