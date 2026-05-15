/**
 * Pure helpers for the v2 Runtime Config UI: categorization, diffing,
 * value normalization, and CLI/env preview generation.
 *
 * No React imports — keep this testable in isolation.
 */

import type {RuntimeConfigPolicyRecord, RuntimeConfigRoleEntry} from '../../api/types';
import {formatRuntimeValue, getRoleSelection, isFlagArg, isRecord, itemChoices, itemDisplayKey, itemLabel, itemRowKey, itemType, normalizeRuntimeUserValue, roleKindKey} from '../runtimeConfigUtils';
import type {RuntimeDocument} from '../runtimeConfigTypes';
import type {
    CategoryGroup,
    CompareDelta,
    FieldBucket,
    ImpactSummary,
    InheritanceLink,
    ModifiedField,
    PolicyTagSet,
    PreviewLine,
    RoleFilter,
    RoleStats,
    RuntimeConfigCatalogItemRecord,
    RuntimeConfigKind,
    TuneGoal,
    TuningIntent
} from './types';

const TUNING_INTENTS: readonly TuningIntent[] = ['latency', 'throughput', 'cost', 'balanced', 'debug'];

const CATEGORY_KEYWORDS: Array<{key: string; label: string; patterns: RegExp[]}> = [
    {key: 'routing', label: 'Routing', patterns: [/router/i, /rout/i, /dispatch/i, /load[_-]?balanc/i]},
    {key: 'kv-cache', label: 'KV Cache', patterns: [/kv[_-]?cache/i, /kv[_-]?events/i, /kv[_-]?reuse/i]},
    {key: 'memory', label: 'Memory', patterns: [/memory/i, /gpu[_-]?mem/i, /swap/i, /alloc/i, /budget/i]},
    {key: 'concurrency', label: 'Concurrency & Batching', patterns: [/batch/i, /concurren/i, /max[_-]?num/i, /seq(?:uence)?/i, /parallel/i]},
    {key: 'disagg', label: 'Disaggregation', patterns: [/disagg/i, /bootstrap/i, /transfer[_-]?backend/i, /nixl/i]},
    {key: 'tokenization', label: 'Tokenizer & Chat', patterns: [/token/i, /tokeniz/i, /chat/i, /tool[_-]?call/i, /reasoning[_-]?parser/i]},
    {key: 'sampling', label: 'Sampling & Generation', patterns: [/sampling/i, /temperature/i, /top[_-]?[pk]/i, /repetition/i, /max[_-]?seq[_-]?len/i, /max[_-]?tokens/i]},
    {key: 'observability', label: 'Logging & Observability', patterns: [/log/i, /metric/i, /trace/i, /verbose/i, /debug/i]},
    {key: 'networking', label: 'Networking', patterns: [/host/i, /port/i, /grpc/i, /http/i, /listen/i]},
    {key: 'security', label: 'Security & Trust', patterns: [/trust/i, /auth/i, /secret/i, /tls/i, /cert/i]},
    {key: 'experimental', label: 'Experimental', patterns: [/experim/i, /preview/i, /unstable/i]}
];

const CATEGORY_FALLBACK: CategoryGroup = {key: 'other', label: 'Other', items: []};

const IMPACT_KEYWORDS: Array<{label: string; patterns: RegExp[]}> = [
    {label: 'latency', patterns: [/latenc/i, /ttft/i, /tpot/i, /response[_-]?time/i]},
    {label: 'throughput', patterns: [/throughput/i, /batch/i, /concurren/i, /parallel/i]},
    {label: 'memory', patterns: [/memory/i, /gpu[_-]?mem/i, /kv[_-]?cache/i, /swap/i, /alloc/i]},
    {label: 'stability', patterns: [/timeout/i, /retry/i, /circuit/i, /healthcheck/i]}
];

