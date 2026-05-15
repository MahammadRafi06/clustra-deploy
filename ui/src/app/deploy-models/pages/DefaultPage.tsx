import React, {useEffect, useMemo, useState} from 'react';

import {policyApiClient} from '../../policy-management/api/client';
import type {PolicyRecord, RequestPolicyType, RuntimeConfigPolicyRecord} from '../../policy-management/api/types';
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
}

const EMPTY_POLICY_OPTIONS: PolicyOptionState = {
    workload: [],
    infrastructure: [],
    serving: [],
    runtime: []
};

function documentString(document: Record<string, unknown>, key: string): string {
    return typeof document[key] === 'string' ? (document[key] as string) : '';
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
        description: [record.engine, record.engine_version, record.deployment_type].filter(Boolean).join(' / ')
    }));
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
            policyApiClient.listRuntimeConfigPolicies({active: true, limit: POLICY_OPTION_FETCH_LIMIT, offset: 0})
        ])
            .then(([workload, infrastructure, serving, runtime]) => {
                if (cancelled) {
                    return;
                }
                setPolicyOptions({
                    workload: requestPolicyOptions(workload.policies || []),
                    infrastructure: requestPolicyOptions(infrastructure.policies || []),
                    serving: requestPolicyOptions(serving.policies || []),
                    runtime: runtimePolicyOptions(runtime.runtime_config_policies || [])
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

    function handleFieldChange(key: string, value: string) {
        setValue(key, value);
        if (submitError) {
            setSubmitError(null);
        }
    }

    function buildRequest() {
        return {
            model_path: values.model_path,
            public_model_name: values.public_model_name,
            total_gpus: Number(values.total_gpus),
            workload_policy: values.workload_policy,
            infrastructure_policy: values.infrastructure_policy,
            serving_policy: values.serving_policy,
            runtime_policy: values.runtime_policy
        };
    }

    async function handleSubmit() {
        if (
            !validateRequired([
                'model_path',
                'public_model_name',
                'total_gpus',
                'workload_policy',
                'infrastructure_policy',
                'serving_policy',
                'runtime_policy'
            ])
        ) {
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
                    key: 'runtime_policy',
                    label: 'Runtime Policy',
                    type: 'select',
                    required: true,
                    placeholder: 'Select runtime policy',
                    options: policyOptions.runtime,
                    hint: policyLoadingHint
                }}
                value={values.runtime_policy || ''}
                error={errors.runtime_policy}
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
