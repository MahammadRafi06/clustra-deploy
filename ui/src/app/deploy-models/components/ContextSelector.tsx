import {Select} from 'argo-ui';
import React, {useEffect, useMemo, useState} from 'react';

import {listArgoApplications, listArgoProjects} from '../api';
import type {Application, ApplicationSource, Project} from '../types';
import {ErrorAlert} from './ErrorAlert';
import {NoticeAlert} from './NoticeAlert';

export interface SelectedAppTarget {
    appName: string;
    appNamespace: string;
    projectName: string;
    application: Application;
}

interface ContextSelectorProps {
    value: SelectedAppTarget | null;
    onChange: (target: SelectedAppTarget | null) => void;
}

function applicationKey(application: Application): string {
    return `${application.metadata.namespace || 'argocd'}:${application.metadata.name}`;
}

function toTarget(application: Application, projectName: string): SelectedAppTarget {
    return {
        appName: application.metadata.name,
        appNamespace: application.metadata.namespace || 'argocd',
        projectName,
        application
    };
}

function primarySource(application: Application): ApplicationSource | undefined {
    return application.spec.source || application.spec.sources?.[0];
}

export function ContextSelector({value, onChange}: ContextSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectName, setProjectName] = useState(value?.projectName || '');
    const [applications, setApplications] = useState<Application[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [applicationsError, setApplicationsError] = useState<string | null>(null);

    useEffect(() => {
        if (value?.projectName && value.projectName !== projectName) {
            setProjectName(value.projectName);
        }
    }, [projectName, value?.projectName]);

    useEffect(() => {
        let cancelled = false;
        setProjectsLoading(true);
        setProjectsError(null);

        listArgoProjects()
            .then(items => {
                if (cancelled) {
                    return;
                }

                setProjects(items);
                if (!projectName && items.length > 0) {
                    const defaultProject = items.find(item => item.metadata.name === 'default')?.metadata.name || items[0].metadata.name;
                    setProjectName(defaultProject);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setProjectsError(err instanceof Error ? err.message : String(err));
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

    useEffect(() => {
        let cancelled = false;

        if (!projectName) {
            setApplications([]);
            setApplicationsLoading(false);
            setApplicationsError(null);
            return;
        }

        setApplicationsLoading(true);
        setApplicationsError(null);
        listArgoApplications(projectName)
            .then(items => {
                if (cancelled) {
                    return;
                }

                const filtered = items.filter(item => (item.spec.project || '') === projectName);
                setApplications(filtered);

                const currentSelection = value ? filtered.find(item => applicationKey(item) === `${value.appNamespace}:${value.appName}`) : null;
                if (currentSelection) {
                    onChange(toTarget(currentSelection, projectName));
                    return;
                }

                if (filtered.length === 1) {
                    onChange(toTarget(filtered[0], projectName));
                    return;
                }

                onChange(null);
            })
            .catch(err => {
                if (!cancelled) {
                    setApplicationsError(err instanceof Error ? err.message : String(err));
                    setApplications([]);
                    onChange(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setApplicationsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [onChange, projectName, value]);

    const applicationValue = value ? `${value.appNamespace}:${value.appName}` : '';
    const selectedSource = useMemo(() => (value ? primarySource(value.application) : undefined), [value]);

    function handleProjectChange(nextProjectName: string) {
        setProjectName(nextProjectName);
        setApplications([]);
        setApplicationsError(null);
        onChange(null);
    }

    function handleApplicationChange(nextApplication: string) {
        const selectedApplication = applications.find(item => applicationKey(item) === nextApplication);
        if (!selectedApplication || !projectName) {
            onChange(null);
            return;
        }
        onChange(toTarget(selectedApplication, projectName));
    }

    return (
        <div className='deploy-models__context'>
            <div className='deploy-models__context-grid'>
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
                    {!projectsError && <p className='deploy-models__field-hint'>Existing Argo CD projects visible to the current user.</p>}
                </div>

                <div className='argo-form-row deploy-models__field'>
                    <label htmlFor='deploy-models-application-select'>Application</label>
                    <div className='deploy-models__select'>
                        <Select
                            id='deploy-models-application-select'
                            value={applicationValue}
                            options={[
                                {
                                    title: !projectName ? 'Select a project first' : applicationsLoading ? 'Loading applications…' : '— select application —',
                                    value: ''
                                },
                                ...applications.map(application => ({
                                    title: `${application.metadata.namespace || 'argocd'}/${application.metadata.name}`,
                                    value: applicationKey(application)
                                }))
                            ]}
                            placeholder={!projectName ? 'Select a project first' : applicationsLoading ? 'Loading applications…' : '— select application —'}
                            onChange={option => handleApplicationChange(option.value)}
                        />
                    </div>
                    {!applicationsError && <p className='deploy-models__field-hint'>Existing Argo CD applications inside the selected project.</p>}
                </div>
            </div>

            {projectsError && <ErrorAlert message={`Unable to load Argo CD projects: ${projectsError}`} />}
            {applicationsError && <ErrorAlert message={`Unable to load Argo CD applications: ${applicationsError}`} />}

            {!projectsLoading && projects.length === 0 && <NoticeAlert variant='warning' message='No projects are visible to this Argo CD user.' />}

            {!applicationsLoading && projectName && applications.length === 0 && !applicationsError && (
                <NoticeAlert variant='warning' message={`No applications are currently available in project "${projectName}".`} />
            )}

            {!value && projectName && applications.length > 1 && !applicationsLoading && !applicationsError && (
                <NoticeAlert variant='info' message='Pick an application to load deploy context and Git target details.' />
            )}

            {value && (
                <div className='deploy-models__context-summary'>
                    <div className='deploy-models__context-summary-title'>Selected Target</div>
                    <div className='deploy-models__context-summary-grid'>
                        <div className='deploy-models__context-summary-item'>
                            <span className='deploy-models__context-summary-label'>Application</span>
                            <span>
                                {value.appNamespace}/{value.appName}
                            </span>
                        </div>
                        <div className='deploy-models__context-summary-item'>
                            <span className='deploy-models__context-summary-label'>Project</span>
                            <span>{value.projectName}</span>
                        </div>
                        {selectedSource?.repoURL && (
                            <div className='deploy-models__context-summary-item'>
                                <span className='deploy-models__context-summary-label'>Repository</span>
                                <span>{selectedSource.repoURL}</span>
                            </div>
                        )}
                        {selectedSource?.path && (
                            <div className='deploy-models__context-summary-item'>
                                <span className='deploy-models__context-summary-label'>Path</span>
                                <span>{selectedSource.path}</span>
                            </div>
                        )}
                        {selectedSource?.targetRevision && (
                            <div className='deploy-models__context-summary-item'>
                                <span className='deploy-models__context-summary-label'>Revision</span>
                                <span>{selectedSource.targetRevision}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