function readMetadataString(record: RuntimeConfigCatalogItemRecord, key: string): string | undefined {
    const value = record.record?.[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function readMetadataList(record: RuntimeConfigCatalogItemRecord, key: string): string[] {
    const value = record.record?.[key];
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim());
}

/**
 * Best-effort categorization for a catalog item.
 *
 * Honors record.category when present in the catalog, otherwise infers a
 * group from the item name + description using a keyword table. Falls back
 * to "Other" so nothing is ever dropped.
 */
export function itemCategory(item: RuntimeConfigCatalogItemRecord): {key: string; label: string} {
    const explicit = readMetadataString(item, 'category');
    if (explicit) {
        return {key: explicit.toLowerCase(), label: explicit};
    }
    const haystack = `${item.name} ${readMetadataString(item, 'description') ?? ''} ${itemDisplayKey(item)}`;
    for (const candidate of CATEGORY_KEYWORDS) {
        if (candidate.patterns.some(pattern => pattern.test(haystack))) {
            return {key: candidate.key, label: candidate.label};
        }
    }
    return {key: CATEGORY_FALLBACK.key, label: CATEGORY_FALLBACK.label};
}

/**
 * Returns ordered category groups for the given items. Order follows the
 * CATEGORY_KEYWORDS table when matched and appends remaining categories
 * alphabetically. Within each group, AIC-controlled fields are sorted to
 * the bottom so editable fields stay visually primary.
 */
export function groupByCategory(items: RuntimeConfigCatalogItemRecord[]): CategoryGroup[] {
    const groups = new Map<string, CategoryGroup>();
    items.forEach(item => {
        const {key, label} = itemCategory(item);
        if (!groups.has(key)) {
            groups.set(key, {key, label, items: []});
        }
        groups.get(key)?.items.push(item);
    });
    groups.forEach(group => {
        group.items.sort((left, right) => {
            const leftAic = left.aic ? 1 : 0;
            const rightAic = right.aic ? 1 : 0;
            if (leftAic !== rightAic) return leftAic - rightAic;
            return 0;
        });
    });
    const ordered: CategoryGroup[] = [];
    const remaining = new Map(groups);
    CATEGORY_KEYWORDS.forEach(candidate => {
        const group = remaining.get(candidate.key);
        if (group) {
            ordered.push(group);
            remaining.delete(candidate.key);
        }
    });
    Array.from(remaining.values())
        .sort((left, right) => left.label.localeCompare(right.label))
        .forEach(group => ordered.push(group));
    return ordered;
}

/** Returns impact tags inferred from the catalog item. */
export function itemImpacts(item: RuntimeConfigCatalogItemRecord): string[] {
    const explicit = readMetadataList(item, 'impact');
    if (explicit.length) {
        return explicit;
    }
    const haystack = `${item.name} ${readMetadataString(item, 'description') ?? ''}`;
    return IMPACT_KEYWORDS.filter(candidate => candidate.patterns.some(pattern => pattern.test(haystack))).map(candidate => candidate.label);
}

/** A soft-warning hint surfaced under field inputs (e.g., risky ranges). */
export function itemHint(item: RuntimeConfigCatalogItemRecord, value: unknown): string | undefined {
    const explicit = readMetadataString(item, 'hint');
    if (explicit) {
        return explicit;
    }
    if (item.name.toLowerCase().includes('gpu_memory_fraction')) {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric) && numeric > 0.95) {
            return 'Above 0.95 may cause OOM under sudden bursts.';
        }
    }
    if (item.name.toLowerCase().includes('max_num_batched_tokens')) {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric) && numeric < 512) {
            return 'Very small values reduce throughput and may starve the engine.';
        }
    }
    return undefined;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
    if (left === right) {
        return true;
    }
    try {
        return JSON.stringify(left) === JSON.stringify(right);
    } catch {
        return false;
    }
}

function defaultForItem(item: RuntimeConfigCatalogItemRecord): unknown {
    if (item.default_value !== undefined) {
        return item.default_value;
    }
    return item.record?.default ?? null;
}

/**
 * Collect every field where the user value differs from the catalog default.
 * Items not present in the catalog (because the engine version changed)
 * are still reported, with defaultValue undefined.
 */
