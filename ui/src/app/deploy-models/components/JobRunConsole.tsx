import React from 'react';

import {isJobSettled} from '../jobState';
import {useJobAudit} from '../hooks/useJobAudit';
import type {JobResult} from '../types';

import {JobResultView} from './JobResultView';
import {JobStatusBanner} from './JobStatusBanner';
import {RecentRunsPanel} from './RecentRunsPanel';

interface JobRunConsoleProps {
    job: JobResult | null;
    selectedJobId: string | null;
    cancelling: boolean;
    onCancel: () => void;
    onSelectJob: (jobId: string) => void;
}

export function JobRunConsole({job, selectedJobId, cancelling, onCancel, onSelectJob}: JobRunConsoleProps) {
    const {audit, auditError, auditLoading} = useJobAudit(job?.job_id ?? null, !!job && !isJobSettled(job));

    return (
        <>
            {job && <JobStatusBanner job={job} onCancel={onCancel} cancelling={cancelling} />}
            {job && <JobResultView job={job} audit={audit} auditError={auditError} auditLoading={auditLoading} />}
            <RecentRunsPanel selectedJobId={selectedJobId} onSelectJob={onSelectJob} />
        </>
    );
}
