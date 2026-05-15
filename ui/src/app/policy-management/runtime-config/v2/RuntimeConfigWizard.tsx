import * as React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

import type {
    DeploymentType,
    PolicyApiClient,
    RuntimeConfigCatalogItemRecord,
    RuntimeConfigCatalogRecord,
    RuntimeConfigKind,
    RuntimeConfigPolicyRecord,
    RuntimeConfigRoleEntry,
    RuntimeConfigRoleSchemaRecord
} from '../../api/types';
import {PolicyError} from '../../components/PolicyError';
import {POLICY_ID_PATTERN} from '../../validation';
import {
    activeRoleSchema,
    cloneDocument,
    fetchRuntimeConfigCatalogItems,
    getRoleSelection,
    isRecord,
    normalizeRuntimeUserValue,
    roleKindKey,
    roleLabel,
    runtimeCatalogScopeLabel,
    runtimeDeploymentLabel,
    runtimeEngineLabel,
    setRoleValue,
    unique
} from '../runtimeConfigUtils';
import type {RuntimeDocument} from '../runtimeConfigTypes';
import {FieldControl} from './components/FieldControl';
import {ImpactRibbon} from './components/ImpactRibbon';
import {RadioGroup, RadioOption} from './components/RadioGroup';
// RoleArchitectureMini was previously rendered as an inline role-pill row
// inside each step. The top-bar stepper already shows the active role + lets
// you jump between roles, so the inline row is removed to avoid duplication.
import type {RoleFilter, TuningIntent} from './types';
import {collectFieldErrors, collectModified, computeImpactSummary, errorsForRole, fieldErrorKey, groupByCategory, itemMatchesRoleFilter, jsonMergePatchDiff, readInheritance, readPolicyTags, roleFilterCounts, writePolicyTags, setParentPolicyId, inheritedValueFor as inheritedValueForUtil} from './utils';

const INTENT_OPTIONS: Array<{value: '' | TuningIntent; label: string}> = [
    {value: '', label: 'No intent set'},
    {value: 'latency', label: 'Latency-tuned'},
    {value: 'throughput', label: 'Throughput-tuned'},
    {value: 'cost', label: 'Cost-tuned'},
    {value: 'balanced', label: 'Balanced'},
    {value: 'debug', label: 'Debug / dev'}
];

const WIZARD_FILTER_OPTIONS: Array<{value: RoleFilter; label: string; helper: string}> = [
    {value: 'essentials', label: 'Essentials', helper: 'The few flags most users tune (5–15 fields)'},
    {value: 'latency', label: 'Latency', helper: 'Time-to-first-token, response time'},
    {value: 'throughput', label: 'Throughput', helper: 'Batching, parallelism'},
    {value: 'memory', label: 'Memory', helper: 'GPU memory, KV cache'},
    {value: 'stability', label: 'Stability', helper: 'Timeouts, health, retries'},
    {value: 'debug', label: 'Debug', helper: 'Logging, metrics, traces'},
    {value: 'all', label: 'All', helper: 'Every field in the catalog'}
];

/**
 * Linear, guided wizard for creating a new runtime config policy.
 *
 * The wizard intentionally trades the editor's three-pane flexibility for a
 * lower-cognitive-load flow: one role at a time, no rail, no live-preview
 * pane, no Cmd+K — and Essentials by default with an explicit "Show all"
 * escape hatch. Users who want to jump or see everything can switch to the
 * advanced editor via the topbar link.
 *
 * The wizard reuses everything below the view layer: the same selection
 * mutation helpers, the same catalog loader, the same FieldControl, the same
 * save/validate logic.
 */
