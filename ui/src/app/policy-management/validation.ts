import {REQUEST_POLICY_TYPES, PolicyFamily, PolicyTypeRecord, RequestPolicyType} from './api/types';

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

export const POLICY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function isRequestPolicyType(value: unknown): value is RequestPolicyType {
    return typeof value === 'string' && (REQUEST_POLICY_TYPES as readonly string[]).includes(value);
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
        errors.push('extra_engine_args_config is not a public policy input.');
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
        if (typeof document.engine !== 'string' || !document.engine.trim()) {
            errors.push('engine is required.');
        }
        if (typeof document.deployment_type !== 'string' || !['agg', 'disagg'].includes(document.deployment_type)) {
            errors.push('deployment_type must be agg or disagg.');
        }
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

export function buildUsageSnippet(family: PolicyFamily, document: Record<string, unknown>): Record<string, unknown> {
    const policyId = String(document.policy_id || '');
    if (family === 'request') {
        return {
            policies: {
                [String(document.type || '')]: [policyId]
            }
        };
    }
    if (family === 'runtime') {
        return {
            policy_id: policyId,
            resolve_url: `/api/v1/runtime-config-policies/${policyId}/resolve`
        };
    }
    return {policy_id: policyId};
}
