import React, {useState} from 'react';

import {Spinner} from '../../shared/components';

import {submitGenerate} from '../api';
import {AdvancedSection} from '../components/AdvancedSection';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import {JobResultView} from '../components/JobResultView';
import {JobStatusBanner} from '../components/JobStatusBanner';
import {NoticeAlert} from '../components/NoticeAlert';
import {useFormState} from '../hooks/useFormState';
import {useJobPoller} from '../hooks/useJobPoller';
import {DEPLOYMENT_MODE_HINT, DEPLOY_MODE_OPTIONS, EC2_INSTANCE_HINT, EC2_INSTANCE_OPTIONS} from '../options';
import {getDeployCompatibilityAdvisory} from '../supportGuard';
import type {DeployMode} from '../types';

const BACKEND_OPTIONS = [
    {value: 'trtllm', label: 'TRT-LLM'},
    {value: 'sglang', label: 'SGLang'},
    {value: 'vllm', label: 'vLLM'}
];

export function GeneratePage() {
    const {values, errors, setValue, validateRequired, reset} = useFormState({mode: 'agg'});
    const [jobId, setJobId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [compatibilityWarning, setCompatibilityWarning] = useState<string | null>(null);
    const {job, cancelling, cancel, reset: resetPoller} = useJobPoller(jobId);

    const isTerminal = !!job && (job.status === 'success' || job.status === 'failed' || job.status === 'cancelled');

    async function handleSubmit() {
        if (!validateRequired(['model_path', 'total_gpus', 'instance_type', 'mode'])) {
            return;
        }

        setSubmitError(null);
        setCompatibilityWarning(null);
        setSubmitting(true);
        resetPoller();
        setJobId(null);

        try {
            const mode = (values.mode || undefined) as DeployMode | undefined;
            const compatibility = await getDeployCompatibilityAdvisory({
                modelPath: values.model_path,
                instanceType: values.instance_type,
                backend: values.backend || 'trtllm',
                mode
            });
            if (compatibility.blockingError) {
                setSubmitError(compatibility.blockingError);
                return;
            }
            if (compatibility.warning) {
                setCompatibilityWarning(compatibility.warning);
            }

            const accepted = await submitGenerate({
                model_path: values.model_path,
                total_gpus: Number(values.total_gpus),
                instance_type: values.instance_type,
                backend: values.backend || 'trtllm',
                ...(values.backend_version && {backend_version: values.backend_version}),
                mode
            });
            setJobId(accepted.job_id);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    }

    function handleReset() {
        reset();
        resetPoller();
        setJobId(null);
        setSubmitError(null);
        setCompatibilityWarning(null);
    }

    return (
        <div className='deploy-models__form'>
            <FieldInput
                def={{key: 'model_path', label: 'Model Path', type: 'text', required: true, placeholder: 'Qwen/Qwen3-32B-FP8'}}
                value={values.model_path || ''}
                error={errors.model_path}
                onChange={setValue}
            />
            <FieldInput
                def={{
                    key: 'total_gpus',
                    label: 'Total GPUs',
                    type: 'number',
                    required: true,
                    min: 1,
                    placeholder: '8',
                    hint: 'Total GPU count across the deployment you want AIC to size.'
                }}
                value={values.total_gpus || ''}
                error={errors.total_gpus}
                onChange={setValue}
            />
            <FieldInput
                def={{key: 'instance_type', label: 'EC2 Instance', type: 'select', required: true, options: EC2_INSTANCE_OPTIONS, hint: EC2_INSTANCE_HINT}}
                value={values.instance_type || ''}
                error={errors.instance_type}
                onChange={setValue}
            />

            <AdvancedSection>
                <FieldInput
                    def={{key: 'backend', label: 'Backend', type: 'select', options: BACKEND_OPTIONS}}
                    value={values.backend || ''}
                    error={errors.backend}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'backend_version', label: 'Backend Version', type: 'text', placeholder: 'e.g. 0.17.0'}}
                    value={values.backend_version || ''}
                    error={errors.backend_version}
                    onChange={setValue}
                />
            </AdvancedSection>

            <div className='deploy-models__section-divider'>
                <span>Deploy</span>
            </div>
            <FieldInput
                def={{key: 'mode', label: 'Deployment Mode', type: 'select', required: true, options: DEPLOY_MODE_OPTIONS, includeEmptyOption: false, hint: DEPLOYMENT_MODE_HINT}}
                value={values.mode || ''}
                error={errors.mode}
                onChange={setValue}
            />

            <NoticeAlert variant='info' message='Compatibility checks are advisory only. A mode marked not confirmed can still be tried.' />

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={handleSubmit} disabled={submitting || (!!job && !isTerminal)}>
                    {submitting ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Running…
                        </>
                    ) : (
                        <>
                            <i className='fa fa-rocket' /> Deploy
                        </>
                    )}
                </button>
                {(jobId || submitError) && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={handleReset}>
                        New run
                    </button>
                )}
            </div>

            {submitError && <ErrorAlert message={submitError} />}
            {compatibilityWarning && <NoticeAlert variant='warning' message={compatibilityWarning} />}

            {job && (
                <>
                    <JobStatusBanner jobId={job.job_id} status={job.status} onCancel={cancel} cancelling={cancelling} />
                    {isTerminal && <JobResultView job={job} />}
                </>
            )}
        </div>
    );
}
