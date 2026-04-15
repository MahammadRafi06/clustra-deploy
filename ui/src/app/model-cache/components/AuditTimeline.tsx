import React, { useEffect, useState } from "react";
import type { AuditLogEntry } from "../api/types";
import { modelAuditTrail } from "../api/client";
import { formatRelativeTime } from "../utils/formatters";

interface Props {
  modelId: string;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  download_requested:       { icon: "fa-cloud-download", color: "var(--mc-accent)", label: "Download requested" },
  download_succeeded:       { icon: "fa-check-circle",   color: "var(--mc-success)", label: "Download complete" },
  download_failed:          { icon: "fa-times-circle",   color: "var(--mc-danger)", label: "Download failed" },
  download_cancelled:       { icon: "fa-ban",            color: "var(--mc-text-soft)", label: "Download cancelled" },
  soft_delete:              { icon: "fa-eye-slash",      color: "var(--mc-warning)", label: "Soft deleted" },
  hard_delete_requested:    { icon: "fa-trash",          color: "var(--mc-danger)", label: "Hard delete started" },
  hard_delete_succeeded:    { icon: "fa-trash",          color: "var(--mc-success)", label: "Hard delete confirmed" },
  hard_delete_failed:       { icon: "fa-exclamation-triangle", color: "var(--mc-danger)", label: "Hard delete failed" },
  restore:                  { icon: "fa-undo",           color: "var(--mc-accent)", label: "Restored" },
  integrity_check_requested:{ icon: "fa-shield",         color: "var(--mc-accent)", label: "Integrity check" },
  rescan_requested:         { icon: "fa-refresh",        color: "var(--mc-accent)", label: "Rescan requested" },
};

function getReasonText(details: Record<string, unknown>): string {
  if (details && typeof details === "object" && "reason" in details) {
    return String(details.reason);
  }
  return "";
}

export const AuditTimeline: React.FC<Props> = ({ modelId }) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    modelAuditTrail(modelId, { page: 1 })
      .then((r) => {
        // Deduplicate entries with same action+timestamp (from job watcher duplicate events)
        const seen = new Set<string>();
        const deduped = r.items.filter((e) => {
          const key = `${e.action}-${e.created_at}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setEntries(deduped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [modelId]);

  if (loading) return <div style={{ padding: "12px 0", color: "var(--mc-text-soft)", fontSize: "12px" }}>Loading timeline...</div>;
  if (entries.length === 0) return <div style={{ padding: "12px 0", color: "var(--mc-text-soft)", fontSize: "12px" }}>No activity recorded</div>;

  return (
    <div>
      {entries.map((entry) => {
        const config = ACTION_CONFIG[entry.action] || { icon: "fa-circle", color: "var(--mc-text-soft)", label: entry.action };
        return (
          <div key={entry.id} style={entryStyle}>
            <div style={{ ...dotStyle, borderColor: config.color }}>
              <i className={`fa ${config.icon}`} style={{ color: config.color, fontSize: "10px" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", color: "var(--mc-text)" }}>{config.label}</div>
              <div style={{ fontSize: "11px", color: "var(--mc-text-soft)" }}>
                by {entry.actor} {formatRelativeTime(entry.created_at)}
                {getReasonText(entry.details) && (
                  <span style={{ marginLeft: "6px", color: "var(--mc-danger)" }}>— {getReasonText(entry.details)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const entryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "6px 0",
  borderLeft: "1px solid var(--mc-border-table)",
  marginLeft: "9px",
  paddingLeft: "14px",
  position: "relative",
};

const dotStyle: React.CSSProperties = {
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  border: "2px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--mc-bg)",
  position: "absolute",
  left: "-11px",
  flexShrink: 0,
};