export const RuntimeConfigWizard: React.FC<{
    client: PolicyApiClient;
    mode: 'create' | 'edit';
    initialDocument: RuntimeDocument;
    original?: RuntimeConfigPolicyRecord | null;
    catalogs: RuntimeConfigCatalogRecord[];
    roleSchemas: RuntimeConfigRoleSchemaRecord[];
    allPolicies?: RuntimeConfigPolicyRecord[];
    onClose: () => void;
    onSaved: () => Promise<void>;
    onSwitchToEditor: () => void;
}> = ({client, mode, initialDocument, original, catalogs, roleSchemas, allPolicies = [], onClose, onSaved, onSwitchToEditor}) => {
    const [document, setDocument] = useState<RuntimeDocument>(cloneDocument(initialDocument));
    const [itemsByRoleKind, setItemsByRoleKind] = useState<Record<string, RuntimeConfigCatalogItemRecord[]>>({});
    const [itemsLoading, setItemsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<unknown | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [filterByRole, setFilterByRole] = useState<Record<string, RoleFilter>>({});

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

    const modified = useMemo(() => collectModified(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const fieldErrors = useMemo(() => collectFieldErrors(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const totalErrors = Object.keys(fieldErrors).length;

    const docAsRecord = useMemo<RuntimeConfigPolicyRecord>(
        () => ({document, managed_by: original?.managed_by ?? 'custom'} as RuntimeConfigPolicyRecord),
        [document, original]
    );
    const inheritance = useMemo(() => readInheritance(docAsRecord, allPolicies), [allPolicies, docAsRecord]);
    const parentPolicy = useMemo(() => allPolicies.find(record => record.policy_id === inheritance.parentPolicyId), [allPolicies, inheritance.parentPolicyId]);

    // Step 0 = Scope, 1..N = roles, N+1 = Review
    const totalSteps = 1 + roles.length + 1;
    const isScopeStep = activeStep === 0;
    const isReviewStep = activeStep === totalSteps - 1;
    const activeRole: RuntimeConfigRoleEntry | undefined = !isScopeStep && !isReviewStep ? roles[activeStep - 1] : undefined;

    const scopeReady = !!(document.policy_id && document.display_name && engine && engineVersion && dynamoVersion);
    const scopeIdValid = typeof document.policy_id === 'string' && POLICY_ID_PATTERN.test(document.policy_id.trim());

    function setField(name: string, value: unknown) {
        setDocument(current => ({...current, [name]: value}));
    }
    function setScopeFields(values: Partial<RuntimeDocument>) {
        setActiveStep(0);
        setDocument(current => ({...current, ...values, selections: {}}));
    }
    function setSelection(role: string, kind: RuntimeConfigKind, name: string, value: unknown) {
        setDocument(current => setRoleValue(current, role, kind, name, value));
    }
    function clearSelection(role: string, kind: RuntimeConfigKind, name: string) {
        setDocument(current => setRoleValue(current, role, kind, name, undefined));
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
            errors.push('Pick an engine, engine version, and Dynamo version.');
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

    async function save() {
        setError(null);
        const result = buildDocumentForSave();
        if (!result.document || result.errors.length) {
            setError(new Error(result.errors.join(' ')));
            return;
        }
        setIsSaving(true);
        try {
            if (mode === 'edit' && original) {
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
        } finally {
            setIsSaving(false);
        }
    }

    const tags = readPolicyTags(docAsRecord);

    const goNext = useCallback(() => setActiveStep(step => Math.min(totalSteps - 1, step + 1)), [totalSteps]);
    const goBack = useCallback(() => setActiveStep(step => Math.max(0, step - 1)), []);
    const isDirty = useMemo(() => JSON.stringify(document) !== JSON.stringify(initialDocument), [document, initialDocument]);

    function handleCancel() {
        if (isDirty && !window.confirm('Discard all unsaved changes and return to the library?')) {
            return;
        }
        onClose();
    }

    // Keyboard shortcuts: Enter advances, Ctrl/⌘+S saves on Review, Escape
    // cancels (dirty-confirm preserved).
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isText = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                handleCancel();
                return;
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && isReviewStep) {
                event.preventDefault();
                if (modified.length > 0 && !isSaving) save();
                return;
            }
            if (event.key === 'Enter' && !isText && !event.metaKey && !event.ctrlKey) {
                if (isReviewStep) return;
                if (isScopeStep && !scopeReady) return;
                event.preventDefault();
                goNext();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goNext, isReviewStep, isScopeStep, isSaving, modified.length, scopeReady, isDirty]);

    return (
        <main className='policy-management rcfg-v2-wizard' role='main' aria-label={mode === 'edit' ? 'Edit runtime config policy (wizard)' : 'New runtime config policy (wizard)'}>
            <header className='rcfg-v2-wizard__topbar'>
                <div className='rcfg-v2-wizard__topbar-titles'>
                    <div className='rcfg-v2-library__eyebrow'>Runtime configuration policy</div>
                    <h1>{mode === 'edit' ? 'Edit policy' : 'New policy'}</h1>
                    <small>{runtimeDeploymentLabel(deploymentType)} · {runtimeEngineLabel(engine) || 'Pick an engine'}</small>
                </div>
                <div className='rcfg-v2-wizard__topbar-actions'>
                    <button type='button' className='rcfg-v2-wizard__switch' onClick={onSwitchToEditor}>
                        Switch to advanced editor →
                    </button>
                    <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={handleCancel}>
                        Cancel
                    </button>
                </div>
            </header>

            {/* Step indicator */}
            <nav className='rcfg-v2-wizard__steps' aria-label='Wizard steps'>
                <Step index={0} active={activeStep} label='Scope & metadata' complete={scopeReady && activeStep > 0} onSelect={() => setActiveStep(0)} />
                {roles.map((role, idx) => {
                    const overrides = (Object.keys(getRoleSelection(document, role.role, 'args')).length + Object.keys(getRoleSelection(document, role.role, 'envs')).length);
                    const roleErrors = errorsForRole(fieldErrors, role.role);
                    // Hide the "0 overrides" sublabel — it's just noise on first
                    // render. Show it only when the user has actually touched the
                    // role or is currently focused on it.
                    const showSub = overrides > 0 || activeStep === idx + 1;
                    return (
                        <Step
                            key={role.role}
                            index={idx + 1}
                            active={activeStep}
                            label={roleLabel(role)}
                            sublabel={showSub ? `${overrides} override${overrides === 1 ? '' : 's'}` : undefined}
                            errorCount={roleErrors}
                            complete={overrides > 0 && roleErrors === 0 && activeStep > idx + 1}
                            onSelect={() => setActiveStep(idx + 1)}
                            disabled={!scopeReady}
                        />
                    );
                })}
                <Step
                    index={totalSteps - 1}
                    active={activeStep}
                    label='Review & save'
                    sublabel={modified.length > 0 || activeStep === totalSteps - 1 ? `${modified.length} override${modified.length === 1 ? '' : 's'}` : undefined}
                    errorCount={totalErrors}
                    complete={false}
                    onSelect={() => setActiveStep(totalSteps - 1)}
                    disabled={!scopeReady}
                />
            </nav>

            {error && <PolicyError error={error} prefix='Could not save policy' />}

            <div className='rcfg-v2-wizard__body'>
                {isScopeStep && (
                    <ScopeStep
                        document={document}
                        mode={mode}
                        tagsValue={tags.tags.join(', ')}
                        intentValue={tags.intent || ''}
                        workloadClassValue={tags.workloadClass || ''}
                        dynamoOptions={dynamoOptions}
                        engineOptions={engineOptions}
                        engineVersionOptions={engineVersionOptions}
                        parentPolicyId={inheritance.parentPolicyId || ''}
                        parentOptions={allPolicies
                            .filter(record => record.policy_id !== original?.policy_id)
                            .map(record => ({value: record.policy_id, label: `${(record.document?.display_name as string) || record.policy_id} · ${record.policy_id}`}))}
                        onChangeField={setField}
                        onChangeScope={setScopeFields}
                        onChangeTags={value => setDocument(current => writePolicyTags(current, {tags: value.split(',').map(item => item.trim()).filter(Boolean)}))}
                        onChangeIntent={value => setDocument(current => writePolicyTags(current, {intent: value === '' ? undefined : (value as TuningIntent)}))}
                        onChangeWorkloadClass={value => setDocument(current => writePolicyTags(current, {workloadClass: value}))}
                        onChangeParent={value => setDocument(current => setParentPolicyId(current, value || undefined))}
                        scopeIdValid={scopeIdValid}
                    />
                )}

                {activeRole && (itemsLoading ? (
                    <div className='rcfg-v2-empty'>
                        <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                        <p>Loading {activeRole.role} catalog…</p>
                    </div>
                ) : (
                    <RoleStep
                        role={activeRole}
                        roles={roles}
                        onJumpRole={target => {
                            const idx = roles.findIndex(r => r.role === target);
                            if (idx >= 0) setActiveStep(idx + 1);
                        }}
                        document={document}
                        items={{
                            args: itemsByRoleKind[roleKindKey(activeRole.role, 'args')] || [],
                            envs: itemsByRoleKind[roleKindKey(activeRole.role, 'envs')] || []
                        }}
                        filter={filterByRole[activeRole.role] || 'essentials'}
                        onFilterChange={value => setFilterByRole(current => ({...current, [activeRole.role]: value}))}
                        onChange={setSelection}
                        onClear={clearSelection}
                        lockedFields={inheritance.lockedFields}
                        lockedByLabel={inheritance.parentDisplayName}
                        inheritedValueFor={(kind, name) => inheritedValueForUtil(parentPolicy, activeRole.role, kind, name)}
                        fieldErrors={fieldErrors}
                    />
                ))}

                {isReviewStep && (
                    <ReviewStep
                        document={document}
                        modified={modified}
                        roles={roles}
                        fieldErrors={fieldErrors}
                        onJumpToRole={(role) => {
                            const idx = roles.findIndex(r => r.role === role);
                            if (idx >= 0) setActiveStep(idx + 1);
                        }}
                    />
                )}
            </div>

            <footer className='rcfg-v2-wizard__footer'>
                <button type='button' className='argo-button argo-button--base-o policy-management__button' disabled={activeStep === 0} onClick={goBack}>
                    ← Back
                </button>
                <div className='rcfg-v2-wizard__footer-summary'>
                    Step {activeStep + 1} of {totalSteps}
                </div>
                <div className='rcfg-v2-wizard__footer-actions'>
                    {!isReviewStep && activeRole && (
                        <button type='button' className='rcfg-v2-wizard__skip' onClick={goNext} title={`Continue without configuring ${roleLabel(activeRole)} — you can come back later.`}>
                            Skip {roleLabel(activeRole)}
                        </button>
                    )}
                    {!isReviewStep ? (
                        <button
                            type='button'
                            className='argo-button argo-button--base policy-management__create-button'
                            disabled={isScopeStep && !scopeReady}
                            onClick={goNext}>
                            Continue →
                        </button>
                    ) : (
                        <button
                            type='button'
                            className='argo-button argo-button--base policy-management__create-button'
                            onClick={save}
                            disabled={isSaving || modified.length === 0 || totalErrors > 0}
                            title={
                                totalErrors > 0
                                    ? `Fix the ${totalErrors} validation error${totalErrors === 1 ? '' : 's'} flagged on the role steps before saving.`
                                    : modified.length === 0
                                      ? 'Add at least one override on a role step before saving.'
                                      : 'Save the policy and return to the library.'
                            }>
                            {isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save policy'}
                        </button>
                    )}
                </div>
            </footer>
        </main>
    );
};

const Step: React.FC<{
    index: number;
    active: number;
    label: string;
    sublabel?: string;
    errorCount?: number;
    complete: boolean;
    disabled?: boolean;
    onSelect: () => void;
}> = ({index, active, label, sublabel, errorCount, complete, disabled, onSelect}) => {
    const hasErrors = (errorCount || 0) > 0;
    return (
        <button
            type='button'
            className={`rcfg-v2-wizard__step ${index === active ? 'is-active' : ''} ${complete ? 'is-complete' : ''} ${hasErrors ? 'has-errors' : ''}`}
            disabled={disabled}
            aria-current={index === active ? 'step' : undefined}
            onClick={onSelect}>
            <span className='rcfg-v2-wizard__step-num'>
                {hasErrors ? <i className='fa fa-exclamation-circle' aria-hidden='true' /> : complete ? <i className='fa fa-check' aria-hidden='true' /> : index + 1}
            </span>
            <span className='rcfg-v2-wizard__step-label'>
                <strong>{label}</strong>
                {hasErrors ? (
                    <small className='rcfg-v2-wizard__step-error' aria-label={`${errorCount} validation error${errorCount === 1 ? '' : 's'}`}>
                        {errorCount} error{errorCount === 1 ? '' : 's'}
                    </small>
                ) : sublabel ? (
                    <small>{sublabel}</small>
                ) : null}
            </span>
        </button>
    );
};

const ScopeStep: React.FC<{
    document: RuntimeDocument;
    mode: 'create' | 'edit';
    tagsValue: string;
    intentValue: string;
    workloadClassValue: string;
    dynamoOptions: string[];
    engineOptions: string[];
    engineVersionOptions: string[];
    parentPolicyId: string;
    parentOptions: Array<{value: string; label: string}>;
    onChangeField: (name: string, value: unknown) => void;
    onChangeScope: (values: Partial<RuntimeDocument>) => void;
    onChangeTags: (tags: string) => void;
    onChangeIntent: (intent: string) => void;
    onChangeWorkloadClass: (cls: string) => void;
    onChangeParent: (value: string) => void;
    scopeIdValid: boolean;
}> = props => {
    const deploymentType = props.document.deployment_type === 'agg' ? 'agg' : 'disagg';
    const engine = typeof props.document.engine === 'string' ? props.document.engine : '';
    const engineVersion = typeof props.document.engine_version === 'string' ? props.document.engine_version : '';
    const dynamoVersion = typeof props.document.dynamo_version === 'string' ? props.document.dynamo_version : '';
    const policyId = typeof props.document.policy_id === 'string' ? props.document.policy_id : '';
    return (
        <section className='rcfg-v2-wizard__step-card'>
            <header>
                <h2>Name &amp; scope</h2>
            </header>

            {/* Identity row — most important: display name (full width) + slug. */}
            <div className='rcfg-v2-wizard__grid'>
                <WLabel label='Display name' span={2}>
                    <input
                        className='argo-field'
                        aria-label='display_name'
                        value={String(props.document.display_name || '')}
                        onChange={event => props.onChangeField('display_name', event.target.value)}
                        placeholder='Latency-tuned llama-70b'
                    />
                </WLabel>
                <WLabel
                    label='Policy ID'
                    span={2}
                    help='Lowercase letters, numbers, dots, underscores, hyphens. Cannot be changed after creation.'
                    error={policyId && !props.scopeIdValid ? 'Invalid format — use a lowercase slug.' : undefined}>
                    <input
                        className='argo-field'
                        aria-label='policy_id'
                        value={policyId}
                        disabled={props.mode === 'edit'}
                        onChange={event => props.onChangeField('policy_id', event.target.value)}
                        placeholder='llama-70b-prod'
                    />
                </WLabel>
            </div>

            <header className='rcfg-v2-wizard__subhead'>
                <h3>Deployment target</h3>
            </header>
            <div className='rcfg-v2-wizard__grid'>
                <WLabel label='Deployment mode' help='Aggregated runs prefill + decode together. Disaggregated splits them across workers.'>
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
                </WLabel>
                <WLabel label='Dynamo version'>
                    <select className='argo-field' aria-label='dynamo_version' value={dynamoVersion} onChange={event => props.onChangeScope({dynamo_version: event.target.value, engine: '', engine_version: ''})}>
                        {props.dynamoOptions.map(option => (<option key={option} value={option}>{option}</option>))}
                    </select>
                </WLabel>
                <WLabel label='Engine'>
                    <select className='argo-field' aria-label='engine' value={engine} onChange={event => props.onChangeScope({engine: event.target.value, engine_version: ''})}>
                        {props.engineOptions.map(option => (<option key={option} value={option}>{runtimeEngineLabel(option)}</option>))}
                    </select>
                </WLabel>
                <WLabel label='Engine version'>
                    <select className='argo-field' aria-label='engine_version' value={engineVersion} onChange={event => props.onChangeScope({engine_version: event.target.value})}>
                        {props.engineVersionOptions.map(option => (<option key={option} value={option}>{option}</option>))}
                    </select>
                </WLabel>
                <WLabel label='Description' span={2} optional>
                    <input className='argo-field' aria-label='description' value={String(props.document.description || '')} onChange={event => props.onChangeField('description', event.target.value)} placeholder='What this policy is tuned for…' />
                </WLabel>
            </div>

            {/* Inheritance comes before tags — it's load-bearing for governance
                (locked fields), tags are decorative. */}
            <header className='rcfg-v2-wizard__subhead'>
                <h3>Inheritance <small>(optional)</small></h3>
            </header>
            <div className='rcfg-v2-wizard__grid'>
                <WLabel label='Parent policy' span={2} optional help='Inherits values from the chosen policy. Fields the parent has locked become read-only here.'>
                    <select className='argo-field' aria-label='parent_policy_id' value={props.parentPolicyId} onChange={event => props.onChangeParent(event.target.value)}>
                        <option value=''>— None (standalone policy) —</option>
                        {props.parentOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </select>
                </WLabel>
            </div>

            <header className='rcfg-v2-wizard__subhead'>
                <h3>Tags &amp; intent <small>(optional)</small></h3>
            </header>
            <div className='rcfg-v2-wizard__grid'>
                <WLabel label='Tags' optional help='Comma-separated.'>
                    <input className='argo-field' aria-label='tags' value={props.tagsValue} onChange={event => props.onChangeTags(event.target.value)} placeholder='prod, h100, customer-acme' />
                </WLabel>
                <WLabel label='Tuning intent' optional help='Surfaces this policy on the matching intent card in the library.'>
                    <select className='argo-field' aria-label='intent' value={props.intentValue} onChange={event => props.onChangeIntent(event.target.value)}>
                        {INTENT_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </select>
                </WLabel>
                <WLabel label='Workload class' span={2} optional help='Logical group used by library search, e.g. "Llama-3 70B class".'>
                    <input className='argo-field' aria-label='workload_class' value={props.workloadClassValue} onChange={event => props.onChangeWorkloadClass(event.target.value)} placeholder='Llama-3 70B class' />
                </WLabel>
            </div>
        </section>
    );
};

const RoleStep: React.FC<{
    role: RuntimeConfigRoleEntry;
    roles: RuntimeConfigRoleEntry[];
    onJumpRole?: (role: string) => void;
    document: RuntimeDocument;
    items: Record<RuntimeConfigKind, RuntimeConfigCatalogItemRecord[]>;
    filter: RoleFilter;
    onFilterChange: (value: RoleFilter) => void;
    onChange: (role: string, kind: RuntimeConfigKind, name: string, value: unknown) => void;
    onClear: (role: string, kind: RuntimeConfigKind, name: string) => void;
    lockedFields?: Set<string>;
    lockedByLabel?: string;
    inheritedValueFor?: (kind: RuntimeConfigKind, name: string) => unknown;
    fieldErrors?: Record<string, string>;
}> = ({role, roles, onJumpRole, document, items, filter, onFilterChange, onChange, onClear, lockedFields, lockedByLabel, inheritedValueFor, fieldErrors}) => {
    const argsItems = items.args;
    const envsItems = items.envs;
    const argsSelection = getRoleSelection(document, role.role, 'args');
    const envsSelection = getRoleSelection(document, role.role, 'envs');
    const [query, setQuery] = useState('');
    const trimmedQuery = query.trim().toLowerCase();
    const roleModified = useMemo(
        () => collectModified(document, [role], {[roleKindKey(role.role, 'args')]: argsItems, [roleKindKey(role.role, 'envs')]: envsItems}),
        [argsItems, document, envsItems, role]
    );
    const roleImpact = computeImpactSummary(roleModified);

    const renderRows = (kind: RuntimeConfigKind, all: RuntimeConfigCatalogItemRecord[]) => {
        const selection = kind === 'args' ? argsSelection : envsSelection;
        const visible = all.filter(item => {
            // Always keep rows the user has touched.
            if (item.name in selection) return true;
            // Search bypasses the axis filter — power users can reach any field.
            if (trimmedQuery) {
                const haystack = `${item.name} ${item.display_name || ''} ${item.record?.description || ''}`.toLowerCase();
                return haystack.includes(trimmedQuery);
            }
            // AIC fields render disabled with an "AIC" chip but still appear in the list.
            return itemMatchesRoleFilter(item, filter);
        });
        if (!visible.length) {
            return (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-filter' aria-hidden='true' />
                    <p>{trimmedQuery ? `No ${kind} match "${query}".` : `No matching ${kind} for the chosen filter.`}</p>
                </div>
            );
        }
        // Group by category once we're past ~12 visible fields — keeps short
        // lists clean and tall lists scannable.
        const useGroups = visible.length > 12;
        if (!useGroups) {
            return (
                <div className='rcfg-v2-wizard__rows'>
                    {visible.map(item => renderItem(item, kind, selection))}
                </div>
            );
        }
        const groups = groupByCategory(visible);
        return (
            <div className='rcfg-v2-wizard__groups'>
                {groups.map(group => (
                    <section key={group.key} className='rcfg-v2-wizard__group'>
                        <header>
                            <span className='rcfg-v2-wizard__group-label'>{group.label}</span>
                            <small>{group.items.length} field(s)</small>
                        </header>
                        <div className='rcfg-v2-wizard__rows'>
                            {group.items.map(item => renderItem(item, kind, selection))}
                        </div>
                    </section>
                ))}
            </div>
        );
    };

    const renderItem = (item: RuntimeConfigCatalogItemRecord, kind: RuntimeConfigKind, selection: Record<string, unknown>) => {
        const value = selection[item.name];
        const isOverridden = item.name in selection;
        const locked = !!lockedFields?.has(item.name);
        const inherited = inheritedValueFor ? inheritedValueFor(kind, item.name) : undefined;
        const error = fieldErrors?.[fieldErrorKey(role.role, kind, item.name)];
        return (
            <FieldControl
                key={item.name}
                item={item}
                role={role.role}
                kind={kind}
                value={value}
                defaultValue={item.default_value}
                isOverridden={isOverridden}
                onChange={next => onChange(role.role, kind, item.name, next)}
                onReset={() => onClear(role.role, kind, item.name)}
                onRemove={isOverridden ? () => onClear(role.role, kind, item.name) : undefined}
                density='rows'
                locked={locked}
                lockedByLabel={lockedByLabel}
                inheritedValue={inherited}
                error={error}
            />
        );
    };

    const filterCounts = roleFilterCounts([...argsItems, ...envsItems]);

    const roleDescription = readRoleDescription(role);
    return (
        <section className='rcfg-v2-wizard__step-card'>
            <header className='rcfg-v2-wizard__role-head'>
                <div>
                    <h2>{roleLabel(role)}</h2>
                    <p>{roleDescription}</p>
                    <small className='rcfg-v2-wizard__role-scope'>{runtimeCatalogScopeLabel(role.catalog_scope)} catalog</small>
                </div>
                <span className='rcfg-v2-chip rcfg-v2-chip--accent'>{roleModified.length} override{roleModified.length === 1 ? '' : 's'}</span>
            </header>

            <ImpactRibbon summary={roleImpact} overrideCount={roleModified.length} />

            <div className={`rcfg-v2-wizard__role-tools ${trimmedQuery ? 'is-search-active' : ''}`}>
                <RadioGroup label='Filter fields' value={filter} onChange={value => onFilterChange(value as RoleFilter)} className='rcfg-v2-axis' disabled={!!trimmedQuery}>
                    {WIZARD_FILTER_OPTIONS.filter(option => option.value === filter || option.value === 'essentials' || option.value === 'all' || filterCounts[option.value] > 0).map(option => (
                        <RadioOption key={option.value} value={option.value} className='rcfg-v2-axis__opt' title={option.helper}>
                            <span>{option.label}</span>
                            <small>{filterCounts[option.value]}</small>
                        </RadioOption>
                    ))}
                </RadioGroup>
                {trimmedQuery && <span className='rcfg-v2-wizard__search-bypass-hint' aria-live='polite'>Search bypasses the filter</span>}
            </div>

            {/* In-role search: power users who know the field name should never
                have to scroll. Search bypasses both the Essentials filter and
                the Goal chip so it always returns hits. */}
            <div className='rcfg-v2-search rcfg-v2-wizard__search'>
                <i className='fa fa-search' aria-hidden='true' />
                <input
                    className='argo-field'
                    type='search'
                    placeholder='Search this role… (e.g. router_mode, kv_cache, port)'
                    value={query}
                    aria-label={`Search ${roleLabel(role)} fields`}
                    onChange={event => setQuery(event.target.value)}
                />
                {query && (
                    <button type='button' className='rcfg-v2-search__clear' onClick={() => setQuery('')} aria-label='Clear search'>
                        <i className='fa fa-times' aria-hidden='true' />
                    </button>
                )}
            </div>

            <h3 className='rcfg-v2-wizard__section-title'>CLI args <small>{argsItems.length} in catalog</small></h3>
            {renderRows('args', argsItems)}

            <h3 className='rcfg-v2-wizard__section-title'>Environment variables <small>{envsItems.length} in catalog</small></h3>
            {renderRows('envs', envsItems)}
        </section>
    );
};

const ReviewStep: React.FC<{
    document: RuntimeDocument;
    modified: ReturnType<typeof collectModified>;
    roles: RuntimeConfigRoleEntry[];
    fieldErrors?: Record<string, string>;
    onJumpToRole: (role: string) => void;
}> = ({document, modified, roles, fieldErrors, onJumpToRole}) => {
    const grouped = new Map<string, typeof modified>();
    modified.forEach(entry => {
        const list = grouped.get(entry.role) || [];
        list.push(entry);
        grouped.set(entry.role, list);
    });
    const errorEntries = fieldErrors
        ? Object.entries(fieldErrors).map(([key, message]) => {
              const [role, kind, ...rest] = key.split(':');
              return {role, kind, name: rest.join(':'), message};
          })
        : [];
    return (
        <section className='rcfg-v2-wizard__step-card'>
            <header>
                <h2>Review & save</h2>
            </header>
            <div className='rcfg-v2-summary__stats'>
                <Stat label='Policy ID' value={String(document.policy_id || 'Not set')} />
                <Stat label='Display name' value={String(document.display_name || 'Not set')} />
                <Stat label='Overrides' value={String(modified.length)} accent />
                <Stat label='Roles' value={String(roles.length)} />
            </div>
            {errorEntries.length > 0 && (
                <section className='rcfg-v2-summary__errors' role='alert' aria-label={`${errorEntries.length} validation error${errorEntries.length === 1 ? '' : 's'}`}>
                    <header>
                        <i className='fa fa-exclamation-circle' aria-hidden='true' />
                        <strong>
                            {errorEntries.length} validation error{errorEntries.length === 1 ? '' : 's'} prevent{errorEntries.length === 1 ? 's' : ''} saving
                        </strong>
                    </header>
                    <ul>
                        {errorEntries.map(entry => {
                            const roleEntry = roles.find(r => r.role === entry.role);
                            return (
                                <li key={`${entry.role}:${entry.kind}:${entry.name}`}>
                                    <button type='button' className='rcfg-v2-link' onClick={() => onJumpToRole(entry.role)}>
                                        {roleEntry?.label || entry.role} · <code>{entry.name}</code>
                                    </button>
                                    <span> — {entry.message}</span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
            {modified.length === 0 ? (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-info-circle' aria-hidden='true' />
                    <p>No overrides yet — go back and tune at least one field.</p>
                </div>
            ) : (
                <div className='rcfg-v2-summary__roles'>
                    {roles.map(role => {
                        const list = grouped.get(role.role) || [];
                        return (
                            <section key={role.role} className='rcfg-v2-summary__role'>
                                <header>
                                    <button type='button' className='rcfg-v2-link' onClick={() => onJumpToRole(role.role)}>{role.label}</button>
                                    <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{list.length} override{list.length === 1 ? '' : 's'}</span>
                                </header>
                                {list.length === 0 ? (
                                    <p className='rcfg-v2-summary__empty'>No overrides for this role.</p>
                                ) : (
                                    <table className='rcfg-v2-summary__table'>
                                        <thead>
                                            <tr><th>Field</th><th>Kind</th><th>Default</th><th>Override</th></tr>
                                        </thead>
                                        <tbody>
                                            {list.map(entry => (
                                                <tr key={`${entry.role}:${entry.kind}:${entry.name}`}>
                                                    <td><code>{entry.name}</code></td>
                                                    <td>{entry.kind}</td>
                                                    <td className='is-default'><code>{cellText(entry.defaultValue)}</code></td>
                                                    <td className='is-modified'><code>{cellText(entry.value)}</code></td>
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

const Stat: React.FC<{label: string; value: string; accent?: boolean}> = ({label, value, accent}) => (
    <div className={`rcfg-v2-stat ${accent ? 'rcfg-v2-stat--accent' : ''}`}>
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const WLabel: React.FC<{
    label: string;
    /**
     * Renders as a hover tooltip on an (i) icon next to the label. Keep these
     * short — anything that explains something non-obvious (format constraints,
     * downstream implications). Skip the prop entirely when the label alone
     * already answers "what should I type here".
     */
    help?: string;
    error?: string;
    span?: number;
    /** Field is required by default. Pass optional to render an "(optional)" hint instead of the required asterisk. */
    optional?: boolean;
    children: React.ReactNode;
}> = ({label, help, error, span, optional, children}) => (
    <label className={`rcfg-v2-wizard__field ${span ? `rcfg-v2-wizard__field--span-${span}` : ''} ${error ? 'has-error' : ''}`}>
        <span className='rcfg-v2-wizard__field-label'>
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
        {error ? (
            <span className='rcfg-v2-wizard__field-error' role='alert'>
                <i className='fa fa-times-circle' aria-hidden='true' /> {error}
            </span>
        ) : null}
    </label>
);

function readRoleDescription(role: RuntimeConfigRoleEntry): string {
    const explicit = typeof (role as unknown as {description?: unknown}).description === 'string' ? ((role as unknown as {description: string}).description) : undefined;
    if (explicit) return explicit;
    // Sensible fallbacks per role name pattern. These match the canonical
    // Dynamo deployment-type role schemas; if the schema introduces new
    // role names we fall back to a generic line.
    switch (role.role) {
        case 'frontend':
            return 'Configure the Dynamo frontend — the request router and HTTP/gRPC entrypoint.';
        case 'agg_worker':
        case 'aggregate_worker':
            return 'Configure the aggregate worker — handles both prefill and decode for incoming requests.';
        case 'prefill_worker':
            return 'Configure the prefill worker — runs the initial token-generation pass before transfer to decode.';
        case 'decode_worker':
            return 'Configure the decode worker — generates output tokens after KV-cache transfer from prefill.';
        default:
            return `Configure ${roleLabel(role).toLowerCase()} for this deployment.`;
    }
}

function cellText(value: unknown): string {
    if (value === undefined) return '(unset)';
    if (value === null) return 'null';
    if (typeof value === 'string') return value || '""';
    try { return JSON.stringify(value); } catch { return String(value); }
}
