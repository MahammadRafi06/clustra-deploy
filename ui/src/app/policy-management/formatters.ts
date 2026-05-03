import type {FeaturePolicyRecord, PolicyFamily, PolicyRecord, PolicyRow} from './api/types';

export function formatRelativeTime(iso?: string | null): string {
    if (!iso) {
        return 'unknown';
    }
    const time = new Date(iso).getTime();
    if (Number.isNaN(time)) {
        return iso;
    }
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) {
        return 'just now';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 48) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function displayName(document: Record<string, unknown>): string {
    return typeof document.display_name === 'string' && document.display_name.trim() ? document.display_name : '';
}

export function description(document: Record<string, unknown>): string {
    return typeof document.description === 'string' ? document.description : '';
}

export function featureName(document: Record<string, unknown>): string {
    return typeof document.feature === 'string' ? document.feature : '';
}

export function tags(document: Record<string, unknown>): string[] {
    const metadata = document.metadata && typeof document.metadata === 'object' && !Array.isArray(document.metadata) ? (document.metadata as Record<string, unknown>) : {};
    return Array.isArray(metadata.tags) ? metadata.tags.map(item => String(item)).filter(Boolean) : [];
}

export function uiMetadata(document: Record<string, unknown>): Record<string, unknown> {
    const metadata = document.metadata && typeof document.metadata === 'object' && !Array.isArray(document.metadata) ? (document.metadata as Record<string, unknown>) : {};
    return metadata.ui && typeof metadata.ui === 'object' && !Array.isArray(metadata.ui) ? (metadata.ui as Record<string, unknown>) : {};
}

export function toPolicyRows(policies: PolicyRecord[], featurePolicies: FeaturePolicyRecord[]): PolicyRow[] {
    return [
        ...policies.map(record => ({
            id: record.policy_id,
            family: 'request' as PolicyFamily,
            kindLabel: 'Request policy' as const,
            typeOrBackend: record.type,
            record
        })),
        ...featurePolicies.map(record => ({
            id: record.policy_id,
            family: 'feature' as PolicyFamily,
            kindLabel: 'Feature policy' as const,
            typeOrBackend: record.backend,
            record
        }))
    ].sort((left, right) => {
        const updated = new Date(right.record.updated_at).getTime() - new Date(left.record.updated_at).getTime();
        return updated === 0 ? left.id.localeCompare(right.id) : updated;
    });
}

export function matchesSearch(row: PolicyRow, search: string): boolean {
    const query = search.trim().toLowerCase();
    if (!query) {
        return true;
    }
    const document = row.record.document || {};
    const haystack = [row.id, displayName(document), description(document), featureName(document), ...tags(document)].join(' ').toLowerCase();
    return haystack.includes(query);
}
