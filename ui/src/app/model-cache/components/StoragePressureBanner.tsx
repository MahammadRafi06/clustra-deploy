import React from "react";
import type { SystemHealth } from "../api/types";
import { formatBytes } from "../utils/formatters";

interface Props {
  health: SystemHealth;
}

const PRESSURE_CONFIG: Record<string, { icon: string; color: string; bg: string; message: string }> = {
  warning: {
    icon: "fa-exclamation-triangle",
    color: "var(--mc-warning)",
    bg: "var(--mc-warning-soft)",
    message: "Storage usage above 70%.",
  },
  critical: {
    icon: "fa-exclamation-circle",
    color: "var(--mc-danger)",
    bg: "var(--mc-danger-soft)",
    message: "Storage usage above 85%. Consider removing unused models.",
  },
  emergency: {
    icon: "fa-ban",
    color: "var(--mc-danger)",
    bg: "var(--mc-danger-soft)",
    message: "Storage nearly full (>95%). Downloads may fail. Remove models immediately.",
  },
};

export const StoragePressureBanner: React.FC<Props> = ({ health }) => {
  const config = PRESSURE_CONFIG[health.storage_pressure];
  if (!config) return null;

  return (
    <div style={{ ...bannerStyle, backgroundColor: config.bg, borderColor: config.color }}>
      <i className={`fa ${config.icon}`} style={{ color: config.color, fontSize: "15px" }} />
      <div style={{ flex: 1 }}>
        <span style={{ color: config.color, fontWeight: 600 }}>{config.message}</span>
        <span style={{ color: "var(--mc-text-soft)", marginLeft: "8px" }}>
          {health.storage_usage_percent}% used — {formatBytes(health.storage_free_bytes)} free of {formatBytes(health.storage_total_bytes)}
        </span>
      </div>
    </div>
  );
};

const bannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 16px",
  borderRadius: "6px",
  border: "1px solid",
  marginBottom: "12px",
  fontSize: "13px",
};
