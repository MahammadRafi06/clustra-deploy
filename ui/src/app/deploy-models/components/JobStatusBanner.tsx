import React, {useEffect, useState} from 'react';

import {Spinner} from '../../shared/components';

import {getJobStatusCopy, getRunStatusDescriptor, getStatusToneClass, isJobSettled} from '../jobState';
import type {JobResult} from '../types';

interface JobStatusBannerProps {
    job: JobResult;
    onCancel: () => void;
    cancelling: boolean;
}

function elapsedSeconds(job: JobResult): number {
    const startedAt = new Date(job.created_at).getTime();
    const endedAt = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
    return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

export function JobStatusBanner({job, onCancel, cancelling}: JobStatusBannerProps) {
    const [elapsed, setElapsed] = useState(() => elapsedSeconds(job));
    const settled = isJobSettled(job);
    const status = getRunStatusDescriptor(job);

    useEffect(() => {
        setElapsed(elapsedSeconds(job));
        if (settled) {
            return;
        }
        const intervalId = window.setInterval(() => {
            setElapsed(elapsedSeconds(job));
        }, 1000);
        return () => window.clearInterval(intervalId);
    }, [job, settled]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const elapsedLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const canCancel = (job.status === 'pending' || job.status === 'running') && job.can_cancel === true;

    function handleCancelClick() {
        if (cancelling) {
            return;
        }
        const confirmed = window.confirm('Mark this run as cancelled? Running compute may continue briefly, but the result will stop being treated as an active deploy.');
        if (confirmed) {
            onCancel();
        }
    }

    return (
        <div className='deploy-models__status-banner'>
            <div className='deploy-models__status-copy'>
                {!settled && (
                    <span className='deploy-models__status-spinner'>
                        <Spinner show={true} />
                    </span>
                )}
                <div className='deploy-models__status-text'>
                    <div className='deploy-models__status-title'>
                        <span className={`deploy-models__status-pill ${getStatusToneClass(status.tone)}`}>{status.label}</span>
                    </div>
                    <div className='deploy-models__status-subtitle'>
                        Job {job.job_id.slice(0, 8)}… · {getJobStatusCopy(job)}
                        {!settled && ` · ${elapsedLabel}`}
                    </div>
                </div>
            </div>
            {canCancel && (
                <button type='button' className='argo-button argo-button--base-o deploy-models__danger-button' onClick={handleCancelClick} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Mark cancelled'}
                </button>
            )}
        </div>
    );
}
