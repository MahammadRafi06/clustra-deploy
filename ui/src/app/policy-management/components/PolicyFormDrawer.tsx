import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';

import type {FeatureBackend, PolicyApiClient, PolicyFamily, PolicyRecord, PolicyTypeRecord, RequestPolicyType} from '../api/types';
import {FEATURE_BACKENDS, REQUEST_POLICY_TYPES} from '../api/types';
import {
    applySglangStarterTemplate,
    buildFeaturePolicyTemplate,
    buildRequestPolicyTemplate,
    formatPolicyJson,
    isFeatureBackend,
    isRequestPolicyType,
    parsePolicyJson,
    validatePolicyDocument
} from '../validation';
import {ArgsBuilder} from './ArgsBuilder';
import {PolicyJsonEditor} from './PolicyJsonEditor';

type EditorMode = 'create' | 'edit';
type EditorTab = 'form' | 'json' | 'args';

interface PolicyFormDrawerProps {
    mode: EditorMode;
    client: PolicyApiClient;
    initialFamily?: PolicyFamily | null;
    initialDocument?: Record<string, unknown> | null;
    initialRequestType?: RequestPolicyType;
    originalRecord?: PolicyRecord | {policy_id: string; backend: FeatureBackend; type?: never; document: Record<string, unknown>} | null;
    onClose: () => void;
    onSaved: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function documentStringValue(document: Record<string, unknown>, key: string): string {
    return typeof document[key] === 'string' ? (document[key] as string) : '';
}

function documentBooleanValue(document: Record<string, unknown>, key: string, fallback = true): boolean {
    return typeof document[key] === 'boolean' ? (document[key] as boolean) : fallback;
}

function metadata(document: Record<string, unknown>): Record<string, unknown> {
    return isObject(document.metadata) ? (document.metadata as Record<string, unknown>) : {};
}

function tagsValue(document: Record<string, unknown>): string {
    const tags = metadata(document).tags;
    return Array.isArray(tags) ? tags.join(', ') : '';
}

function sortOrderValue(document: Record<string, unknown>): number {
    const ui = isObject(metadata(document).ui) ? (metadata(document).ui as Record<string, unknown>) : {};
    return typeof ui.sort_order === 'number' ? ui.sort_order : 100;
}

function setTopLevel(document: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
    return {...document, [key]: value};
}

function setMetadata(document: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
    return {...document, metadata: {...metadata(document), [key]: value}};
}

function setSortOrder(document: Record<string, unknown>, sortOrder: number): Record<string, unknown> {
    const current = metadata(document);
    const ui = isObject(current.ui) ? (current.ui as Record<string, unknown>) : {};
    return {...document, metadata: {...current, ui: {...ui, sort_order: sortOrder}}};
}

function setEffectsText(document: Record<string, unknown>, value: string): Record<string, unknown> {
    const parsed = parsePolicyJson(value);
    return parsed.document ? {...document, effects: parsed.document} : document;
}

function policyTypeKey(policyType: PolicyTypeRecord): string {
    return policyType.policy_type || policyType.type || policyType.name || '';
}

function copyCommonFields(from: Record<string, unknown>, to: Record<string, unknown>): Record<string, unknown> {
    return {
        ...to,
        policy_id: from.policy_id ?? to.policy_id,
        display_name: from.display_name ?? to.display_name,
        description: from.description ?? to.description,
        active: from.active ?? to.active,
        metadata: from.metadata ?? to.metadata
    };
}

export const PolicyFormDrawer: React.FC<PolicyFormDrawerProps> = ({mode, client, initialFamily, initialDocument, initialRequestType, originalRecord, onClose, onSaved}) => {
    const [family, setFamily] = useState<PolicyFamily | null>(initialFamily || null);
    const [requestType, setRequestType] = useState<RequestPolicyType>(() => {
        if (initialDocument && isRequestPolicyType(initialDocument.type)) {
            return initialDocument.type;
        }
        return initialRequestType || 'workload';
    });
    const [allowTypeChange, setAllowTypeChange] = useState(!initialRequestType);
    const [requestTemplateReady, setRequestTemplateReady] = useState(mode === 'edit' || !!initialDocument || initialFamily !== 'request');
    const [featureBackendChoice, setFeatureBackendChoice] = useState<FeatureBackend | null>(() => {
        if (initialDocument && isFeatureBackend(initialDocument.backend)) {
            return initialDocument.backend;
        }
        return null;
    });
    const [policyTypes, setPolicyTypes] = useState<PolicyTypeRecord[]>([]);
    const [policyTypesError, setPolicyTypesError] = useState<string | null>(null);
    const [policyTypesLoading, setPolicyTypesLoading] = useState(false);
    const [tab, setTab] = useState<EditorTab>('form');
    const [document, setDocument] = useState<Record<string, unknown>>(() => initialDocument || {});
    const [jsonText, setJsonText] = useState(() => (initialDocument ? formatPolicyJson(initialDocument) : '{}'));
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const originalValue = useMemo(() => (mode === 'edit' && initialDocument ? formatPolicyJson(initialDocument) : null), [initialDocument, mode]);

    useEffect(() => {
        if (family !== 'request') {
            return;
        }
        let cancelled = false;
        setPolicyTypesLoading(true);
        setPolicyTypesError(null);
        client
            .listPolicyTypes({active: true, limit: 50, offset: 0})
            .then(result => {
                if (!cancelled) {
                    setPolicyTypes(result.policy_types || []);
                }
            })
            .catch(error => {
                if (!cancelled) {
                    setPolicyTypesError(error instanceof Error ? error.message : String(error));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPolicyTypesLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [client, family]);

    useEffect(() => {
        if (family !== 'request' || mode !== 'create' || initialDocument || policyTypesLoading) {
            return;
        }
        if (requestTemplateReady && document.type === requestType && isObject(document.effects) && Object.keys(document.effects).length > 0) {
            return;
        }
        const policyType = policyTypes.find(item => policyTypeKey(item) === requestType);
        if (!policyType) {
            if (policyTypes.length > 0) {
                setPolicyTypesError(`Policy type template "${requestType}" was not returned by clustra-ai-service.`);
            }
            setRequestTemplateReady(false);
            return;
        }
        const template = copyCommonFields(document, buildRequestPolicyTemplate(requestType, policyType));
        const templateHasEffects = isObject(template.effects) && Object.keys(template.effects).length > 0;
        if (!templateHasEffects) {
            setPolicyTypesError(`Policy type template "${requestType}" did not include populated effects defaults.`);
        }
        if (document.type === requestType && isObject(document.effects) && JSON.stringify(document.effects) === JSON.stringify(template.effects)) {
            setRequestTemplateReady(templateHasEffects);
            return;
        }
        setPolicyDocument(template);
        setRequestTemplateReady(templateHasEffects);
    }, [document, family, initialDocument, mode, policyTypes, policyTypesLoading, requestTemplateReady, requestType]);

    function setPolicyDocument(next: Record<string, unknown>) {
        setDocument(next);
        setJsonText(formatPolicyJson(next));
        setValidationErrors([]);
        setServerError(null);
    }

    function handleJsonChange(value: string) {
        setJsonText(value);
        const parsed = parsePolicyJson(value);
        if (parsed.document) {
            setDocument(parsed.document);
            setValidationErrors([]);
        } else {
            setValidationErrors(parsed.errors);
        }
    }

    function handleFamilySelect(nextFamily: PolicyFamily) {
        setFamily(nextFamily);
        setTab('form');
        setValidationErrors([]);
        setServerError(null);
        if (nextFamily === 'request') {
            setRequestType(initialRequestType || 'workload');
            setRequestTemplateReady(false);
            setPolicyDocument({});
        } else {
            setFeatureBackendChoice(null);
            setPolicyDocument({});
        }
    }

    function handleRequestTypeChange(nextType: RequestPolicyType) {
        setRequestType(nextType);
        setRequestTemplateReady(false);
    }

    function handleBackendChange(nextBackend: FeatureBackend) {
        setFeatureBackendChoice(nextBackend);
        if (isObject(document.effects)) {
            setPolicyDocument(setTopLevel(document, 'backend', nextBackend));
        } else {
            setPolicyDocument(copyCommonFields(document, buildFeaturePolicyTemplate(nextBackend)));
        }
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setServerError(null);

        const parsed = parsePolicyJson(jsonText);
        if (!parsed.document) {
            setValidationErrors(parsed.errors);
            setTab('json');
            return;
        }
        if (!family) {
            setValidationErrors(['Select a policy family.']);
            return;
        }
        if (family === 'request' && mode === 'create' && !requestTemplateReady) {
            setValidationErrors(['Wait for the selected policy type template to load before submitting.']);
            return;
        }

        const originalPolicyId = typeof originalRecord?.policy_id === 'string' ? originalRecord.policy_id : undefined;
        const originalType = originalRecord && 'type' in originalRecord && typeof originalRecord.type === 'string' ? originalRecord.type : undefined;
        const validation = validatePolicyDocument(parsed.document, {family, mode, originalPolicyId, originalType});
        setValidationErrors(validation.errors);
        if (!validation.valid) {
            setTab('json');
            return;
        }

        setIsSaving(true);
        try {
            if (mode === 'edit' && originalPolicyId) {
                if (family === 'request') {
                    await client.updatePolicy(originalPolicyId, parsed.document);
                } else {
                    await client.updateFeaturePolicy(originalPolicyId, parsed.document);
                }
            } else if (family === 'request') {
                await client.createPolicy(parsed.document);
            } else {
                await client.createFeaturePolicy(parsed.document);
            }
            setIsSaving(false);
            onSaved();
        } catch (error) {
            setServerError(error instanceof Error ? error.message : String(error));
            setIsSaving(false);
        }
    }

    const selectedRequestType = requestType;
    const selectedBackend = isFeatureBackend(document.backend) ? document.backend : featureBackendChoice || 'sglang';
    const canShowArgs = family === 'feature';
    const needsBackendChoice = family === 'feature' && mode === 'create' && !initialDocument && !featureBackendChoice && !isFeatureBackend(document.backend);
    const requestTemplatePending = family === 'request' && mode === 'create' && !requestTemplateReady;

    const header = (
        <div className='policy-management__drawer-title'>
            <strong>{mode === 'edit' ? 'Edit Policy' : 'Create Policy'}</strong>
            {family && <span className='policy-management__drawer-subtitle'>{family === 'request' ? 'Request policy' : 'Feature policy'}</span>}
        </div>
    );

    return (
        <section className='policy-management__inline-panel' aria-label={mode === 'edit' ? 'Edit policy' : 'Create policy'}>
            <div className='policy-management__inline-panel-header'>
                {header}
                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={onClose}>
                    Close
                </button>
            </div>
            <form className='policy-management__drawer-body' onSubmit={handleSubmit}>
                {!family && (
                    <div className='policy-management__choice-grid'>
                        <button type='button' className='argo-button argo-button--base-o policy-management__choice-button' onClick={() => handleFamilySelect('request')}>
                            <i className='fa fa-file-alt' aria-hidden='true' /> Request policy
                        </button>
                        <button type='button' className='argo-button argo-button--base-o policy-management__choice-button' onClick={() => handleFamilySelect('feature')}>
                            <i className='fa fa-sliders-h' aria-hidden='true' /> Feature policy
                        </button>
                    </div>
                )}

                {needsBackendChoice && (
                    <div className='policy-management__choice-grid'>
                        {FEATURE_BACKENDS.map(backend => (
                            <button
                                key={backend}
                                type='button'
                                className='argo-button argo-button--base-o policy-management__choice-button'
                                onClick={() => handleBackendChange(backend)}>
                                <i className='fa fa-sliders-h' aria-hidden='true' /> {backend}
                            </button>
                        ))}
                    </div>
                )}

                {requestTemplatePending && (
                    <div className='policy-management__template-loading'>
                        <div className='policy-management__inline-banner'>
                            {policyTypesLoading ? 'Loading policy type template...' : `Waiting for a populated ${selectedRequestType} policy type template.`}
                        </div>
                        <div className='policy-management__inline-fields'>
                            <select
                                className='argo-field policy-management__select'
                                aria-label='type'
                                value={selectedRequestType}
                                disabled={!allowTypeChange}
                                onChange={event => handleRequestTypeChange(event.target.value as RequestPolicyType)}>
                                {REQUEST_POLICY_TYPES.map(type => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                            {!allowTypeChange && (
                                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => setAllowTypeChange(true)}>
                                    Change type
                                </button>
                            )}
                        </div>
                        {policyTypesError && <div className='policy-management__inline-error'>{policyTypesError}</div>}
                    </div>
                )}

                {family && !needsBackendChoice && !requestTemplatePending && (
                    <>
                        <div className='policy-management__tab-row' role='tablist' aria-label='Policy editor tabs'>
                            {(['form', 'json'] as EditorTab[]).map(item => (
                                <button
                                    key={item}
                                    type='button'
                                    className={`argo-button ${tab === item ? 'argo-button--base' : 'argo-button--base-o'} policy-management__button`}
                                    onClick={() => setTab(item)}>
                                    {item === 'form' ? 'Form' : 'JSON'}
                                </button>
                            ))}
                            {canShowArgs && (
                                <button
                                    type='button'
                                    className={`argo-button ${tab === 'args' ? 'argo-button--base' : 'argo-button--base-o'} policy-management__button`}
                                    onClick={() => setTab('args')}>
                                    Args Builder
                                </button>
                            )}
                        </div>

                        {tab === 'form' && (
                            <div className='policy-management__form-grid'>
                                <label className='argo-form-row'>
                                    <span>policy_id</span>
                                    <input
                                        className='argo-field'
                                        aria-label='policy_id'
                                        value={documentStringValue(document, 'policy_id')}
                                        disabled={mode === 'edit'}
                                        onChange={event => setPolicyDocument(setTopLevel(document, 'policy_id', event.target.value))}
                                    />
                                </label>
                                {family === 'request' ? (
                                    <label className='argo-form-row'>
                                        <span>type</span>
                                        <select
                                            className='argo-field'
                                            aria-label='type'
                                            value={selectedRequestType}
                                            disabled={mode === 'edit' || !allowTypeChange}
                                            onChange={event => handleRequestTypeChange(event.target.value as RequestPolicyType)}>
                                            {REQUEST_POLICY_TYPES.map(type => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                        {mode === 'create' && !allowTypeChange && (
                                            <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => setAllowTypeChange(true)}>
                                                Change type
                                            </button>
                                        )}
                                        {policyTypesLoading && <span className='policy-management__table-meta'>Loading templates...</span>}
                                        {policyTypesError && <span className='policy-management__text--danger'>{policyTypesError}</span>}
                                    </label>
                                ) : (
                                    <label className='argo-form-row'>
                                        <span>backend</span>
                                        <select
                                            className='argo-field'
                                            aria-label='backend'
                                            value={selectedBackend}
                                            onChange={event => handleBackendChange(event.target.value as FeatureBackend)}>
                                            {FEATURE_BACKENDS.map(backend => (
                                                <option key={backend} value={backend}>
                                                    {backend}
                                                </option>
                                            ))}
                                        </select>
                                        {mode === 'edit' && <span className='policy-management__table-meta'>Selected /default requests must match this backend.</span>}
                                    </label>
                                )}
                                {family === 'feature' && (
                                    <label className='argo-form-row'>
                                        <span>feature</span>
                                        <input
                                            className='argo-field'
                                            aria-label='feature'
                                            value={documentStringValue(document, 'feature')}
                                            onChange={event => setPolicyDocument(setTopLevel(document, 'feature', event.target.value))}
                                        />
                                    </label>
                                )}
                                <label className='argo-form-row'>
                                    <span>display_name</span>
                                    <input
                                        className='argo-field'
                                        aria-label='display_name'
                                        value={documentStringValue(document, 'display_name')}
                                        onChange={event => setPolicyDocument(setTopLevel(document, 'display_name', event.target.value))}
                                    />
                                </label>
                                <label className='argo-form-row policy-management__field--wide'>
                                    <span>description</span>
                                    <textarea
                                        className='argo-field'
                                        aria-label='description'
                                        value={documentStringValue(document, 'description')}
                                        onChange={event => setPolicyDocument(setTopLevel(document, 'description', event.target.value))}
                                    />
                                </label>
                                <label className='argo-form-row'>
                                    <span>active</span>
                                    <input
                                        type='checkbox'
                                        aria-label='active'
                                        checked={documentBooleanValue(document, 'active')}
                                        onChange={event => setPolicyDocument(setTopLevel(document, 'active', event.target.checked))}
                                    />
                                </label>
                                <label className='argo-form-row'>
                                    <span>sort_order</span>
                                    <input
                                        className='argo-field'
                                        type='number'
                                        aria-label='sort_order'
                                        value={sortOrderValue(document)}
                                        onChange={event => setPolicyDocument(setSortOrder(document, Number(event.target.value) || 100))}
                                    />
                                </label>
                                <label className='argo-form-row policy-management__field--wide'>
                                    <span>tags</span>
                                    <input
                                        className='argo-field'
                                        aria-label='tags'
                                        value={tagsValue(document)}
                                        onChange={event =>
                                            setPolicyDocument(
                                                setMetadata(
                                                    document,
                                                    'tags',
                                                    event.target.value
                                                        .split(',')
                                                        .map(tag => tag.trim())
                                                        .filter(Boolean)
                                                )
                                            )
                                        }
                                    />
                                </label>
                                {family === 'request' && (
                                    <label className='argo-form-row policy-management__field--wide'>
                                        <span>effects</span>
                                        <textarea
                                            className='argo-field policy-management__textarea-code'
                                            aria-label='effects'
                                            value={formatPolicyJson(isObject(document.effects) ? (document.effects as Record<string, unknown>) : {})}
                                            onChange={event => setPolicyDocument(setEffectsText(document, event.target.value))}
                                        />
                                    </label>
                                )}
                                {family === 'feature' && selectedBackend === 'sglang' && mode === 'create' && (
                                    <div className='policy-management__field--wide'>
                                        <button
                                            type='button'
                                            className='argo-button argo-button--base-o policy-management__button'
                                            onClick={() => setPolicyDocument(applySglangStarterTemplate(document))}>
                                            <i className='fa fa-magic' aria-hidden='true' /> KV cache routing / Qwen3 parser starter
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'json' && (
                            <PolicyJsonEditor
                                value={jsonText}
                                onChange={handleJsonChange}
                                validationErrors={validationErrors}
                                serverError={serverError}
                                originalValue={originalValue}
                                onReset={originalValue ? () => handleJsonChange(originalValue) : undefined}
                            />
                        )}

                        {tab === 'args' && canShowArgs && <ArgsBuilder document={document} onChange={setPolicyDocument} />}

                        {(tab === 'form' || tab === 'args') && validationErrors.length > 0 && (
                            <div className='policy-management__inline-error'>
                                {validationErrors.map(error => (
                                    <div key={error}>{error}</div>
                                ))}
                            </div>
                        )}
                        {(tab === 'form' || tab === 'args') && serverError && <div className='policy-management__inline-error'>{serverError}</div>}

                        <div className='policy-management__drawer-actions'>
                            <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                type='submit'
                                className='argo-button argo-button--base policy-management__button'
                                disabled={isSaving || (family === 'request' && mode === 'create' && !requestTemplateReady)}>
                                {isSaving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create policy'}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </section>
    );
};
