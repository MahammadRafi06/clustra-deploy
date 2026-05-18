export const REQUEST_POLICY_TYPES = ['workload', 'infrastructure', 'serving'] as const;

export type RequestPolicyType = (typeof REQUEST_POLICY_TYPES)[number];
export type RuntimeConfigKind = 'args' | 'envs';
export type DeploymentType = 'agg' | 'disagg';
export type CatalogScope = 'frontend' | 'engine';
export type PolicyFamily = 'request' | 'runtime';
export type PolicyKindFilter = 'all' | 'request' | 'runtime';
export type ActiveFilter = 'all' | 'active' | 'inactive';
export type ManagedByFilter = 'all' | 'system' | 'custom';
export type PolicyPageKey = RequestPolicyType | 'runtime-config';

export interface PolicyRecord {
    policy_id: string;
    type: string;
    active: boolean;
    managed_by: string;
    document: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface PolicyTypeRecord {
    policy_type?: string;
    type?: string;
    name?: string;
    display_name?: string;
    description?: string;
    active?: boolean;
    document?: Record<string, unknown>;
    template?: Record<string, unknown>;
    schema?: Record<string, unknown>;
    fields?: unknown[];
    defaults?: Record<string, unknown>;
}

export interface PolicyListResponse {
    policies: PolicyRecord[];
    total: number;
}

export interface RuntimeConfigPolicyRecord {
    policy_id: string;
    engine: string;
    engine_version: string;
    dynamo_version: string;
    deployment_type: DeploymentType;
    active: boolean;
    managed_by: string;
    document: Record<string, unknown>;
    /** Count of catalogs whose snapshot sha256 differs from the current catalog. 0 = clean. */
    drift_count?: number;
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface RuntimeConfigPolicyListResponse {
    runtime_config_policies: RuntimeConfigPolicyRecord[];
    total: number;
}

export interface ManifestOverlayRecord {
    overlay_id: string;
    overlay_key: string;
    display_name: string;
    description?: string | null;
    active: boolean;
    is_default: boolean;
    managed_by: string;
    cloud_provider: string;
    engine: string;
    engine_version: string;
    dynamo_version: string;
    deployment_type: DeploymentType;
    crd_version: string;
    template_yaml: string;
    values_schema: Record<string, unknown>;
    default_values: Record<string, unknown>;
    ui_metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface ManifestOverlayListResponse {
    overlays: ManifestOverlayRecord[];
    total: number;
}

export interface RuntimeConfigRoleEntry {
    role: string;
    label: string;
    catalog_scope: CatalogScope;
    [key: string]: unknown;
}

export interface RuntimeConfigRoleSchemaRecord {
    deployment_type: DeploymentType;
    active: boolean;
    managed_by: string;
    schema: {
        deployment_type: DeploymentType;
        active?: boolean;
        roles: RuntimeConfigRoleEntry[];
        [key: string]: unknown;
    };
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface RuntimeConfigRoleSchemaListResponse {
    role_schemas: RuntimeConfigRoleSchemaRecord[];
    total: number;
}

export interface RuntimeConfigCatalogRecord {
    catalog_id: string;
    engine: string;
    engine_version: string;
    dynamo_version: string;
    kind: RuntimeConfigKind;
    active: boolean;
    source?: string | null;
    /** Hex sha256 of the canonical catalog document; null on legacy rows. */
    sha256?: string | null;
    created_at: string;
    updated_at: string;
    uploaded_by?: string | null;
}

export interface RuntimeConfigCatalogListResponse {
    catalogs: RuntimeConfigCatalogRecord[];
    total: number;
}

export interface RuntimeConfigCatalogItemRecord {
    catalog_id: string;
    name: string;
    display_name: string;
    engine: string;
    engine_version: string;
    dynamo_version: string;
    kind: RuntimeConfigKind;
    ui: 'primary' | 'advanced' | 'less_frequent' | string;
    aic: boolean;
    type?: string | null;
    default_value?: unknown;
    record: Record<string, unknown>;
    position: number;
    active: boolean;
    applicable_deployment_types?: string[] | null;
    applicable_roles?: string[] | null;
    created_at: string;
    updated_at: string;
}

export interface RuntimeConfigCatalogItemListResponse {
    items: RuntimeConfigCatalogItemRecord[];
    total: number;
}

export interface RuntimeConfigCatalogDrift {
    catalog_id: string;
    snapshot_sha256: string;
    current_sha256: string | null;
}

export interface RuntimeConfigPolicyExport {
    policy_id: string;
    engine: string;
    engine_version: string;
    dynamo_version: string;
    deployment_type: DeploymentType;
    roles: Record<string, {args: Record<string, unknown>; envs: Record<string, unknown>}>;
    catalog_drift?: RuntimeConfigCatalogDrift[];
}

export interface RuntimeConfigCatalogImportItem {
    engine: string;
    engine_version: string;
    dynamo_version: string;
    kind: RuntimeConfigKind;
    document: Record<string, unknown>;
    catalog_id?: string;
    sha256?: string;
}

export interface RuntimeConfigCatalogImportRequest {
    catalogs: RuntimeConfigCatalogImportItem[];
}

export interface RuntimeConfigCatalogConcept {
    concept: string;
    item_count: number;
    engines: string[];
}

export interface RuntimeConfigCatalogConceptListResponse {
    concepts: RuntimeConfigCatalogConcept[];
    total: number;
}

export interface ListRuntimeConfigCatalogConceptsParams {
    engine?: string;
    kind?: RuntimeConfigKind;
}

export type RuntimeConfigPolicyMigrationChangeType = 'rename' | 'dropped';

export interface RuntimeConfigPolicyMigrationChange {
    type: RuntimeConfigPolicyMigrationChangeType;
    role: string;
    kind: RuntimeConfigKind;
    from_name: string;
    to_name?: string | null;
    reason?: string | null;
}

export interface RuntimeConfigPolicyMigrationResponse {
    policy_id: string;
    applied: boolean;
    changes: RuntimeConfigPolicyMigrationChange[];
    validation_errors: string[];
    policy: RuntimeConfigPolicyRecord | null;
}

export interface AuditEventRecord {
    request_id: string;
    job_id?: string | null;
    endpoint: string;
    event_type: string;
    triggered_by?: string | null;
    created_at: string;
    payload: Record<string, unknown>;
}

export interface AuditEventListResponse {
    events: AuditEventRecord[];
    total: number;
}

export interface ListAuditEventsParams {
    request_id?: string;
    job_id?: string;
    endpoint?: string;
    event_type?: string;
    triggered_by?: string;
    policy_id?: string;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
}

export interface PolicyTypeListResponse {
    policy_types: PolicyTypeRecord[];
    total: number;
}

export interface ListPolicyTypesParams {
    active?: boolean;
    limit?: number;
    offset?: number;
}

export interface ListPoliciesParams {
    type?: RequestPolicyType;
    active?: boolean;
    limit?: number;
    offset?: number;
}

export interface ListRuntimeConfigPoliciesParams {
    engine?: string;
    dynamo_version?: string;
    deployment_type?: DeploymentType;
    active?: boolean;
    has_drift?: boolean;
    limit?: number;
    offset?: number;
}

export interface ListManifestOverlaysParams {
    overlay_key?: string;
    cloud_provider?: string;
    engine?: string;
    engine_version?: string;
    dynamo_version?: string;
    deployment_type?: DeploymentType;
    crd_version?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
}

export interface ListRuntimeConfigCatalogsParams {
    engine?: string;
    dynamo_version?: string;
    kind?: RuntimeConfigKind;
    active?: boolean;
    limit?: number;
    offset?: number;
}

export interface ListRuntimeConfigCatalogItemsParams {
    engine?: string;
    version?: string;
    engine_version?: string;
    dynamo_version?: string;
    kind?: RuntimeConfigKind;
    deployment_type?: DeploymentType;
    role?: string;
    ui?: string;
    q?: string;
    concept?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
}

export interface PolicyRow {
    id: string;
    family: PolicyFamily;
    kindLabel: 'Request policy' | 'Runtime config policy';
    typeOrBackend: string;
    record: PolicyRecord | RuntimeConfigPolicyRecord;
}

export interface PolicyApiClient {
    listPolicyTypes(params?: ListPolicyTypesParams): Promise<PolicyTypeListResponse>;
    getPolicyType(policyType: string): Promise<PolicyTypeRecord>;
    listPolicies(params?: ListPoliciesParams): Promise<PolicyListResponse>;
    getPolicy(policyId: string): Promise<PolicyRecord>;
    createPolicy(document: Record<string, unknown>): Promise<PolicyRecord>;
    updatePolicy(policyId: string, document: Record<string, unknown>): Promise<PolicyRecord>;
    deletePolicy(policyId: string): Promise<void>;
    listRuntimeConfigPolicies(params?: ListRuntimeConfigPoliciesParams): Promise<RuntimeConfigPolicyListResponse>;
    listManifestOverlays(params?: ListManifestOverlaysParams): Promise<ManifestOverlayListResponse>;
    getRuntimeConfigPolicy(policyId: string): Promise<RuntimeConfigPolicyRecord>;
    createRuntimeConfigPolicy(document: Record<string, unknown>): Promise<RuntimeConfigPolicyRecord>;
    updateRuntimeConfigPolicy(policyId: string, document: Record<string, unknown>): Promise<RuntimeConfigPolicyRecord>;
    deleteRuntimeConfigPolicy(policyId: string): Promise<void>;
    exportRuntimeConfigPolicy(policyId: string): Promise<RuntimeConfigPolicyExport>;
    resolveRuntimeConfigPolicy(policyId: string): Promise<RuntimeConfigPolicyExport>;
    listRuntimeConfigRoleSchemas(params?: {active?: boolean; limit?: number; offset?: number}): Promise<RuntimeConfigRoleSchemaListResponse>;
    getRuntimeConfigRoleSchema(deploymentType: DeploymentType): Promise<RuntimeConfigRoleSchemaRecord>;
    updateRuntimeConfigRoleSchema(deploymentType: DeploymentType, schema: Record<string, unknown>): Promise<RuntimeConfigRoleSchemaRecord>;
    listRuntimeConfigCatalogs(params?: ListRuntimeConfigCatalogsParams): Promise<RuntimeConfigCatalogListResponse>;
    deleteRuntimeConfigCatalog(catalogId: string): Promise<RuntimeConfigCatalogRecord>;
    listRuntimeConfigCatalogItems(params?: ListRuntimeConfigCatalogItemsParams): Promise<RuntimeConfigCatalogItemListResponse>;
    listRuntimeConfigCatalogConcepts(params?: ListRuntimeConfigCatalogConceptsParams): Promise<RuntimeConfigCatalogConceptListResponse>;
    importRuntimeConfigCatalogs(request: RuntimeConfigCatalogImportRequest): Promise<RuntimeConfigCatalogListResponse>;
    patchRuntimeConfigPolicy(policyId: string, patch: Record<string, unknown>): Promise<RuntimeConfigPolicyRecord>;
    migrateRuntimeConfigPolicy(policyId: string, apply: boolean): Promise<RuntimeConfigPolicyMigrationResponse>;
    listAuditEvents(params?: ListAuditEventsParams): Promise<AuditEventListResponse>;
}
