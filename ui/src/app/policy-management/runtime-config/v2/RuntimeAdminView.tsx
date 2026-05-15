import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';

import type {DeploymentType, PolicyApiClient, RuntimeConfigCatalogRecord, RuntimeConfigRoleSchemaRecord} from '../../api/types';
import {PolicyConfirmDialog} from '../../components/PolicyConfirmDialog';
import {PolicyError} from '../../components/PolicyError';
import {formatPolicyJson, parsePolicyJson} from '../../validation';
import {RuntimeConfigAdminPanel} from '../RuntimeConfigListComponents';
import {activeRoleSchema} from '../runtimeConfigUtils';
import {CatalogImportPanel} from './components/CatalogImportPanel';
import {ConceptBrowser} from './components/ConceptBrowser';

/**
 * Admin entry-point rendered inside the v2 library shell.
 *
 * Wraps the structured `RuntimeConfigAdminPanel` (already used by the
 * legacy workspace) so v2 users can reach role-schema and catalog
 * management without falling back to ?ui=legacy.
 *
 * The wrapped panel itself is already structured (segmented role designer
 * + advanced JSON fallback). This wrapper owns just the data lifecycle
 * (load, save schema, delete catalog) and the v2-styled chrome.
 */
export const RuntimeAdminView: React.FC<{
    client: PolicyApiClient;
    onBack: () => void;
}> = ({client, onBack}) => {
    const [catalogs, setCatalogs] = useState<RuntimeConfigCatalogRecord[]>([]);
    const [roleSchemas, setRoleSchemas] = useState<RuntimeConfigRoleSchemaRecord[]>([]);
    const [schemaDeployment, setSchemaDeployment] = useState<DeploymentType>('disagg');
    const [schemaText, setSchemaText] = useState('');
    const [schemaPending, setSchemaPending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<unknown | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [deleteCatalog, setDeleteCatalog] = useState<RuntimeConfigCatalogRecord | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [catalogResult, schemaResult] = await Promise.all([
                client.listRuntimeConfigCatalogs({active: true, limit: 200, offset: 0}),
                client.listRuntimeConfigRoleSchemas({active: true, limit: 20, offset: 0})
            ]);
            setCatalogs(catalogResult.catalogs || []);
            setRoleSchemas(schemaResult.role_schemas || []);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [client]);

    useEffect(() => {
        load();
    }, [load]);

    // Re-seed the schema text whenever the active deployment changes or the
    // loaded role schemas refresh.
    useEffect(() => {
        const schema = activeRoleSchema(roleSchemas, schemaDeployment);
        setSchemaText(schema ? formatPolicyJson(schema.schema) : formatPolicyJson({deployment_type: schemaDeployment, active: true, roles: []}));
    }, [roleSchemas, schemaDeployment]);

    function showToast(message: string) {
        setToast(message);
        window.setTimeout(() => setToast(null), 3000);
    }

    async function saveSchema() {
        setSchemaPending(true);
        setError(null);
        const parsed = parsePolicyJson(schemaText);
        if (!parsed.document) {
            setError(new Error(parsed.errors.join(' ')));
            setSchemaPending(false);
            return;
        }
        try {
            await client.updateRuntimeConfigRoleSchema(schemaDeployment, parsed.document);
            await load();
            showToast('Role schema saved.');
        } catch (err) {
            setError(err);
        } finally {
            setSchemaPending(false);
        }
    }

    async function confirmDeleteCatalog() {
        if (!deleteCatalog) return;
        try {
            await client.deleteRuntimeConfigCatalog(deleteCatalog.catalog_id);
            setDeleteCatalog(null);
            await load();
            showToast('Catalog disabled.');
        } catch (err) {
            setError(err);
        }
    }

    return (
        <main className='policy-management rcfg-v2-admin' role='main' aria-label='Runtime config administration'>
            <header className='rcfg-v2-admin__topbar'>
                <button type='button' className='rcfg-v2-editor__back' onClick={onBack} aria-label='Back to library'>
                    <i className='fa fa-chevron-left' aria-hidden='true' />
                    <span>Library</span>
                </button>
                <div className='rcfg-v2-admin__titles'>
                    <div className='rcfg-v2-library__eyebrow'>Runtime configuration · admin</div>
                    <h1>Role schemas &amp; catalogs</h1>
                    <p>Define which roles appear for each deployment type, and manage the engine and frontend catalogs available to policies.</p>
                </div>
                <button type='button' className='argo-button argo-button--base-o' onClick={() => load()} aria-label='Refresh admin data'>
                    <i className='fa fa-sync' aria-hidden='true' /> Refresh
                </button>
            </header>

            {toast && <div className='policy-management__toast'>{toast}</div>}
            {error && <PolicyError error={error} prefix='Admin action failed' />}

            {isLoading ? (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                    <p>Loading admin data…</p>
                </div>
            ) : (
                <>
                    <RuntimeConfigAdminPanel
                        catalogs={catalogs}
                        schemaDeployment={schemaDeployment}
                        schemaText={schemaText}
                        schemaPending={schemaPending}
                        onSchemaDeploymentChange={setSchemaDeployment}
                        onSchemaTextChange={setSchemaText}
                        onSaveSchema={saveSchema}
                        onDeleteCatalog={setDeleteCatalog}
                    />
                    <CatalogImportPanel
                        client={client}
                        onImported={() => {
                            showToast('Catalogs imported.');
                            load();
                        }}
                    />
                    <ConceptBrowser client={client} />
                </>
            )}

            {deleteCatalog && (
                <PolicyConfirmDialog
                    title='Disable Catalog'
                    message={`Disable ${deleteCatalog.catalog_id}? Policies referencing this catalog will lose access to its fields until it is re-enabled.`}
                    confirmLabel='Disable'
                    onCancel={() => setDeleteCatalog(null)}
                    onConfirm={confirmDeleteCatalog}
                    pending={false}
                />
            )}
        </main>
    );
};
