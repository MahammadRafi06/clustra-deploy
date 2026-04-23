import React, {useState} from 'react';

import {Spinner} from '../../shared/components';

import {submitExp} from '../api';
import {AdvancedSection} from '../components/AdvancedSection';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import {JobRunConsole} from '../components/JobRunConsole';
import {useFormState} from '../hooks/useFormState';
import {useJobPoller} from '../hooks/useJobPoller';
import {DEPLOY_MODE_OPTIONS} from '../options';
import type {DeployMode} from '../types';

type InputMode = 'yaml_path' | 'inline';

export function ExpPage() {
    const {values, errors, setValue, setError, reset} = useFormState({mode: 'agg'});
    const [inputMode, setInputMode] = useState<InputMode>('yaml_path');
    const [jobId, setJobId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const {job, cancelling, cancel, reset: resetPoller} = useJobPoller(jobId);

    async function handleSubmit() {
        setSubmitError(null);

        let config: Record<string, unknown> | undefined;

        if (inputMode === 'yaml_path') {
            if (!values.yaml_path?.trim()) {
                setError('yaml_path', 'This field is required');
                return;
            }
        } else {
            if (!values.config?.trim()) {
                setError('config', 'This field is required');
                return;
            }
            try {
                config = JSON.parse(values.config) as Record<string, unknown>;
            } catch {
                setError('config', 'Invalid JSON');
                return;
            }
        }

        if (!values.mode?.trim()) {
            setError('mode', 'This field is required');
            return;
        }

        setSubmitting(true);
        resetPoller();
        setJobId(null);

        try {
            const mode = (values.mode || undefined) as DeployMode | undefined;
            const accepted = await submitExp({
                ...(inputMode === 'yaml_path' ? {yaml_path: values.yaml_path} : {config}),
                top_n: values.top_n ? Number(values.top_n) : undefined,
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
        setInputMode('yaml_path');
    }

    return (
        <div className='deploy-models__form'>
            <div className='argo-form-row deploy-models__field'>
                <label>Config Source</label>
                <div className='deploy-models__choice-group'>
                    <label className='deploy-models__choice'>
                        <input type='radio' value='yaml_path' checked={inputMode === 'yaml_path'} onChange={() => setInputMode('yaml_path')} />
                        YAML Path
                    </label>
                    <label className='deploy-models__choice'>
                        <input type='radio' value='inline' checked={inputMode === 'inline'} onChange={() => setInputMode('inline')} />
                        Inline Config
                    </label>
                </div>
            </div>

            {inputMode === 'yaml_path' ? (
                <FieldInput
                    def={{
                        key: 'yaml_path',
                        label: 'YAML Path (server-side)',
                        type: 'text',
                        required: true,
                        placeholder: '/app/output/my-experiment.yaml',
                        hint: 'Must be within AICONF_OUTPUT_BASE_DIR'
                    }}
                    value={values.yaml_path || ''}
                    error={errors.yaml_path}
                    onChange={setValue}
                />
            ) : (
                <FieldInput
                    def={{
                        key: 'config',
                        label: 'Inline Config (JSON)',
                        type: 'textarea',
                        required: true,
                        rows: 8,
                        placeholder: '{\n  "model_path": "...",\n  ...\n}'
                    }}
                    value={values.config || ''}
                    error={errors.config}
                    onChange={setValue}
                />
            )}

            <FieldInput
                def={{
                    key: 'mode',
                    label: 'Deployment Mode',
                    type: 'select',
                    required: true,
                    options: DEPLOY_MODE_OPTIONS,
                    includeEmptyOption: false,
                    hint: 'Chooses the manifest layout committed to your ArgoCD app repo.'
                }}
                value={values.mode || ''}
                error={errors.mode}
                onChange={setValue}
            />

            <AdvancedSection>
                <FieldInput
                    def={{key: 'top_n', label: 'Top-N Results', type: 'number', min: 1, max: 50, placeholder: '5'}}
                    value={values.top_n || ''}
                    error={errors.top_n}
                    onChange={setValue}
                />
            </AdvancedSection>

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Running…
                        </>
                    ) : (
                        <>
                            <i className='fa fa-play' /> Run
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

            <JobRunConsole job={job} selectedJobId={jobId} cancelling={cancelling} onCancel={cancel} onSelectJob={setJobId} />
        </div>
    );
}
