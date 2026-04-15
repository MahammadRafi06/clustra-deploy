import React, { useEffect, useState } from 'react';
import { setArgoProxyContext } from './api';
import { AppContextProvider } from './components/AppContext';
import { AppNameBadge } from './components/AppNameBadge';
import { ContextSelector, type SelectedAppTarget } from './components/ContextSelector';
import { NoticeAlert } from './components/NoticeAlert';
import { TASK_OPTIONS, TaskSelector } from './components/TaskSelector';
import type { TaskKey } from './components/TaskSelector';
import { DefaultPage } from './pages/DefaultPage';
import { EstimatePage } from './pages/EstimatePage';
import { ExpPage } from './pages/ExpPage';
import { GeneratePage } from './pages/GeneratePage';
import { SupportPage } from './pages/SupportPage';

function TaskPage({ task }: { task: TaskKey }) {
  switch (task) {
    case 'default':    return <DefaultPage />;
    case 'experiment': return <ExpPage />;
    case 'generate':   return <GeneratePage />;
    case 'support':    return <SupportPage />;
    case 'estimate':   return <EstimatePage />;
  }
}

export function DeployModelsPage() {
  const [task, setTask] = useState<TaskKey>('default');
  const [selectedTarget, setSelectedTarget] = useState<SelectedAppTarget | null>(null);
  const activeTask = TASK_OPTIONS.find(option => option.value === task) ?? TASK_OPTIONS[0];

  useEffect(() => {
    if (selectedTarget) {
      setArgoProxyContext({
        applicationName: selectedTarget.appName,
        applicationNamespace: selectedTarget.appNamespace,
        projectName: selectedTarget.projectName,
      });
      return () => setArgoProxyContext(null);
    }

    setArgoProxyContext(null);
    return () => setArgoProxyContext(null);
  }, [selectedTarget]);

  return (
    <AppContextProvider
      appName={selectedTarget?.appName}
      appNamespace={selectedTarget?.appNamespace}
      projectName={selectedTarget?.projectName}
    >
      <div className="clustra-ext">
        <div className="cext-header cext-header--hero">
          <div className="cext-header__copy">
            <div className="cext-header__eyebrow">Clustra AI Delivery Workspace</div>
            <h2 className="cext-header__title">
              <i className="fa fa-rocket" style={{ marginRight: 8, color: 'var(--brand-emerald)' }} />
              Deploy Models
            </h2>
            <p className="cext-header__subtitle">
              Choose an existing Argo CD target, then plan, validate, or generate the deployment that will be committed to Git.
            </p>
          </div>
          <div className="cext-header__aside">
            <AppNameBadge />
            <div className="cext-header__hint">
              <i className="fa fa-info-circle" />
              Business users can stay on this page for both sizing and deployment.
            </div>
          </div>
        </div>

        <div className="cext-body cext-body--page">
          <div className="cext-workspace">
            <section className="cext-main">
              <div className="cext-task-shell">
                <ContextSelector value={selectedTarget} onChange={setSelectedTarget} />

                <div className="cext-panel cext-panel--workflow">
                  <div className="cext-panel__header">
                    <div>
                      <div className="cext-panel__eyebrow">Workflow</div>
                      <div className="cext-panel__title">Choose what you want to do</div>
                      <div className="cext-panel__subtitle">
                        Each workflow uses the same target context, but focuses on a different decision or deployment action.
                      </div>
                    </div>
                  </div>
                  <TaskSelector value={task} onChange={setTask} />
                </div>

                {selectedTarget ? (
                  <div className="cext-panel cext-panel--task">
                    <div className="cext-panel__header cext-panel__header--split">
                      <div>
                        <div className="cext-panel__eyebrow">{activeTask.label}</div>
                        <div className="cext-panel__title">{activeTask.title}</div>
                        <div className="cext-panel__subtitle">{activeTask.description}</div>
                      </div>
                      <div className="cext-task-summary">
                        <div className="cext-task-summary__item">
                          <span className="cext-task-summary__label">Project</span>
                          <span>{selectedTarget.projectName}</span>
                        </div>
                        <div className="cext-task-summary__item">
                          <span className="cext-task-summary__label">Application</span>
                          <span>{selectedTarget.appName}</span>
                        </div>
                      </div>
                    </div>
                    <TaskPage key={`${selectedTarget.appNamespace}/${selectedTarget.appName}:${task}`} task={task} />
                  </div>
                ) : (
                  <div className="cext-panel cext-panel--empty">
                    <div className="cext-empty-state">
                      <div className="cext-empty-state__icon">
                        <i className="fa fa-project-diagram" />
                      </div>
                      <div className="cext-empty-state__title">Choose a target to unlock the workflows</div>
                      <div className="cext-empty-state__subtitle">
                        The task forms become active once this page knows which Argo CD application and Git destination you want to work with.
                      </div>
                      <NoticeAlert
                        variant="info"
                        message="Start by selecting a project and application. The service will then load the deploy workflows with the correct GitOps context."
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className="cext-rail cext-rail--side">
              <div className="cext-sidecard">
                <div className="cext-sidecard__title">How This Flows</div>
                <div className="cext-sidecard__steps">
                  <div className="cext-sidecard__step">
                    <span className="cext-sidecard__step-num">1</span>
                    <span>Select the Argo project and application that should receive the manifest.</span>
                  </div>
                  <div className="cext-sidecard__step">
                    <span className="cext-sidecard__step-num">2</span>
                    <span>Pick the workflow that matches your goal: compare options, estimate, or deploy directly.</span>
                  </div>
                  <div className="cext-sidecard__step">
                    <span className="cext-sidecard__step-num">3</span>
                    <span>Run the task and let the service retain the artifacts while committing the selected deploy file to Git.</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppContextProvider>
  );
}
