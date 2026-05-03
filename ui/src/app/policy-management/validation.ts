import {FEATURE_BACKENDS, REQUEST_POLICY_TYPES, FeatureBackend, PolicyFamily, PolicyTypeRecord, RequestPolicyType} from './api/types';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface ValidatePolicyDocumentOptions {
    family: PolicyFamily;
    mode?: 'create' | 'edit';
    originalPolicyId?: string;
    originalType?: string;
}

export interface ParsedJsonResult {
    document: Record<string, unknown> | null;
    errors: string[];
}

export interface FeatureArgEntry {
    flag: string;
    value: string | null;
}

export const POLICY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function isRequestPolicyType(value: unknown): value is RequestPolicyType {
    return typeof value === 'string' && (REQUEST_POLICY_TYPES as readonly string[]).includes(value);
}

export function isFeatureBackend(value: unknown): value is FeatureBackend {
    return typeof value === 'string' && (FEATURE_BACKENDS as readonly string[]).includes(value);
}

export function parsePolicyJson(text: string): ParsedJsonResult {
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {document: null, errors: ['Policy JSON must be an object.']};
        }
        return {document: parsed as Record<string, unknown>, errors: []};
    } catch (error) {
        return {document: null, errors: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]};
    }
}

export function formatPolicyJson(document: Record<string, unknown>): string {
    return JSON.stringify(document, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneObject(value: unknown): Record<string, unknown> {
    if (!isPlainObject(value)) {
        return {};
    }
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function hasForbiddenKey(value: unknown, keyName: string): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }
    if (Array.isArray(value)) {
        return value.some(item => hasForbiddenKey(item, keyName));
    }
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => key === keyName || hasForbiddenKey(child, keyName));
}

function collectArgsValidation(value: unknown, path: string, errors: string[]) {
    if (Array.isArray(value)) {
        parseFeatureArgs(value).forEach((entry, index) => {
            if (entry.flag.includes('\n') || entry.flag.includes('\0')) {
                errors.push(`${path}[${index}]: flags cannot contain newlines or null bytes.`);
            }
            if (!entry.flag.startsWith('-')) {
                errors.push(`${path}[${index}]: flags must start with "-".`);
            }
            if (typeof entry.value === 'string' && (entry.value.includes('\n') || entry.value.includes('\0'))) {
                errors.push(`${path}[${index}]: values cannot contain newlines or null bytes.`);
            }
        });
        return;
    }

    if (!isPlainObject(value)) {
        return;
    }

    Object.entries(value).forEach(([key, argValue]) => {
        if (key.includes('\n') || key.includes('\0')) {
            errors.push(`${path}.${key}: flags cannot contain newlines or null bytes.`);
        }
        if (!key.startsWith('-')) {
            errors.push(`${path}.${key}: flags must start with "-".`);
        }
        if (typeof argValue === 'string' && (argValue.includes('\n') || argValue.includes('\0'))) {
            errors.push(`${path}.${key}: values cannot contain newlines or null bytes.`);
        }
    });
}

export function parseFeatureArgs(value: unknown): FeatureArgEntry[] {
    if (Array.isArray(value)) {
        const entries: FeatureArgEntry[] = [];
        for (let index = 0; index < value.length; index += 1) {
            const token = value[index] == null ? '' : String(value[index]);
            const nextToken = index + 1 < value.length ? String(value[index + 1]) : '';
            if (token.startsWith('-') && index + 1 < value.length && (!nextToken.startsWith('-') || isNumericToken(nextToken))) {
                entries.push({flag: token, value: nextToken});
                index += 1;
            } else {
                entries.push({flag: token, value: null});
            }
        }
        return entries;
    }

    if (isPlainObject(value)) {
        return Object.entries(value).map(([flag, argValue]) => ({
            flag,
            value: argValue == null ? null : String(argValue)
        }));
    }

    return [];
}

function isNumericToken(token: string): boolean {
    return /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token.trim());
}

export function serializeFeatureArgs(entries: FeatureArgEntry[], preferArray: boolean): Record<string, string | null> | string[] {
    if (preferArray) {
        return entries.reduce<string[]>((tokens, entry) => {
            if (!entry.flag) {
                return tokens;
            }
            tokens.push(entry.flag);
            if (entry.value !== null && entry.value !== '') {
                tokens.push(entry.value);
            }
            return tokens;
        }, []);
    }

    return Object.fromEntries(entries.filter(entry => entry.flag).map(entry => [entry.flag, entry.value === '' ? null : entry.value]));
}

export function validateFeaturePolicyArgs(document: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const effects = isPlainObject(document.effects) ? document.effects : {};
    const agg = isPlainObject(effects.agg) ? effects.agg : {};
    const disagg = isPlainObject(effects.disagg) ? effects.disagg : {};

    [
        ['effects.agg.frontend.args', agg.frontend],
        ['effects.agg.worker.args', agg.worker],
        ['effects.disagg.frontend.args', disagg.frontend],
        ['effects.disagg.prefill.args', disagg.prefill],
        ['effects.disagg.decode.args', disagg.decode]
    ].forEach(([path, role]) => {
        const args = Array.isArray(role) ? role : isPlainObject(role) ? role.args : undefined;
        if (args !== undefined && !isPlainObject(args) && !Array.isArray(args)) {
            errors.push(`${path}: args must be an object or token array.`);
            return;
        }
        collectArgsValidation(args, path as string, errors);
    });

    return errors;
}

