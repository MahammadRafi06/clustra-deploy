import * as React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

import type {
    DeploymentType,
    PolicyApiClient,
    RuntimeConfigCatalogItemRecord,
    RuntimeConfigCatalogRecord,
    RuntimeConfigKind,
    RuntimeConfigPolicyRecord,
    RuntimeConfigRoleSchemaRecord
} from '../../api/types';
import {PolicyError} from '../../components/PolicyError';
import {POLICY_ID_PATTERN} from '../../validation';
import {
    activeRoleSchema,
    cloneDocument,
    fetchRuntimeConfigCatalogItems,
    isRecord,
    normalizeRuntimeUserValue,
    roleKindKey,
    runtimeDeploymentLabel,
    runtimeEngineLabel,
    unique
} from '../runtimeConfigUtils';
import type {RuntimeDocument} from '../runtimeConfigTypes';
import {CatalogBrowser} from './components/CatalogBrowser';
import {GlobalSearch} from './components/GlobalSearch';
import {ImpactRibbon} from './components/ImpactRibbon';
import {LivePreview} from './components/LivePreview';
import {RadioGroup, RadioOption} from './components/RadioGroup';
import {RailSelection, RolesRail} from './components/RolesRail';
import {RoleArchitectureMini} from './components/RoleArchitectureMini';
import type {FieldDensity, RoleFilter, TuningIntent} from './types';
import {collectFieldErrors, collectModified, computeImpactSummary, errorsForRole, inheritedValueFor as inheritedValueForUtil, jsonMergePatchDiff, parseSelectionsFieldPath, readInheritance, readPolicyTags, setParentPolicyId, writePolicyTags} from './utils';
import {ApiError} from '../../../deploy-models/errors';

const INTENT_OPTIONS: Array<{value: '' | TuningIntent; label: string}> = [
    {value: '', label: 'No intent set'},
    {value: 'latency', label: 'Latency-tuned'},
    {value: 'throughput', label: 'Throughput-tuned'},
    {value: 'cost', label: 'Cost-tuned'},
    {value: 'balanced', label: 'Balanced'},
    {value: 'debug', label: 'Debug / dev'}
];

const STORAGE_KEYS = {
    density: 'rcfg.v2.density',
    filter: 'rcfg.v2.filter',
    hideAic: 'rcfg.v2.hideAic'
};

const ROLE_FILTER_VALUES: RoleFilter[] = ['essentials', 'latency', 'throughput', 'memory', 'stability', 'debug', 'all'];

function readStorage<T>(key: string, fallback: T, parse: (raw: string) => T | undefined): T {
    try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        if (raw == null) return fallback;
        const parsed = parse(raw);
        return parsed === undefined ? fallback : parsed;
    } catch {
        return fallback;
    }
}
function writeStorage(key: string, value: string) {
    try {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
        }
    } catch {
        // ignore
    }
}

