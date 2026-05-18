import React, {useEffect, useMemo, useState} from 'react';

import {policyApiClient} from '../../policy-management/api/client';
import type {ManifestOverlayRecord, PolicyRecord, RequestPolicyType, RuntimeConfigPolicyRecord} from '../../policy-management/api/types';
import {Spinner} from '../../shared/components';

import {submitDefault} from '../api';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import type {SelectOption} from '../components/FieldInput';
import {JobRunConsole} from '../components/JobRunConsole';
import {useFormState} from '../hooks/useFormState';
import {useJobPoller} from '../hooks/useJobPoller';
import {FIELD_HELP} from '../options';

const POLICY_OPTION_FETCH_LIMIT = 200;

type RequestPolicyOptions = Record<RequestPolicyType, SelectOption[]>;

interface PolicyOptionState extends RequestPolicyOptions {
    runtime: SelectOption[];
    infrastructureRecords: PolicyRecord[];
    runtimeRecords: RuntimeConfigPolicyRecord[];
    overlayRecords: ManifestOverlayRecord[];
}

const EMPTY_POLICY_OPTIONS: PolicyOptionState = {
    workload: [],
    infrastructure: [],
    serving: [],
    runtime: [],
    infrastructureRecords: [],
    runtimeRecords: [],
    overlayRecords: []
};

function documentString(document: Record<string, unknown>, key: string): string {
    return typeof document[key] === 'string' ? (document[key] as string) : '';
}

