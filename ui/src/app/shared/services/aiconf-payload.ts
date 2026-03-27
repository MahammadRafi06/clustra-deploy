import * as models from '../models';
import {AIConfigPayload} from './aiconf-service';

const REQUIRED_KEYS = ['model_path', 'system', 'backend', 'backend_version', 'mode', 'total_gpus'] as const;
const INTEGER_KEYS = new Set(['total_gpus', 'isl', 'osl', 'top_n']);
const NUMBER_KEYS = new Set(['ttft', 'tpot']);

export function getAIConfigPayload(app: models.Application): AIConfigPayload | null {
    const annotations = app.metadata?.annotations || {};

    if (!REQUIRED_KEYS.every(key => !!annotations[key])) {
        return null;
    }

    const payload = Object.entries(annotations).reduce(
        (acc, [key, value]) => {
            if (typeof value !== 'string' || value.trim() === '') {
                return acc;
            }

            if (INTEGER_KEYS.has(key)) {
                const parsed = parseInt(value, 10);
                if (!Number.isNaN(parsed)) {
                    acc[key] = parsed;
                }
                return acc;
            }

            if (NUMBER_KEYS.has(key)) {
                const parsed = parseFloat(value);
                if (!Number.isNaN(parsed)) {
                    acc[key] = parsed;
                }
                return acc;
            }

            acc[key] = value;
            return acc;
        },
        {} as {[key: string]: string | number}
    );

    payload.application_name = app.metadata?.name || '';

    if (!payload.application_name || typeof payload.total_gpus !== 'number') {
        return null;
    }

    return payload as AIConfigPayload;
}
