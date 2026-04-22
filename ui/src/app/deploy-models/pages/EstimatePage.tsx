import React, {useState} from 'react';

import {Spinner} from '../../shared/components';

import {submitEstimate} from '../api';
import {AdvancedSection} from '../components/AdvancedSection';
import {ErrorAlert} from '../components/ErrorAlert';
import {FieldInput} from '../components/FieldInput';
import {NoticeAlert} from '../components/NoticeAlert';
import {useFormState} from '../hooks/useFormState';
import {EC2_INSTANCE_HINT, EC2_INSTANCE_OPTIONS} from '../options';
import type {EstimateMode, EstimateResponse} from '../types';

const BACKEND_OPTIONS = [
    {value: 'trtllm', label: 'TRT-LLM'},
    {value: 'sglang', label: 'SGLang'},
    {value: 'vllm', label: 'vLLM'}
];

const DB_MODE_OPTIONS = [
    {value: 'SILICON', label: 'Silicon'},
    {value: 'HYBRID', label: 'Hybrid'},
    {value: 'EMPIRICAL', label: 'Empirical'},
    {value: 'SOL', label: 'SOL'}
];

const ESTIMATE_MODE_OPTIONS = [
    {value: 'agg', label: 'Aggregated (agg)'},
    {value: 'disagg', label: 'Disaggregated (disagg)'}
];

function formatMetric(value: number | null | undefined, decimals = 2): string {
    if (value == null) {
        return '—';
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(decimals);
}

function EstimateResult({result}: {result: EstimateResponse}) {
    return (
        <div className='deploy-models__result'>
            <div className='deploy-models__result-section'>
                <div className='deploy-models__result-title'>Latency</div>
                <div className='deploy-models__metric-grid'>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>TTFT (ms)</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.ttft)}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>TPOT (ms)</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.tpot)}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>E2E Latency (ms)</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.request_latency)}</div>
                    </div>
                </div>
            </div>

            <div className='deploy-models__result-section'>
                <div className='deploy-models__result-title'>Throughput</div>
                <div className='deploy-models__metric-grid'>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>Tokens/s</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.tokens_per_second, 1)}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>Tokens/s/GPU</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.tokens_per_second_per_gpu, 1)}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>Seq/s</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.seq_per_second, 1)}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>Concurrency</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.concurrency, 1)}</div>
                    </div>
                </div>
            </div>

            <div className='deploy-models__result-section'>
                <div className='deploy-models__result-title'>Config</div>
                <div className='deploy-models__metric-grid'>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>TP Size</div>
                        <div className='deploy-models__metric-value'>{result.tp_size}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>PP Size</div>
                        <div className='deploy-models__metric-value'>{result.pp_size}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>Total GPUs</div>
                        <div className='deploy-models__metric-value'>{result.num_total_gpus}</div>
                    </div>
                    <div className='deploy-models__metric'>
                        <div className='deploy-models__metric-label'>Power (W)</div>
                        <div className='deploy-models__metric-value'>{formatMetric(result.power_w, 0)}</div>
                    </div>
                </div>
            </div>

            {result.kv_cache_warning && <NoticeAlert variant='warning' message={result.kv_cache_warning} />}
        </div>
    );
}