export function collectModified(document: RuntimeDocument, roles: RuntimeConfigRoleEntry[], itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>): ModifiedField[] {
    const modified: ModifiedField[] = [];
    roles.forEach(role => {
        (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
            const selection = getRoleSelection(document, role.role, kind);
            const items = itemsByRoleKind[roleKindKey(role.role, kind)] || [];
            const byName = new Map(items.map(item => [item.name, item]));
            Object.entries(selection).forEach(([name, value]) => {
                const item = byName.get(name);
                const defaultValue = item ? defaultForItem(item) : undefined;
                if (!valuesEqual(value, defaultValue)) {
                    modified.push({role: role.role, kind, name, value, defaultValue, item});
                }
            });
        });
    });
    return modified;
}

export function modifiedCountByRole(
    document: RuntimeDocument,
    roles: RuntimeConfigRoleEntry[],
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>
): Record<string, RoleStats> {
    void itemsByRoleKind;
    const result: Record<string, RoleStats> = {};
    roles.forEach(role => {
        const args = getRoleSelection(document, role.role, 'args');
        const envs = getRoleSelection(document, role.role, 'envs');
        result[role.role] = {
            role: role.role,
            label: role.label,
            catalog_scope: role.catalog_scope,
            argsCount: Object.keys(args).length,
            envsCount: Object.keys(envs).length,
            issueCount: 0
        };
    });
    return result;
}

/** Format a single arg/env field into a one-line CLI fragment. */
export function formatCliFragment(item: RuntimeConfigCatalogItemRecord | undefined, name: string, value: unknown): string {
    if (item && isFlagArg(item)) {
        if (value === false && typeof item.record?.false_arg === 'string') {
            return String(item.record.false_arg);
        }
        const flagKey = typeof item.record?.arg === 'string' ? item.record.arg : itemDisplayKey(item);
        if (value === true || value === null || value === undefined || value === '') {
            return flagKey;
        }
        return `${flagKey} ${stringifyValue(value)}`;
    }
    if (item && item.kind === 'args') {
        const flagKey = itemDisplayKey(item);
        return `${flagKey}=${stringifyValue(value)}`;
    }
    if (item && item.kind === 'envs') {
        const envKey = itemDisplayKey(item);
        return `${envKey}=${stringifyValue(value)}`;
    }
    return `${name}=${stringifyValue(value)}`;
}

function stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Compute the live CLI/env preview lines for the editor's right rail.
 *
 * For each role:
 *   - Args are emitted as CLI fragments
 *   - Envs are emitted as KEY=VALUE
 *   - Modified-vs-default flag is set per line so the UI can highlight
 */
export function buildPreviewLines(
    document: RuntimeDocument,
    roles: RuntimeConfigRoleEntry[],
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>
): {args: PreviewLine[]; envs: PreviewLine[]} {
    const args: PreviewLine[] = [];
    const envs: PreviewLine[] = [];
    roles.forEach(role => {
        (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
            const selection = getRoleSelection(document, role.role, kind);
            const items = itemsByRoleKind[roleKindKey(role.role, kind)] || [];
            const byName = new Map(items.map(item => [item.name, item]));
            Object.entries(selection).forEach(([name, value]) => {
                const item = byName.get(name);
                const defaultValue = item ? defaultForItem(item) : undefined;
                const fragment: PreviewLine = {
                    role: role.role,
                    text: formatCliFragment(item, name, value),
                    kind,
                    isModified: !valuesEqual(value, defaultValue)
                };
                if (kind === 'args') {
                    args.push(fragment);
                } else {
                    envs.push(fragment);
                }
            });
        });
    });
    return {args, envs};
}

/** Returns a normalized tag set for the policy card. */
export function readPolicyTags(record: RuntimeConfigPolicyRecord): PolicyTagSet {
    const metadata = isRecord(record.document?.metadata) ? (record.document.metadata as Record<string, unknown>) : {};
    const rawTags = Array.isArray(metadata.tags) ? metadata.tags.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim()) : [];
    const intent = typeof metadata.intent === 'string' && (TUNING_INTENTS as readonly string[]).includes(metadata.intent) ? (metadata.intent as TuningIntent) : undefined;
    const workloadClass = typeof metadata.workload_class === 'string' && metadata.workload_class.trim() ? metadata.workload_class.trim() : undefined;
    return {
        tags: rawTags,
        intent,
        workloadClass,
        isTemplate: record.managed_by === 'system'
    };
}

