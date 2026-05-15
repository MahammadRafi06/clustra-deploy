/**
 * Types for the redesigned Runtime Config Policies UI.
 *
 * Lives alongside the legacy wizard types under runtime-config/. The runtime
 * "shape" of policies, catalogs, role schemas, etc. is unchanged — these are
 * purely view-layer types and helpers.
 */

import type {DeploymentType, RuntimeConfigCatalogItemRecord, RuntimeConfigKind, RuntimeConfigPolicyRecord, RuntimeConfigRoleEntry} from '../../api/types';
import type {RuntimeDocument} from '../runtimeConfigTypes';

export type TuningIntent = 'latency' | 'throughput' | 'cost' | 'balanced' | 'debug';

/**
 * Progressive-disclosure buckets driven off the catalog item's `ui` field.
 * - "essentials": item.ui === 'primary' — the 5–15 fields per role most users care about
 * - "common":     item.ui in {'primary', 'advanced'} — adds the common knobs (~80% of real tuning)
 * - "all":        everything in the catalog
 */
export type FieldBucket = 'essentials' | 'common' | 'all';

/** Goal-driven filter that maps to catalog impact tags. */
export type TuneGoal = 'all' | 'latency' | 'throughput' | 'memory' | 'stability' | 'debug';

/**
 * Unified filter axis used by the role-config UI. Collapses the previous
 * dual axes (Goal + Bucket) into a single segmented control.
 *
 * Semantics:
 *   - "essentials"                                : only catalog items with ui === 'primary'
 *   - "latency" / "throughput" / "memory" / "stability" / "debug"
 *                                                : items whose impact tags include this goal,
 *                                                  regardless of bucket
 *   - "all"                                       : every item in the catalog
 *
 * Default is "essentials" — first-time users see the 5–15 fields most worth
 * tuning. Power users hit "All" to see everything.
 */
export type RoleFilter = 'essentials' | 'latency' | 'throughput' | 'memory' | 'stability' | 'debug' | 'all';

/** Compact rows for power users, cards for first-time / docs-heavy review. */
export type FieldDensity = 'rows' | 'cards';

/** What "kinds" the catalog browser is rendering. */
export type KindFilter = 'args' | 'envs' | 'both';

/** A short summary of what the user's current overrides touch. Drives the impact ribbon. */
export interface ImpactSummary {
    /** Distinct impact tags touched by the user's overrides (e.g. "latency", "memory"). */
    tags: string[];
    /** Per-tag count of modified fields. */
    counts: Record<string, number>;
    /** Best-effort estimate of the GPU memory fraction the policy reserves, if set. */
    gpuMemoryFraction?: number;
    /** Best-effort max-batched-tokens value if set. Used as a rough throughput indicator. */
    maxBatchedTokens?: number;
    /** Best-effort max-num-seqs if set. */
    maxNumSeqs?: number;
}

/** Read from document.metadata.parent_policy_id — UI-only inheritance (no backend changes). */
export interface InheritanceLink {
    parentPolicyId?: string;
    parentDisplayName?: string;
    /** Catalog item names that the parent has locked. */
    lockedFields: Set<string>;
}

export interface PolicyTagSet {
    /** Free-form tags pulled from document.metadata.tags */
    tags: string[];
    /** Tuning intent metadata, if present in document.metadata.intent */
    intent?: TuningIntent;
    /** Workload class label, if present in document.metadata.workload_class */
    workloadClass?: string;
    /** True when managed_by === 'system' — treated as a template */
    isTemplate: boolean;
}

export interface CategoryGroup {
    /** Stable group key derived from the catalog item metadata */
    key: string;
    /** Display label */
    label: string;
    /** Items belonging to this group */
    items: RuntimeConfigCatalogItemRecord[];
}

export interface RoleStats {
    role: string;
    label: string;
    catalog_scope: string;
    /** Number of args overrides set */
    argsCount: number;
    /** Number of envs overrides set */
    envsCount: number;
    /** Number of items with validation issues */
    issueCount: number;
}

export interface ModifiedField {
    role: string;
    kind: RuntimeConfigKind;
    name: string;
    value: unknown;
    defaultValue: unknown;
    item?: RuntimeConfigCatalogItemRecord;
}

export interface PreviewLine {
    role: string;
    text: string;
    kind: RuntimeConfigKind;
    isModified: boolean;
}

export interface EditorScope {
    engine: string;
    engineVersion: string;
    dynamoVersion: string;
    deploymentType: DeploymentType;
}

export interface EditorState {
    document: RuntimeDocument;
    scope: EditorScope;
    roles: RuntimeConfigRoleEntry[];
    /** Items indexed by `${role}:${kind}` */
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>;
}

export interface CompareDelta {
    role: string;
    kind: RuntimeConfigKind;
    name: string;
    label: string;
    base?: unknown;
    other?: unknown;
    defaultValue?: unknown;
}

/** Re-exports so v2 modules only need to import from this file. */
export type {RuntimeConfigCatalogItemRecord, RuntimeConfigKind, RuntimeConfigPolicyRecord, RuntimeConfigRoleEntry, RuntimeDocument};
