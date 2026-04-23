import React from 'react';

import type {ApplicationSource} from '../types';
import type {SelectedAppTarget} from './ContextSelector';
import type {TaskKey} from './TaskSelector';

const WRITE_TASKS = new Set<TaskKey>(['default', 'experiment', 'generate']);

interface DeployTargetNoticeProps {
    target: SelectedAppTarget;
    task: TaskKey;
}

function primarySource(target: SelectedAppTarget): ApplicationSource | undefined {
    return target.application.spec.source || target.application.spec.sources?.[0];
}

export function DeployTargetNotice({target, task}: DeployTargetNoticeProps) {
    const source = primarySource(target);
    const writesManifests = WRITE_TASKS.has(task);

    return (
        <div className={`deploy-models__target-notice ${writesManifests ? 'is-write' : 'is-read-only'}`}>
            <div className='deploy-models__target-copy'>
                <div className='deploy-models__context-summary-title'>{writesManifests ? 'Deploy Target' : 'Read-Only Workflow'}</div>
                <div className='deploy-models__secondary-text'>
                    {writesManifests
                        ? 'Successful runs in this workflow can commit generated manifests to the selected Argo CD source.'
                        : 'This workflow uses the selected app for context only. It does not commit repository changes.'}
                </div>
            </div>

            <div className='deploy-models__target-grid'>
                <div className='deploy-models__summary-item'>
                    <span className='deploy-models__summary-label'>Action</span>
                    <span>{writesManifests ? 'Writes manifests on success' : 'No repo writes'}</span>
                </div>
                <div className='deploy-models__summary-item'>
                    <span className='deploy-models__summary-label'>Repository</span>
                    <span>{source?.repoURL || 'Not exposed by this Argo CD source'}</span>
                </div>
                <div className='deploy-models__summary-item'>
                    <span className='deploy-models__summary-label'>Path</span>
                    <span>{source?.path || 'Application source root'}</span>
                </div>
                <div className='deploy-models__summary-item'>
                    <span className='deploy-models__summary-label'>Revision</span>
                    <span>{source?.targetRevision || 'Default revision'}</span>
                </div>
            </div>
        </div>
    );
}
