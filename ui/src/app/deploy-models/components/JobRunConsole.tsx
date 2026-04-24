import React, {useEffect, useRef} from 'react';

import {formatPollRecoveryMessage, type PollRecoveryState} from '../polling';
import {isJobSettled} from '../jobState';
import {useJobAudit} from '../hooks/useJobAudit';
import type {JobResult} from '../types';

import {ErrorAlert} from './ErrorAlert';
import {JobResultView} from './JobResultView';
import {JobStatusBanner} from './JobStatusBanner';
import {NoticeAlert} from './NoticeAlert';

interface JobRunConsoleProps {
    job: JobResult | null;
    cancelling: boolean;
    cancelError: unknown | null;
    pollRecovery: PollRecoveryState;
    onRetryPoll: () => void;
    onCancel: () => void;
}

export function JobRunConsole({job, cancelling, cancelError, pollRecovery, onRetryPoll, onCancel}: JobRunConsoleProps) {
    const {audit, auditError, auditLoading, auditRecovery, retryAudit} = useJobAudit(job?.job_id ?? null, !!job && !isJobSettled(job));
    const consoleRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (job?.job_id) {
            consoleRef.current?.focus();
        }
    }, [job?.job_id]);

    return (
        <div ref={consoleRef} tabIndex={-1} className='deploy-models__job-console'>
            {(pollRecovery.reconnecting || pollRecovery.exhausted) && (
                <NoticeAlert
                    variant='warning'
                    message={formatPollRecoveryMessage('Live run updates are delayed', pollRecovery)}
                    actionLabel={pollRecovery.exhausted ? 'Retry now' : undefined}
                    onAction={pollRecovery.exhausted ? onRetryPoll : undefined}
                />
            )}
            {cancelError && <ErrorAlert error={cancelError} prefix='Unable to cancel run' />}
            {job && <JobStatusBanner job={job} onCancel={onCancel} cancelling={cancelling} />}
            {job && <JobResultView job={job} audit={audit} auditError={auditError} auditLoading={auditLoading} auditRecovery={auditRecovery} onRetryAudit={retryAudit} />}
        </div>
    );
}
