import React from "react";
import { useHealth } from "../hooks/useHealth";
import { formatBytes } from "../utils/formatters";

export const HealthSummaryCards: React.FC = () => {
  const { data, isLoading } = useHealth();

  if (isLoading || !data) {
    return <div style={containerStyle}>{[1, 2, 3, 4].map((i) => <div key={i} style={cardStyle}>Loading...</div>)}</div>;
  }

  const usagePercent = data.storage_total_bytes > 0
    ? Math.round((data.storage_used_bytes / data.storage_total_bytes) * 100)
    : 0;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={labelStyle}>Total Models</div>
        <div style={valueStyle}>{data.total_models}</div>
        <div style={subStyle}>
          {Object.entries(data.models_by_status)
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Active Jobs</div>
        <div style={{ ...valueStyle, color: data.active_jobs > 0 ? "var(--mc-accent)" : undefined }}>{data.active_jobs}</div>
        <div style={subStyle}>downloads & operations</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Nodes</div>
        <div style={valueStyle}>
          <span style={{ color: "var(--mc-success)" }}>{data.nodes_healthy}</span>
          {data.nodes_stale > 0 && <span style={{ color: "var(--mc-danger)" }}> / {data.nodes_stale} stale</span>}
        </div>
        <div style={subStyle}>{data.nodes_total} total</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Model Cache</div>
        <div style={valueStyle}>{formatBytes(data.models_total_size_bytes)}</div>
        <div style={{ ...subStyle, marginBottom: "6px" }}>
          {formatBytes(data.storage_free_bytes)} disk free of {formatBytes(data.storage_total_bytes)}
        </div>
        <div style={{ height: "4px", backgroundColor: "var(--mc-surface-muted)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: "2px",
            width: `${usagePercent}%`,
            backgroundColor: usagePercent > 85 ? "var(--mc-danger)" : usagePercent > 70 ? "var(--mc-warning)" : "var(--mc-success)",
          }} />
        </div>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--mc-bg-card-alt)", borderRadius: "8px", padding: "16px",
  border: "1px solid var(--mc-border-table)",
};

const labelStyle: React.CSSProperties = { fontSize: "11px", color: "var(--mc-text-soft)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" };
const valueStyle: React.CSSProperties = { fontSize: "24px", fontWeight: 700, color: "var(--mc-text)", marginBottom: "2px" };
const subStyle: React.CSSProperties = { fontSize: "12px", color: "var(--mc-text-soft)" };
