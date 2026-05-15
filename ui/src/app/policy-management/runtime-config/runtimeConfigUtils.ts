import type {
    ActiveFilter,
    DeploymentType,
    ListRuntimeConfigCatalogItemsParams,
    PolicyApiClient,
    RuntimeConfigCatalogItemRecord,
    RuntimeConfigCatalogRecord,
    RuntimeConfigKind,
    RuntimeConfigPolicyRecord,
    RuntimeConfigRoleEntry,
    RuntimeConfigRoleSchemaRecord
} from '../api/types';
import {displayName} from '../formatters';
import type {RuntimeDocument} from './runtimeConfigTypes';

export const DEFAULT_RUNTIME_PAGE_SIZE = 25;
export const RUNTIME_PAGE_SIZES = [25, 50, 100];
export const RUNTIME_POLICY_FETCH_LIMIT = 200;
export const CATALOG_ITEM_PAGE_SIZE = 200;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function cloneDocument<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function activeParam(active: ActiveFilter): boolean | undefined {
    if (active === 'active') {
        return true;
    }
    if (active === 'inactive') {
        return false;
    }
    return undefined;
}

export function unique(values: Array<string | undefined | null>): string[] {
    return Array.from(new Set(values.filter((item): item is string => !!item))).sort();
}

const RUNTIME_ENGINE_LABELS: Record<string, string> = {
    'dynamo': 'Dynamo',
    'frontend': 'Frontend',
    'sglang': 'SGLang',
    'trtllm': 'TensorRT-LLM',
    'tensorrtllm': 'TensorRT-LLM',
    'tensorrt-llm': 'TensorRT-LLM',
    'vllm': 'vLLM',
    'vllm_omni': 'vLLM-Omni',
    'vllm-omni': 'vLLM-Omni'
};