export function writePolicyTags(document: RuntimeDocument, patch: Partial<PolicyTagSet>): RuntimeDocument {
    const next: RuntimeDocument = {...document};
    const metadata = isRecord(next.metadata) ? {...(next.metadata as Record<string, unknown>)} : {};
    if (patch.tags !== undefined) {
        metadata.tags = [...patch.tags];
    }
    if (patch.intent !== undefined) {
        metadata.intent = patch.intent;
    }
    if (patch.workloadClass !== undefined) {
        metadata.workload_class = patch.workloadClass;
    }
    next.metadata = metadata;
    return next;
}

/** Compute deltas between two policies (used by the compare view). */
export function comparePolicies(
    base: RuntimeConfigPolicyRecord,
    other: RuntimeConfigPolicyRecord,
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>,
    roles: RuntimeConfigRoleEntry[]
): CompareDelta[] {
    const baseDocument = (base.document || {}) as RuntimeDocument;
    const otherDocument = (other.document || {}) as RuntimeDocument;
    const deltas: CompareDelta[] = [];
    roles.forEach(role => {
        (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
            const baseSelection = getRoleSelection(baseDocument, role.role, kind);
            const otherSelection = getRoleSelection(otherDocument, role.role, kind);
            const items = itemsByRoleKind[roleKindKey(role.role, kind)] || [];
            const byName = new Map(items.map(item => [item.name, item]));
            const names = new Set<string>([...Object.keys(baseSelection), ...Object.keys(otherSelection)]);
            names.forEach(name => {
                const baseValue = baseSelection[name];
                const otherValue = otherSelection[name];
                if (valuesEqual(baseValue, otherValue)) {
                    return;
                }
                const item = byName.get(name);
                deltas.push({
                    role: role.role,
                    kind,
                    name,
                    label: item ? itemLabel(item) : name,
                    base: baseValue,
                    other: otherValue,
                    defaultValue: item ? defaultForItem(item) : undefined
                });
            });
        });
    });
    return deltas;
}

/**
 * Detect whether the value in `selection` for an item is structurally a JSON
 * scalar that matches its enum/choice options. Used by the typed field
 * controls to decide between text input and segmented control.
 */
export function hasFiniteChoices(item: RuntimeConfigCatalogItemRecord): boolean {
    const choices = itemChoices(item);
    return Array.isArray(choices) && choices.length > 0 && choices.length <= 5;
}

export function isBooleanItem(item: RuntimeConfigCatalogItemRecord): boolean {
    if (isFlagArg(item)) {
        return true;
    }
    return itemType(item).includes('bool');
}

export function isNumericItem(item: RuntimeConfigCatalogItemRecord): boolean {
    const type = itemType(item);
    return type.includes('int') || type.includes('float') || type.includes('number');
}

export function readNumericRange(item: RuntimeConfigCatalogItemRecord): {min?: number; max?: number; step?: number} {
    const min = item.record?.minimum ?? item.record?.min;
    const max = item.record?.maximum ?? item.record?.max;
    const step = item.record?.step;
    return {
        min: typeof min === 'number' ? min : undefined,
        max: typeof max === 'number' ? max : undefined,
        step: typeof step === 'number' ? step : undefined
    };
}

/** Build a quick-match index across all items for global Cmd+K search. */
export function buildSearchIndex(
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>,
    roles: RuntimeConfigRoleEntry[]
): Array<{role: string; kind: RuntimeConfigKind; item: RuntimeConfigCatalogItemRecord; haystack: string; roleLabel: string}> {
    const index: Array<{role: string; kind: RuntimeConfigKind; item: RuntimeConfigCatalogItemRecord; haystack: string; roleLabel: string}> = [];
    roles.forEach(role => {
        (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
            const items = itemsByRoleKind[roleKindKey(role.role, kind)] || [];
            items.forEach(item => {
                const haystack = [item.name, itemLabel(item), itemDisplayKey(item), readMetadataString(item, 'description') ?? '', kind, role.label].join(' ').toLowerCase();
                index.push({role: role.role, kind, item, haystack, roleLabel: role.label});
            });
        });
    });
    return index;
}

/** Returns `true` if the wizard-level shape (engine/version/dynamo/deployment) is filled in. */
export function isScopeComplete(document: RuntimeDocument): boolean {
    return !!(document.engine && document.engine_version && document.dynamo_version && document.deployment_type);
}

