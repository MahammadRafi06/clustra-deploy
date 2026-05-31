import React, {useCallback, useEffect, useRef, useState} from 'react';

import {deleteDeployment, listDeployments} from '../api';
import type {DeploymentStatus, DeploymentSummary} from '../types';
import {useAppContext} from './AppContext';
import {DeploymentDeleteDialog} from './DeploymentDeleteDialog';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

const DEPLOYMENT_LIST_LIMIT = 100;

// Map a deployment lifecycle status onto the shared status-pill tone classes.
const STATUS_TONE_CLASS: Record<DeploymentStatus, string> = {
    active: 'deploy-models__status-pill--success',
    committing: 'deploy-models__status-pill--info',
    removing: 'deploy-models__status-pill--warning',
    removed: 'deploy-models__status-pill--muted',
    failed: 'deploy-models__status-pill--error'
};

function statusToneClass(status: DeploymentStatus): string {
    return STATUS_TONE_CLASS[status] || 'deploy-models__status-pill--info';
}

function formatTimestamp(value: string): string {
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

interface DeploymentsTableProps {
    /** Bump to force a reload — the parent increments this after a deploy commits. */
    reloadKey: number;
    /** "+ Deploy Model" click — reveals the deploy form flow in the parent. */
    onDeployModel: () => void;
}

export function DeploymentsTable({reloadKey, onDeployModel}: DeploymentsTableProps) {
    const {appName, appNamespace, projectName} = useAppContext();
    const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<DeploymentSummary | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<unknown | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    // Monotonic request token: only the most recently started load() is allowed
    // to commit its result. Guards against a stale in-flight response (from a
    // previous context, or a delete→reload that overlaps a reloadKey reload)
    // overwriting fresher state. Cheaper than threading an AbortSignal through
    // the shared api client and robust to React 16's lack of effect-cleanup here.
    const loadSeqRef = useRef(0);

    const load = useCallback(async () => {
        const seq = ++loadSeqRef.current;
        if (!appName || !appNamespace || !projectName) {
            setDeployments([]);
            setError(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await listDeployments({limit: DEPLOYMENT_LIST_LIMIT}, {applicationName: appName, applicationNamespace: appNamespace, projectName});
            if (seq !== loadSeqRef.current) {
                return; // a newer load() superseded this one — drop the stale result
            }
            setDeployments(response.deployments);
            setError(null);
        } catch (err) {
            if (seq !== loadSeqRef.current) {
                return;
            }
            setError(err);
        } finally {
            if (seq === loadSeqRef.current) {
                setLoading(false);
            }
        }
    }, [appName, appNamespace, projectName]);

    // Reload on mount, whenever the Argo CD context changes, and whenever the
    // parent bumps reloadKey (i.e. right after a deploy run commits).
    useEffect(() => {
        void load();
    }, [load, reloadKey]);

    async function handleConfirmDelete() {
        if (!confirmTarget || !appName || !appNamespace || !projectName) {
            return;
        }
        setDeleting(true);
        setDeleteError(null);
        try {
            const result = await deleteDeployment(confirmTarget.deployment_id, {
                applicationName: appName,
                applicationNamespace: appNamespace,
                projectName
            });
            setConfirmTarget(null);
            setNotice(result.message || 'Deployment removal committed to Git. Argo CD will prune the resources on its next sync.');
            await load();
        } catch (err) {
            setDeleteError(err);
        } finally {
            setDeleting(false);
        }
    }

    function openConfirm(deployment: DeploymentSummary) {
        setNotice(null);
        setDeleteError(null);
        setConfirmTarget(deployment);
    }

    function closeConfirm() {
        if (deleting) {
            return;
        }
        setConfirmTarget(null);
        setDeleteError(null);
    }

    return (
        <section className='deploy-models__panel' aria-label='Deployed Models'>
            <header className='deploy-models__panel-header deploy-models__panel-header--split'>
                <div>
                    <h2 className='deploy-models__panel-title'>Deployed Models</h2>
                    <p className='deploy-models__panel-description'>
                        Deployments you created for this application. Removing one deletes its manifests from Git; Argo CD then prunes the live resources.
                    </p>
                </div>
                <div className='deploy-models__deployments-actions'>
                    <button type='button' className='argo-button argo-button--base-o' onClick={() => void load()} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <button type='button' className='argo-button argo-button--base' onClick={onDeployModel}>
                        <i className='fa fa-plus' /> Deploy Model
                    </button>
                </div>
            </header>

            {notice ? <NoticeAlert variant='info' message={notice} /> : null}
            {error ? <ErrorAlert error={error} prefix='Unable to load deployments' /> : null}

            {!error && !loading && deployments.length === 0 ? (
                <div className='deploy-models__muted-text'>No deployments yet for this application. Use “Deploy Model” to create one.</div>
            ) : null}

            {deployments.length > 0 ? (
                <div className='deploy-models__deployments argo-table-list' role='table' aria-label='Deployments'>
                    <div className='deploy-models__deployments-head row' role='row'>
                        <div className='columns small-3' role='columnheader'>
                            Deployment
                        </div>
                        <div className='columns small-2' role='columnheader'>
                            Status
                        </div>
                        <div className='columns small-1' role='columnheader'>
                            Mode
                        </div>
                        <div className='columns small-2' role='columnheader'>
                            Created
                        </div>
                        <div className='columns small-2' role='columnheader'>
                            Triggered by
                        </div>
                        <div className='columns small-2 deploy-models__deployments-actions-col' role='columnheader'>
                            Actions
                        </div>
                    </div>
                    {deployments.map(deployment => {
                        const label = deployment.repo_target_subdir || deployment.app_name || deployment.deployment_id.slice(0, 8);
                        return (
                            <div className='deploy-models__deployments-row row' role='row' key={deployment.deployment_id}>
                                <div className='columns small-3' role='cell' data-label='Deployment'>
                                    <div className='deploy-models__deployments-primary' title={deployment.repo_target_subdir}>
                                        {deployment.repo_target_subdir || deployment.app_name || '—'}
                                    </div>
                                    <div className='deploy-models__muted-text'>
                                        {deployment.deployment_id.slice(0, 8)}… · {deployment.branch}
                                    </div>
                                </div>
                                <div className='columns small-2' role='cell' data-label='Status'>
                                    <span className={`deploy-models__status-pill ${statusToneClass(deployment.status)}`}>{deployment.status}</span>
                                </div>
                                <div className='columns small-1' role='cell' data-label='Mode'>
                                    {deployment.deploy_mode}
                                </div>
                                <div className='columns small-2' role='cell' data-label='Created'>
                                    {formatTimestamp(deployment.created_at)}
                                </div>
                                <div className='columns small-2' role='cell' data-label='Triggered by'>
                                    {deployment.triggered_by_display || '—'}
                                </div>
                                <div className='columns small-2 deploy-models__deployments-actions-col' role='cell' data-label='Actions'>
                                    <button
                                        type='button'
                                        className='argo-button argo-button--base-o deploy-models__danger-button'
                                        onClick={() => openConfirm(deployment)}
                                        disabled={deployment.status === 'removing'}
                                        aria-label={`Delete deployment ${label}`}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}

            {confirmTarget ? (
                <DeploymentDeleteDialog deployment={confirmTarget} pending={deleting} error={deleteError} onCancel={closeConfirm} onConfirm={handleConfirmDelete} />
            ) : null}
        </section>
    );
}