export function runtimeEngineLabel(engine: string | undefined | null): string {
    if (!engine) {
        return 'Not set';
    }
    const normalized = engine.trim().toLowerCase();
    if (RUNTIME_ENGINE_LABELS[normalized]) {
        return RUNTIME_ENGINE_LABELS[normalized];
    }
    return engine
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function runtimeDeploymentLabel(deploymentType: string | undefined | null): string {
    if (deploymentType === 'agg') {
        return 'Aggregated';
    }
    if (deploymentType === 'disagg') {
        return 'Disaggregated';
    }
    return deploymentType || 'Not set';
}

export function runtimeDeploymentShortLabel(deploymentType: string | undefined | null): string {
    if (deploymentType === 'agg') {
        return 'Agg';
    }
    if (deploymentType === 'disagg') {
        return 'Disagg';
    }
    return deploymentType || 'Not set';
}

export function runtimeCatalogScopeLabel(scope: string | undefined | null): string {
    if (scope === 'frontend') {
        return 'Frontend';
    }
    if (scope === 'engine') {
        return 'Engine';
    }
    return scope || 'All catalogs';
}

export function runtimeCatalogKindLabel(kind: string | undefined | null): string {
    if (kind === 'args') {
        return 'Args';
    }
    if (kind === 'envs') {
        return 'Env';
    }
    return kind || 'Unknown';
}

export function runtimeConfigKeyLabel(key: string): string {
    return key
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

export function defaultRuntimeDocument(catalogs: RuntimeConfigCatalogRecord[], deploymentType: DeploymentType = 'disagg'): RuntimeDocument {
    const engineCatalog = catalogs.find(catalog => catalog.engine !== 'frontend') || catalogs[0];
    const dynamoVersion = engineCatalog?.dynamo_version || catalogs[0]?.dynamo_version || '1.1.1';
    const engine = engineCatalog?.engine || 'vllm';
    const engineVersion = engineCatalog?.engine_version || '';
    return {
        schema_version: 1,
        policy_id: '',
        display_name: '',
        description: '',
        engine,
        engine_version: engineVersion,
        dynamo_version: dynamoVersion,
        deployment_type: deploymentType,
        active: true,
        metadata: {},
        selections: {}
    };
}

export function runtimeDescription(record: RuntimeConfigPolicyRecord): string {
    const document = record.document || {};
    const name = displayName(document);
    return name || `${runtimeEngineLabel(record.engine)} ${record.engine_version} on Dynamo ${record.dynamo_version}`;
}

export function itemDescription(item: RuntimeConfigCatalogItemRecord): string {
    const description = item.record?.description;
    return typeof description === 'string' && description.trim() ? description : item.name;
}

export function itemLabel(item: RuntimeConfigCatalogItemRecord): string {
    const label = item.display_name || item.record?.display_name;
    if (typeof label === 'string' && label.trim()) {
        return label.trim();
    }
    return item.name
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function itemChoices(item: RuntimeConfigCatalogItemRecord): unknown[] | null {
    if (Array.isArray(item.record?.choices)) {
        return item.record.choices;
    }
    if (Array.isArray(item.record?.enum)) {
        return item.record.enum;
    }
    return null;
}

export function itemDefault(item: RuntimeConfigCatalogItemRecord): string {
    if (item.default_value === undefined || item.default_value === null || item.default_value === '') {
        return 'none';
    }
    return typeof item.default_value === 'string' ? item.default_value : JSON.stringify(item.default_value);
}

export function hasDefaultValue(item: RuntimeConfigCatalogItemRecord): boolean {
    return item.default_value !== undefined && item.default_value !== null && item.default_value !== '';
}

export function isFlagArg(item: RuntimeConfigCatalogItemRecord): boolean {
    return item.kind === 'args' && item.record?.flag === true;
}

export function itemType(item: RuntimeConfigCatalogItemRecord): string {
    return String(item.type || item.record?.type || 'string').toLowerCase();
}

export function roleLabel(role: RuntimeConfigRoleEntry): string {
    if (role.label) {
        return role.label;
    }
    return role.role
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function roleKindKey(role: string, kind: RuntimeConfigKind): string {
    return `${role}:${kind}`;
}

export function itemRowKey(role: string, kind: RuntimeConfigKind, itemName: string): string {
    return `${role}:${kind}:${itemName}`;
}

export function itemDisplayKey(item: RuntimeConfigCatalogItemRecord): string {
    if (item.kind === 'args') {
        return String(item.record?.arg || item.record?.true_arg || item.record?.cli_arg || `--${item.name.replace(/_/g, '-')}`);
    }
    return String(item.record?.env_var || item.name);
}

export function formatRuntimeValue(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    return JSON.stringify(value, null, 2);
}

export function editableDefaultValue(item: RuntimeConfigCatalogItemRecord): unknown {
    if (!hasDefaultValue(item)) {
        return undefined;
    }
    if (isRecord(item.default_value) || Array.isArray(item.default_value)) {
        return JSON.stringify(item.default_value, null, 2);
    }
    return item.default_value;
}

export function selectedValueCount(document: RuntimeDocument, roles: RuntimeConfigRoleEntry[]): number {
    return roles.reduce((total, role) => {
        const args = Object.keys(getRoleSelection(document, role.role, 'args')).length;
        const envs = Object.keys(getRoleSelection(document, role.role, 'envs')).length;
        return total + args + envs;
    }, 0);
}

export function getRoleSelection(document: RuntimeDocument, role: string, kind: RuntimeConfigKind): Record<string, unknown> {
    const selections = isRecord(document.selections) ? document.selections : {};
    const roleSelection = isRecord(selections[role]) ? (selections[role] as Record<string, unknown>) : {};
    return isRecord(roleSelection[kind]) ? (roleSelection[kind] as Record<string, unknown>) : {};
}

export function setRoleValue(document: RuntimeDocument, role: string, kind: RuntimeConfigKind, name: string, value: unknown): RuntimeDocument {
    const next = cloneDocument(document);
    const selections: Record<string, unknown> = isRecord(next.selections) ? cloneDocument(next.selections) : {};
    const roleSelection: Record<string, unknown> = isRecord(selections[role]) ? cloneDocument(selections[role] as Record<string, unknown>) : {};
    const kindSelection: Record<string, unknown> = isRecord(roleSelection[kind]) ? cloneDocument(roleSelection[kind] as Record<string, unknown>) : {};

    if (value === undefined || value === '') {
        delete kindSelection[name];
    } else {
        kindSelection[name] = value;
    }

    roleSelection[kind] = kindSelection;
    selections[role] = roleSelection;
    next.selections = selections;
    return next;
}

export function activeRoleSchema(roleSchemas: RuntimeConfigRoleSchemaRecord[], deploymentType: DeploymentType): RuntimeConfigRoleSchemaRecord | undefined {
    return roleSchemas.find(schema => schema.deployment_type === deploymentType);
}

export async function fetchRuntimeConfigCatalogItems(
    client: PolicyApiClient,
    params: Omit<ListRuntimeConfigCatalogItemsParams, 'limit' | 'offset'>
): Promise<RuntimeConfigCatalogItemRecord[]> {
    const items: RuntimeConfigCatalogItemRecord[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (items.length < total) {
        const result = await client.listRuntimeConfigCatalogItems({...params, limit: CATALOG_ITEM_PAGE_SIZE, offset});
        const pageItems = result.items || [];
        items.push(...pageItems);
        total = typeof result.total === 'number' ? result.total : items.length;
        if (!pageItems.length) {
            break;
        }
        offset += pageItems.length;
    }

    return items;
}

export function normalizeRuntimeUserValue(item: RuntimeConfigCatalogItemRecord, rawValue: unknown, path: string): {value?: unknown; unset?: boolean; error?: string} {
    if (rawValue === undefined || rawValue === '') {
        return {unset: true};
    }
    if (item.aic) {
        return {error: `${path} is controlled by AIC and cannot be set in a runtime config policy.`};
    }
    const type = itemType(item);
    let value = rawValue;
    if (isFlagArg(item)) {
        if (value === true || value === 'true' || value === null) {
            return {value: true};
        }
        if (value === false || value === 'false') {
            return {value: false};
        }
        return {error: `${path} must be a flag selection.`};
    }
    if (type.includes('bool')) {
        if (value === true || value === 'true') {
            value = true;
        } else if (value === false || value === 'false') {
            value = false;
        } else {
            return {error: `${path} must be true or false.`};
        }
    } else if (type.includes('int')) {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (!Number.isInteger(parsed)) {
            return {error: `${path} must be an integer.`};
        }
        value = parsed;
    } else if (type.includes('float') || type.includes('number')) {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(parsed)) {
            return {error: `${path} must be a number.`};
        }
        value = parsed;
    } else if (type.includes('dict') || type.includes('object') || type.includes('list') || type.includes('array')) {
        if (typeof value === 'string') {
            try {
                value = JSON.parse(value);
            } catch {
                return {error: `${path} must be valid JSON.`};
            }
        }
        if ((type.includes('dict') || type.includes('object')) && !isRecord(value)) {
            return {error: `${path} must be a JSON object.`};
        }
        if ((type.includes('list') || type.includes('array')) && !Array.isArray(value)) {
            return {error: `${path} must be a JSON array.`};
        }
    }

    const choices = itemChoices(item);
    if (choices?.length && !choices.some(choice => JSON.stringify(choice) === JSON.stringify(value))) {
        return {error: `${path} must be one of ${choices.map(choice => String(choice)).join(', ')}.`};
    }
    return {value};
}