/** Tiny helper used by the modified-only filter on the catalog browser. */
export function isModifiedRow(item: RuntimeConfigCatalogItemRecord, roleSelection: Record<string, unknown>): boolean {
    if (!(item.name in roleSelection)) {
        return false;
    }
    const defaultValue = defaultForItem(item);
    return !valuesEqual(roleSelection[item.name], defaultValue);
}

/** Returns a one-line summary suitable for an action chip. */
export function valueSummary(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return 'Not set';
    }
    return formatRuntimeValue(value);
}

/** Convenience: produce a stable React key for a (role, kind, item) row. */
export const rowKey = itemRowKey;

/* ────────────────────────────────────────────────────────────────────────────
   Progressive disclosure: Essentials / Common / All
   ─────────────────────────────────────────────────────────────────────────── */

/** Maps the catalog item's `ui` field into a progressive-disclosure bucket. */
export function itemBucket(item: RuntimeConfigCatalogItemRecord): FieldBucket {
    const ui = (item.ui || '').toString().toLowerCase();
    if (ui === 'primary') return 'essentials';
    if (ui === 'advanced') return 'common';
    return 'all';
}

/**
 * Returns true if the item should be visible when the user has chosen `bucket`.
 *
 * essentials → only ui=primary
 * common     → ui in {primary, advanced}
 * all        → everything
 */
export function itemMatchesBucket(item: RuntimeConfigCatalogItemRecord, bucket: FieldBucket): boolean {
    if (bucket === 'all') return true;
    const itemB = itemBucket(item);
    if (bucket === 'essentials') return itemB === 'essentials';
    // common
    return itemB === 'essentials' || itemB === 'common';
}

/** Counts items per bucket. Used in the bucket selector header. */
export function bucketCounts(items: RuntimeConfigCatalogItemRecord[]): Record<FieldBucket, number> {
    const counts: Record<FieldBucket, number> = {essentials: 0, common: 0, all: items.length};
    items.forEach(item => {
        const b = itemBucket(item);
        if (b === 'essentials') {
            counts.essentials += 1;
            counts.common += 1;
        } else if (b === 'common') {
            counts.common += 1;
        }
    });
    return counts;
}

/* ────────────────────────────────────────────────────────────────────────────
   Goal-based filtering
   ─────────────────────────────────────────────────────────────────────────── */

const GOAL_TO_IMPACT: Record<Exclude<TuneGoal, 'all'>, string[]> = {
    latency: ['latency'],
    throughput: ['throughput'],
    memory: ['memory'],
    stability: ['stability'],
    debug: ['debug', 'observability']
};

const DEBUG_KEYWORDS = /(log|metric|trace|verbose|debug|profile)/i;

/** Returns true if the item is relevant to the given tuning goal. */
export function itemMatchesGoal(item: RuntimeConfigCatalogItemRecord, goal: TuneGoal): boolean {
    if (goal === 'all') return true;
    const impacts = itemImpacts(item).map(tag => tag.toLowerCase());
    const wanted = GOAL_TO_IMPACT[goal];
    if (wanted.some(tag => impacts.includes(tag))) {
        return true;
    }
    if (goal === 'debug') {
        const haystack = `${item.name} ${item.record?.description || ''}`;
        return DEBUG_KEYWORDS.test(haystack);
    }
    return false;
}

/** How many items in the role match each goal — used to label/disable goal chips. */
export function goalCounts(items: RuntimeConfigCatalogItemRecord[]): Record<Exclude<TuneGoal, 'all'>, number> {
    const counts: Record<Exclude<TuneGoal, 'all'>, number> = {latency: 0, throughput: 0, memory: 0, stability: 0, debug: 0};
    items.forEach(item => {
        (['latency', 'throughput', 'memory', 'stability', 'debug'] as Array<Exclude<TuneGoal, 'all'>>).forEach(goal => {
            if (itemMatchesGoal(item, goal)) {
                counts[goal] += 1;
            }
        });
    });
    return counts;
}