export const RuntimeConfigEditor: React.FC<{
    client: PolicyApiClient;
    mode: 'create' | 'edit';
    initialDocument: RuntimeDocument;
    original?: RuntimeConfigPolicyRecord | null;
    catalogs: RuntimeConfigCatalogRecord[];
    roleSchemas: RuntimeConfigRoleSchemaRecord[];
    /** All known policies, used to render the parent-policy picker and resolve inheritance. */
    allPolicies?: RuntimeConfigPolicyRecord[];
    onClose: () => void;
    onSaved: () => Promise<void>;
    /** Optional handoff back to the guided wizard for users who want step-by-step. */
    onSwitchToWizard?: () => void;
}> = ({client, mode, initialDocument, original, catalogs, roleSchemas, allPolicies = [], onClose, onSaved, onSwitchToWizard}) => {
    const [document, setDocument] = useState<RuntimeDocument>(cloneDocument(initialDocument));
    const [itemsByRoleKind, setItemsByRoleKind] = useState<Record<string, RuntimeConfigCatalogItemRecord[]>>({});
    const [itemsLoading, setItemsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<unknown | null>(null);
    const [validation, setValidation] = useState<{level: 'ok' | 'warn'; message: string} | null>(null);
    const [selection, setSelection] = useState<RailSelection>({section: 'scope'});
    const [searchOpen, setSearchOpen] = useState(false);
    // Smart defaults:
    //  - create flow: focus on essentials (5–15 fields), let the user discover progressively
    //  - edit flow:   show only what's been modified (the most useful default for "I'm tweaking")
    const initialOnlyModified = mode === 'edit';
    const initialFilter: RoleFilter = mode === 'edit' ? 'all' : 'essentials';
    const [onlyModified, setOnlyModified] = useState<boolean>(initialOnlyModified);
    const [filter, setFilter] = useState<RoleFilter>(() =>
        readStorage<RoleFilter>(STORAGE_KEYS.filter, initialFilter, raw => ((ROLE_FILTER_VALUES as string[]).includes(raw) ? (raw as RoleFilter) : undefined))
    );
    const [density, setDensity] = useState<FieldDensity>(() =>
        readStorage<FieldDensity>(STORAGE_KEYS.density, 'rows', raw => (raw === 'rows' || raw === 'cards' ? raw : undefined))
    );
    // Default to showing AIC fields. They render disabled with an explicit
    // "AIC" chip, so visibility is the discoverable behavior; hiding is the
    // opt-in for cleaner views.
    const [hideAic, setHideAic] = useState<boolean>(() => readStorage<boolean>(STORAGE_KEYS.hideAic, false, raw => (raw === 'true' ? true : raw === 'false' ? false : undefined)));
    useEffect(() => {
        writeStorage(STORAGE_KEYS.filter, filter);
    }, [filter]);
    useEffect(() => {
        writeStorage(STORAGE_KEYS.density, density);
    }, [density]);
    useEffect(() => {
        writeStorage(STORAGE_KEYS.hideAic, String(hideAic));
    }, [hideAic]);

    const deploymentType = (document.deployment_type === 'agg' ? 'agg' : 'disagg') as DeploymentType;
    const roleSchema = activeRoleSchema(roleSchemas, deploymentType);
    const roles = useMemo(() => roleSchema?.schema?.roles || [], [roleSchema]);

    const engine = typeof document.engine === 'string' ? document.engine : '';
    const engineVersion = typeof document.engine_version === 'string' ? document.engine_version : '';
    const dynamoVersion = typeof document.dynamo_version === 'string' ? document.dynamo_version : '';
    const roleSignature = roles.map(role => `${role.role}:${role.catalog_scope}`).join('|');

    const engineOptions = useMemo(
        () => unique(catalogs.filter(catalog => catalog.engine !== 'frontend' && (!dynamoVersion || catalog.dynamo_version === dynamoVersion)).map(catalog => catalog.engine)),
        [catalogs, dynamoVersion]
    );
    const dynamoOptions = useMemo(() => unique(catalogs.map(catalog => catalog.dynamo_version)), [catalogs]);
    const engineVersionOptions = useMemo(
        () => unique(catalogs.filter(catalog => catalog.engine === engine && catalog.dynamo_version === dynamoVersion).map(catalog => catalog.engine_version)),
        [catalogs, dynamoVersion, engine]
    );

    useEffect(() => {
        if (engineOptions.length && !engineOptions.includes(engine)) {
            setDocument(current => ({...current, engine: engineOptions[0], engine_version: ''}));
        }
    }, [engine, engineOptions]);

    useEffect(() => {
        if (engineVersionOptions.length && !engineVersionOptions.includes(engineVersion)) {
            setDocument(current => ({...current, engine_version: engineVersionOptions[0]}));
        }
    }, [engineVersion, engineVersionOptions]);

    const loadItems = useCallback(async () => {
        if (!roles.length || !dynamoVersion || !engine || !engineVersion) {
            setItemsByRoleKind({});
            return;
        }
        setItemsLoading(true);
        setError(null);
        try {
            const entries = await Promise.all(
                roles.flatMap(role =>
                    (['args', 'envs'] as RuntimeConfigKind[]).map(async kind => {
                        const catalogEngine = role.catalog_scope === 'frontend' ? 'frontend' : engine;
                        const version = role.catalog_scope === 'frontend' ? dynamoVersion : engineVersion;
                        const items = await fetchRuntimeConfigCatalogItems(client, {
                            engine: catalogEngine,
                            version,
                            dynamo_version: dynamoVersion,
                            kind,
                            deployment_type: deploymentType,
                            role: role.role,
                            active: true
                        });
                        return [roleKindKey(role.role, kind), items] as const;
                    })
                )
            );
            setItemsByRoleKind(Object.fromEntries(entries));
        } catch (loadError) {
            setError(loadError);
        } finally {
            setItemsLoading(false);
        }
    }, [client, deploymentType, dynamoVersion, engine, engineVersion, roleSignature]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    // ⌘K / Ctrl+K to open global search
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const modified = useMemo(() => collectModified(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const fieldErrors = useMemo(() => collectFieldErrors(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const totalErrors = Object.keys(fieldErrors).length;
    const errorCountByRole = useMemo(() => {
        const map: Record<string, number> = {};
        roles.forEach(role => {
            map[role.role] = errorsForRole(fieldErrors, role.role);
        });
        return map;
    }, [fieldErrors, roles]);

    // Inheritance: read parent_policy_id from document.metadata, resolve to a record,
    // and surface locked fields. We pass these into the catalog browser to disable
    // editing of any field a parent has locked.
    const docAsRecord = useMemo<RuntimeConfigPolicyRecord>(() => ({document, managed_by: original?.managed_by ?? 'custom'}) as RuntimeConfigPolicyRecord, [document, original]);
    const inheritance = useMemo(() => readInheritance(docAsRecord, allPolicies), [allPolicies, docAsRecord]);
    const parentPolicy = useMemo(() => allPolicies.find(record => record.policy_id === inheritance.parentPolicyId), [allPolicies, inheritance.parentPolicyId]);

    function setField(name: string, value: unknown) {
        setValidation(null);
        setDocument(current => ({...current, [name]: value}));
    }

    function setScopeFields(values: Partial<RuntimeDocument>) {
        setValidation(null);
        setDocument(current => ({...current, ...values, selections: {}}));
    }

    function buildDocumentForSave(): {document?: RuntimeDocument; errors: string[]} {
        const errors: string[] = [];
        const roleNames = new Set(roles.map(role => role.role));
        const normalized: RuntimeDocument = cloneDocument(document);
        const policyId = typeof normalized.policy_id === 'string' ? normalized.policy_id.trim() : '';
        const display = typeof normalized.display_name === 'string' ? normalized.display_name.trim() : '';
        if (!POLICY_ID_PATTERN.test(policyId)) {
            errors.push('Policy ID must be a lowercase slug using letters, numbers, dots, underscores, or hyphens.');
        }
        if (!display) {
            errors.push('Display name is required.');
        }
        if (!engine || !engineVersion || !dynamoVersion) {
            errors.push('Choose an engine, engine version, and Dynamo version from the imported catalogs.');
        }
        if (!roles.length) {
            errors.push(`No active role schema exists for ${runtimeDeploymentLabel(deploymentType)} deployments.`);
        }

        const rawSelections = isRecord(document.selections) ? document.selections : {};
        const nextSelections: Record<string, unknown> = {};
        let values = 0;
        Object.entries(rawSelections).forEach(([roleName, roleValue]) => {
            if (!roleNames.has(roleName)) {
                errors.push(`Role ${roleName} is not in the active ${runtimeDeploymentLabel(deploymentType)} role schema.`);
                return;
            }
            const roleSelection = isRecord(roleValue) ? roleValue : {};
            const nextRole: Record<string, unknown> = {};
            (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
                const selected = isRecord(roleSelection[kind]) ? (roleSelection[kind] as Record<string, unknown>) : {};
                const catalogItems = itemsByRoleKind[roleKindKey(roleName, kind)] || [];
                const byName = new Map(catalogItems.map(item => [item.name, item]));
                const nextKind: Record<string, unknown> = {};
                Object.entries(selected).forEach(([name, rawValue]) => {
                    const item = byName.get(name);
                    if (!item) {
                        errors.push(`${roleName}.${kind}.${name} is not available for the selected engine/version.`);
                        return;
                    }
                    const result = normalizeRuntimeUserValue(item, rawValue, `${roleName}.${kind}.${name}`);
                    if (result.error) {
                        errors.push(result.error);
                        return;
                    }
                    if (!result.unset) {
                        nextKind[name] = result.value;
                        values += 1;
                    }
                });
                if (Object.keys(nextKind).length) {
                    nextRole[kind] = nextKind;
                }
            });
            if (Object.keys(nextRole).length) {
                nextSelections[roleName] = nextRole;
            }
        });
        if (!values) {
            errors.push('Add at least one runtime arg or env value before saving.');
        }
        normalized.policy_id = policyId;
        normalized.display_name = display;
        normalized.engine = engine;
        normalized.engine_version = engineVersion;
        normalized.dynamo_version = dynamoVersion;
        normalized.deployment_type = deploymentType;
        normalized.active = document.active !== false;
        normalized.metadata = isRecord(document.metadata) ? document.metadata : {};
        normalized.selections = nextSelections;
        return errors.length ? {errors} : {document: normalized, errors};
    }

    function validateOnly() {
        setError(null);
        const result = buildDocumentForSave();
        if (result.errors.length) {
            setValidation(null);
            setError(new Error(result.errors.join(' ')));
            return;
        }
        setValidation({level: 'ok', message: `Policy is valid · ${modified.length} override(s) ready to save.`});
    }

    async function save() {
        setError(null);
        const result = buildDocumentForSave();
        if (!result.document || result.errors.length) {
            setValidation(null);
            setError(new Error(result.errors.join(' ')));
            return;
        }
        setIsSaving(true);
        try {
            if (mode === 'edit' && original) {
                // Send a JSON Merge Patch of just what changed. Sensitive fields
                // the user didn't touch are still "***" in `result.document`, so
                // they compare equal to the server's masked snapshot in
                // `original.document` and drop out of the diff — the encrypted
                // value stays put server-side.
                const patch = jsonMergePatchDiff(original.document, result.document);
                if (patch && typeof patch === 'object' && !Array.isArray(patch) && Object.keys(patch).length === 0) {
                    await onSaved();
                    return;
                }
                await client.patchRuntimeConfigPolicy(original.policy_id, patch as Record<string, unknown>);
            } else {
                await client.createRuntimeConfigPolicy(result.document);
            }
            await onSaved();
        } catch (saveError) {
            setError(saveError);
            if (saveError instanceof ApiError) {
                const parsed = parseSelectionsFieldPath(saveError.fieldPath);
                if (parsed) {
                    jumpToField(parsed.role, parsed.kind, parsed.name, 'error-flash');
                }
            }
        } finally {
            setIsSaving(false);
        }
    }

    const jumpToRole = useCallback((role: string) => {
        setSelection({section: 'role', role});
    }, []);

    function jumpToField(role: string, kind: RuntimeConfigKind, name: string, flash: 'flash' | 'error-flash' = 'flash') {
        setSelection({section: 'role', role});
        window.setTimeout(() => {
            const node = window.document.querySelector(`[data-field='${CSS.escape(name)}']`);
            if (node instanceof HTMLElement) {
                node.scrollIntoView({block: 'center', behavior: 'smooth'});
                const cls = `rcfg-v2-field--${flash}`;
                node.classList.add(cls);
                window.setTimeout(() => node.classList.remove(cls), flash === 'error-flash' ? 3200 : 1400);
            }
        }, 80);
    }

    const tags = readPolicyTags({document, managed_by: original?.managed_by ?? 'custom'} as RuntimeConfigPolicyRecord);

    const isDirty = JSON.stringify(document) !== JSON.stringify(initialDocument);
    const handleClose = useCallback(() => {
        if (isDirty && !window.confirm('Discard all unsaved changes and return to the library?')) return;
        onClose();
    }, [isDirty, onClose]);

    // Esc closes the editor (dirty-confirm respected). Skip when the global
    // search palette is open — it owns its own Esc handling.
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.metaKey || event.ctrlKey) return;
            if (searchOpen) return;
            event.preventDefault();
            handleClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleClose, searchOpen]);

    return (
        <main className='policy-management rcfg-v2-editor' role='main' aria-label={mode === 'edit' ? 'Edit runtime config policy' : 'Create runtime config policy'}>
            <header className='rcfg-v2-editor__topbar'>
                <button type='button' className='rcfg-v2-editor__back' onClick={handleClose} aria-label='Back to library'>
                    <i className='fa fa-chevron-left' aria-hidden='true' />
                    <span>Library</span>
                </button>
                <div className='rcfg-v2-editor__topbar-titles'>
                    <h1>{mode === 'edit' ? 'Edit policy' : 'New policy'}</h1>
                    {/* The override count lives in the sticky save bar — keep this
                        subtitle focused on the policy's identity. */}
                    <span>
                        {runtimeEngineLabel(engine) || 'Engine'} <strong>{engineVersion || '—'}</strong> · Dynamo <strong>{dynamoVersion || '—'}</strong> · {runtimeDeploymentLabel(deploymentType)}
                    </span>
                </div>
                <div className='rcfg-v2-editor__topbar-actions'>
                    {onSwitchToWizard && (
                        <button type='button' className='rcfg-v2-wizard__switch' onClick={onSwitchToWizard} title='Take me through this step by step'>
                            ← Switch to guided wizard
                        </button>
                    )}
                    {/* Validate as a quiet text-button so the primary action (Save in
                        the sticky bar) stays the visual focus. */}
                    <button type='button' className='rcfg-v2-editor__validate-link' onClick={validateOnly} title='Run client-side validation without saving'>
                        Validate
                    </button>
                </div>
            </header>

            {error && <PolicyError error={error} prefix='Policy save failed' />}
            {validation && (
                <div className={`rcfg-v2-banner rcfg-v2-banner--${validation.level}`} role='status'>
                    <i className='fa fa-check-circle' aria-hidden='true' /> {validation.message}
                </div>
            )}

            <div className='rcfg-v2-editor__layout'>
                <RolesRail
                    document={document}
                    roles={roles}
                    itemsByRoleKind={itemsByRoleKind}
                    selection={selection}
                    onSelect={setSelection}
                    onOpenSearch={() => setSearchOpen(true)}
                    onlyModified={onlyModified}
                    onToggleOnlyModified={setOnlyModified}
                    density={density}
                    onToggleDensity={() => setDensity(current => (current === 'rows' ? 'cards' : 'rows'))}
                    errorCountByRole={errorCountByRole}
                />

                <div className='rcfg-v2-editor__center'>
                    {selection.section === 'scope' && (
                        <ScopePanel
                            document={document}
                            mode={mode}
                            tagsValue={tags.tags.join(', ')}
                            intentValue={tags.intent || ''}
                            workloadClassValue={tags.workloadClass || ''}
                            dynamoOptions={dynamoOptions}
                            engineOptions={engineOptions}
                            engineVersionOptions={engineVersionOptions}
                            onChangeField={setField}
                            onChangeScope={setScopeFields}
                            onChangeTags={tagsStr => {
                                const list = tagsStr
                                    .split(',')
                                    .map(item => item.trim())
                                    .filter(Boolean);
                                setDocument(current => writePolicyTags(current, {tags: list}));
                            }}
                            onChangeIntent={value => setDocument(current => writePolicyTags(current, {intent: value === '' ? undefined : (value as TuningIntent)}))}
                            onChangeWorkloadClass={value => setDocument(current => writePolicyTags(current, {workloadClass: value}))}
                            parentPolicyId={inheritance.parentPolicyId || ''}
                            parentOptions={allPolicies
                                .filter(record => record.policy_id !== original?.policy_id && record.managed_by !== 'custom-archived')
                                .map(record => ({value: record.policy_id, label: `${(record.document?.display_name as string) || record.policy_id} · ${record.policy_id}`}))}
                            onChangeParent={(value: string) => setDocument(current => setParentPolicyId(current, value || undefined))}
                            lockedFieldCount={inheritance.lockedFields.size}
                        />
                    )}

                    {selection.section === 'role' &&
                        selection.role &&
                        (itemsLoading ? (
                            <div className='rcfg-v2-empty'>
                                <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                                <p>Loading catalog for {selection.role}…</p>
                            </div>
                        ) : (
                            (() => {
                                const role = roles.find(r => r.role === selection.role);
                                if (!role) {
                                    return (
                                        <div className='rcfg-v2-empty'>
                                            <p>Role not found in the active schema.</p>
                                        </div>
                                    );
                                }
                                // Per-role impact summary uses only modifications for this role.
                                const roleModified = modified.filter(entry => entry.role === role.role);
                                const roleImpact = computeImpactSummary(roleModified);
                                // Wizard-style progression hint without forcing a wizard:
                                // figure out what the natural "next" section is.
                                const idx = roles.findIndex(r => r.role === role.role);
                                const nextRole = idx >= 0 && idx < roles.length - 1 ? roles[idx + 1] : null;
                                return (
                                    <>
                                        <RoleArchitectureMini
                                            roles={roles}
                                            activeRole={role.role}
                                            onSelect={target => setSelection({section: 'role', role: target})}
                                        />
                                        <ImpactRibbon summary={roleImpact} overrideCount={roleModified.length} />
                                        <CatalogBrowser
                                            role={role}
                                            document={document}
                                            items={{
                                                args: itemsByRoleKind[roleKindKey(role.role, 'args')] || [],
                                                envs: itemsByRoleKind[roleKindKey(role.role, 'envs')] || []
                                            }}
                                            onChange={next => setDocument(next)}
                                            onlyModified={onlyModified}
                                            density={density}
                                            filter={filter}
                                            onFilterChange={setFilter}
                                            hideAic={hideAic}
                                            onToggleHideAic={setHideAic}
                                            lockedFields={inheritance.lockedFields}
                                            lockedByLabel={inheritance.parentDisplayName}
                                            inheritedValueFor={(kind, name) => inheritedValueForUtil(parentPolicy, role.role, kind, name)}
                                            fieldErrors={fieldErrors}
                                        />
                                        <nav className='rcfg-v2-role-next' aria-label='Section progression'>
                                            <span className='rcfg-v2-role-next__hint'>Done with {role.label}?</span>
                                            {nextRole ? (
                                                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => setSelection({section: 'role', role: nextRole.role})}>
                                                    Continue to {nextRole.label} →
                                                </button>
                                            ) : (
                                                <button type='button' className='argo-button argo-button--base policy-management__create-button' onClick={() => setSelection({section: 'summary'})}>
                                                    Review &amp; save →
                                                </button>
                                            )}
                                        </nav>
                                    </>
                                );
                            })()
                        ))}

                    {selection.section === 'summary' && <SummaryPanel document={document} modified={modified} roles={roles} onJumpTo={jumpToRole} />}
                </div>

                <LivePreview
                    document={document}
                    roles={roles}
                    itemsByRoleKind={itemsByRoleKind}
                    onJumpTo={jumpToRole}
                    autoCollapse={selection.section === 'scope'}
                />
            </div>

            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} roles={roles} itemsByRoleKind={itemsByRoleKind} onJump={jumpToField} />

            {/* Sticky save bar so the user always has a quick path to Save / Discard
                regardless of how far down the catalog they've scrolled. Only shows
                once there's something to save (modified.length > 0) or when there
                are validation issues to surface. */}
            {modified.length > 0 && (
                <div className={`rcfg-v2-stickybar ${totalErrors > 0 ? 'rcfg-v2-stickybar--invalid' : ''}`} role='region' aria-label='Unsaved changes'>
                    <div className='rcfg-v2-stickybar__msg'>
                        {totalErrors > 0 ? (
                            <>
                                <i className='fa fa-exclamation-circle' aria-hidden='true' />
                                <strong>
                                    {totalErrors} validation error{totalErrors === 1 ? '' : 's'}
                                </strong>
                                <small>Fix the highlighted fields to save.</small>
                            </>
                        ) : (
                            <>
                                <i className='fa fa-circle' aria-hidden='true' />
                                <strong>{modified.length}</strong> override{modified.length === 1 ? '' : 's'} ready to save
                                <small>{mode === 'edit' && original ? `on ${original.policy_id}` : 'new policy'}</small>
                            </>
                        )}
                    </div>
                    <div className='rcfg-v2-stickybar__actions'>
                        {mode === 'edit' && (
                            <button
                                type='button'
                                className='argo-button argo-button--base-o policy-management__button'
                                onClick={() => {
                                    if (window.confirm('Discard all unsaved changes?')) {
                                        setDocument(cloneDocument(initialDocument));
                                        setValidation(null);
                                        setError(null);
                                    }
                                }}>
                                Discard
                            </button>
                        )}
                        <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={validateOnly}>
                            Validate
                        </button>
                        <button
                            type='button'
                            className='argo-button argo-button--base policy-management__create-button'
                            onClick={save}
                            disabled={isSaving || !roles.length || totalErrors > 0}
                            title={totalErrors > 0 ? `Fix the ${totalErrors} validation error${totalErrors === 1 ? '' : 's'} flagged on role fields before saving.` : undefined}>
                            {isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save policy'}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
};

const ScopePanel: React.FC<{
    document: RuntimeDocument;
    mode: 'create' | 'edit';
    tagsValue: string;
    intentValue: string;
    workloadClassValue: string;
    dynamoOptions: string[];
    engineOptions: string[];
    engineVersionOptions: string[];
    onChangeField: (name: string, value: unknown) => void;
    onChangeScope: (values: Partial<RuntimeDocument>) => void;
    onChangeTags: (tags: string) => void;
    onChangeIntent: (intent: string) => void;
    onChangeWorkloadClass: (cls: string) => void;
    parentPolicyId: string;
    parentOptions: Array<{value: string; label: string}>;
    onChangeParent: (value: string) => void;
    lockedFieldCount: number;
}> = props => {
    const deploymentType = props.document.deployment_type === 'agg' ? 'agg' : 'disagg';
    const engine = typeof props.document.engine === 'string' ? props.document.engine : '';
    const engineVersion = typeof props.document.engine_version === 'string' ? props.document.engine_version : '';
    const dynamoVersion = typeof props.document.dynamo_version === 'string' ? props.document.dynamo_version : '';
    return (
        <section className='rcfg-v2-scope-panel'>
            <header>
                <div className='rcfg-v2-library__eyebrow'>Identity &amp; target</div>
                <h2>Name &amp; scope</h2>
            </header>
            <div className='rcfg-v2-scope-grid'>
                <Field label='Policy ID' help='Lowercase slug. Cannot be changed after creation.'>
                    <input
                        className='argo-field'
                        aria-label='policy_id'
                        value={String(props.document.policy_id || '')}
                        disabled={props.mode === 'edit'}
                        onChange={event => props.onChangeField('policy_id', event.target.value)}
                        placeholder='my-policy'
                    />
                </Field>
                <Field label='Display name'>
                    <input
                        className='argo-field'
                        aria-label='display_name'
                        value={String(props.document.display_name || '')}
                        onChange={event => props.onChangeField('display_name', event.target.value)}
                        placeholder='Latency-tuned llama-70b'
                    />
                </Field>
                <Field label='Deployment' help='Aggregated runs prefill + decode together. Disaggregated splits them across workers.'>
                    <RadioGroup
                        label='Deployment type'
                        value={deploymentType}
                        onChange={value => props.onChangeScope({deployment_type: value as 'agg' | 'disagg'})}
                        className='rcfg-v2-segmented'>
                        <RadioOption value='disagg' className='rcfg-v2-segmented__opt'>
                            Disaggregated
                        </RadioOption>
                        <RadioOption value='agg' className='rcfg-v2-segmented__opt'>
                            Aggregated
                        </RadioOption>
                    </RadioGroup>
                </Field>
                <Field label='Dynamo version'>
                    <select
                        className='argo-field'
                        aria-label='dynamo_version'
                        value={dynamoVersion}
                        onChange={event => {
                            const nextDynamo = event.target.value;
                            props.onChangeScope({dynamo_version: nextDynamo, engine: '', engine_version: ''});
                        }}>
                        {props.dynamoOptions.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label='Engine'>
                    <select className='argo-field' aria-label='engine' value={engine} onChange={event => props.onChangeScope({engine: event.target.value, engine_version: ''})}>
                        {props.engineOptions.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label='Engine version'>
                    <select className='argo-field' aria-label='engine_version' value={engineVersion} onChange={event => props.onChangeScope({engine_version: event.target.value})}>
                        {props.engineVersionOptions.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label='Description' span={2} optional>
                    <input
                        className='argo-field'
                        aria-label='description'
                        value={String(props.document.description || '')}
                        onChange={event => props.onChangeField('description', event.target.value)}
                        placeholder='What this policy is tuned for…'
                    />
                </Field>
            </div>

            <header className='rcfg-v2-scope-panel__meta-head'>
                <h3>Tags &amp; intent <small>(optional)</small></h3>
            </header>
            <div className='rcfg-v2-scope-grid'>
                <Field label='Tags' optional help='Comma-separated.'>
                    <input
                        className='argo-field'
                        aria-label='tags'
                        value={props.tagsValue}
                        onChange={event => props.onChangeTags(event.target.value)}
                        placeholder='prod, h100, customer-acme'
                    />
                </Field>
                <Field label='Tuning intent' optional help='Surfaces this policy on the matching intent card in the library.'>
                    <select className='argo-field' aria-label='intent' value={props.intentValue} onChange={event => props.onChangeIntent(event.target.value)}>
                        {INTENT_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label='Workload class' optional help='Logical group used by library search, e.g. "Llama-3 70B class".'>
                    <input
                        className='argo-field'
                        aria-label='workload_class'
                        value={props.workloadClassValue}
                        onChange={event => props.onChangeWorkloadClass(event.target.value)}
                        placeholder='Llama-3 70B class'
                    />
                </Field>
            </div>

            <header className='rcfg-v2-scope-panel__meta-head'>
                <h3>Inherits from <small>(optional)</small></h3>
            </header>
            <div className='rcfg-v2-scope-grid'>
                <Field
                    label='Parent policy'
                    span={2}
                    optional
                    help={
                        props.lockedFieldCount > 0
                            ? `${props.lockedFieldCount} field(s) locked by the parent.`
                            : 'Inheritance is optional. Leave empty to author a standalone policy.'
                    }>
                    <select className='argo-field' aria-label='parent_policy_id' value={props.parentPolicyId} onChange={event => props.onChangeParent(event.target.value)}>
                        <option value=''>— None (standalone) —</option>
                        {props.parentOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
        </section>
    );
};

const SummaryPanel: React.FC<{
    document: RuntimeDocument;
    modified: ReturnType<typeof collectModified>;
    roles: Array<{role: string; label: string; catalog_scope: string}>;
    onJumpTo: (role: string) => void;
}> = ({document, modified, roles, onJumpTo}) => {
    const grouped = new Map<string, typeof modified>();
    modified.forEach(entry => {
        const list = grouped.get(entry.role) || [];
        list.push(entry);
        grouped.set(entry.role, list);
    });
    return (
        <section className='rcfg-v2-summary'>
            <header>
                <h2>Review & save</h2>
            </header>
            <div className='rcfg-v2-summary__stats'>
                <Stat label='Policy ID' value={String(document.policy_id || 'Not set')} />
                <Stat label='Display name' value={String(document.display_name || 'Not set')} />
                <Stat label='Overrides' value={String(modified.length)} accent />
                <Stat label='Roles' value={String(roles.length)} />
            </div>
            {modified.length === 0 ? (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-info-circle' aria-hidden='true' />
                    <p>No overrides yet. Pick a role from the rail and start tuning.</p>
                </div>
            ) : (
                <div className='rcfg-v2-summary__roles'>
                    {roles.map(role => {
                        const list = grouped.get(role.role) || [];
                        return (
                            <section key={role.role} className='rcfg-v2-summary__role'>
                                <header>
                                    <button type='button' className='rcfg-v2-link' onClick={() => onJumpTo(role.role)}>
                                        {role.label}
                                    </button>
                                    <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{list.length} override(s)</span>
                                </header>
                                {list.length === 0 ? (
                                    <p className='rcfg-v2-summary__empty'>No overrides for this role.</p>
                                ) : (
                                    <table className='rcfg-v2-summary__table'>
                                        <thead>
                                            <tr>
                                                <th>Field</th>
                                                <th>Kind</th>
                                                <th>Default</th>
                                                <th>Override</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.map(entry => (
                                                <tr key={`${entry.role}:${entry.kind}:${entry.name}`}>
                                                    <td>
                                                        <code>{entry.name}</code>
                                                    </td>
                                                    <td>{entry.kind}</td>
                                                    <td className='is-default'>
                                                        <code>{cell(entry.defaultValue)}</code>
                                                    </td>
                                                    <td className='is-modified'>
                                                        <code>{cell(entry.value)}</code>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

const Field: React.FC<{
    label: string;
    /** Renders as a hover tooltip on the (i) icon next to the label. Drop the prop when the label alone is self-explanatory. */
    help?: string;
    span?: number;
    /** Field is required by default. Pass optional to render an "(optional)" hint instead of the required asterisk. */
    optional?: boolean;
    children: React.ReactNode;
}> = ({label, help, span, optional, children}) => (
    <label className={`rcfg-v2-field-row ${span ? `rcfg-v2-field-row--span-${span}` : ''}`}>
        <span className='rcfg-v2-field-row__label'>
            <strong>{label}</strong>
            {help ? (
                <span
                    className='rcfg-v2-wizard__field-info'
                    tabIndex={0}
                    title={help}
                    aria-label={help}
                    role='note'>
                    <i className='fa fa-info-circle' aria-hidden='true' />
                </span>
            ) : null}
            {optional ? (
                <span className='rcfg-v2-optional'>(optional)</span>
            ) : (
                <span className='rcfg-v2-required' aria-hidden='true'>
                    *
                </span>
            )}
        </span>
        {children}
    </label>
);

const Stat: React.FC<{label: string; value: string; accent?: boolean}> = ({label, value, accent}) => (
    <div className={`rcfg-v2-stat ${accent ? 'rcfg-v2-stat--accent' : ''}`}>
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

function cell(value: unknown): string {
    if (value === undefined) return '(unset)';
    if (value === null) return 'null';
    if (typeof value === 'string') return value || '""';
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
