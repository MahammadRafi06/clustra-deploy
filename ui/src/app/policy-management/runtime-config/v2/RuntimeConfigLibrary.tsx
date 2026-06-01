import * as React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {DataTable, PageHeader, StatusPill} from '../../../shared/components';
import type {ActiveFilter, DeploymentType, PolicyApiClient, RuntimeConfigCatalogRecord, RuntimeConfigPolicyRecord, RuntimeConfigRoleSchemaRecord} from '../../api/types';
import {PolicyConfirmDialog} from '../../components/PolicyConfirmDialog';
import {PolicyError} from '../../components/PolicyError';
import {formatRelativeTime} from '../../formatters';
import {
    activeParam,
    cloneDocument,
    defaultRuntimeDocument,
    RUNTIME_POLICY_FETCH_LIMIT,
    runtimeDeploymentLabel,
    runtimeDescription,
    runtimeEngineLabel,
    unique
} from '../runtimeConfigUtils';
import type {RuntimeDocument} from '../runtimeConfigTypes';
import {AuditDrawer} from './components/AuditDrawer';
import {CompareDialog} from './components/CompareDialog';
import {MigrateDialog} from './components/MigrateDialog';
import {PolicyCard} from './components/PolicyCard';
import {PolicyDetailsDrawer} from './components/PolicyDetailsDrawer';
import {RuntimeAdminView} from './RuntimeAdminView';
import {RuntimeConfigEditor} from './RuntimeConfigEditor';
import {RuntimeConfigWizard} from './RuntimeConfigWizard';
import type {TuningIntent} from './types';
import {readPolicyTags} from './utils';

const INTENT_OPTIONS: Array<{value: TuningIntent | 'all'; label: string}> = [
    {value: 'all', label: 'All intents'},
    {value: 'latency', label: 'Latency'},
    {value: 'throughput', label: 'Throughput'},
    {value: 'cost', label: 'Cost'},
    {value: 'balanced', label: 'Balanced'},
    {value: 'debug', label: 'Debug / dev'}
];

type EditingState = {mode: 'create' | 'edit'; document: RuntimeDocument; original: RuntimeConfigPolicyRecord | null; ui: 'wizard' | 'editor'} | null;