/* ────────────────────────────────────────────────────────────────────────────
   Impact ribbon — translate overrides into runtime consequences
   ─────────────────────────────────────────────────────────────────────────── */

const KEY_INDICATOR_FIELDS = {
    gpuMemoryFraction: /gpu[_-]?memory[_-]?fraction|free[_-]?gpu[_-]?memory[_-]?fraction/i,
    maxBatchedTokens: /max[_-]?num[_-]?batched[_-]?tokens|max[_-]?batched[_-]?tokens/i,
    maxNumSeqs: /max[_-]?num[_-]?seqs|max[_-]?num[_-]?seq/i
};

export function computeImpactSummary(modified: ModifiedField[]): ImpactSummary {
    const counts: Record<string, number> = {};
    let gpuMemoryFraction: number | undefined;
    let maxBatchedTokens: number | undefined;
    let maxNumSeqs: number | undefined;
    modified.forEach(entry => {
        if (!entry.item) return;
        const tags = itemImpacts(entry.item);
        tags.forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
        const numeric = typeof entry.value === 'number' ? entry.value : Number(entry.value);
        if (!Number.isFinite(numeric)) return;
        if (KEY_INDICATOR_FIELDS.gpuMemoryFraction.test(entry.item.name)) {
            gpuMemoryFraction = numeric;
        }
        if (KEY_INDICATOR_FIELDS.maxBatchedTokens.test(entry.item.name)) {
            maxBatchedTokens = numeric;
        }
        if (KEY_INDICATOR_FIELDS.maxNumSeqs.test(entry.item.name)) {
            maxNumSeqs = numeric;
        }
    });
    return {
        tags: Object.keys(counts).sort(),
        counts,
        gpuMemoryFraction,
        maxBatchedTokens,
        maxNumSeqs
    };
}

/* ────────────────────────────────────────────────────────────────────────────
   Parent policy inheritance (UI-only, stored in document.metadata)
   ─────────────────────────────────────────────────────────────────────────── */

const PARENT_POLICY_KEY = 'parent_policy_id';
const LOCKED_FIELDS_KEY = 'locked_fields';

export function readInheritance(record: RuntimeConfigPolicyRecord | null | undefined, allPolicies: RuntimeConfigPolicyRecord[]): InheritanceLink {
    const metadata = record && isRecord(record.document?.metadata) ? (record.document.metadata as Record<string, unknown>) : {};
    const parentId = typeof metadata[PARENT_POLICY_KEY] === 'string' ? (metadata[PARENT_POLICY_KEY] as string) : undefined;
    const parent = parentId ? allPolicies.find(candidate => candidate.policy_id === parentId) : undefined;
    const parentMetadata = parent && isRecord(parent.document?.metadata) ? (parent.document.metadata as Record<string, unknown>) : {};
    const locked = Array.isArray(parentMetadata[LOCKED_FIELDS_KEY])
        ? (parentMetadata[LOCKED_FIELDS_KEY] as unknown[]).filter((entry): entry is string => typeof entry === 'string')
        : [];
    return {
        parentPolicyId: parent ? parent.policy_id : undefined,
        parentDisplayName: parent ? (parent.document?.display_name as string | undefined) || parent.policy_id : undefined,
        lockedFields: new Set(locked)
    };
}

/** Returns a new document with the given parent policy id (or undefined to clear). */
export function setParentPolicyId(document: import('./types').RuntimeDocument, parentId: string | undefined): import('./types').RuntimeDocument {
    const next: import('./types').RuntimeDocument = {...document};
    const metadata = isRecord(next.metadata) ? {...(next.metadata as Record<string, unknown>)} : {};
    if (parentId) {
        metadata[PARENT_POLICY_KEY] = parentId;
    } else {
        delete metadata[PARENT_POLICY_KEY];
    }
    next.metadata = metadata;
    return next;
}

/**
 * Project the parent policy's selections onto an item so the child can show
 * "inherits 32 (from acme-baseline)" when the child has no override.
 */
