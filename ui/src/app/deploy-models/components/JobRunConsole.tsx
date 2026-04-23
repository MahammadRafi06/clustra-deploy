import React from 'react';

import {formatPollRecoveryMessage} from '../polling';
import {isJobSettled} from '../jobState';
import {useJobAudit} from '../hooks/useJobAudit';
import type {JobResult} from '../types';

import {ErrorAlert} from './ErrorAlert';
import {JobResultView} from './JobResultView';
import {JobStatusBanner} from './JobStatusBanner';
import {NoticeAlert} from './NoticeAlert';
import {RecentRunsPanel} from './RecentRunsPanel';

interface JobRunConsoleProps {
    job: JobResult | null;
    selectedJobId: string | null;
    cancelling: boolean;
    cancelError: unknown | null;
    pollRecovery: {reconnecting: boolean; retryCount: number; nextDelayMs: number | null; error: unknown | null};
    onCancel: () => void;
    onSelectJob: (jobId: string) => void;
}

export function JobRunConsole({job, selectedJobId, cancelling, cancelError, pollRecovery, onCancel, onSelectJob}: JobRunConsoleProps) {
    const {audit, auditError, auditLoading, auditRecovery} = useJobAudit(job?.job_id ?? null, !!job && !isJobSettled(job));

    return (
        <>
            {pollRecovery.reconnecting && <NoticeAlert variant='warning' message={formatPollRecoveryMessage('Live run updates are delayed', pollRecovery)} />}
            {cancelError && <ErrorAlert error={cancelError} prefix='Unable to cancel run' />}
            {job && <JobStatusBanner job={job} onCancel={onCancel} cancelling={cancelling} />}
            {job && <JobResultView job={job} audit={audit} auditError={auditError} auditLoading={auditLoading} auditRecovery={auditRecovery} />}
            <RecentRunsPanel selectedJobId={selectedJobId} onSelectJob={onSelectJob} />
        </>
    );
}
