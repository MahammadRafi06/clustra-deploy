import React, {useEffect, useRef, useState} from 'react';

import {Spinner} from '../../shared/components';

import type {JobStatus} from '../types';

interface JobStatusBannerProps {
    jobId: string;
    status: JobStatus;
    onCancel: () => void;
    cancelling: boolean;
}

function statusLabel(status: JobStatus): string {
    switch (status) {
        case 'pending':
            return 'Queued';
        case 'running':
            return 'Running';
        case 'success':
            return 'Completed';
        case 'failed':
            return 'Failed';
        case 'cancelled':
            return 'Cancelled';
    }
}

function statusClass(status: JobStatus): string {
    switch (status) {
        case 'success':
            return 'deploy-models__status-pill--success';
        case 'failed':
            return 'deploy-models__status-pill--error';
        case 'cancelled':
            return 'deploy-models__status-pill--warning';
        default:
            return 'deploy-models__status-pill--info';
    }
}

export function JobStatusBanner({jobId, status, onCancel, cancelling}: JobStatusBannerProps) {
    const startRef = useRef(Date.now());
    const [elapsed, setElapsed] = useState(0);

    const isTerminal = status === 'success' || status === 'failed' || status === 'cancelled';

    useEffect(() => {
        if (isTerminal) {
            return;
        }
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
        return () => clearInterval(id);
    }, [isTerminal]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const elapsedLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    return (
        <div className='deploy-models__status-banner'>
            <div className='deploy-models__status-copy'>
                {!isTerminal && (
                    <span className='deploy-models__status-spinner'>
                        <Spinner show={true} />
                    </span>
                )}
                <div className='deploy-models__status-text'>
                    <div className='deploy-models__status-title'>
                        <span className={`deploy-models__status-pill ${statusClass(status)}`}>{statusLabel(status)}</span>
                    </div>
                    <div className='deploy-models__status-subtitle'>
                        Job {jobId.slice(0, 8)}…{!isTerminal && ` · ${elapsedLabel}`}
                    </div>
                </div>
            </div>
            {!isTerminal && (
                <button type='button' className='argo-button argo-button--base-o deploy-models__danger-button' onClick={onCancel} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
            )}
        </div>
    );
}
