import {SlidingPanel} from 'argo-ui';
import React, { useEffect, useState } from "react";

import * as api from "../api/client";
import type { ModelDetail, RelatedModel } from "../api/types";
import { formatBytes, formatDate, formatRelativeTime } from "../utils/formatters";
import { AuditTimeline } from "./AuditTimeline";
import { StatusBadge } from "./common/StatusBadge";

interface Props {
  model: ModelDetail | null;
  isLoading: boolean;
  airgapped?: boolean;
  onClose: () => void;
  onSoftDelete: (id: string) => void;
  onHardDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onIntegrityCheck: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export const ModelDetailDrawer: React.FC<Props> = ({
  model: initialModel,
  isLoading,
  airgapped,
  onClose,
  onSoftDelete,
  onHardDelete,
  onRestore,
  onIntegrityCheck,
  onTogglePin,
}) => {
  const [model, setModel] = useState(initialModel);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [related, setRelated] = useState<RelatedModel[]>([]);

  React.useEffect(() => {
    setModel(initialModel);
  }, [initialModel]);

  useEffect(() => {
    if (initialModel?.id) {
      api.getRelatedModels(initialModel.id).then(setRelated).catch(() => setRelated([]));
    }
  }, [initialModel?.id]);

  const handleCheckVersion = async () => {
    if (!model) {
      return;
    }
    setCheckingVersion(true);
    try {
      const updated = await api.checkModelVersion(model.id);
      setModel(updated);
    } catch (error) {
      console.error("Version check failed:", error);
    } finally {
      setCheckingVersion(false);
    }
  };

  if (!model && !isLoading) {
    return null;
  }

  const header = (
    <div style={{display: "flex", alignItems: "center", gap: "10px", maxWidth: "100%", minWidth: 0}}>
      <strong style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
        {model?.display_name || model?.repo_id || "Model Details"}
      </strong>
      {!isLoading && model && <StatusBadge status={model.status} />}
    </div>
  );

  return (
    <SlidingPanel
      hasCloseButton={true}
      hasNoPadding={true}
      header={header}
      isMiddle={true}
      isShown={!!model || isLoading}
      onClose={onClose}>
      {isLoading || !model ? (
        <div style={{ padding: "24px", color: "var(--mc-text-soft)" }}>Loading...</div>
      ) : (
        <>
          <div style={sectionStyle}>
            <div style={{ fontSize: "12px", color: "var(--mc-text-soft)" }}>{model.repo_id}</div>
          </div>

          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Metadata</h4>
            <div style={gridStyle}>
              <MetaField label="Source" value={model.source} />
              <MetaField label="Revision" value={model.revision} />
              <MetaField label="Size" value={formatBytes(model.total_size_bytes)} />
              <MetaField label="Files" value={model.file_count?.toString() || "-"} />
              <MetaField label="Format" value={model.format || "-"} />
              <MetaField label="Task Type" value={model.task_type || "-"} />
              <MetaField label="SHA256" value={model.sha256 ? model.sha256.substring(0, 12) + "..." : "-"} />
              <MetaField label="Created By" value={model.created_by || "-"} />
              <MetaField label="Created" value={formatDate(model.created_at)} />
              <MetaField label="Updated" value={formatRelativeTime(model.updated_at)} />
            </div>
            {Object.keys(model.labels).length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--mc-text-soft)" }}>Labels: </span>
                {Object.entries(model.labels).map(([key, value]) => (
                  <span key={key} style={labelBadge}>{key}: {value}</span>
                ))}
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Cache Status</h4>
            <div style={gridStyle}>
              <MetaField label="Complete" value={model.is_complete ? "Yes" : "No (partial)"} />
              <MetaField label="Kind" value={model.model_kind || "unknown"} />
              <MetaField label="Disk Path" value={model.disk_path || "-"} />
              <MetaField label="Last Scanned" value={model.last_scanned_at ? formatRelativeTime(model.last_scanned_at) : "Never"} />
              {model.base_model && <MetaField label="Base Model" value={model.base_model} />}
            </div>
          </div>

          {related.length > 0 && (
            <div style={sectionStyle}>
              <h4 style={sectionTitleStyle}>Related Models ({related.length})</h4>
              {related.map((relatedModel) => {
                const tone = relationshipTone(relatedModel.relationship);
                return (
                  <div key={relatedModel.id} style={relatedRowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", color: "var(--mc-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {relatedModel.repo_id}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--mc-text-soft)" }}>
                        {relatedModel.revision} · {relatedModel.model_kind || "unknown"}
                      </div>
                    </div>
                    <span
                      style={{
                        ...relationshipBadgeStyle,
                        color: tone.color,
                        backgroundColor: tone.background,
                      }}>
                      {relatedModel.relationship}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {!airgapped && (
            <div style={sectionStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
                <h4 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Version</h4>
                <button
                  className="argo-button argo-button--base-o"
                  disabled={checkingVersion}
                  onClick={handleCheckVersion}>
                  <i className={`fa fa-cloud${checkingVersion ? " fa-spin" : ""}`} style={{ marginRight: "4px" }} />
                  {checkingVersion ? "Checking..." : "Check upstream"}
                </button>
              </div>
              {model.update_available && (
                <div
                  style={{
                    padding: "8px 12px",
                    marginBottom: "10px",
                    backgroundColor: "var(--mc-accent-soft)",
                    borderLeft: "3px solid var(--mc-accent)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "var(--mc-accent)",
                  }}>
                  <i className="fa fa-arrow-up" style={{ marginRight: "6px" }} />
                  A newer version is available upstream. Re-download to update.
                </div>
              )}
              <div style={gridStyle}>
                <MetaField label="Local SHA" value={model.sha256 ? model.sha256.substring(0, 12) : "-"} />
                <MetaField label="Upstream SHA" value={model.upstream_sha256 ? model.upstream_sha256.substring(0, 12) : "-"} />
                <MetaField label="Last Checked" value={model.upstream_checked_at ? formatRelativeTime(model.upstream_checked_at) : "Never"} />
              </div>
            </div>
          )}

          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Activity</h4>
            <AuditTimeline modelId={model.id} />
          </div>

          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Actions</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button className="argo-button argo-button--base-o" onClick={() => onTogglePin(model.id, !model.pinned)}>
                <i className="fa fa-thumb-tack" style={{ marginRight: "4px" }} />
                {model.pinned ? "Unpin" : "Pin"}
              </button>
              <button className="argo-button argo-button--base-o" onClick={() => onIntegrityCheck(model.id)}>
                <i className="fa fa-check-circle" style={{ marginRight: "4px" }} />
                Check Integrity
              </button>
              {model.status === "soft_deleted" ? (
                <button className="argo-button argo-button--base-o" onClick={() => onRestore(model.id)} style={{borderColor: "var(--mc-success)", color: "var(--mc-success)"}}>
                  <i className="fa fa-undo" style={{ marginRight: "4px" }} />
                  Restore
                </button>
              ) : (
                <button className="argo-button argo-button--base-o" onClick={() => onSoftDelete(model.id)} style={{borderColor: "var(--mc-warning)", color: "var(--mc-warning)"}}>
                  <i className="fa fa-eye-slash" style={{ marginRight: "4px" }} />
                  Soft Delete
                </button>
              )}
              <button className="argo-button argo-button--base-o" onClick={() => onHardDelete(model.id)} style={{borderColor: "var(--mc-danger)", color: "var(--mc-danger)"}}>
                <i className="fa fa-trash" style={{ marginRight: "4px" }} />
                Hard Delete
              </button>
            </div>
          </div>
        </>
      )}
    </SlidingPanel>
  );
};

const MetaField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: "10px", color: "var(--mc-text-soft)", textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: "13px", color: "var(--mc-text)", wordBreak: "break-all" }}>{value}</div>
  </div>
);

const sectionStyle: React.CSSProperties = { padding: "16px 20px", borderBottom: "1px solid var(--mc-border-table)" };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 12px 0", fontSize: "13px", color: "var(--mc-text-soft)", textTransform: "uppercase", letterSpacing: "0.5px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" };
const labelBadge: React.CSSProperties = {
  display: "inline-block", padding: "2px 8px", marginRight: "4px", marginBottom: "4px",
  backgroundColor: "var(--mc-surface-muted)", borderRadius: "3px", fontSize: "11px", color: "var(--mc-text-soft)",
};
const relatedRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
  border: "1px solid var(--mc-border-table)", borderRadius: "6px", backgroundColor: "var(--mc-bg-card-alt)", marginBottom: "8px",
};
const relationshipBadgeStyle: React.CSSProperties = {
  display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
};

function relationshipTone(relationship: string): {background: string; color: string} {
  switch (relationship) {
    case "adapter_of":
      return {color: "var(--mc-adapter)", background: "var(--mc-adapter-soft)"};
    case "tokenizer_of":
      return {color: "var(--mc-warning)", background: "var(--mc-warning-soft)"};
    case "duplicate_of":
      return {color: "var(--mc-accent)", background: "var(--mc-accent-soft)"};
    default:
      return {color: "var(--mc-text-soft)", background: "var(--mc-surface-muted)"};
  }
}