export function inheritedValueFor(parent: RuntimeConfigPolicyRecord | undefined, role: string, kind: RuntimeConfigKind, name: string): unknown {
    if (!parent) return undefined;
    const selections = parent.document?.selections;
    if (!isRecord(selections)) return undefined;
    const roleSelection = isRecord((selections as Record<string, unknown>)[role]) ? ((selections as Record<string, unknown>)[role] as Record<string, unknown>) : undefined;
    if (!roleSelection) return undefined;
    const kindSelection = isRecord(roleSelection[kind]) ? (roleSelection[kind] as Record<string, unknown>) : undefined;
    if (!kindSelection) return undefined;
    return kindSelection[name];
}

/**
 * Per-field validation. Returns a short, control-adjacent error string (no
 * "role.kind.name" prefix — that's added by callers when surfacing in a
 * summary list), or undefined if the value is acceptable.
 *
 * Undefined / empty-string values always pass — they represent "use default".
 * The save-time validator separately enforces "at least one override".
 */
export function validateFieldValue(item: RuntimeConfigCatalogItemRecord, value: unknown): string | undefined {
    if (value === undefined || value === '') return undefined;
    const result = normalizeRuntimeUserValue(item, value, '');
    if (result.error) {
        // Strip leading " " left over from path='' so the message is clean.
        return result.error.replace(/^\s+/, '');
    }
    return undefined;
}

/** Field-level errors keyed by `role:kind:name`. */
export type FieldErrors = Record<string, string>;

export function fieldErrorKey(role: string, kind: RuntimeConfigKind, name: string): string {
    return `${role}:${kind}:${name}`;
}

/**
 * Walk the document's selections and collect per-field validation errors so
 * the wizard/editor can render error counts per step and a flat list on the
 * review screen.
 */
export function collectFieldErrors(
    document: RuntimeDocument,
    roles: RuntimeConfigRoleEntry[],
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>
): FieldErrors {
    const out: FieldErrors = {};
    roles.forEach(role => {
        (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
            const selection = getRoleSelection(document, role.role, kind);
            const items = itemsByRoleKind[roleKindKey(role.role, kind)] || [];
            const byName = new Map(items.map(item => [item.name, item]));
            Object.entries(selection).forEach(([name, value]) => {
                const item = byName.get(name);
                if (!item) {
                    out[fieldErrorKey(role.role, kind, name)] = `No longer in catalog for this engine version.`;
                    return;
                }
                const error = validateFieldValue(item, value);
                if (error) {
                    out[fieldErrorKey(role.role, kind, name)] = error;
                }
            });
        });
    });
    return out;
}

/** Does this item match the unified RoleFilter axis? */
export function itemMatchesRoleFilter(item: RuntimeConfigCatalogItemRecord, filter: RoleFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'essentials') return itemMatchesBucket(item, 'essentials');
    // Otherwise the filter is one of the impact-tag goals.
    return itemMatchesGoal(item, filter);
}

/** Per-option counts for the unified axis, used to render badge counts. */
export function roleFilterCounts(items: RuntimeConfigCatalogItemRecord[]): Record<RoleFilter, number> {
    const out: Record<RoleFilter, number> = {essentials: 0, latency: 0, throughput: 0, memory: 0, stability: 0, debug: 0, all: items.length};
    items.forEach(item => {
        if (itemMatchesBucket(item, 'essentials')) out.essentials += 1;
        const impacts = itemImpacts(item);
        impacts.forEach(tag => {
            if (tag in out) (out as Record<string, number>)[tag] += 1;
        });
    });
    return out;
}

export function errorsForRole(errors: FieldErrors, role: string): number {
    let count = 0;
    const prefix = `${role}:`;
    Object.keys(errors).forEach(key => {
        if (key.startsWith(prefix)) count += 1;
    });
    return count;
}

export interface PolicyOverrideSummary {
    /** Total override count across roles + kinds. */
    total: number;
    /** Per-role breakdown in role order. */
    byRole: Array<{role: string; count: number}>;
    /** A single "headline" override to surface on the card, when one is interesting enough. */
    headline?: {role: string; kind: RuntimeConfigKind; name: string; value: unknown};
}

/**
 * Catalog-free summary of a policy's overrides. Drives the per-card stat
 * line in the library and the headline diff on `PolicyCard`.
 *
 * Cards don't load catalog items per policy (expensive in a list of 40+),
 * so we infer "interestingness" by field-name keyword priority. When no
 * keyword matches, we fall back to the first override encountered in role
 * order.
 */
