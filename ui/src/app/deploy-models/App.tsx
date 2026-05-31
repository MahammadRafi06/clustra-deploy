import React, {useCallback, useEffect, useLayoutEffect, useState} from 'react';

import {EmptyState} from '../shared/components';

import {setArgoProxyContext} from './api';
import {AppContextProvider} from './components/AppContext';
import {AppNameBadge} from './components/AppNameBadge';
import {ContextSelector, type SelectedAppTarget} from './components/ContextSelector';
import {DeploymentsTable} from './components/DeploymentsTable';
import {DefaultPage} from './pages/DefaultPage';

export function DeployModelsPage() {
    const [selectedTarget, setSelectedTarget] = useState<SelectedAppTarget | null>(null);
    // The deployments list is the primary view; the deploy form is revealed on
    // demand via "+ Deploy Model". deploymentsReloadKey bumps after a run
    // commits so the table refreshes without a manual reload.
    const [deployFormOpen, setDeployFormOpen] = useState(false);
    const [deploymentsReloadKey, setDeploymentsReloadKey] = useState(0);

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

    // Collapse the form back down whenever the target changes, so a new context
    // starts on its deployments list rather than a stale open form.
    useEffect(() => {
        setDeployFormOpen(false);
    }, [selectedTarget?.appNamespace, selectedTarget?.appName]);

    // Stable reference so the deploy form's settle effect doesn't re-run every
    // render. Bumps the reload key to refresh the deployments table once a run
    // commits.
    const handleDeploySettled = useCallback(() => setDeploymentsReloadKey(key => key + 1), []);

    return (
        <AppContextProvider appName={selectedTarget?.appName} appNamespace={selectedTarget?.appNamespace} projectName={selectedTarget?.projectName}>
            <main className='deploy-models' role='main' aria-label='Model Deployments'>
                <section className='deploy-models__hero'>
                    <div className='deploy-models__hero-titles'>
                        <div className='deploy-models__eyebrow'>Model deployment</div>
                        <h1>Model Deployments</h1>
                        <p>Pick an Argo CD project and application to review its deployed models, then deploy a new one or remove an existing deployment.</p>
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
                    <>
                        <DeploymentsTable reloadKey={deploymentsReloadKey} onDeployModel={() => setDeployFormOpen(true)} />

                        {deployFormOpen ? (
                            <section className='deploy-models__panel'>
                                <header className='deploy-models__panel-header deploy-models__panel-header--split'>
                                    <div>
                                        <h2 className='deploy-models__panel-title'>Find Best Deployment Plan</h2>
                                        <p className='deploy-models__panel-description'>Picks a deployment shape and writes manifests if the run succeeds.</p>
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
                                        <button type='button' className='argo-button argo-button--base-o' onClick={() => setDeployFormOpen(false)}>
                                            Close
                                        </button>
                                    </div>
                                </header>
                                <DefaultPage key={`${selectedTarget.appNamespace}/${selectedTarget.appName}`} onDeploySettled={handleDeploySettled} />
                            </section>
                        ) : null}
                    </>
                ) : (
                    <section className='deploy-models__panel deploy-models__panel--empty'>
                        <EmptyState icon='fa fa-project-diagram'>
                            <h4>Choose a target to continue</h4>
                            <h5>The deployments list and deploy form activate after you pick an Argo CD project and application.</h5>
                        </EmptyState>
                    </section>
                )}
            </main>
        </AppContextProvider>
    );
}