export function EstimatePage() {
    const {values, errors, setValue, validateRequired, reset} = useFormState();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<EstimateResponse | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const isDisagg = values.estimate_mode === 'disagg';

    async function handleSubmit() {
        if (!validateRequired(['model_path', 'instance_type'])) {
            return;
        }
        if (isDisagg) {
            const disaggRequired = ['prefill_batch_size', 'prefill_num_workers', 'decode_batch_size', 'decode_num_workers'];
            if (!validateRequired(disaggRequired)) {
                return;
            }
        }

        setSubmitError(null);
        setResult(null);
        setLoading(true);

        try {
            const response = await submitEstimate({
                model_path: values.model_path,
                instance_type: values.instance_type,
                estimate_mode: (values.estimate_mode || 'agg') as EstimateMode,
                backend: values.backend || 'trtllm',
                ...(values.backend_version && {backend_version: values.backend_version}),
                database_mode: values.database_mode || 'SILICON',
                isl: values.isl ? Number(values.isl) : undefined,
                osl: values.osl ? Number(values.osl) : undefined,
                batch_size: values.batch_size ? Number(values.batch_size) : undefined,
                tp_size: values.tp_size ? Number(values.tp_size) : undefined,
                pp_size: values.pp_size ? Number(values.pp_size) : undefined,
                attention_dp_size: values.attention_dp_size ? Number(values.attention_dp_size) : undefined,
                moe_tp_size: values.moe_tp_size ? Number(values.moe_tp_size) : undefined,
                moe_ep_size: values.moe_ep_size ? Number(values.moe_ep_size) : undefined,
                gemm_quant_mode: values.gemm_quant_mode || undefined,
                kvcache_quant_mode: values.kvcache_quant_mode || undefined,
                fmha_quant_mode: values.fmha_quant_mode || undefined,
                moe_quant_mode: values.moe_quant_mode || undefined,
                comm_quant_mode: values.comm_quant_mode || undefined,
                ...(isDisagg && {
                    decode_instance_type: values.decode_instance_type || undefined,
                    prefill_tp_size: values.prefill_tp_size ? Number(values.prefill_tp_size) : undefined,
                    prefill_pp_size: values.prefill_pp_size ? Number(values.prefill_pp_size) : undefined,
                    prefill_batch_size: Number(values.prefill_batch_size),
                    prefill_num_workers: Number(values.prefill_num_workers),
                    decode_tp_size: values.decode_tp_size ? Number(values.decode_tp_size) : undefined,
                    decode_pp_size: values.decode_pp_size ? Number(values.decode_pp_size) : undefined,
                    decode_batch_size: Number(values.decode_batch_size),
                    decode_num_workers: Number(values.decode_num_workers)
                }),
                free_gpu_memory_fraction: values.free_gpu_memory_fraction ? Number(values.free_gpu_memory_fraction) : undefined,
                max_seq_len: values.max_seq_len ? Number(values.max_seq_len) : undefined
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
                def={{key: 'instance_type', label: 'EC2 Instance (prefill / agg)', type: 'select', required: true, options: EC2_INSTANCE_OPTIONS, hint: EC2_INSTANCE_HINT}}
                value={values.instance_type || ''}
                error={errors.instance_type}
                onChange={setValue}
            />

            <AdvancedSection>
                <FieldInput
                    def={{key: 'estimate_mode', label: 'Estimate Mode', type: 'select', options: ESTIMATE_MODE_OPTIONS}}
                    value={values.estimate_mode || ''}
                    error={errors.estimate_mode}
                    onChange={setValue}
                />
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
                <FieldInput
                    def={{key: 'database_mode', label: 'Database Mode', type: 'select', options: DB_MODE_OPTIONS}}
                    value={values.database_mode || ''}
                    error={errors.database_mode}
                    onChange={setValue}
                />
                <FieldInput def={{key: 'isl', label: 'ISL', type: 'number', min: 1, placeholder: '1024'}} value={values.isl || ''} error={errors.isl} onChange={setValue} />
                <FieldInput def={{key: 'osl', label: 'OSL', type: 'number', min: 1, placeholder: '1024'}} value={values.osl || ''} error={errors.osl} onChange={setValue} />
                <FieldInput
                    def={{key: 'batch_size', label: 'Batch Size', type: 'number', min: 1, placeholder: '128'}}
                    value={values.batch_size || ''}
                    error={errors.batch_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'tp_size', label: 'TP Size', type: 'number', min: 1, placeholder: '1'}}
                    value={values.tp_size || ''}
                    error={errors.tp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'pp_size', label: 'PP Size', type: 'number', min: 1, placeholder: '1'}}
                    value={values.pp_size || ''}
                    error={errors.pp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'attention_dp_size', label: 'Attention DP', type: 'number', min: 1}}
                    value={values.attention_dp_size || ''}
                    error={errors.attention_dp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'moe_tp_size', label: 'MoE TP Size', type: 'number', min: 1}}
                    value={values.moe_tp_size || ''}
                    error={errors.moe_tp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'moe_ep_size', label: 'MoE EP Size', type: 'number', min: 1}}
                    value={values.moe_ep_size || ''}
                    error={errors.moe_ep_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'gemm_quant_mode', label: 'GEMM Quant Mode', type: 'text'}}
                    value={values.gemm_quant_mode || ''}
                    error={errors.gemm_quant_mode}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'kvcache_quant_mode', label: 'KV Cache Quant Mode', type: 'text'}}
                    value={values.kvcache_quant_mode || ''}
                    error={errors.kvcache_quant_mode}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'fmha_quant_mode', label: 'FMHA Quant Mode', type: 'text'}}
                    value={values.fmha_quant_mode || ''}
                    error={errors.fmha_quant_mode}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'moe_quant_mode', label: 'MoE Quant Mode', type: 'text'}}
                    value={values.moe_quant_mode || ''}
                    error={errors.moe_quant_mode}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'comm_quant_mode', label: 'Comm Quant Mode', type: 'text'}}
                    value={values.comm_quant_mode || ''}
                    error={errors.comm_quant_mode}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'free_gpu_memory_fraction', label: 'KV Cache Memory Fraction', type: 'number', min: 0.01, max: 1, step: 0.01}}
                    value={values.free_gpu_memory_fraction || ''}
                    error={errors.free_gpu_memory_fraction}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'max_seq_len', label: 'Max Seq Length', type: 'number', min: 1}}
                    value={values.max_seq_len || ''}
                    error={errors.max_seq_len}
                    onChange={setValue}
                />

                <div className='deploy-models__section-divider'>
                    <span>Disaggregated Config</span>
                </div>
                <FieldInput
                    def={{key: 'decode_instance_type', label: 'Decode EC2 Instance', type: 'select', options: EC2_INSTANCE_OPTIONS, hint: EC2_INSTANCE_HINT}}
                    value={values.decode_instance_type || ''}
                    error={errors.decode_instance_type}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'prefill_batch_size', label: 'Prefill Batch Size', type: 'number', min: 1, required: isDisagg}}
                    value={values.prefill_batch_size || ''}
                    error={errors.prefill_batch_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'prefill_num_workers', label: 'Prefill Workers', type: 'number', min: 1, required: isDisagg}}
                    value={values.prefill_num_workers || ''}
                    error={errors.prefill_num_workers}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'prefill_tp_size', label: 'Prefill TP Size', type: 'number', min: 1}}
                    value={values.prefill_tp_size || ''}
                    error={errors.prefill_tp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'prefill_pp_size', label: 'Prefill PP Size', type: 'number', min: 1}}
                    value={values.prefill_pp_size || ''}
                    error={errors.prefill_pp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'decode_batch_size', label: 'Decode Batch Size', type: 'number', min: 1, required: isDisagg}}
                    value={values.decode_batch_size || ''}
                    error={errors.decode_batch_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'decode_num_workers', label: 'Decode Workers', type: 'number', min: 1, required: isDisagg}}
                    value={values.decode_num_workers || ''}
                    error={errors.decode_num_workers}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'decode_tp_size', label: 'Decode TP Size', type: 'number', min: 1}}
                    value={values.decode_tp_size || ''}
                    error={errors.decode_tp_size}
                    onChange={setValue}
                />
                <FieldInput
                    def={{key: 'decode_pp_size', label: 'Decode PP Size', type: 'number', min: 1}}
                    value={values.decode_pp_size || ''}
                    error={errors.decode_pp_size}
                    onChange={setValue}
                />
            </AdvancedSection>

            <div className='deploy-models__actions'>
                <button type='button' className='argo-button argo-button--base' onClick={handleSubmit} disabled={loading}>
                    {loading ? (
                        <>
                            <span className='deploy-models__button-spinner'>
                                <Spinner show={true} />
                            </span>
                            Estimating…
                        </>
                    ) : (
                        <>
                            <i className='fa fa-calculator' /> Estimate
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
            {result && <EstimateResult result={result} />}
        </div>
    );
}
