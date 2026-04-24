import React, {useState} from 'react';

import {Spinner} from '../../shared/components';

import {submitDefault, submitDefaultPreflight} from '../api';
import {AdvancedSection} from '../components/AdvancedSection';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import {JobRunConsole} from '../components/JobRunConsole';
import {NoticeAlert} from '../components/NoticeAlert';
import {RecentRunsPanel} from '../components/RecentRunsPanel';
import {useFormState} from '../hooks/useFormState';
import {useJobPoller} from '../hooks/useJobPoller';
import {DATABASE_MODE_OPTIONS, DEPLOYMENT_MODE_HINT, DEPLOY_MODE_OPTIONS, EC2_INSTANCE_HINT, EC2_INSTANCE_OPTIONS, FIELD_HELP} from '../options';
import type {DefaultPreflightResponse, DeployMode} from '../types';

const BACKEND_OPTIONS = [
    {value: 'trtllm', label: 'TRT-LLM'},
    {value: 'sglang', label: 'SGLang'},
    {value: 'vllm', label: 'vLLM'},
    {value: 'auto', label: 'Auto'}
];

export function DefaultPage() {
    const {values, errors, setValue, validateRequired, reset} = useFormState({mode: 'agg'});
    const [jobId, setJobId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<unknown | null>(null);
    const [preflight, setPreflight] = useState<DefaultPreflightResponse | null>(null);
    const {job, cancelling, cancelError, pollRecovery, cancel, retry, reset: resetPoller} = useJobPoller(jobId);
    const preflightSummary = getPreflightSummary(preflight);

    function handleFieldChange(key: string, value: string) {
        setValue(key, value);
        if (preflight) {
            setPreflight(null);
        }
        if (submitError) {
            setSubmitError(null);
        }
    }

    function buildRequest() {
        const mode = (values.mode || undefined) as DeployMode | undefined;
        return {
            model_path: values.model_path,
            total_gpus: Number(values.total_gpus),
            instance_type: values.instance_type,
            ...(values.decode_instance_type && {decode_instance_type: values.decode_instance_type}),
            backend: values.backend || 'trtllm',
            ...(values.backend_version && {backend_version: values.backend_version}),
            database_mode: values.database_mode || 'SILICON',
            isl: values.isl ? Number(values.isl) : undefined,
            osl: values.osl ? Number(values.osl) : undefined,
            ttft: values.ttft ? Number(values.ttft) : undefined,
            tpot: values.tpot ? Number(values.tpot) : undefined,
            ...(values.request_latency && {request_latency: Number(values.request_latency)}),
            prefix: values.prefix ? Number(values.prefix) : undefined,
            ...(values.free_gpu_memory_fraction && {free_gpu_memory_fraction: Number(values.free_gpu_memory_fraction)}),
            ...(values.max_seq_len && {max_seq_len: Number(values.max_seq_len)}),
            top_n: values.top_n ? Number(values.top_n) : undefined,
            generator_set: values.generator_set
                ? values.generator_set
                      .split(/\r?\n|,/)
                      .map(item => item.trim())
                      .filter(Boolean)
                : undefined,
            ...(values.generator_config && {generator_config: values.generator_config}),
            ...(values.generator_dynamo_version && {generator_dynamo_version: values.generator_dynamo_version}),
            mode
        };
    }

    function getPreflightSummary(currentPreflight: DefaultPreflightResponse | null): {variant: 'warning' | 'error'; message: string} | null {
        if (!currentPreflight || currentPreflight.status === 'ready') {
            return null;
        }
        if (currentPreflight.status === 'warning') {
            return {
                variant: 'warning',
                message: 'Preflight found issues. Review the warnings below, adjust the inputs, or continue anyway if you accept the risk.'
            };
        }
        if (currentPreflight.can_run_anyway) {
            return {
                variant: 'warning',
                message: 'Preflight found blocking issues, but this request can still be forced. Use Continue anyway only if you expect the generated config to still be valid.'
            };
        }
        return {
            variant: 'error',
            message: 'Preflight blocked this run. Adjust the highlighted settings before trying again.'
        };
    }

    async function handleSubmit(force = false) {
        if (!validateRequired(['model_path', 'total_gpus', 'instance_type', 'mode'])) {
            return;
        }

        setSubmitError(null);
        setPreflight(null);
        setSubmitting(true);
        resetPoller();
        setJobId(null);

        try {
            const request = buildRequest();
            if (!force) {
                const nextPreflight = await submitDefaultPreflight(request);
                if (nextPreflight.status !== 'ready') {
                    setPreflight(nextPreflight);
                    return;
                }
            }
            const accepted = await submitDefault(request);
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
        setPreflight(null);
    }

    function applyRecommendedDatabaseMode() {
        if (!preflight?.recommended_database_mode) {
            return;
        }
        handleFieldChange('database_mode', preflight.recommended_database_mode);
    }

    return (
        <div className='deploy-models__form'>
            <RecentRunsPanel selectedJobId={jobId} onSelectJob={setJobId} />
            <FieldInput
                def={{key: 'model_path', label: 'Model Path', type: 'text', required: true, placeholder: 'Qwen/Qwen3-32B-FP8', help: FIELD_HELP.modelPath}}
                value={values.model_path || ''}
                error={errors.model_path}
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
                    help: FIELD_HELP.totalGpus,
                    hint: 'Total GPU count across the deployment you want AIC to size.'
                }}
                value={values.total_gpus || ''}
                error={errors.total_gpus}
                onChange={handleFieldChange}
            />
            <FieldInput
                def={{key: 'instance_type', label: 'EC2 Instance', type: 'select', required: true, options: EC2_INSTANCE_OPTIONS, hint: EC2_INSTANCE_HINT}}
                value={values.instance_type || ''}
                error={errors.instance_type}
                onChange={handleFieldChange}
            />

            <FieldInput
                def={{
                    key: 'mode',
                    label: 'Deployment Mode',
                    type: 'select',
                    required: true,
                    options: DEPLOY_MODE_OPTIONS,
                    includeEmptyOption: false,
                    help: FIELD_HELP.deployMode,
                    hint: DEPLOYMENT_MODE_HINT
                }}
                value={values.mode || ''}
                error={errors.mode}
                onChange={handleFieldChange}
            />

            <AdvancedSection>
                <FieldInput
                    def={{key: 'isl', label: 'Input Seq Length', type: 'number', min: 1, placeholder: '4000', help: FIELD_HELP.isl}}
                    value={values.isl || ''}
                    error={errors.isl}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'osl', label: 'Output Seq Length', type: 'number', min: 1, placeholder: '1000', help: FIELD_HELP.osl}}
                    value={values.osl || ''}
                    error={errors.osl}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'ttft', label: 'TTFT Target (ms)', type: 'number', min: 0, placeholder: '2000', help: FIELD_HELP.ttft}}
                    value={values.ttft || ''}
                    error={errors.ttft}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'tpot', label: 'TPOT Target (ms)', type: 'number', min: 0, placeholder: '30', help: FIELD_HELP.tpot}}
                    value={values.tpot || ''}
                    error={errors.tpot}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'request_latency', label: 'E2E Latency Target (ms)', type: 'number', min: 0, help: FIELD_HELP.requestLatency}}
                    value={values.request_latency || ''}
                    error={errors.request_latency}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'backend', label: 'Backend', type: 'select', options: BACKEND_OPTIONS, help: FIELD_HELP.backend}}
                    value={values.backend || ''}
                    error={errors.backend}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'backend_version', label: 'Backend Version', type: 'text', placeholder: 'e.g. 0.17.0', help: FIELD_HELP.backendVersion}}
                    value={values.backend_version || ''}
                    error={errors.backend_version}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{
                        key: 'database_mode',
                        label: 'Database Mode',
                        type: 'select',
                        options: DATABASE_MODE_OPTIONS,
                        help: FIELD_HELP.databaseMode,
                        hint: 'Compatibility does not guarantee success for the selected database mode or latency targets. Run performs an exact preflight first.'
                    }}
                    value={values.database_mode || ''}
                    error={errors.database_mode}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'decode_instance_type', label: 'Decode EC2 Instance (disagg)', type: 'select', options: EC2_INSTANCE_OPTIONS, hint: EC2_INSTANCE_HINT}}
                    value={values.decode_instance_type || ''}
                    error={errors.decode_instance_type}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'prefix', label: 'Prefix Cache Length', type: 'number', min: 0, help: FIELD_HELP.prefixCache}}
                    value={values.prefix || ''}
                    error={errors.prefix}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{
                        key: 'free_gpu_memory_fraction',
                        label: 'KV Cache Memory Fraction',
                        type: 'number',
                        min: 0.01,
                        max: 1,
                        step: 0.01,
                        placeholder: '0.9',
                        help: FIELD_HELP.kvCacheFraction
                    }}
                    value={values.free_gpu_memory_fraction || ''}
                    error={errors.free_gpu_memory_fraction}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'max_seq_len', label: 'Max Seq Length', type: 'number', min: 1, help: FIELD_HELP.maxSeqLen}}
                    value={values.max_seq_len || ''}
                    error={errors.max_seq_len}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{key: 'top_n', label: 'Top-N Results', type: 'number', min: 1, max: 50, placeholder: '5', help: FIELD_HELP.topN}}
                    value={values.top_n || ''}
                    error={errors.top_n}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{
                        key: 'generator_set',
                        label: 'Generator Rules',
                        type: 'text',
                        placeholder: 'rule=benchmark, ServiceConfig.model_path=meta/llama',
                        help: FIELD_HELP.generatorSet,
                        hint: 'Optional comma-separated generator rules and overrides for expert tuning.'
                    }}
                    value={values.generator_set || ''}
                    error={errors.generator_set}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{
                        key: 'generator_config',
                        label: 'Generator Config Path',
                        type: 'text',
                        placeholder: '/tmp/generator.yaml',
                        help: FIELD_HELP.generatorConfig,
                        hint: 'Optional generator config file path for advanced generation behavior.'
                    }}
                    value={values.generator_config || ''}
                    error={errors.generator_config}
                    onChange={handleFieldChange}
                />
                <FieldInput
                    def={{
                        key: 'generator_dynamo_version',
                        label: 'Dynamo Version Override',
                        type: 'text',
                        placeholder: 'e.g. 1.1.0',
                        help: FIELD_HELP.generatorDynamoVersion
                    }}
                    value={values.generator_dynamo_version || ''}
                    error={errors.generator_dynamo_version}
                    onChange={handleFieldChange}
                />
            </AdvancedSection>

            <NoticeAlert
                variant='info'
                message='Run first performs an exact preflight using your selected database mode, GPU count, and latency targets. Compatibility alone does not guarantee deploy success.'
            />

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={() => handleSubmit()} disabled={submitting}>
                    {submitting ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Running…
                        </>
                    ) : (
                        <>
                            <i className='fa fa-play' /> Run planner
                        </>
                    )}
                </button>
                {preflight && preflight.status !== 'ready' && preflight.can_run_anyway && !submitting && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={() => handleSubmit(true)}>
                        Continue anyway
                    </button>
                )}
                {preflight?.recommended_database_mode && preflight.recommended_database_mode !== (values.database_mode || 'SILICON') && !submitting && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={applyRecommendedDatabaseMode}>
                        Use {preflight.recommended_database_mode}
                    </button>
                )}
                {(jobId || submitError || preflight) && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={handleReset}>
                        New run
                    </button>
                )}
            </div>

            {submitError && <ErrorAlert error={submitError} />}
            {preflightSummary && <NoticeAlert variant={preflightSummary.variant} message={preflightSummary.message} />}
            {preflight?.messages.map(message => (
                <NoticeAlert
                    key={`${message.code}-${message.severity}`}
                    variant={message.severity === 'error' ? 'error' : message.severity === 'warning' ? 'warning' : 'info'}
                    message={message.message}
                />
            ))}

            <JobRunConsole job={job} cancelling={cancelling} cancelError={cancelError} pollRecovery={pollRecovery} onRetryPoll={retry} onCancel={cancel} />
        </div>
    );
}
