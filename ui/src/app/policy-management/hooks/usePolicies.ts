import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {
    ActiveFilter,
    FeatureBackend,
    FeatureBackendFilter,
    FeaturePolicyRecord,
    ManagedByFilter,
    PolicyApiClient,
    PolicyFamily,
    PolicyRecord,
    PolicyRow,
    RequestPolicyType
} from '../api/types';
import {FEATURE_BACKENDS} from '../api/types';
import {matchesSearch, toPolicyRows} from '../formatters';

const LOCAL_FILTER_FETCH_SIZE = 200;

export interface PolicyListFilters {
    family: PolicyFamily;
    search: string;
    active: ActiveFilter;
    managedBy: ManagedByFilter;
    requestType?: RequestPolicyType;
    backend: FeatureBackendFilter;
    page: number;
    pageSize: number;
}

export interface PolicyListResult {
    rows: PolicyRow[];
    total: number;
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function activeParam(active: ActiveFilter): boolean | undefined {
    if (active === 'active') {
        return true;
    }
    if (active === 'inactive') {
        return false;
    }
    return undefined;
}

function rowManagedBy(row: PolicyRow): 'system' | 'custom' {
    return row.record.managed_by === 'system' ? 'system' : 'custom';
}

function filterRows(rows: PolicyRow[], filters: PolicyListFilters): PolicyRow[] {
    return rows.filter(row => {
        if (filters.managedBy !== 'all' && rowManagedBy(row) !== filters.managedBy) {
            return false;
        }
        return matchesSearch(row, filters.search);
    });
}

function hasLocalOnlyFilters(filters: PolicyListFilters): boolean {
    return filters.search.trim() !== '' || filters.managedBy !== 'all';
}

function paginateRows(rows: PolicyRow[], filters: PolicyListFilters): PolicyRow[] {
    const pageStart = filters.page * filters.pageSize;
    return rows.slice(pageStart, pageStart + filters.pageSize);
}

async function fetchAllPolicies(client: PolicyApiClient, type: RequestPolicyType | undefined, active: boolean | undefined): Promise<PolicyRecord[]> {
    const policies: PolicyRecord[] = [];
    let offset = 0;
    let total: number | undefined;

    while (true) {
        const result = await client.listPolicies({type, active, limit: LOCAL_FILTER_FETCH_SIZE, offset});
        const page = result.policies || [];
        policies.push(...page);
        total = typeof result.total === 'number' ? result.total : total;

        if (page.length < LOCAL_FILTER_FETCH_SIZE || (typeof total === 'number' && policies.length >= total)) {
            break;
        }
        offset += LOCAL_FILTER_FETCH_SIZE;
    }

    return policies;
}

async function fetchAllFeaturePolicies(client: PolicyApiClient, backend: FeatureBackend, active: boolean | undefined): Promise<FeaturePolicyRecord[]> {
    const featurePolicies: FeaturePolicyRecord[] = [];
    let offset = 0;
    let total: number | undefined;

    while (true) {
        const result = await client.listFeaturePolicies({backend, active, limit: LOCAL_FILTER_FETCH_SIZE, offset});
        const page = result.feature_policies || [];
        featurePolicies.push(...page);
        total = typeof result.total === 'number' ? result.total : total;

        if (page.length < LOCAL_FILTER_FETCH_SIZE || (typeof total === 'number' && featurePolicies.length >= total)) {
            break;
        }
        offset += LOCAL_FILTER_FETCH_SIZE;
    }

    return featurePolicies;
}

async function fetchRows(client: PolicyApiClient, filters: PolicyListFilters): Promise<PolicyListResult> {
    const active = activeParam(filters.active);
    const offset = filters.page * filters.pageSize;

    if (filters.family === 'request') {
        if (hasLocalOnlyFilters(filters)) {
            const rows = filterRows(toPolicyRows(await fetchAllPolicies(client, filters.requestType, active), []), filters);
            return {
                rows: paginateRows(rows, filters),
                total: rows.length
            };
        }

        const result = await client.listPolicies({type: filters.requestType, active, limit: filters.pageSize, offset});
        return {
            rows: toPolicyRows(result.policies || [], []),
            total: result.total || 0
        };
    }

    if (filters.backend !== 'all') {
        if (hasLocalOnlyFilters(filters)) {
            const rows = filterRows(toPolicyRows([], await fetchAllFeaturePolicies(client, filters.backend, active)), filters);
            return {
                rows: paginateRows(rows, filters),
                total: rows.length
            };
        }

        const result = await client.listFeaturePolicies({backend: filters.backend, active, limit: filters.pageSize, offset});
        return {
            rows: toPolicyRows([], result.feature_policies || []),
            total: result.total || 0
        };
    }

    const results = await Promise.all(FEATURE_BACKENDS.map(backend => fetchAllFeaturePolicies(client, backend, active)));
    const rows = filterRows(
        toPolicyRows(
            [],
            results.flatMap(result => result)
        ),
        filters
    );

    return {
        rows: paginateRows(rows, filters),
        total: rows.length
    };
}

export function usePolicies(client: PolicyApiClient, filters: PolicyListFilters, invalidationKey = 0) {
    const cache = useRef(new Map<string, PolicyListResult>());
    const [data, setData] = useState<PolicyListResult>({rows: [], total: 0});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const cacheKey = useMemo(() => JSON.stringify({...filters, invalidationKey}), [filters, invalidationKey]);

    const refetch = useCallback(
        async (force = false) => {
            if (!force && cache.current.has(cacheKey)) {
                setData(cache.current.get(cacheKey));
                setIsLoading(false);
                setError(null);
                return;
            }
            setIsLoading(true);
            try {
                const result = await fetchRows(client, filters);
                cache.current.set(cacheKey, result);
                setData(result);
                setError(null);
            } catch (err) {
                setError(toError(err));
            } finally {
                setIsLoading(false);
            }
        },
        [cacheKey, client, filters]
    );

    useEffect(() => {
        refetch();
    }, [refetch]);

    const invalidate = useCallback(() => {
        cache.current.clear();
        return refetch(true);
    }, [refetch]);

    return {data, isLoading, error, refetch: invalidate};
}