function documentObject(document: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = document[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function policyLabel(record: PolicyRecord | RuntimeConfigPolicyRecord): string {
    const displayName = documentString(record.document || {}, 'display_name');
    return displayName ? `${displayName} (${record.policy_id})` : record.policy_id;
}

function requestPolicyOptions(records: PolicyRecord[]): SelectOption[] {
    return records.map(record => ({
        value: record.policy_id,
        label: policyLabel(record),
        description: documentString(record.document || {}, 'description')
    }));
}

function runtimePolicyOptions(records: RuntimeConfigPolicyRecord[]): SelectOption[] {
    return records.map(record => ({
        value: record.policy_id,
        label: policyLabel(record),
        description: [record.deployment_type, record.engine, record.engine_version, record.dynamo_version].filter(Boolean).join(' / ')
    }));
}

function overlayOptions(records: ManifestOverlayRecord[]): SelectOption[] {
    const byKey = new Map<string, ManifestOverlayRecord[]>();
    records.forEach(record => {
        const existing = byKey.get(record.overlay_key) || [];
        existing.push(record);
        byKey.set(record.overlay_key, existing);
    });
    return Array.from(byKey.entries()).map(([overlayKey, grouped]) => {
        const primary = grouped.find(record => record.is_default) || grouped[0];
        const crdVersions = Array.from(new Set(grouped.map(record => record.crd_version))).sort();
        return {
            value: overlayKey,
            label: primary.display_name ? `${primary.display_name} (${overlayKey})` : overlayKey,
            description: [
                primary.cloud_provider,
                primary.engine,
                primary.engine_version,
                primary.dynamo_version,
                primary.deployment_type,
                crdVersions.length ? `CRD: ${crdVersions.join(', ')}` : ''
            ]
                .filter(Boolean)
                .join(' / ')
        };
    });
}

export function DefaultPage() {
    const {values, errors, setValue, validateRequired, reset} = useFormState();
    const [jobId, setJobId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<unknown | null>(null);
    const [policyOptions, setPolicyOptions] = useState<PolicyOptionState>(EMPTY_POLICY_OPTIONS);
    const [policyOptionsLoading, setPolicyOptionsLoading] = useState(true);
    const [policyOptionsError, setPolicyOptionsError] = useState<unknown | null>(null);
    const {job, cancelling, cancelError, pollRecovery, cancel, retry, reset: resetPoller} = useJobPoller(jobId);

    useEffect(() => {
        let cancelled = false;
        setPolicyOptionsLoading(true);
        setPolicyOptionsError(null);

        Promise.all([
            policyApiClient.listPolicies({type: 'workload', active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listPolicies({type: 'infrastructure', active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listPolicies({type: 'serving', active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listRuntimeConfigPolicies({active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0}),
            policyApiClient.listManifestOverlays({active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0})
        ])
            .then(([workload, infrastructure, serving, runtime, overlays]) => {
                if (cancelled) {
                    return;
                }
                setPolicyOptions({
                    workload: requestPolicyOptions(workload.policies || []),
                    infrastructure: requestPolicyOptions(infrastructure.policies || []),
                    serving: requestPolicyOptions(serving.policies || []),
                    runtime: runtimePolicyOptions(runtime.runtime_config_policies || []),
                    infrastructureRecords: infrastructure.policies || [],
                    runtimeRecords: runtime.runtime_config_policies || [],
                    overlayRecords: overlays.overlays || []
                });
            })
            .catch(error => {
                if (!cancelled) {
                    setPolicyOptionsError(error);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPolicyOptionsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const policyLoadingHint = useMemo(() => (policyOptionsLoading ? 'Loading active policies...' : undefined), [policyOptionsLoading]);

    const matchingOverlayOptions = useMemo(() => {
        const selectedRuntime = policyOptions.runtimeRecords.find(record => record.policy_id === values.runtime_config_policy_id);
        const selectedInfrastructure = policyOptions.infrastructureRecords.find(record => record.policy_id === values.infrastructure_policy);
        const infraEffects = selectedInfrastructure ? documentObject(selectedInfrastructure.document || {}, 'effects') : {};
        const cloudProvider = typeof infraEffects.cloud_provider === 'string' ? infraEffects.cloud_provider : undefined;
        const filtered = policyOptions.overlayRecords.filter(record => {
            if (cloudProvider && record.cloud_provider !== cloudProvider) {
                return false;
            }
            if (!selectedRuntime) {
                return true;
            }
            return (
                record.engine === selectedRuntime.engine &&
                record.engine_version === selectedRuntime.engine_version &&
                record.dynamo_version === selectedRuntime.dynamo_version &&
                record.deployment_type === selectedRuntime.deployment_type
            );
        });
        return overlayOptions(filtered.length || selectedRuntime || cloudProvider ? filtered : policyOptions.overlayRecords);
    }, [policyOptions.infrastructureRecords, policyOptions.overlayRecords, policyOptions.runtimeRecords, values.infrastructure_policy, values.runtime_config_policy_id]);

    useEffect(() => {
        if (values.overlay_key && !matchingOverlayOptions.some(option => option.value === values.overlay_key)) {
            setValue('overlay_key', '');
        }
    }, [matchingOverlayOptions, setValue, values.overlay_key]);

    function handleFieldChange(key: string, value: string) {
        setValue(key, value);
        if (submitError) {
            setSubmitError(null);
        }
    }

    function buildRequest() {
        const request = {
            model_path: values.model_path,
            public_model_name: values.public_model_name,
            total_gpus: Number(values.total_gpus),
            policies: {
                workload: [values.workload_policy],
                infrastructure: [values.infrastructure_policy],
                serving: [values.serving_policy]
            },
            runtime_config_policy_id: values.runtime_config_policy_id
        };
        return values.overlay_key ? {...request, overlay_key: values.overlay_key} : request;
    }

    async function handleSubmit() {
        if (!validateRequired(['model_path', 'public_model_name', 'total_gpus', 'workload_policy', 'infrastructure_policy', 'serving_policy', 'runtime_config_policy_id'])) {
            return;
        }

        setSubmitError(null);
        setSubmitting(true);
        resetPoller();
        setJobId(null);

        try {
            const accepted = await submitDefault(buildRequest());
            setJobId(accepted.job_id);
        } catch (err) {
            setSubmitError(err);
        } finally {
            setSubmitting(false);
        }
    }

    function handleReset() {
        reset();
        resetPoller();
        setJobId(null);
        setSubmitError(null);
    }

    return (
        <div className='deploy-models__form'>
            <FieldInput
                def={{key: 'model_path', label: 'Model Path', type: 'text', required: true, placeholder: 'Qwen/Qwen3-32B-FP8', help: FIELD_HELP.modelPath}}
                value={values.model_path || ''}
                error={errors.model_path}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'public_model_name',
                    label: 'Public Model Name',
                    type: 'text',
                    required: true,
                    placeholder: 'Qwen/Qwen3-32B-FP8',
                    help: FIELD_HELP.publicModelName
                }}
                value={values.public_model_name || ''}
                error={errors.public_model_name}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'total_gpus',
                    label: 'Total GPUs',
                    type: 'number',
                    required: true,
                    min: 1,
                    placeholder: '8',
                    help: FIELD_HELP.totalGpus
                }}
                value={values.total_gpus || ''}
                error={errors.total_gpus}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'workload_policy',
                    label: 'Workload Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select workload policy',
                    options: policyOptions.workload,
                    hint: policyLoadingHint
                }}
                value={values.workload_policy || ''}
                error={errors.workload_policy}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'infrastructure_policy',
                    label: 'Infra Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select infra policy',
                    options: policyOptions.infrastructure,
                    hint: policyLoadingHint
                }}
                value={values.infrastructure_policy || ''}
                error={errors.infrastructure_policy}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'serving_policy',
                    label: 'Serving Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select serving policy',
                    options: policyOptions.serving,
                    hint: policyLoadingHint
                }}
                value={values.serving_policy || ''}
                error={errors.serving_policy}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'runtime_config_policy_id',
                    label: 'Runtime Config Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select runtime config policy',
                    options: policyOptions.runtime,
                    hint: policyLoadingHint
                }}
                value={values.runtime_config_policy_id || ''}
                error={errors.runtime_config_policy_id}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{
                    key: 'overlay_key',
                    label: 'Manifest Overlay',
                    type: 'select',
                    required: false,
                    placeholder: 'Use matching default overlay',
                    options: matchingOverlayOptions,
                    hint: policyLoadingHint
                }}
                value={values.overlay_key || ''}
                error={errors.overlay_key}
                onChange={handleFieldChange}
            />

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={handleSubmit} disabled={submitting || policyOptionsLoading}>
                    {submitting ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Submitting...
                        </>
                    ) : (
                        <>
                            <i className='fa fa-paper-plane' /> Submit
                        </>
                    )}
                </button>
                {(jobId || submitError) && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={handleReset}>
                        New run
                    </button>
                )}
            </div>

            {policyOptionsError && <ErrorAlert error={policyOptionsError} />}
            {submitError && <ErrorAlert error={submitError} />}

            <JobRunConsole job={job} cancelling={cancelling} cancelError={cancelError} pollRecovery={pollRecovery} onRetryPoll={retry} onCancel={cancel} />
        </div>
    );
}
