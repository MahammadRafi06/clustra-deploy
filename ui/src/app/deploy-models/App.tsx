import {SlidingPanel} from 'argo-ui';
import React, {useCallback, useLayoutEffect, useState} from 'react';

import {EmptyState, PageHeader} from '../shared/components';

import {setArgoProxyContext} from './api';
import {AppContextProvider} from './components/AppContext';
import {ContextSelector, type SelectedAppTarget} from './components/ContextSelector';
import {DeploymentsTable} from './components/DeploymentsTable';
import {DefaultPage} from './pages/DefaultPage';

export function DeployModelsPage() {
    const [selectedTarget, setSelectedTarget] = useState<SelectedAppTarget | null>(null);
    // The deployments list is always visible (owner-scoped, no app gating).
    // "Deploy Model" reveals the deploy form, which DOES need a target context.
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

    const handleDeploySettled = useCallback(() => setDeploymentsReloadKey(key => key + 1), []);

    return (
        <AppContextProvider appName={selectedTarget?.appName} appNamespace={selectedTarget?.appNamespace} projectName={selectedTarget?.projectName}>
            <main className='deploy-models' role='main' aria-label='Model Deployments'>
                <PageHeader
                    title='Model Deployments'
                    description='Every model you have deployed. Deploy a new one, or remove an existing deployment.'
                    actions={
                        <>
                            <button
                                type='button'
                                className='argo-button argo-button--base-o'
                                onClick={() => setDeploymentsReloadKey(key => key + 1)}
                                aria-label='Refresh deployments'>
                                <i className='fa fa-sync' aria-hidden='true' /> Refresh
                            </button>
                            <button type='button' className='argo-button argo-button--base' onClick={() => setDeployFormOpen(true)}>
                                <i className='fa fa-plus' /> Deploy AI
                            </button>
                        </>
                    }
                />

                <DeploymentsTable reloadKey={deploymentsReloadKey} />

                <SlidingPanel isShown={deployFormOpen} onClose={() => setDeployFormOpen(false)} isMiddle={true} hasCloseButton={true} header={<strong>Deploy an AI Model</strong>}>
                    {deployFormOpen ? (
                        <div className='deploy-models__drawer'>
                            <p className='deploy-models__panel-description'>
                                Pick an Argo CD project and application, then run the planner. Successful runs commit generated manifests back to the selected source.
                            </p>

                            <ContextSelector value={selectedTarget} onChange={setSelectedTarget} />

                            {selectedTarget ? (
                                <DefaultPage key={`${selectedTarget.appNamespace}/${selectedTarget.appName}`} onDeploySettled={handleDeploySettled} />
                            ) : (
                                <div className='deploy-models__panel deploy-models__panel--empty'>
                                    <EmptyState icon='fa fa-project-diagram'>
                                        <h4>Choose a target to continue</h4>
                                        <h5>The deploy form activates after you pick an Argo CD project and application.</h5>
                                    </EmptyState>
                                </div>
                            )}
                        </div>
                    ) : null}
                </SlidingPanel>
            </main>
        </AppContextProvider>
    );
}
