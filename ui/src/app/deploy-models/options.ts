export const EC2_INSTANCE_OPTIONS = [
    {value: 'p5e.48xlarge', label: 'p5e.48xlarge - H200 / Hopper - 8 GPUs - 1,128 GB GPU RAM - 192 vCPUs'},
    {value: 'p5en.48xlarge', label: 'p5en.48xlarge - H200 / Hopper - 8 GPUs - 1,128 GB GPU RAM - 192 vCPUs'},
    {value: 'p6-b200.48xlarge', label: 'p6-b200.48xlarge - B200 / Blackwell - 8 GPUs - 1,432 GB GPU RAM - 192 vCPUs'},
    {value: 'p4de.24xlarge', label: 'p4de.24xlarge - A100 / Ampere - 8 GPUs - 320 GB GPU RAM - 96 vCPUs'},
    {value: 'p6e-gb200.36xlarge', label: 'p6e-gb200.36xlarge - GB200 / Grace Blackwell - 4 GPUs - 740 GB GPU RAM - 144 vCPUs'},
    {value: 'p6e-gb300.ultraserver', label: 'p6e-gb300.ultraserver - GB300 / Grace Blackwell Ultra - UltraServer'},
    {value: 'g6e.xlarge', label: 'g6e.xlarge - L40S / Ada Lovelace - 1 GPU - 48 GB GPU RAM - 4 vCPUs - 32 GB RAM'},
    {value: 'g6e.4xlarge', label: 'g6e.4xlarge - L40S / Ada Lovelace - 1 GPU - 48 GB GPU RAM - 16 vCPUs - 128 GB RAM'},
    {value: 'g6e.8xlarge', label: 'g6e.8xlarge - L40S / Ada Lovelace - 1 GPU - 48 GB GPU RAM - 32 vCPUs - 256 GB RAM'},
    {value: 'g6e.12xlarge', label: 'g6e.12xlarge - L40S / Ada Lovelace - 4 GPUs - 192 GB GPU RAM - 48 vCPUs - 384 GB RAM'},
    {value: 'g6e.48xlarge', label: 'g6e.48xlarge - L40S / Ada Lovelace - 8 GPUs - 384 GB GPU RAM - 192 vCPUs - 1,536 GB RAM'}
];

export const DEPLOY_MODE_OPTIONS = [
    {value: 'agg', label: 'Aggregated (agg)'},
    {value: 'disagg', label: 'Disaggregated (disagg)'}
];

export const DATABASE_MODE_OPTIONS = [
    {
        value: 'SILICON',
        label: 'Silicon',
        description: 'Uses curated silicon-backed performance data only. Best when the exact model and backend are already covered.'
    },
    {
        value: 'HYBRID',
        label: 'Hybrid',
        description: 'Combines measured data with estimator fallbacks. Best default when silicon coverage is incomplete.'
    },
    {
        value: 'EMPIRICAL',
        label: 'Empirical',
        description: 'Prefers empirical observations over silicon-derived estimates when that data is available.'
    },
    {
        value: 'SOL',
        label: 'SOL',
        description: 'Uses the roofline-style estimator path. Useful for exploratory sizing when database coverage is sparse.'
    }
] as const;

// Reviewer - Master: users pick an EC2 size, while the service continues to operate on the smaller backend system catalog.
export const EC2_INSTANCE_HINT = 'Choose the EC2 instance size you want. The backend maps each instance type to the supported GPU system automatically.';

export const DEPLOYMENT_MODE_HINT = 'Aggregated uses one serving tier. Disaggregated splits prefill and decode into separate tiers.';

export const FIELD_HELP = {
    modelPath: 'Model identifier or registry path that AIC should size, estimate, or generate manifests for.',
    publicModelName: 'Optional model name exposed by the public OpenAI-compatible API. Leave blank to use the model id.',
    totalGpus: 'Total GPU budget across the full deployment. In disaggregated mode, this includes both prefill and decode tiers.',
    deployMode: 'Aggregated keeps prefill and decode together. Disaggregated splits them into separate serving tiers.',
    backend: 'Serving runtime used to execute the model. Leave the default unless you need a specific stack.',
    backendVersion: 'Optional runtime version pin. Leave blank to use the service default for the selected backend.',
    databaseMode: 'Planner data source strategy. Hybrid mixes cached empirical data with estimator fallbacks.',
    isl: 'Input sequence length: prompt tokens sent into the model.',
    osl: 'Output sequence length: tokens expected back from the model.',
    ttft: 'Time to first token. Lower values improve first-token responsiveness.',
    tpot: 'Time per output token after generation begins.',
    requestLatency: 'Full request latency from prompt submission to the last token.',
    prefixCache: 'Expected reusable prompt prefix length used for prefix-cache sizing.',
    kvCacheFraction: 'Fraction of remaining GPU memory reserved for KV cache after runtime overhead.',
    maxSeqLen: 'Hard cap on the total context length the runtime should admit.',
    topN: 'Number of candidate plans or results to return.',
    generatorSet: 'Advanced generator rules and overrides applied before manifests are written.',
    generatorConfig: 'Server-side YAML path for expert generator behavior.',
    generatorDynamoVersion: 'Optional Dynamo version override for expert tuning.',
    estimateMode: 'Estimate one shared serving tier or separate prefill/decode tiers.',
    tpSize: 'Tensor parallel shard count.',
    ppSize: 'Pipeline parallel stage count.',
    attentionDpSize: 'Attention data-parallel replica count.',
    moeTpSize: 'MoE tensor parallel shard count.',
    moeEpSize: 'MoE expert parallel shard count.',
    gemmQuantMode: 'Matrix-multiply quantization mode used by the runtime, if supported by the backend.',
    kvCacheQuantMode: 'KV-cache quantization mode used for cache memory reduction, if supported.',
    fmhaQuantMode: 'Attention-kernel quantization mode for fused multi-head attention, if supported.',
    moeQuantMode: 'Mixture-of-experts quantization mode applied to expert weights or activations.',
    commQuantMode: 'Communication quantization mode for reducing data movement overhead between workers.',
    decodeInstanceType: 'Optional EC2 instance type for the decode tier when you want a different hardware shape than prefill.',
    prefillBatchSize: 'Maximum batch size allocated to the prefill tier in disaggregated estimates.',
    prefillNumWorkers: 'Number of prefill workers to provision in disaggregated estimates.',
    prefillTpSize: 'Tensor parallel shard count for prefill workers only.',
    prefillPpSize: 'Pipeline parallel stage count for prefill workers only.',
    decodeBatchSize: 'Maximum batch size allocated to the decode tier in disaggregated estimates.',
    decodeNumWorkers: 'Number of decode workers to provision in disaggregated estimates.',
    decodeTpSize: 'Tensor parallel shard count for decode workers only.',
    decodePpSize: 'Pipeline parallel stage count for decode workers only.',
    yamlPath: 'Path to a server-side config file that already exists within the service output area.',
    inlineConfig: 'Paste a JSON config when you want to replay an experiment without referencing a server-side file.'
} as const;
