import {Select} from 'argo-ui';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {Column, DataTable, StatusPill, type PillTone} from '../../shared/components';
import {deleteDeployment, listDeployments} from '../api';
import type {DeploymentStatus, DeploymentSummary} from '../types';
import {DeploymentDeleteDialog} from './DeploymentDeleteDialog';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

const DEPLOYMENT_LIST_LIMIT = 200;

const STATUS_FILTER_OPTIONS = [
    {title: 'Active', value: 'active'},
    {title: 'Committing', value: 'committing'},
    {title: 'Removing', value: 'removing'},
    {title: 'Removed', value: 'removed'},
    {title: 'Failed', value: 'failed'}
];

const STATUS_TONE: Record<DeploymentStatus, PillTone> = {
    active: 'success',
    committing: 'info',
    removing: 'warning',
    removed: 'neutral',
    failed: 'danger'
};

function statusTone(status: DeploymentStatus): PillTone {
    return STATUS_TONE[status] || 'info';
}

function formatTimestamp(value: string): string {
    return new Date(value).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
}

interface DeploymentsTableProps {
    /** Bump to force a reload — the parent increments this after a deploy commits. */
    reloadKey: number;
}

export function DeploymentsTable({reloadKey}: DeploymentsTableProps) {
    const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<DeploymentSummary | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<unknown | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [clusterFilter, setClusterFilter] = useState('');
    const loadSeqRef = useRef(0);

    const load = useCallback(async () => {
        const seq = ++loadSeqRef.current;
        setLoading(true);
        try {
            const response = await listDeployments({limit: DEPLOYMENT_LIST_LIMIT});
            if (seq !== loadSeqRef.current) {
                return;
            }
            setDeployments(response.deployments);
            setError(null);
        } catch (err) {
            if (seq === loadSeqRef.current) {
                setError(err);
            }
        } finally {
            if (seq === loadSeqRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load, reloadKey]);

    async function handleConfirmDelete() {
        if (!confirmTarget) {
            return;
        }
        setDeleting(true);
        setDeleteError(null);
        try {
            const result = await deleteDeployment(confirmTarget.deployment_id);
            setConfirmTarget(null);
            setNotice(result.message || 'Deployment removal committed to Git. Argo CD will prune the resources on its next sync.');
            await load();
        } catch (err) {
            setDeleteError(err);
        } finally {
            setDeleting(false);
        }
    }

    // Filter dropdown options are derived from the loaded set, so they only ever
    // offer values that actually exist.
    const projectOptions = useMemo(() => Array.from(new Set(deployments.map(d => d.project).filter((p): p is string => !!p))).sort(), [deployments]);
    const clusterOptions = useMemo(() => Array.from(new Set(deployments.map(d => d.cluster).filter((c): c is string => !!c))).sort(), [deployments]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return deployments.filter(d => {
            if (statusFilter && d.status !== statusFilter) return false;
            if (projectFilter && d.project !== projectFilter) return false;
            if (clusterFilter && d.cluster !== clusterFilter) return false;
            if (!query) return true;
            return [d.repo_target_subdir, d.app_name, d.project, d.cluster, d.branch, d.triggered_by_display, d.deployment_id]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query);
        });
    }, [deployments, search, statusFilter, projectFilter, clusterFilter]);

    const columns: Array<Column<DeploymentSummary>> = [
        {
            key: 'deployment',
            header: 'Deployment',
            width: 'minmax(0, 1.6fr)',
            render: d => (
                <div className='ctbl__stack'>
                    <span className='ctbl__primary' title={d.repo_target_subdir}>
                        {d.repo_target_subdir || d.app_name || d.deployment_id}
                    </span>
                    <span className='ctbl__secondary'>
                        {d.deployment_id.slice(0, 8)}… · {d.branch} · {d.deploy_mode}
                    </span>
                </div>
            )
        },
        {
            key: 'application',
            header: 'Application',
            width: 'minmax(0, 1fr)',
            render: d => (
                <span className='ctbl__secondary' title={d.app_name || undefined}>
                    {d.app_name || '—'}
                </span>
            )
        },
        {
            key: 'cluster',
            header: 'Cluster',
            width: 'minmax(0, 1fr)',
            render: d => (
                <span className='ctbl__secondary' title={d.cluster || undefined}>
                    {d.cluster || '—'}
                </span>
            )
        },
        {
            key: 'project',
            header: 'Project',
            width: 'minmax(0, 0.9fr)',
            render: d => (
                <span className='ctbl__secondary' title={d.project || undefined}>
                    {d.project || '—'}
                </span>
            )
        },
        {
            key: 'status',
            header: 'Status',
            width: 'minmax(0, 0.9fr)',
            render: d => <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill>
        },
        {
            key: 'created',
            header: 'Created',
            width: 'minmax(0, 0.9fr)',
            render: d => <span className='ctbl__secondary'>{formatTimestamp(d.created_at)}</span>
        },
        {
            key: 'triggered',
            header: 'Triggered by',
            width: 'minmax(0, 1fr)',
            render: d => <span className='ctbl__secondary'>{d.triggered_by_display || '—'}</span>
        },
        {
            key: 'actions',
            header: '',
            width: '92px',
            align: 'right',
            render: d => (
                <button
                    type='button'
                    className='ctbl__rowbtn ctbl__rowbtn--danger'
                    onClick={() => {
                        setNotice(null);
                        setDeleteError(null);
                        setConfirmTarget(d);
                    }}
                    disabled={d.status === 'removing'}
                    aria-label={`Delete deployment ${d.repo_target_subdir || d.app_name || d.deployment_id.slice(0, 8)}`}>
                    Delete
                </button>
            )
        }
    ];

    return (
        <>
            {notice ? <NoticeAlert variant='info' message={notice} /> : null}
            {error ? <ErrorAlert error={error} prefix='Unable to load deployments' /> : null}

            <div className='ctbl-toolbar' role='search' aria-label='Deployment filters'>
                <input
                    type='text'
                    className='argo-field ctbl-toolbar__search'
                    placeholder='Search deployments'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label='Search deployments'
                />
                <div className='deploy-models__filter-select'>
                    <Select
                        value={statusFilter}
                        placeholder='All statuses'
                        options={[{title: 'All statuses', value: ''}, ...STATUS_FILTER_OPTIONS]}
                        onChange={option => setStatusFilter(option.value)}
                    />
                </div>
                <div className='deploy-models__filter-select'>
                    <Select
                        value={projectFilter}
                        placeholder='All projects'
                        options={[{title: 'All projects', value: ''}, ...projectOptions.map(p => ({title: p, value: p}))]}
                        onChange={option => setProjectFilter(option.value)}
                    />
                </div>
                <div className='deploy-models__filter-select'>
                    <Select
                        value={clusterFilter}
                        placeholder='All clusters'
                        options={[{title: 'All clusters', value: ''}, ...clusterOptions.map(c => ({title: c, value: c}))]}
                        onChange={option => setClusterFilter(option.value)}
                    />
                </div>
            </div>

            <DataTable<DeploymentSummary>
                ariaLabel='Deployments'
                columns={columns}
                rows={filtered}
                loading={loading && deployments.length === 0}
                rowKey={d => d.deployment_id}
                empty={deployments.length > 0 ? 'No deployments match your filters.' : 'No deployments yet. Use “Deploy AI” to create one.'}
            />

            {confirmTarget ? (
                <DeploymentDeleteDialog
                    deployment={confirmTarget}
                    pending={deleting}
                    error={deleteError}
                    onCancel={() => {
                        if (!deleting) {
                            setConfirmTarget(null);
                            setDeleteError(null);
                        }
                    }}
                    onConfirm={handleConfirmDelete}
                />
            ) : null}
        </>
    );
}
