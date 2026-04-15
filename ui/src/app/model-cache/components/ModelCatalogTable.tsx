import {Checkbox} from 'argo-ui';
import React from "react";
import type { ModelSummary } from "../api/types";
import { formatBytes, formatRelativeTime } from "../utils/formatters";
import { EmptyState } from "./common/EmptyState";
import { StatusBadge } from "./common/StatusBadge";

interface Props {
  models: ModelSummary[];
  total: number;
  page: number;
  totalPages: number;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (id: string) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

interface Tone {
  background: string;
  color: string;
}

function getStaleTone(iso: string): Tone {
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days > 90) return {color: "var(--mc-danger)", background: "var(--mc-danger-soft)"};
  if (days > 30) return {color: "var(--mc-warning)", background: "var(--mc-warning-soft)"};
  return {color: "var(--mc-text-soft)", background: "var(--mc-surface-muted)"};
}

const KIND_TONES: Record<string, Tone> = {
  full: {color: "var(--mc-success)", background: "var(--mc-success-soft)"},
  adapter: {color: "var(--mc-adapter)", background: "var(--mc-adapter-soft)"},
  tokenizer: {color: "var(--mc-warning)", background: "var(--mc-warning-soft)"},
  embedding: {color: "var(--mc-accent)", background: "var(--mc-accent-soft)"},
  unknown: {color: "var(--mc-text-soft)", background: "var(--mc-surface-muted)"},
};

function KindBadge({ kind }: { kind: string | null }) {
  if (!kind) return null;
  const tone = KIND_TONES[kind] || KIND_TONES.unknown;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        backgroundColor: tone.background,
        color: tone.color,
        borderRadius: "3px",
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
      }}
      title={`Model kind: ${kind}`}>
      {kind}
    </span>
  );
}

export const ModelCatalogTable: React.FC<Props> = ({
  models, total, page, totalPages, selectedIds,
  onSelect, onSelectAll, onRowClick, onPageChange, isLoading,
}) => {
  if (!isLoading && models.length === 0) {
    return <EmptyState icon="fa-database" title="No models found" message="Download a model to get started, or adjust your filters." />;
  }

  return (
    <div>
      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={{ ...thStyle, width: "32px" }}>
              <Checkbox checked={selectedIds.size === models.length && models.length > 0} onChange={onSelectAll} />
            </th>
            <th style={thStyle}>Model</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Size</th>
            <th style={thStyle}>Revision</th>
            <th style={thStyle}>Complete</th>
            <th style={thStyle}>Last Used</th>
            <th style={thStyle}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: "24px" }}>Loading...</td></tr>
          ) : (
            models.map((m) => (
              <tr
                key={m.id}
                style={{ ...rowStyle, backgroundColor: selectedIds.has(m.id) ? "var(--mc-bg-card-alt)" : undefined }}
                onClick={() => onRowClick(m.id)}>
                <td style={tdStyle} onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(m.id)} onChange={() => onSelect(m.id)} />
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: "var(--mc-text)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    {m.pinned && <i className="fa fa-thumb-tack" style={{ color: "var(--mc-warning)", fontSize: "11px" }} />}
                    <span>{m.display_name || m.repo_id}</span>
                    <KindBadge kind={m.model_kind} />
                    {m.duplicate_count > 0 && (
                      <span style={duplicateBadgeStyle} title={`${m.duplicate_count} other revision(s) of this model`}>
                        <i className="fa fa-clone" style={{ marginRight: "3px", fontSize: "9px" }} />
                        +{m.duplicate_count}
                      </span>
                    )}
                    {m.update_available && (
                      <span style={updateBadgeStyle} title="A newer version is available upstream">
                        <i className="fa fa-arrow-up" style={{ marginRight: "3px", fontSize: "9px" }} />
                        update
                      </span>
                    )}
                  </div>
                  {m.base_model && (
                    <div style={{ fontSize: "10px", color: "var(--mc-text-soft)", marginTop: "2px" }}>
                      <i className="fa fa-link" style={{ marginRight: "4px", fontSize: "9px" }} />
                      base: {m.base_model}
                    </div>
                  )}
                  {m.display_name && <div style={{ fontSize: "11px", color: "var(--mc-text-soft)" }}>{m.repo_id}</div>}
                  {Object.keys(m.labels).length > 0 && (
                    <div style={{ marginTop: "2px" }}>
                      {Object.entries(m.labels).map(([k, v]) => (
                        <span key={k} style={labelBadgeStyle}>{k}: {v}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={tdStyle}><StatusBadge status={m.status} size="small" /></td>
                <td style={tdStyle}><span style={{ fontSize: "12px", color: "var(--mc-text-soft)" }}>{m.source}</span></td>
                <td style={tdStyle}><span style={{ fontSize: "12px" }}>{formatBytes(m.total_size_bytes)}</span></td>
                <td style={tdStyle}><code style={{ fontSize: "11px", color: "var(--mc-text-soft)" }}>{m.revision}</code></td>
                <td style={tdStyle}>
                  <i
                    className={`fa ${m.is_complete ? "fa-check-circle" : "fa-exclamation-circle"}`}
                    style={{ color: m.is_complete ? "var(--mc-success)" : "var(--mc-warning)", fontSize: "13px" }}
                  />
                </td>
                <td style={tdStyle}>
                  {m.last_used_at ? (
                    <span style={{ fontSize: "12px", color: getStaleTone(m.last_used_at).color }}>
                      {formatRelativeTime(m.last_used_at)}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        backgroundColor: "var(--mc-warning-soft)",
                        color: "var(--mc-warning)",
                      }}>
                      never used
                    </span>
                  )}
                </td>
                <td style={tdStyle}><span style={{ fontSize: "12px", color: "var(--mc-text-soft)" }}>{formatRelativeTime(m.updated_at)}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={paginationStyle}>
          <span style={{ fontSize: "12px", color: "var(--mc-text-soft)" }}>{total} models</span>
          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={pageBtnStyle}>Prev</button>
            <span style={{ padding: "4px 8px", fontSize: "12px", color: "var(--mc-text)" }}>
              {page} / {totalPages}
            </span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} style={pageBtnStyle}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", fontSize: "13px",
};

const headerRowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--mc-border-table)",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px", textAlign: "left", color: "var(--mc-text-soft)", fontSize: "11px",
  textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px", borderBottom: "1px solid var(--mc-border-table)", verticalAlign: "top",
};

const rowStyle: React.CSSProperties = {
  cursor: "pointer", transition: "background-color 0.1s",
};

const labelBadgeStyle: React.CSSProperties = {
  display: "inline-block", padding: "1px 6px", marginRight: "4px",
  backgroundColor: "var(--mc-surface-muted)", borderRadius: "3px", fontSize: "10px", color: "var(--mc-text-soft)",
};

const updateBadgeStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", padding: "1px 6px",
  backgroundColor: "var(--mc-accent-soft)", borderRadius: "3px", fontSize: "10px",
  color: "var(--mc-accent)", fontWeight: 600, textTransform: "uppercase",
};

const duplicateBadgeStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", padding: "1px 6px",
  backgroundColor: "var(--mc-warning-soft)", borderRadius: "3px", fontSize: "10px",
  color: "var(--mc-warning)", fontWeight: 600,
};

const paginationStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 0",
};

const pageBtnStyle: React.CSSProperties = {
  padding: "4px 12px", backgroundColor: "var(--mc-surface-muted)", border: "1px solid var(--mc-border-surface)",
  borderRadius: "4px", color: "var(--mc-text)", cursor: "pointer", fontSize: "12px",
};
