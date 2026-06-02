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
    // "Deploy AI" reveals the deploy form, which needs a project context.
    const [deployFormOpen, setDeployFormOpen] = useState(false);
    const [deploymentsReloadKey, setDeploymentsReloadKey] = useState(0);

    useLayoutEffect(() => {
        // Repo-per-team flow is project-scoped: the proxy signs the request with
        // only the project, and the SCM-matrix ApplicationSet generates the
        // Application from the committed deployment directory. No app context.
        if (selectedTarget) {
            setArgoProxyContext({projectName: selectedTarget.projectName});
            return () => setArgoProxyContext(null);
        }
        setArgoProxyContext(null);
        return () => setArgoProxyContext(null);
    }, [selectedTarget]);

    const handleDeploySettled = useCallback(() => setDeploymentsReloadKey(key => key + 1), []);

    return (
        <AppContextProvider projectName={selectedTarget?.projectName}>
            <main className='deploy-models' role='main' aria-label='Model Deployments'>
                <PageHeader
                    title='AI Model Deployments'
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
                                Pick an Argo CD project + namespace and name the deployment, then run the planner. Successful runs commit the generated DGD to the
                                team repository, where Argo CD deploys it automatically.
                            </p>

                            <ContextSelector value={selectedTarget} onChange={setSelectedTarget} />

                            {selectedTarget && selectedTarget.namespace ? (
                                <DefaultPage
                                    key={`${selectedTarget.projectName}/${selectedTarget.namespace}`}
                                    projectName={selectedTarget.projectName}
                                    namespace={selectedTarget.namespace}
                                    onDeploySettled={handleDeploySettled}
                                />
                            ) : (
                                <div className='deploy-models__panel deploy-models__panel--empty'>
                                    <EmptyState icon='fa fa-project-diagram'>
                                        <h4>Choose a project + namespace to continue</h4>
                                        <h5>The deploy form activates after you pick an Argo CD project and one of its onboarded namespaces.</h5>
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
