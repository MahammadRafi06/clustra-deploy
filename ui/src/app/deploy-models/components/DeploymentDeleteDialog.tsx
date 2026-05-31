import {SlidingPanel} from 'argo-ui';
import * as React from 'react';

import type {DeploymentSummary} from '../types';
import {ErrorAlert} from './ErrorAlert';

/**
 * Destructive-confirm drawer for removing a deployment. Deletion is GitOps-only
 * (manifests are removed from Git and Argo CD prunes the live resources), so the
 * copy frames it as a Git removal, not a direct k8s delete. The DELETE runs the
 * git removal synchronously and may take up to ~2 minutes — hence the explicit
 * pending state and the inline error surface for the (rare) commit failure.
 */
export const DeploymentDeleteDialog: React.FC<{
    deployment: DeploymentSummary;
    pending?: boolean;
    error?: unknown;
    onCancel: () => void;
    onConfirm: () => void;
}> = ({deployment, pending, error, onCancel, onConfirm}) => {
    const label = deployment.repo_target_subdir || deployment.app_name || deployment.deployment_id;
    return (
        <SlidingPanel hasCloseButton={true} header={<strong>Remove deployment</strong>} isMiddle={true} isShown={true} onClose={onCancel}>
            <div className='deploy-models__confirm' role='dialog' aria-modal='true' aria-label='Remove deployment' aria-describedby='deployment-removal-description'>
                <p id='deployment-removal-description'>
                    This removes the manifests for <strong>{label}</strong> from the Git repository. Argo CD will prune the running resources on its next sync. This cannot be
                    undone.
                </p>
                <p className='deploy-models__muted-text'>
                    Deployment <code>{deployment.deployment_id}</code> on branch <code>{deployment.branch}</code>. Removal commits to Git synchronously and may take up to two
                    minutes.
                </p>
                {error ? <ErrorAlert error={error} prefix='Removal failed' /> : null}
                <div className='deploy-models__confirm-actions'>
                    <button type='button' className='argo-button argo-button--base-o' onClick={onCancel} disabled={pending}>
                        Cancel
                    </button>
                    <button type='button' className='argo-button argo-button--base-o deploy-models__danger-button' onClick={onConfirm} disabled={pending}>
                        {pending ? 'Removing…' : 'Remove deployment'}
                    </button>
                </div>
            </div>
        </SlidingPanel>
    );
};
