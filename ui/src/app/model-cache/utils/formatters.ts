export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString();
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export interface StatusTone {
  background: string;
  color: string;
}

export function statusTone(status: string): StatusTone {
  const tones: Record<string, StatusTone> = {
    available: {color: "var(--mc-success)", background: "var(--mc-success-soft)"},
    downloading: {color: "var(--mc-accent)", background: "var(--mc-accent-soft)"},
    download_failed: {color: "var(--mc-danger)", background: "var(--mc-danger-soft)"},
    soft_deleted: {color: "var(--mc-warning)", background: "var(--mc-warning-soft)"},
    hard_deleting: {color: "var(--mc-warning)", background: "var(--mc-warning-soft)"},
    purged: {color: "var(--mc-text-soft)", background: "var(--mc-surface-muted)"},
    integrity_error: {color: "var(--mc-danger)", background: "var(--mc-danger-soft)"},
    queued: {color: "var(--mc-warning)", background: "var(--mc-warning-soft)"},
    running: {color: "var(--mc-accent)", background: "var(--mc-accent-soft)"},
    succeeded: {color: "var(--mc-success)", background: "var(--mc-success-soft)"},
    failed: {color: "var(--mc-danger)", background: "var(--mc-danger-soft)"},
    cancelled: {color: "var(--mc-text-soft)", background: "var(--mc-surface-muted)"},
  };
  return tones[status] || {color: "var(--mc-text-soft)", background: "var(--mc-surface-muted)"};
}

export function statusColor(status: string): string {
  return statusTone(status).color;
}

export function statusBackground(status: string): string {
  return statusTone(status).background;
}
