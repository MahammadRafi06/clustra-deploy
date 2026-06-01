import React, {useCallback, useEffect, useRef, useState} from 'react';

import {Column, DataTable, StatusPill, type PillTone} from '../../shared/components';
import {deleteDeployment, listDeployments} from '../api';
import type {DeploymentStatus, DeploymentSummary} from '../types';
import {DeploymentDeleteDialog} from './DeploymentDeleteDialog';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

const DEPLOYMENT_LIST_LIMIT = 200;

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

    const columns: Array<Column<DeploymentSummary>> = [
        {
            key: 'deployment',
            header: 'Deployment',
            width: 'minmax(0, 2fr)',
            render: d => (
                <div className='ctbl__stack'>
                    <span className='ctbl__primary' title={d.repo_target_subdir}>
                        {d.repo_target_subdir || d.app_name || d.deployment_id}
                    </span>
                    <span className='ctbl__secondary'>
                        {d.deployment_id.slice(0, 8)}… · {d.branch}
                    </span>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            width: 'minmax(0, 1fr)',
            render: d => <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill>
        },
        {
            key: 'mode',
            header: 'Mode',
            width: 'minmax(0, 0.7fr)',
            render: d => <span>{d.deploy_mode}</span>
        },
        {
            key: 'created',
            header: 'Created',
            width: 'minmax(0, 1fr)',
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
        <section className='deploy-models__panel' aria-label='Deployed Models'>
            <header className='deploy-models__panel-header deploy-models__panel-header--split'>
                <div>
                    <h2 className='deploy-models__panel-title'>Deployed Models</h2>
                    <p className='deploy-models__panel-description'>
                        Every deployment you have created. Removing one deletes its manifests from Git; Argo CD then prunes the live resources.
                    </p>
                </div>
                <button type='button' className='argo-button argo-button--base-o' onClick={() => void load()} disabled={loading}>
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </header>

            {notice ? <NoticeAlert variant='info' message={notice} /> : null}
            {error ? <ErrorAlert error={error} prefix='Unable to load deployments' /> : null}

            <DataTable<DeploymentSummary>
                ariaLabel='Deployments'
                columns={columns}
                rows={deployments}
                loading={loading && deployments.length === 0}
                rowKey={d => d.deployment_id}
                empty='No deployments yet. Use “Deploy Model” to create one.'
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
        </section>
    );
}
