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

// Reviewer - Master: users pick an EC2 size, while the service continues to operate on the smaller backend system catalog.
export const EC2_INSTANCE_HINT = 'Choose the EC2 instance size you want. The backend maps each instance type to the supported GPU system automatically.';

export const DEPLOYMENT_MODE_HINT = 'Aggregated uses one serving tier. Disaggregated splits prefill and decode into separate tiers.';
