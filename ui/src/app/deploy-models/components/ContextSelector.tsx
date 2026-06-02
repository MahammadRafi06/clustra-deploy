import {Select} from 'argo-ui';
import React, {useEffect, useMemo, useState} from 'react';

import {listArgoProjects} from '../api';
import type {Project} from '../types';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

// Repo-per-team deploy: the user picks a PROJECT (team) and one of the team's
// onboarded NAMESPACES; the deployment name is typed in the form. The SCM-matrix
// ApplicationSet generates the Application from the committed <ns>/<deployment> dir.
export interface SelectedAppTarget {
    projectName: string;
    namespace: string;
}

interface ContextSelectorProps {
    value: SelectedAppTarget | null;
    onChange: (target: SelectedAppTarget | null) => void;
}

// The team's onboarded namespaces = the project's explicit destination namespaces
// (admin-managed). Glob patterns (e.g. "acme-*") are not concrete namespaces, so
// they're excluded from the picker.
function projectNamespaces(project: Project | undefined): string[] {
    const names = (project?.spec?.destinations || []).map(dest => (dest.namespace || '').trim()).filter(name => name && !name.includes('*'));
    return Array.from(new Set(names)).sort();
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
    const selectedProject = useMemo(() => projects.find(project => project.metadata.name === projectName), [projects, projectName]);
    const namespaceOptions = useMemo(() => projectNamespaces(selectedProject), [selectedProject]);

    function handleProjectChange(name: string) {
        if (!name) {
            onChange(null);
            return;
        }
        const namespaces = projectNamespaces(projects.find(project => project.metadata.name === name));
        // Default to the team namespace (== project name) when present, else the
        // first onboarded namespace, else empty (nothing onboarded yet).
        const defaultNs = namespaces.includes(name) ? name : namespaces[0] || '';
        onChange({projectName: name, namespace: defaultNs});
    }

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
                        onChange={option => handleProjectChange(option.value)}
                    />
                </div>
            </div>

            {value && (
                <div className='argo-form-row deploy-models__field'>
                    <label htmlFor='deploy-models-namespace-select'>Namespace</label>
                    <div className='deploy-models__select'>
                        <Select
                            id='deploy-models-namespace-select'
                            value={value.namespace}
                            options={[
                                {title: namespaceOptions.length ? '— select namespace —' : 'No namespaces onboarded', value: ''},
                                ...namespaceOptions.map(ns => ({title: ns, value: ns}))
                            ]}
                            placeholder='— select namespace —'
                            onChange={option => onChange({projectName: value.projectName, namespace: option.value})}
                        />
                    </div>
                </div>
            )}

            {projectsError && <ErrorAlert error={projectsError} prefix='Unable to load Argo CD projects' />}

            {!projectsLoading && projects.length === 0 && !projectsError && (
                <NoticeAlert variant='warning' message='No projects are visible to this Argo CD user.' />
            )}

            {value && namespaceOptions.length === 0 && (
                <NoticeAlert
                    variant='warning'
                    message={`Project "${value.projectName}" has no onboarded namespaces. An admin must add one (Namespace + model-cache PV/PVC) via the dangerzone repo and the project's AppProject destinations before you can deploy.`}
                />
            )}

            {value && value.namespace && (
                <div className='deploy-models__context-summary'>
                    <div className='deploy-models__context-summary-title'>Target</div>
                    <div className='deploy-models__context-summary-grid'>
                        <div className='deploy-models__context-summary-item'>
                            <span className='deploy-models__context-summary-label'>Project</span>
                            <span>{value.projectName}</span>
                        </div>
                        <div className='deploy-models__context-summary-item'>
                            <span className='deploy-models__context-summary-label'>Namespace</span>
                            <span>{value.namespace}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
