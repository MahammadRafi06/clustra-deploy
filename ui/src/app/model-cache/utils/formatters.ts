export type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'muted' | 'violet';

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || bytes === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const kilo = 1024;
    const index = Math.floor(Math.log(bytes) / Math.log(kilo));
    return `${(bytes / Math.pow(kilo, index)).toFixed(1)} ${units[index]}`;
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) {
        return '-';
    }
    return new Date(iso).toLocaleString();
}

export function formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) {
        return '-';
    }
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) {
        return `${seconds}s ago`;
    }
    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m ago`;
    }
    if (seconds < 86400) {
        return `${Math.floor(seconds / 3600)}h ago`;
    }
    return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDuration(ms: number | null | undefined): string {
    if (ms == null) {
        return '-';
    }
    if (ms < 1000) {
        return `${ms}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
}

export function statusTone(status: string): Tone {
    const tones: Record<string, Tone> = {
        available: 'success',
        downloading: 'accent',
        download_failed: 'danger',
        soft_deleted: 'warning',
        hard_deleting: 'warning',
        purged: 'muted',
        integrity_error: 'danger',
        queued: 'warning',
        running: 'accent',
        succeeded: 'success',
        failed: 'danger',
        cancelled: 'muted'
    };

    return tones[status] || 'muted';
}
