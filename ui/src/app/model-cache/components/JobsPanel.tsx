import {Select, SlidingPanel} from 'argo-ui';
import React, {useEffect, useState} from 'react';

import {useCancelJob, useJobs, useRetryJob} from '../hooks/useJobs';
import {formatRelativeTime} from '../utils/formatters';
import {JobLogViewer} from './JobLogViewer';
import {StatusBadge} from './common/StatusBadge';

export const JobsPanel: React.FC<{visible: boolean; onClose: () => void}> = ({visible, onClose}) => {
    const [kindFilter, setKindFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [logJobId, setLogJobId] = useState<string | null>(null);

    const {data, isLoading} = useJobs({kind: kindFilter || undefined, status: statusFilter || undefined});
    const cancelJob = useCancelJob();
    const retryJob = useRetryJob();

    useEffect(() => {
        if (!visible) {
            setLogJobId(null);
        }
    }, [visible]);

    return (
        <>
            <SlidingPanel hasCloseButton={true} hasNoPadding={true} header={<strong>Jobs</strong>} isNarrow={true} isShown={visible} onClose={onClose}>
                <div className='model-cache__drawer-toolbar model-cache__drawer-toolbar--stack'>
                    <div className='model-cache__select model-cache__filter-select'>
                        <Select
                            value={kindFilter}
                            options={[
                                {title: 'All Types', value: ''},
                                {title: 'Download', value: 'download'},
                                {title: 'Delete', value: 'hard_delete'},
                                {title: 'Integrity', value: 'integrity_check'}
                            ]}
                            placeholder='All Types'
                            onChange={option => setKindFilter(option.value)}
                        />
                    </div>
                    <div className='model-cache__select model-cache__filter-select'>
                        <Select
                            value={statusFilter}
                            options={[
                                {title: 'All Status', value: ''},
                                {title: 'Queued', value: 'queued'},
                                {title: 'Running', value: 'running'},
                                {title: 'Succeeded', value: 'succeeded'},
                                {title: 'Failed', value: 'failed'},
                                {title: 'Cancelled', value: 'cancelled'}
                            ]}
                            placeholder='All Status'
                            onChange={option => setStatusFilter(option.value)}
                        />
                    </div>
                </div>

                <div className='model-cache__drawer-body'>
                    {isLoading ? (
                        <div className='model-cache__table-empty'>Loading…</div>
                    ) : !data || data.items.length === 0 ? (
                        <div className='model-cache__table-empty'>No jobs found</div>
                    ) : (
                        data.items.map(job => (
                            <div key={job.id} className='model-cache__job-card'>
                                <div className='model-cache__job-card-header'>
                                    <div className='model-cache__job-title'>
                                        <i className={`fa ${kindIcon(job.kind)}`} />
                                        <span>{(job.parameters as Record<string, string>).repo_id || job.kind}</span>
                                    </div>
                                    <StatusBadge status={job.status} size='small' />
                                </div>
                                <div className='model-cache__job-meta'>
                                    {job.k8s_job_name || 'pending'} · {formatRelativeTime(job.created_at)}
                                    {job.result_message && <div>{job.result_message}</div>}
                                </div>
                                <div className='model-cache__job-actions'>
                                    {(job.status === 'running' || job.status === 'queued') && (
                                        <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => cancelJob.mutate(job.id)}>
                                            Cancel
                                        </button>
                                    )}
                                    {job.status === 'failed' && (
                                        <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => retryJob.mutate(job.id)}>
                                            Retry
                                        </button>
                                    )}
                                    {job.k8s_job_name && (
                                        <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => setLogJobId(job.id)}>
                                            <i className='fa fa-file-text-o' /> Logs
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </SlidingPanel>

            {logJobId && <JobLogViewer jobId={logJobId} onClose={() => setLogJobId(null)} />}
        </>
    );
};

function kindIcon(kind: string): string {
    const icons: Record<string, string> = {
        download: 'fa-download',
        hard_delete: 'fa-trash',
        integrity_check: 'fa-check-circle',
        rescan: 'fa-refresh'
    };
    return icons[kind] || 'fa-cog';
}
