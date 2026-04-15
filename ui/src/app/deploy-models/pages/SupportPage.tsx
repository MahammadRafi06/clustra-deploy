import React, { useState } from 'react';
import { submitSupport } from '../api';
import { AdvancedSection } from '../components/AdvancedSection';
import { ErrorAlert } from '../components/ErrorAlert';
import { FieldInput } from '../components/FieldInput';
import { NoticeAlert } from '../components/NoticeAlert';
import { useFormState } from '../hooks/useFormState';
import { EC2_INSTANCE_HINT, EC2_INSTANCE_OPTIONS } from '../options';
import type { SupportResponse } from '../types';

const BACKEND_OPTIONS = [
  { value: 'trtllm', label: 'TRT-LLM' },
  { value: 'sglang', label: 'SGLang' },
  { value: 'vllm',   label: 'vLLM' },
];

function SupportResult({ result }: { result: SupportResponse }) {
  return (
    <div className="cext-support-result">
      <div className="cext-support-result__row">
        <span className="cext-support-result__label">Aggregated (agg)</span>
        <span className={`cext-badge ${result.agg_supported ? 'cext-badge--success' : 'cext-badge--warning'}`}>
          {result.agg_supported ? 'Compatible' : 'Not Confirmed'}
        </span>
      </div>
      <div className="cext-support-result__row">
        <span className="cext-support-result__label">Disaggregated (disagg)</span>
        <span className={`cext-badge ${result.disagg_supported ? 'cext-badge--success' : 'cext-badge--warning'}`}>
          {result.disagg_supported ? 'Compatible' : 'Not Confirmed'}
        </span>
      </div>
      <div className="cext-support-result__row" style={{ marginTop: 4 }}>
        <span className="cext-support-result__label" style={{ color: 'var(--brand-text-muted)' }}>Backend</span>
        <span style={{ fontSize: 12, color: 'var(--brand-text-secondary)' }}>{result.backend}</span>
      </div>
      {!result.exact_match && (
        <div className="cext-support-result__row">
          <span className="cext-support-result__label" style={{ color: 'var(--brand-text-muted)' }}>Signal Quality</span>
          <span style={{ fontSize: 12, color: 'var(--brand-text-secondary)' }}>
            {result.inferred_from_architecture && result.architecture
              ? `Inferred from ${result.architecture}`
              : 'No exact cached model match'}
          </span>
        </div>
      )}
      <NoticeAlert variant="info" message={result.note} />
    </div>
  );
}

export function SupportPage() {
  const { values, errors, setValue, validateRequired, reset } = useFormState();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SupportResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!validateRequired(['model_path', 'instance_type'])) return;
    setSubmitError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await submitSupport({
        model_path: values.model_path,
        instance_type: values.instance_type,
        backend: values.backend || 'trtllm',
        ...(values.backend_version && { backend_version: values.backend_version }),
      });
      setResult(res);
    } catch (err: unknown) {
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
    <div className="cext-form">
      <FieldInput
        def={{ key: 'model_path', label: 'Model Path', type: 'text', required: true, placeholder: 'Qwen/Qwen3-32B-FP8' }}
        value={values.model_path ?? ''}
        error={errors.model_path}
        onChange={setValue}
      />
      <FieldInput
        def={{ key: 'instance_type', label: 'EC2 Instance', type: 'select', required: true, options: EC2_INSTANCE_OPTIONS, hint: EC2_INSTANCE_HINT }}
        value={values.instance_type ?? ''}
        error={errors.instance_type}
        onChange={setValue}
      />

      <NoticeAlert
        variant="info"
        message="This page is a compatibility check, not a deploy guarantee. You can still try deployment even when a mode is not confirmed here."
      />

      <AdvancedSection>
        <FieldInput def={{ key: 'backend', label: 'Backend', type: 'select', options: BACKEND_OPTIONS }} value={values.backend ?? ''} error={errors.backend} onChange={setValue} />
        <FieldInput def={{ key: 'backend_version', label: 'Backend Version', type: 'text', placeholder: 'e.g. 0.17.0' }} value={values.backend_version ?? ''} error={errors.backend_version} onChange={setValue} />
      </AdvancedSection>

      <div>
        <button
          type="button"
          className="argo-button argo-button--base cext-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <><span className="cext-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Checking…</> : <><i className="fa fa-search" /> Check Compatibility</>}
        </button>
        {(result || submitError) && (
          <button type="button" className="argo-button argo-button--base-o cext-link-btn" onClick={handleReset}>
            Reset
          </button>
        )}
      </div>

      {submitError && <ErrorAlert message={submitError} />}
      {result && <SupportResult result={result} />}
    </div>
  );
}
