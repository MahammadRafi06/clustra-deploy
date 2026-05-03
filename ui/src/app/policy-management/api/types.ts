export const REQUEST_POLICY_TYPES = ['workload', 'infrastructure', 'serving', 'manifest'] as const;
export const FEATURE_BACKENDS = ['trtllm', 'vllm', 'sglang'] as const;

export type RequestPolicyType = (typeof REQUEST_POLICY_TYPES)[number];
export type FeatureBackend = (typeof FEATURE_BACKENDS)[number];
export type PolicyFamily = 'request' | 'feature';
export type PolicyKindFilter = 'all' | 'request' | 'feature';
export type ActiveFilter = 'all' | 'active' | 'inactive';
export type ManagedByFilter = 'all' | 'system' | 'custom';
export type PolicyPageKey = RequestPolicyType | 'features';
export type FeatureBackendFilter = FeatureBackend | 'all';

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

export interface FeaturePolicyRecord {
    policy_id: string;
    backend: FeatureBackend;
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

export interface FeaturePolicyListResponse {
    feature_policies: FeaturePolicyRecord[];
    total: number;
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

export interface ListFeaturePoliciesParams {
    backend?: FeatureBackend;
    active?: boolean;
    limit?: number;
    offset?: number;
}

export interface PolicyRow {
    id: string;
    family: PolicyFamily;
    kindLabel: 'Request policy' | 'Feature policy';
    typeOrBackend: string;
    record: PolicyRecord | FeaturePolicyRecord;
}

export interface PolicyApiClient {
    listPolicyTypes(params?: ListPolicyTypesParams): Promise<PolicyTypeListResponse>;
    getPolicyType(policyType: string): Promise<PolicyTypeRecord>;
    listPolicies(params?: ListPoliciesParams): Promise<PolicyListResponse>;
    getPolicy(policyId: string): Promise<PolicyRecord>;
    createPolicy(document: Record<string, unknown>): Promise<PolicyRecord>;
    updatePolicy(policyId: string, document: Record<string, unknown>): Promise<PolicyRecord>;
    deletePolicy(policyId: string): Promise<void>;
    listFeaturePolicies(params?: ListFeaturePoliciesParams): Promise<FeaturePolicyListResponse>;
    getFeaturePolicy(policyId: string): Promise<FeaturePolicyRecord>;
    createFeaturePolicy(document: Record<string, unknown>): Promise<FeaturePolicyRecord>;
    updateFeaturePolicy(policyId: string, document: Record<string, unknown>): Promise<FeaturePolicyRecord>;
    deleteFeaturePolicy(policyId: string): Promise<void>;
}
