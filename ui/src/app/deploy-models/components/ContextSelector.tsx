import {Select} from 'argo-ui';
import React, {useEffect, useState} from 'react';

import {listArgoProjects} from '../api';
import type {Project} from '../types';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

// Repo-per-team deploy: the user picks a PROJECT (team); the deployment name is
// typed in the form. There is no Application to select — the global SCM-matrix
// ApplicationSet generates it from the committed model directory.
export interface SelectedAppTarget {
    projectName: string;
}

interface ContextSelectorProps {
    value: SelectedAppTarget | null;
    onChange: (target: SelectedAppTarget | null) => void;
}

export function ContextSelector({value, onChange}: ContextSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<unknown | null>(null);

    useEffect(() => {
        let cancelled = false;
        setProjectsLoading(true);
        setProjectsError(null);
        listArgoProjects()
            .then(items => {
                if (!cancelled) {
                    setProjects(items);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setProjectsError(err);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setProjectsLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const projectName = value?.projectName || '';

    return (
        <div className='deploy-models__context'>
            <div className='argo-form-row deploy-models__field'>
                <label htmlFor='deploy-models-project-select'>Project</label>
                <div className='deploy-models__select'>
                    <Select
                        id='deploy-models-project-select'
                        value={projectName}
                        options={[
                            {title: projectsLoading ? 'Loading projects…' : '— select project —', value: ''},
                            ...projects.map(project => ({title: project.metadata.name, value: project.metadata.name}))
                        ]}
                        placeholder={projectsLoading ? 'Loading projects…' : '— select project —'}
                        onChange={option => onChange(option.value ? {projectName: option.value} : null)}
                    />
                </div>
            </div>

            {projectsError && <ErrorAlert error={projectsError} prefix='Unable to load Argo CD projects' />}

            {!projectsLoading && projects.length === 0 && !projectsError && (
                <NoticeAlert variant='warning' message='No projects are visible to this Argo CD user.' />
            )}

            {value && (
                <div className='deploy-models__context-summary'>
                    <div className='deploy-models__context-summary-title'>Selected Project</div>
                    <div className='deploy-models__context-summary-grid'>
                        <div className='deploy-models__context-summary-item'>
                            <span className='deploy-models__context-summary-label'>Project</span>
                            <span>{value.projectName}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