export const RuntimeConfigLibrary: React.FC<{
    client: PolicyApiClient;
    title: string;
    description: string;
}> = ({client, title, description}) => {
    const [policies, setPolicies] = useState<RuntimeConfigPolicyRecord[]>([]);
    const [catalogs, setCatalogs] = useState<RuntimeConfigCatalogRecord[]>([]);
    const [roleSchemas, setRoleSchemas] = useState<RuntimeConfigRoleSchemaRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<unknown | null>(null);
    const [actionError, setActionError] = useState<unknown | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [intent, setIntent] = useState<'all' | TuningIntent>('all');
    const [active, setActive] = useState<ActiveFilter>('all');
    const [engineFilter, setEngineFilter] = useState('all');
    const [deploymentFilter, setDeploymentFilter] = useState<'all' | DeploymentType>('all');
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [driftFilter, setDriftFilter] = useState<'all' | 'drift' | 'clean'>('all');
    const [editing, setEditing] = useState<EditingState>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RuntimeConfigPolicyRecord | null>(null);
    const [compareTarget, setCompareTarget] = useState<RuntimeConfigPolicyRecord | null>(null);
    const [detailsTarget, setDetailsTarget] = useState<RuntimeConfigPolicyRecord | null>(null);
    const [migrateTarget, setMigrateTarget] = useState<RuntimeConfigPolicyRecord | null>(null);
    const [auditTarget, setAuditTarget] = useState<RuntimeConfigPolicyRecord | null>(null);
    const [adminOpen, setAdminOpen] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [policyResult, catalogResult, schemaResult] = await Promise.all([
                client.listRuntimeConfigPolicies({active: activeParam(active), limit: RUNTIME_POLICY_FETCH_LIMIT, offset: 0}),
                client.listRuntimeConfigCatalogs({active: true, limit: 200, offset: 0}),
                client.listRuntimeConfigRoleSchemas({active: true, limit: 20, offset: 0})
            ]);
            setPolicies(policyResult.runtime_config_policies || []);
            setCatalogs(catalogResult.catalogs || []);
            setRoleSchemas(schemaResult.role_schemas || []);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [active, client]);

    useEffect(() => {
        load();
    }, [load]);

    const allTags = useMemo(() => {
        const set = new Set<string>();
        policies.forEach(record => readPolicyTags(record).tags.forEach(tag => set.add(tag)));
        return Array.from(set).sort();
    }, [policies]);

    const engines = useMemo(() => unique(policies.map(record => record.engine)), [policies]);

    const templates = useMemo(() => policies.filter(record => record.managed_by === 'system'), [policies]);
    const myPolicies = useMemo(() => policies.filter(record => record.managed_by !== 'system'), [policies]);

    const driftCount = useMemo(() => myPolicies.reduce((acc, record) => acc + (record.drift_count && record.drift_count > 0 ? 1 : 0), 0), [myPolicies]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return myPolicies.filter(record => {
            const tags = readPolicyTags(record);
            if (engineFilter !== 'all' && record.engine !== engineFilter) return false;
            if (deploymentFilter !== 'all' && record.deployment_type !== deploymentFilter) return false;
            if (tagFilter !== 'all' && !tags.tags.includes(tagFilter)) return false;
            if (intent !== 'all' && tags.intent !== intent) return false;
            if (active === 'active' && !record.active) return false;
            if (active === 'inactive' && record.active) return false;
            if (driftFilter === 'drift' && !(record.drift_count && record.drift_count > 0)) return false;
            if (driftFilter === 'clean' && record.drift_count && record.drift_count > 0) return false;
            if (!query) return true;
            const haystack = [
                record.policy_id,
                runtimeDescription(record),
                record.engine,
                runtimeEngineLabel(record.engine),
                record.engine_version,
                record.dynamo_version,
                ...tags.tags
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [active, deploymentFilter, driftFilter, engineFilter, intent, myPolicies, search, tagFilter]);

    function showToast(message: string) {
        setToast(message);
        window.setTimeout(() => setToast(null), 3000);
    }

    function openCreate() {
        setActionError(null);
        // Create flow defaults to the guided wizard — most users approaching
        // a blank policy benefit from step-by-step structure.
        setEditing({
            mode: 'create',
            document: defaultRuntimeDocument(catalogs, deploymentFilter === 'all' ? 'disagg' : deploymentFilter),
            original: null,
            ui: 'wizard'
        });
    }

    async function openEdit(record: RuntimeConfigPolicyRecord) {
        setActionError(null);
        try {
            const latest = await client.getRuntimeConfigPolicy(record.policy_id);
            // Edit flow defaults to the advanced editor — users tweaking an
            // existing policy want fast access to "show only modified",
            // Cmd+K search, and the live preview.
            // Edit defaults to the wizard with values prepopulated — same
            // structured flow as create, just stepping through existing data.
            // Power users can drop to the advanced editor via the in-wizard
            // "Switch to advanced editor" button.
            setEditing({mode: 'edit', document: cloneDocument(latest.document), original: latest, ui: 'wizard'});
        } catch (err) {
            setActionError(err);
        }
    }

    function openClone(record: RuntimeConfigPolicyRecord) {
        setActionError(null);
        // A clone is conceptually a new policy — guided wizard by default.
        setEditing({
            mode: 'create',
            document: {
                ...cloneDocument(record.document),
                policy_id: '',
                active: true,
                display_name: `Copy of ${runtimeDescription(record)}`
            },
            original: null,
            ui: 'wizard'
        });
    }

    function openTemplate(record: RuntimeConfigPolicyRecord) {
        // "Use as starting point" is just clone with a fresh policy_id.
        openClone(record);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await client.deleteRuntimeConfigPolicy(deleteTarget.policy_id);
            setDeleteTarget(null);
            await load();
            showToast('Policy archived.');
        } catch (err) {
            setActionError(err);
        }
    }

    if (adminOpen) {
        return (
            <RuntimeAdminView
                client={client}
                onBack={() => {
                    setAdminOpen(false);
                    load();
                }}
            />
        );
    }

    if (editing) {
        const sharedProps = {
            client,
            mode: editing.mode,
            initialDocument: editing.document,
            original: editing.original,
            catalogs,
            roleSchemas,
            allPolicies: policies,
            onClose: () => setEditing(null),
            onSaved: async () => {
                const savedMode = editing.mode;
                setEditing(null);
                await load();
                showToast(savedMode === 'edit' ? 'Runtime config policy updated.' : 'Runtime config policy created.');
            }
        };
        if (editing.ui === 'wizard') {
            return <RuntimeConfigWizard {...sharedProps} onSwitchToEditor={() => setEditing({...editing, ui: 'editor'})} />;
        }
        return <RuntimeConfigEditor {...sharedProps} onSwitchToWizard={() => setEditing({...editing, ui: 'wizard'})} />;
    }

    const activeFilterCount =
        (engineFilter !== 'all' ? 1 : 0) +
        (deploymentFilter !== 'all' ? 1 : 0) +
        (intent !== 'all' ? 1 : 0) +
        (tagFilter !== 'all' ? 1 : 0) +
        (active !== 'all' ? 1 : 0) +
        (driftFilter !== 'all' ? 1 : 0);

    return (
        <main className='policy-management rcfg-v2-library' role='main' aria-label='Runtime Config Policies'>
            <PageHeader
                eyebrow='Runtime configuration'
                title={title}
                description={description}
                actions={
                    <>
                        <button type='button' className='rcfg-v2-icon-btn' onClick={() => load()} aria-label='Refresh policy list' title='Refresh'>
                            <i className='fa fa-sync' aria-hidden='true' />
                        </button>
                        <button type='button' className='rcfg-v2-icon-btn' onClick={() => setAdminOpen(true)} aria-label='Open runtime config admin' title='Admin'>
                            <i className='fa fa-cog' aria-hidden='true' />
                        </button>
                        <span className='rcfg-v2-icon-btn__separator' aria-hidden='true' />
                        <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={openCreate}>
                            Start blank
                        </button>
                        <button type='button' className='argo-button argo-button--base policy-management__create-button' onClick={openCreate}>
                            <i className='fa fa-plus' aria-hidden='true' /> New policy
                        </button>
                    </>
                }
            />

            {toast && <div className='policy-management__toast'>{toast}</div>}
            {error && <PolicyError error={error} prefix='Failed to load runtime config policies' />}
            {actionError && <PolicyError error={actionError} prefix='Runtime config action failed' />}

            {templates.length > 0 && (
                <section className='rcfg-v2-library__templates' aria-label='Curated templates'>
                    <header>
                        <div>
                            <h2>
                                <i className='fa fa-star' aria-hidden='true' /> Templates
                            </h2>
                            <p>Curated starting points. Clone and tune for your deployment.</p>
                        </div>
                        <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{templates.length} available</span>
                    </header>
                    <div className='rcfg-v2-library__cards rcfg-v2-library__cards--templates'>
                        {templates.map(record => (
                            <PolicyCard
                                key={record.policy_id}
                                record={record}
                                selected={selectedId === record.policy_id}
                                onSelect={() => setSelectedId(record.policy_id)}
                                onEdit={openTemplate}
                                onClone={openClone}
                                onCompare={setCompareTarget}
                                onDetails={setDetailsTarget}
                            />
                        ))}
                    </div>
                </section>
            )}

            <section className='rcfg-v2-library__main'>
                <header className='rcfg-v2-library__main-head'>
                    <div>
                        <h2>My policies</h2>
                        <small>
                            {filtered.length} of {myPolicies.length}
                        </small>
                    </div>
                    <div className='rcfg-v2-library__main-head-actions'>
                        {driftCount > 0 && driftFilter !== 'drift' && (
                            <button
                                type='button'
                                className='argo-button argo-button--base-o rcfg-v2-library__drift-shortcut'
                                onClick={() => setDriftFilter('drift')}
                                title='Filter to policies whose authoring catalog has been replaced'>
                                <i className='fa fa-exclamation-triangle' aria-hidden='true' /> {driftCount} need{driftCount === 1 ? 's' : ''} migration
                            </button>
                        )}
                    </div>
                </header>

                <div className='rcfg-v2-library__searchbar' role='search'>
                    <div className='rcfg-v2-search rcfg-v2-search--inline'>
                        <i className='fa fa-search' aria-hidden='true' />
                        <input
                            className='argo-field'
                            type='search'
                            placeholder='Search by name, ID, engine, or tag…'
                            value={search}
                            aria-label='Search policies'
                            onChange={event => setSearch(event.target.value)}
                        />
                        {search && (
                            <button type='button' className='rcfg-v2-search__clear' onClick={() => setSearch('')} aria-label='Clear search'>
                                <i className='fa fa-times' aria-hidden='true' />
                            </button>
                        )}
                    </div>
                    <details className='rcfg-v2-library__filters-disclosure' open={activeFilterCount > 0}>
                        <summary aria-label='Toggle filter panel'>
                            <i className='fa fa-filter' aria-hidden='true' />
                            <span>Filters</span>
                            {activeFilterCount > 0 && <span className='rcfg-v2-library__filters-count'>{activeFilterCount}</span>}
                        </summary>
                        <div className='rcfg-v2-library__filters' aria-label='Filter runtime config policies'>
                            <Select
                                label='Engine'
                                value={engineFilter}
                                onChange={setEngineFilter}
                                options={[{value: 'all', label: 'All engines'}, ...engines.map(engine => ({value: engine, label: runtimeEngineLabel(engine)}))]}
                            />
                            <Select
                                label='Deployment'
                                value={deploymentFilter}
                                onChange={value => setDeploymentFilter(value as 'all' | DeploymentType)}
                                options={[
                                    {value: 'all', label: 'All deployments'},
                                    {value: 'agg', label: 'Aggregated'},
                                    {value: 'disagg', label: 'Disaggregated'}
                                ]}
                            />
                            <Select
                                label='Intent'
                                value={intent}
                                onChange={value => setIntent(value as 'all' | TuningIntent)}
                                options={INTENT_OPTIONS.map(option => ({value: option.value, label: option.label}))}
                            />
                            <Select
                                label='Tag'
                                value={tagFilter}
                                onChange={setTagFilter}
                                options={[{value: 'all', label: 'All tags'}, ...allTags.map(tag => ({value: tag, label: `#${tag}`}))]}
                            />
                            <Select
                                label='Status'
                                value={active}
                                onChange={value => setActive(value as ActiveFilter)}
                                options={[
                                    {value: 'all', label: 'All status'},
                                    {value: 'active', label: 'Active'},
                                    {value: 'inactive', label: 'Archived'}
                                ]}
                            />
                            <Select
                                label='Catalog drift'
                                value={driftFilter}
                                onChange={value => setDriftFilter(value as 'all' | 'drift' | 'clean')}
                                options={[
                                    {value: 'all', label: 'All'},
                                    {value: 'drift', label: `Has drift${driftCount > 0 ? ` (${driftCount})` : ''}`},
                                    {value: 'clean', label: 'Up to date'}
                                ]}
                            />
                            {activeFilterCount > 0 && (
                                <button
                                    type='button'
                                    className='argo-button argo-button--base-o'
                                    onClick={() => {
                                        setEngineFilter('all');
                                        setDeploymentFilter('all');
                                        setIntent('all');
                                        setTagFilter('all');
                                        setActive('all');
                                        setDriftFilter('all');
                                    }}>
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </details>
                </div>

                {isLoading ? (
                    <div className='rcfg-v2-empty rcfg-v2-empty--loading'>
                        <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                        <p>Loading policies…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    myPolicies.length === 0 ? (
                        <div className='rcfg-v2-empty rcfg-v2-empty--first'>
                            <div className='rcfg-v2-empty__icon' aria-hidden='true'>
                                <i className='fa fa-sliders-h' />
                            </div>
                            <h3>No custom policies yet</h3>
                            <p>Clone one of the intent templates above to get a tuned starting point — or start blank for full control.</p>
                            <div className='rcfg-v2-empty__actions'>
                                <button type='button' className='argo-button argo-button--base policy-management__create-button' onClick={openCreate}>
                                    Start blank
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className='rcfg-v2-empty rcfg-v2-empty--filtered'>
                            <div className='rcfg-v2-empty__icon' aria-hidden='true'>
                                <i className='fa fa-filter' />
                            </div>
                            <h3>No policies match your filters</h3>
                            <p>Try clearing one filter at a time, or reset all filters and start over.</p>
                            <div className='rcfg-v2-empty__actions'>
                                <button
                                    type='button'
                                    className='argo-button argo-button--base-o policy-management__button'
                                    onClick={() => {
                                        setSearch('');
                                        setEngineFilter('all');
                                        setDeploymentFilter('all');
                                        setIntent('all');
                                        setTagFilter('all');
                                        setActive('all');
                                        setDriftFilter('all');
                                    }}>
                                    Clear all filters
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <DataTable<RuntimeConfigPolicyRecord>
                        ariaLabel='Runtime config policies'
                        columns={[
                            {
                                key: 'select',
                                width: '32px',
                                header: '',
                                render: record => (
                                    <span onClick={e => e.stopPropagation()}>
                                        <input
                                            type='radio'
                                            name='rcfg-selected-policy'
                                            className='policy-management__row-radio'
                                            aria-label={`Select ${runtimeDescription(record)}`}
                                            checked={selectedId === record.policy_id}
                                            onChange={() => setSelectedId(record.policy_id)}
                                        />
                                    </span>
                                )
                            },
                            {
                                key: 'policy',
                                header: 'Policy',
                                width: 'minmax(0, 2fr)',
                                render: record => (
                                    <div className='ctbl__stack'>
                                        <span className='ctbl__primary'>{runtimeDescription(record)}</span>
                                        <span className='ctbl__secondary'>{record.policy_id}</span>
                                    </div>
                                )
                            },
                            {
                                key: 'engine',
                                header: 'Engine',
                                width: 'minmax(0, 1fr)',
                                render: record => (
                                    <div className='ctbl__stack'>
                                        <span>{runtimeEngineLabel(record.engine)}</span>
                                        <span className='ctbl__secondary'>{record.engine_version}</span>
                                    </div>
                                )
                            },
                            {
                                key: 'deployment',
                                header: 'Deployment',
                                width: 'minmax(0, 0.9fr)',
                                render: record => <span className='ctbl__secondary'>{runtimeDeploymentLabel(record.deployment_type)}</span>
                            },
                            {
                                key: 'status',
                                header: 'Status',
                                width: 'minmax(0, 1.1fr)',
                                render: record => (
                                    <span className='ctbl__line'>
                                        <StatusPill tone={record.active ? 'success' : 'neutral'}>{record.active ? 'active' : 'archived'}</StatusPill>
                                        {typeof record.drift_count === 'number' && record.drift_count > 0 && (
                                            <StatusPill
                                                tone='warning'
                                                icon='fa fa-exclamation-triangle'
                                                title='Authored against a catalog version that has been replaced — click to migrate'
                                                onClick={() => setMigrateTarget(record)}>
                                                drift
                                            </StatusPill>
                                        )}
                                    </span>
                                )
                            },
                            {
                                key: 'updated',
                                header: 'Updated',
                                width: 'minmax(0, 0.9fr)',
                                render: record => <span className='ctbl__secondary'>{formatRelativeTime(record.updated_at)}</span>
                            }
                        ]}
                        rows={filtered}
                        rowKey={record => record.policy_id}
                        onRowClick={setDetailsTarget}
                        isRowSelected={record => selectedId === record.policy_id}
                    />
                )}

                {selectedId && filtered.find(record => record.policy_id === selectedId) && (
                    <div className='rcfg-v2-floating-actions' role='toolbar'>
                        <span>
                            Selected: <code>{selectedId}</code>
                        </span>
                        <button
                            type='button'
                            className='argo-button argo-button--base-o'
                            onClick={() => {
                                const record = filtered.find(r => r.policy_id === selectedId);
                                if (record) setCompareTarget(record);
                            }}>
                            Compare with…
                        </button>
                        <button
                            type='button'
                            className='argo-button argo-button--base-o policy-management__button--danger'
                            onClick={() => {
                                const record = filtered.find(r => r.policy_id === selectedId);
                                if (record && record.managed_by !== 'system') setDeleteTarget(record);
                            }}>
                            Archive
                        </button>
                    </div>
                )}
            </section>

            <CompareDialog open={!!compareTarget} base={compareTarget} candidates={policies} roleSchemas={roleSchemas} client={client} onClose={() => setCompareTarget(null)} />

            <MigrateDialog
                open={!!migrateTarget}
                target={migrateTarget}
                client={client}
                onClose={() => setMigrateTarget(null)}
                onApplied={async () => {
                    setMigrateTarget(null);
                    await load();
                    showToast('Policy migrated to current catalog.');
                }}
            />

            <PolicyDetailsDrawer
                open={!!detailsTarget}
                record={detailsTarget}
                roleSchemas={roleSchemas}
                onClose={() => setDetailsTarget(null)}
                onEdit={record => {
                    setDetailsTarget(null);
                    openEdit(record);
                }}
                onClone={record => {
                    setDetailsTarget(null);
                    openClone(record);
                }}
                onCompare={record => {
                    setDetailsTarget(null);
                    setCompareTarget(record);
                }}
                onArchive={record => {
                    setDetailsTarget(null);
                    setDeleteTarget(record);
                }}
                onAudit={record => {
                    setDetailsTarget(null);
                    setAuditTarget(record);
                }}
            />

            <AuditDrawer open={!!auditTarget} target={auditTarget} client={client} onClose={() => setAuditTarget(null)} />

            {deleteTarget && (
                <PolicyConfirmDialog
                    title='Archive Runtime Config Policy'
                    message={`Archive ${deleteTarget.policy_id}? Existing deployments are not affected. The policy can be reactivated later.`}
                    confirmLabel='Archive'
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                    pending={false}
                />
            )}
        </main>
    );
};

const Select: React.FC<{label: string; value: string; onChange: (value: string) => void; options: Array<{value: string; label: string}>}> = ({label, value, onChange, options}) => (
    <label className='rcfg-v2-select'>
        <span>{label}</span>
        <select className='argo-field' value={value} aria-label={label} onChange={event => onChange(event.target.value)}>
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </label>
);
