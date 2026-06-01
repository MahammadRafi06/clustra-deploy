import {SlidingPanel} from 'argo-ui';
import React, {useCallback, useEffect, useLayoutEffect, useState} from 'react';

import {EmptyState, PageHeader} from '../shared/components';

import {listDeployments, setArgoProxyContext} from './api';
import {AppContextProvider} from './components/AppContext';
import {ContextSelector, type SelectedAppTarget} from './components/ContextSelector';
import {DeploymentsTable} from './components/DeploymentsTable';
import {NoticeAlert} from './components/NoticeAlert';
import {DefaultPage} from './pages/DefaultPage';

// A deployment occupies its Application while non-terminal (1:1: one app = one
// model). 'failed' does not occupy — it left no live DGD.
const OCCUPYING_STATUSES = new Set(['committing', 'active', 'removing']);

export function DeployModelsPage() {
    const [selectedTarget, setSelectedTarget] = useState<SelectedAppTarget | null>(null);
    // The deployments list is always visible (owner-scoped, no app gating).
    // "Deploy Model" reveals the deploy form, which DOES need a target context.
    const [deployFormOpen, setDeployFormOpen] = useState(false);
    const [deploymentsReloadKey, setDeploymentsReloadKey] = useState(0);
    // app_names that already hold a non-terminal deployment. ai-service rejects
    // deploying into an occupied app (1:1, delete-then-redeploy), so we gate the
    // form here for a clean flow rather than letting the user hit the 4xx.
    // Owner-scoped + best-effort; the backend guard is authoritative. Refreshed
    // whenever the deploy panel opens, so a just-deleted app frees up.
    const [occupiedApps, setOccupiedApps] = useState<ReadonlySet<string>>(new Set());

    useEffect(() => {
        if (!deployFormOpen) {
            return;
        }
        let cancelled = false;
        listDeployments({})
            .then(resp => {
                if (cancelled) {
                    return;
                }
                setOccupiedApps(
                    new Set(
                        resp.deployments
                            .filter(d => d.app_name && OCCUPYING_STATUSES.has(d.status))
                            .map(d => d.app_name as string)
                    )
                );
            })
            .catch(() => {
                // Best-effort gating only — the ai-service guard is authoritative.
            });
        return () => {
            cancelled = true;
        };
    }, [deployFormOpen, deploymentsReloadKey]);

    const targetOccupied = !!selectedTarget && occupiedApps.has(selectedTarget.appName);

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
                                Pick an Argo CD project and application, then run the planner. Successful runs commit generated manifests back to the selected source.
                            </p>

                            <ContextSelector value={selectedTarget} onChange={setSelectedTarget} occupiedApps={occupiedApps} />

                            {selectedTarget && targetOccupied ? (
                                <div className='deploy-models__panel'>
                                    <NoticeAlert
                                        variant='warning'
                                        message={`Application "${selectedTarget.appName}" already has a deployment. Each application serves one model — remove its deployment from the list first, then deploy a new one here.`}
                                    />
                                </div>
                            ) : selectedTarget ? (
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
