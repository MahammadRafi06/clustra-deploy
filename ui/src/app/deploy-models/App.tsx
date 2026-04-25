import React, {useLayoutEffect, useState} from 'react';

import {EmptyState} from '../shared/components';

import {setArgoProxyContext} from './api';
import {AppContextProvider} from './components/AppContext';
import {AppNameBadge} from './components/AppNameBadge';
import {ContextSelector, type SelectedAppTarget} from './components/ContextSelector';
import {DeployTargetNotice} from './components/DeployTargetNotice';
import {TASK_OPTIONS, TaskSelector} from './components/TaskSelector';
import type {TaskKey} from './components/TaskSelector';
import {DefaultPage} from './pages/DefaultPage';
import {EstimatePage} from './pages/EstimatePage';
import {ExpPage} from './pages/ExpPage';
import {GeneratePage} from './pages/GeneratePage';
import {SupportPage} from './pages/SupportPage';

function TaskPage({task}: {task: TaskKey}) {
    switch (task) {
        case 'default':
            return <DefaultPage />;
        case 'experiment':
            return <ExpPage />;
        case 'generate':
            return <GeneratePage />;
        case 'support':
            return <SupportPage />;
        case 'estimate':
            return <EstimatePage />;
    }
}

export function DeployModelsPage() {
    const [task, setTask] = useState<TaskKey>('default');
    const [selectedTarget, setSelectedTarget] = useState<SelectedAppTarget | null>(null);
    const activeTask = TASK_OPTIONS.find(option => option.value === task) || TASK_OPTIONS[0];

    useLayoutEffect(() => {
        if (selectedTarget) {
            setArgoProxyContext({
                applicationName: selectedTarget.appName,
                applicationNamespace: selectedTarget.appNamespace,
                projectName: selectedTarget.projectName
            });
            return () => setArgoProxyContext(null);
        }

        setArgoProxyContext(null);
        return () => setArgoProxyContext(null);
    }, [selectedTarget]);

    return (
        <AppContextProvider appName={selectedTarget?.appName} appNamespace={selectedTarget?.appNamespace} projectName={selectedTarget?.projectName}>
            <main className='deploy-models'>
                <section className='white-box deploy-models__panel'>
                    <div className='deploy-models__panel-header'>
                        <div>
                            <div className='deploy-models__panel-title'>Target Context</div>
                            <div className='deploy-models__panel-description'>
                                Select the Argo CD project and application that provide run context and, for write workflows, receive generated manifests.
                            </div>
                        </div>
                        <AppNameBadge />
                    </div>
                    <ContextSelector value={selectedTarget} onChange={setSelectedTarget} />
                </section>

                <section className='white-box deploy-models__panel'>
                    <div className='deploy-models__panel-header'>
                        <div>
                            <div className='deploy-models__panel-title'>Workflow</div>
                            <div className='deploy-models__panel-description'>Pick the task you want to run against the selected target.</div>
                        </div>
                    </div>
                    <TaskSelector value={task} onChange={setTask} />
                </section>

                {selectedTarget ? (
                    <section className='white-box deploy-models__panel'>
                        <div className='deploy-models__panel-header deploy-models__panel-header--split'>
                            <div>
                                <div className='deploy-models__panel-title'>{activeTask.title}</div>
                                <div className='deploy-models__panel-description'>{activeTask.description}</div>
                            </div>
                            <div className='deploy-models__summary'>
                                <div className='deploy-models__summary-item'>
                                    <span className='deploy-models__summary-label'>Project</span>
                                    <span>{selectedTarget.projectName}</span>
                                </div>
                                <div className='deploy-models__summary-item'>
                                    <span className='deploy-models__summary-label'>Application</span>
                                    <span>{selectedTarget.appName}</span>
                                </div>
                            </div>
                        </div>
                        <DeployTargetNotice target={selectedTarget} task={task} />
                        <TaskPage key={`${selectedTarget.appNamespace}/${selectedTarget.appName}:${task}`} task={task} />
                    </section>
                ) : (
                    <section className='white-box deploy-models__panel deploy-models__panel--empty'>
                        <EmptyState icon='fa fa-project-diagram'>
                            <h4>Choose a target to continue</h4>
                            <h5>The workflow forms activate after you pick an Argo CD project and application.</h5>
                        </EmptyState>
                    </section>
                )}
            </main>
        </AppContextProvider>
    );
}
