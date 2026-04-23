import {submitSupport} from './api';
import type {DeployMode} from './types';

interface DeployCompatibilityParams {
    modelPath: string;
    instanceType: string;
    backend?: string;
    mode?: DeployMode;
}

interface DeployCompatibilityResult {
    warning: string | null;
    blockingError: string | null;
}

function _formatSupportFailureMessage(message: string): string {
    if (/ASR/i.test(message)) {
        // Reviewer - Master: surface a business-friendly hint when users pick a speech model for a text-serving workflow.
        return `${message} This looks like a speech/ASR model. The current deployment flow supports text-generation models only.`;
    }
    return message;
}

function _isBlockingCompatibilityFailure(message: string): boolean {
    return /speech|ASR|text-generation models only/i.test(message);
}

export async function getDeployCompatibilityAdvisory({modelPath, instanceType, backend, mode}: DeployCompatibilityParams): Promise<DeployCompatibilityResult> {
    if (!modelPath || !instanceType || !mode) {
        return {warning: null, blockingError: null};
    }
    if (backend === 'auto') {
        return {warning: null, blockingError: null};
    }

    try {
        const result = await submitSupport({
            model_path: modelPath,
            instance_type: instanceType,
            ...(backend && {backend})
        });

        if (mode === 'agg' && !result.agg_supported) {
            return {
                warning:
                    'The compatibility check did not confirm aggregated deployment for this model, backend, and EC2 instance combination. You can still continue and try the deployment.',
                blockingError: null
            };
        }
        if (mode === 'disagg' && !result.disagg_supported) {
            return {
                warning:
                    'The compatibility check did not confirm disaggregated deployment for this model, backend, and EC2 instance combination. You can still continue and try the deployment.',
                blockingError: null
            };
        }

        return {warning: null, blockingError: null};
    } catch (err: unknown) {
        const message = _formatSupportFailureMessage(err instanceof Error ? err.message : String(err));
        return {
            warning: _isBlockingCompatibilityFailure(message)
                ? null
                : `Compatibility advice could not be fetched right now. You can still continue with the deployment. Details: ${message}`,
            blockingError: _isBlockingCompatibilityFailure(message) ? message : null
        };
    }
}