export function validatePolicyDocument(document: Record<string, unknown>, options: ValidatePolicyDocumentOptions): ValidationResult {
    const errors: string[] = [];
    const policyId = typeof document.policy_id === 'string' ? document.policy_id.trim() : '';

    if (!policyId) {
        errors.push('policy_id is required.');
    } else if (!POLICY_ID_PATTERN.test(policyId)) {
        errors.push('policy_id must be a lowercase slug using letters, numbers, dots, underscores, or hyphens.');
    }

    if (options.mode === 'edit' && options.originalPolicyId && policyId !== options.originalPolicyId) {
        errors.push('policy_id cannot be changed while editing.');
    }

    if (hasForbiddenKey(document, 'extra_engine_args_config')) {
        errors.push('extra_engine_args_config is not a public policy input. Use feature policy effects args instead.');
    }

    if (options.family === 'request') {
        if (!isRequestPolicyType(document.type)) {
            errors.push(`type must be one of: ${REQUEST_POLICY_TYPES.join(', ')}.`);
        }
        if (options.mode === 'edit' && options.originalType && document.type !== options.originalType) {
            errors.push('type cannot be changed while editing a request policy.');
        }
        if (!isPlainObject(document.effects) || Object.keys(document.effects).length === 0) {
            errors.push('effects must be populated from the selected policy type template.');
        }
    } else {
        if (!isFeatureBackend(document.backend)) {
            errors.push(`backend must be one of: ${FEATURE_BACKENDS.join(', ')}.`);
        }
        errors.push(...validateFeaturePolicyArgs(document));
    }

    return {valid: errors.length === 0, errors};
}

function defaultFromField(field: unknown): [string, unknown] | null {
    if (!isPlainObject(field)) {
        return null;
    }
    const name = typeof field.name === 'string' ? field.name : typeof field.key === 'string' ? field.key : null;
    if (!name) {
        return null;
    }
    return [name, field.default ?? null];
}

export function effectsFromPolicyType(policyType?: PolicyTypeRecord): Record<string, unknown> {
    if (!policyType) {
        return {};
    }

    const candidateSources = [policyType.template, policyType.defaults, policyType.document, policyType.schema].filter(Boolean);
    for (const source of candidateSources) {
        if (!isPlainObject(source)) {
            continue;
        }
        if (isPlainObject(source.effects)) {
            return cloneObject(source.effects);
        }
        if (isPlainObject(source.default_effects)) {
            return cloneObject(source.default_effects);
        }
        if (Array.isArray(source.fields)) {
            return Object.fromEntries(source.fields.map(defaultFromField).filter(Boolean) as Array<[string, unknown]>);
        }
        const effectsProperties = isPlainObject(source.properties) && isPlainObject(source.properties.effects) ? source.properties.effects : undefined;
        if (isPlainObject(effectsProperties) && isPlainObject(effectsProperties.default)) {
            return cloneObject(effectsProperties.default);
        }
    }

    if (Array.isArray(policyType.fields)) {
        return Object.fromEntries(policyType.fields.map(defaultFromField).filter(Boolean) as Array<[string, unknown]>);
    }

    return {};
}

export function buildRequestPolicyTemplate(type: RequestPolicyType, policyType?: PolicyTypeRecord): Record<string, unknown> {
    return {
        schema_version: 1,
        policy_id: '',
        type,
        display_name: '',
        description: '',
        active: true,
        metadata: {ui: {sort_order: 100}, tags: []},
        effects: effectsFromPolicyType(policyType)
    };
}

export function buildFeaturePolicyTemplate(backend: FeatureBackend): Record<string, unknown> {
    return {
        schema_version: 1,
        policy_id: '',
        backend,
        feature: '',
        display_name: '',
        description: '',
        active: true,
        metadata: {
            ui: {sort_order: 100},
            tags: [backend]
        },
        effects: {
            disagg: {
                frontend: {args: {}},
                prefill: {args: {}},
                decode: {args: {}}
            },
            agg: {
                frontend: {args: {}},
                worker: {args: {}}
            }
        }
    };
}

export function applySglangStarterTemplate(document: Record<string, unknown>): Record<string, unknown> {
    const next = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
    next.backend = 'sglang';
    next.metadata = {
        ...(isPlainObject(next.metadata) ? next.metadata : {}),
        tags: Array.from(
            new Set([
                ...(Array.isArray((next.metadata as Record<string, unknown>)?.tags) ? ((next.metadata as Record<string, unknown>).tags as string[]) : []),
                'sglang',
                'kv-cache'
            ])
        )
    };
    next.effects = {
        disagg: {
            frontend: {
                args: {
                    '--router-mode': 'kv',
                    '--dyn-chat-processor': 'sglang',
                    '--tool-call-parser': 'hermes',
                    '--reasoning-parser': 'qwen3'
                }
            },
            prefill: {
                args: {
                    '--trust-remote-code': null,
                    '--skip-tokenizer-init': null,
                    '--disaggregation-mode': 'prefill',
                    '--disaggregation-transfer-backend': 'nixl',
                    '--disaggregation-bootstrap-port': '12345',
                    '--host': '0.0.0.0'
                }
            },
            decode: {
                args: {
                    '--trust-remote-code': null,
                    '--skip-tokenizer-init': null,
                    '--disaggregation-mode': 'decode',
                    '--disaggregation-transfer-backend': 'nixl',
                    '--disaggregation-bootstrap-port': '12345',
                    '--host': '0.0.0.0'
                }
            }
        },
        agg: {
            frontend: {args: {}},
            worker: {
                args: {
                    '--trust-remote-code': null,
                    '--skip-tokenizer-init': null
                }
            }
        }
    };
    return next;
}

export function buildUsageSnippet(family: PolicyFamily, document: Record<string, unknown>): Record<string, unknown> {
    const policyId = String(document.policy_id || '');
    if (family === 'request') {
        return {
            policies: {
                [String(document.type || '')]: [policyId]
            }
        };
    }
    return {
        backend: document.backend,
        feature_policies: [policyId]
    };
}
