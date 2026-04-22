import React, {useState} from 'react';

import {Spinner} from '../../shared/components';

import {submitSupport} from '../api';
import {AdvancedSection} from '../components/AdvancedSection';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import {NoticeAlert} from '../components/NoticeAlert';
import {useFormState} from '../hooks/useFormState';
import {EC2_INSTANCE_HINT, EC2_INSTANCE_OPTIONS} from '../options';
import type {SupportResponse} from '../types';

const BACKEND_OPTIONS = [
    {value: 'trtllm', label: 'TRT-LLM'},
    {value: 'sglang', label: 'SGLang'},
    {value: 'vllm', label: 'vLLM'}
];

function SupportResult({result}: {result: SupportResponse}) {
    return (
        <div className='deploy-models__support-result'>
            <div className='deploy-models__support-row'>
                <span className='deploy-models__support-label'>Aggregated (agg)</span>
                <span className={`deploy-models__status-pill ${result.agg_supported ? 'deploy-models__status-pill--success' : 'deploy-models__status-pill--warning'}`}>
                    {result.agg_supported ? 'Compatible' : 'Not Confirmed'}
                </span>
            </div>
            <div className='deploy-models__support-row'>
                <span className='deploy-models__support-label'>Disaggregated (disagg)</span>
                <span className={`deploy-models__status-pill ${result.disagg_supported ? 'deploy-models__status-pill--success' : 'deploy-models__status-pill--warning'}`}>
                    {result.disagg_supported ? 'Compatible' : 'Not Confirmed'}
                </span>
            </div>
            <div className='deploy-models__support-row'>
                <span className='deploy-models__support-label deploy-models__support-label--muted'>Backend</span>
                <span className='deploy-models__secondary-text'>{result.backend}</span>
            </div>
            {!result.exact_match && (
                <div className='deploy-models__support-row'>
                    <span className='deploy-models__support-label deploy-models__support-label--muted'>Signal Quality</span>
                    <span className='deploy-models__secondary-text'>
                        {result.inferred_from_architecture && result.architecture ? `Inferred from ${result.architecture}` : 'No exact cached model match'}
                    </span>
                </div>
            )}
            <NoticeAlert variant='info' message={result.note} />
        </div>
    );
}

export function SupportPage() {
    const {values, errors, setValue, validateRequired, reset} = useFormState();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SupportResponse | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    async function handleSubmit() {
        if (!validateRequired(['model_path', 'instance_type'])) {
            return;
        }

        setSubmitError(null);
        setResult(null);
        setLoading(true);

        try {
            const response = await submitSupport({
                model_path: values.model_path,
                instance_type: values.instance_type,
                backend: values.backend || 'trtllm',
                ...(values.backend_version && {backend_version: values.backend_version})
            });
            setResult(response);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    function handleReset() {
        reset();
        setResult(null);
        setSubmitError(null);
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

            <NoticeAlert
                variant='info'
                message='This page is a compatibility check, not a deploy guarantee. You can still try deployment even when a mode is not confirmed here.'
            />

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={handleSubmit} disabled={loading}>
                    {loading ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Checking…
                        </>
                    ) : (
                        <>
                            <i className='fa fa-search' /> Check Compatibility
                        </>
                    )}
                </button>
                {(result || submitError) && (
                    <button type='button' className='argo-button argo-button--base-o' onClick={handleReset}>
                        Reset
                    </button>
                )}
            </div>

            {submitError && <ErrorAlert message={submitError} />}
            {result && <SupportResult result={result} />}
        </div>
    );
}