const HEADLINE_KEYWORDS: RegExp[] = [
    /tensor[_-]?parallel/i,
    /pipeline[_-]?parallel/i,
    /gpu[_-]?memory/i,
    /max[_-]?(?:num[_-]?seqs|batched[_-]?tokens|model[_-]?len)/i,
    /kv[_-]?cache/i,
    /block[_-]?size/i,
    /router/i,
    /chunked[_-]?prefill/i
];

export function summarizePolicyOverrides(record: RuntimeConfigPolicyRecord): PolicyOverrideSummary {
    const document = (record.document || {}) as Record<string, unknown>;
    const selectionsRaw = document.selections;
    if (!isRecord(selectionsRaw)) {
        return {total: 0, byRole: []};
    }
    const byRole: Array<{role: string; count: number}> = [];
    let total = 0;
    let headline: PolicyOverrideSummary['headline'];
    let firstCandidate: PolicyOverrideSummary['headline'];

    Object.entries(selectionsRaw).forEach(([roleName, roleValue]) => {
        if (!isRecord(roleValue)) return;
        let roleCount = 0;
        (['args', 'envs'] as RuntimeConfigKind[]).forEach(kind => {
            const kv = roleValue[kind];
            if (!isRecord(kv)) return;
            Object.entries(kv).forEach(([name, value]) => {
                roleCount += 1;
                total += 1;
                if (!firstCandidate) firstCandidate = {role: roleName, kind, name, value};
                if (!headline && HEADLINE_KEYWORDS.some(re => re.test(name))) {
                    headline = {role: roleName, kind, name, value};
                }
            });
        });
        if (roleCount > 0) byRole.push({role: roleName, count: roleCount});
    });

    return {total, byRole, headline: headline || firstCandidate};
}

/**
 * Parse an RFC 7807 field_path like "selections.decode.args.tensor_parallel_size"
 * back into (role, kind, name) so the UI can scroll/highlight the offending field.
 * Returns null for paths that aren't selection-scoped (e.g. top-level fields).
 */
export function parseSelectionsFieldPath(fieldPath: string | null | undefined): {role: string; kind: RuntimeConfigKind; name: string} | null {
    if (typeof fieldPath !== 'string' || !fieldPath.startsWith('selections.')) {
        return null;
    }
    const parts = fieldPath.slice('selections.'.length).split('.');
    if (parts.length < 3) return null;
    const [role, kind, ...rest] = parts;
    if (kind !== 'args' && kind !== 'envs') return null;
    if (!role || rest.length === 0) return null;
    return {role, kind, name: rest.join('.')};
}

/**
 * Build an RFC 7396 JSON Merge Patch that, when applied to `base`, produces
 * `target`. Used by the editor's save path to send only what changed instead
 * of a full PUT — sensitive fields the user didn't touch stay as the masked
 * `"***"` sentinel in `target` and naturally drop out of the diff.
 *
 * Rules:
 *   - Key present in both with deep-equal values → omitted.
 *   - Key present in both with both values being objects → recursive diff
 *     (omitted if the recursive diff is itself empty).
 *   - Key only in target → included.
 *   - Key only in base → included as null (RFC 7396 "delete" sentinel).
 *   - Arrays are replaced wholesale (per RFC 7396; merge-patch does not
 *     support array-element diffs).
 */
export function jsonMergePatchDiff(base: unknown, target: unknown): unknown {
    if (!isRecord(base) || !isRecord(target)) {
        return target;
    }
    const patch: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
    keys.forEach(key => {
        const inBase = key in base;
        const inTarget = key in target;
        if (!inTarget) {
            patch[key] = null;
            return;
        }
        if (!inBase) {
            patch[key] = target[key];
            return;
        }
        const a = base[key];
        const b = target[key];
        if (isRecord(a) && isRecord(b)) {
            const sub = jsonMergePatchDiff(a, b);
            if (isRecord(sub) && Object.keys(sub).length > 0) {
                patch[key] = sub;
            }
            return;
        }
        if (!shallowJsonEqual(a, b)) {
            patch[key] = b;
        }
    });
    return patch;
}

function shallowJsonEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}
