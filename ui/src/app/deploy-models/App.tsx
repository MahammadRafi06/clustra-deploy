import React, {useLayoutEffect, useState} from 'react';

import {EmptyState} from '../shared/components';

import {setArgoProxyContext} from './api';
import {AppContextProvider} from './components/AppContext';
import {AppNameBadge} from './components/AppNameBadge';
import {ContextSelector, type SelectedAppTarget} from './components/ContextSelector';
import {DefaultPage} from './pages/DefaultPage';

export function DeployModelsPage() {
    const [selectedTarget, setSelectedTarget] = useState<SelectedAppTarget | null>(null);

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
            <main className='deploy-models' role='main' aria-label='Model Deployments'>
                <section className='deploy-models__hero'>
                    <div className='deploy-models__hero-titles'>
                        <div className='deploy-models__eyebrow'>Model deployment</div>
                        <h1>Model Deployments</h1>
                        <p>Pick an Argo CD project and application, then run the planner to size the deployment and commit generated manifests back to the selected source.</p>
                    </div>
                    <div className='deploy-models__hero-actions'>
                        <AppNameBadge />
                    </div>
                </section>

                <section className='deploy-models__panel'>
                    <header className='deploy-models__panel-header'>
                        <div>
                            <h2 className='deploy-models__panel-title'>Target Context</h2>
                            <p className='deploy-models__panel-description'>
                                Choose the project and application used for deployment planning. Successful runs commit generated manifests back to the selected source.
                            </p>
                        </div>
                    </header>
                    <ContextSelector value={selectedTarget} onChange={setSelectedTarget} />
                </section>

                {selectedTarget ? (
                    <section className='deploy-models__panel'>
                        <header className='deploy-models__panel-header deploy-models__panel-header--split'>
                            <div>
                                <h2 className='deploy-models__panel-title'>Find Best Deployment Plan</h2>
                                <p className='deploy-models__panel-description'>
                                    Runs an exact preflight, picks a deployment shape, and writes manifests if the run succeeds.
                                </p>
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
                        </header>
                        <DefaultPage key={`${selectedTarget.appNamespace}/${selectedTarget.appName}`} />
                    </section>
                ) : (
                    <section className='deploy-models__panel deploy-models__panel--empty'>
                        <EmptyState icon='fa fa-project-diagram'>
                            <h4>Choose a target to continue</h4>
                            <h5>The deployment form activates after you pick an Argo CD project and application.</h5>
                        </EmptyState>
                    </section>
                )}
            </main>
        </AppContextProvider>
    );
}
