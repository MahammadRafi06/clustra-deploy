import {SlidingPanel} from 'argo-ui';
import React, { useEffect, useState } from "react";
import * as api from "../api/client";
import type { PresetSummary } from "../api/types";
import { formatRelativeTime } from "../utils/formatters";

interface Props {
  visible: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const PresetsPanel: React.FC<Props> = ({ visible, onClose, onToast }) => {
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetch = () => {
    setLoading(true);
    api.listPresets().then(setPresets).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) fetch();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setShowCreate(false);
    }
  }, [visible]);

  const handleApply = async (preset: PresetSummary) => {
    try {
      const result = await api.applyPreset(preset.id);
      onToast(`Preset "${preset.name}": ${result.triggered.length} triggered, ${result.skipped.length} skipped`);
    } catch (e) {
      onToast(`Failed to apply preset: ${e}`);
    }
  };

  const handleDelete = async (preset: PresetSummary) => {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await api.deletePreset(preset.id);
      onToast(`Deleted preset "${preset.name}"`);
      fetch();
    } catch (e) {
      onToast(`Failed to delete preset: ${e}`);
    }
  };

  return (
    <>
      <SlidingPanel
        hasCloseButton={true}
        hasNoPadding={true}
        header={<strong>Cache Warmup Presets</strong>}
        isNarrow={true}
        isShown={visible}
        onClose={onClose}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mc-border-table)" }}>
          <button className="argo-button argo-button--base" onClick={() => setShowCreate(true)}>
            <i className="fa fa-plus" style={{ marginRight: "6px" }} />New Preset
          </button>
        </div>

        <div style={{ padding: "12px 16px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--mc-text-soft)" }}>Loading...</div>
          ) : presets.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--mc-text-soft)", padding: "24px" }}>
              No presets yet. Create one to bundle related models.
            </div>
          ) : (
            presets.map((p) => (
              <div key={p.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--mc-text)", fontSize: "13px" }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: "11px", color: "var(--mc-text-soft)", marginTop: "2px" }}>{p.description}</div>}
                    <div style={{ fontSize: "11px", color: "var(--mc-text-soft)", marginTop: "4px" }}>
                      {p.model_count} models · {formatRelativeTime(p.updated_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <button className="argo-button argo-button--base-o" onClick={() => handleApply(p)} style={{ color: "var(--mc-accent)", borderColor: "var(--mc-accent)" }}>
                    <i className="fa fa-cloud-download" style={{ marginRight: "4px" }} />Apply
                  </button>
                  <button className="argo-button argo-button--base-o" onClick={() => handleDelete(p)} style={{ color: "var(--mc-danger)", borderColor: "var(--mc-danger)" }}>
                    <i className="fa fa-trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </SlidingPanel>

      {showCreate && (
        <CreatePresetModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetch(); onToast("Preset created"); }}
        />
      )}
    </>
  );
};

const CreatePresetModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addModel = () => {
    if (modelInput.trim() && !models.includes(modelInput.trim())) {
      setModels([...models, modelInput.trim()]);
      setModelInput("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createPreset({
        name,
        description: description || undefined,
        models: models.map((m) => ({ repo_id: m, source: "huggingface", revision: "main" })),
      });
      onCreated();
    } catch (e) {
      alert(`Failed: ${e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ margin: "0 0 16px 0", color: "var(--mc-text)" }}>Create Preset</h3>
        <form onSubmit={submit}>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="production-llm-stack" />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} placeholder="Optional" />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Models</label>
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              <input
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addModel(); } }}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="org/model-name"
              />
              <button type="button" onClick={addModel} style={addBtnStyle}>Add</button>
            </div>
            {models.map((m) => (
              <div key={m} style={modelChipStyle}>
                {m}
                <i className="fa fa-times" style={{ marginLeft: "6px", cursor: "pointer" }}
                   onClick={() => setModels(models.filter((x) => x !== m))} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={submitting || !name || models.length === 0} style={submitBtnStyle}>
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  padding: "12px", backgroundColor: "var(--mc-bg-card-alt)", borderRadius: "6px",
  border: "1px solid var(--mc-border-table)", marginBottom: "8px",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "var(--mc-bg-card)", borderRadius: "8px", padding: "24px",
  width: "480px", maxHeight: "80vh", overflowY: "auto", color: "var(--mc-text)",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "12px", color: "var(--mc-text-soft)", marginBottom: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", backgroundColor: "var(--mc-bg)",
  border: "1px solid var(--mc-border-surface)", borderRadius: "4px", color: "var(--mc-text)",
  fontSize: "13px", boxSizing: "border-box",
};

const addBtnStyle: React.CSSProperties = {
  padding: "8px 12px", backgroundColor: "var(--mc-surface-muted)", border: "1px solid var(--mc-border-surface)",
  borderRadius: "4px", color: "var(--mc-text)", cursor: "pointer", fontSize: "12px",
};

const modelChipStyle: React.CSSProperties = {
  display: "inline-block", padding: "3px 8px", marginRight: "4px", marginBottom: "4px",
  backgroundColor: "var(--mc-surface-muted)", borderRadius: "3px", fontSize: "11px", color: "var(--mc-text)",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "4px", border: "1px solid var(--mc-border-surface)",
  backgroundColor: "transparent", color: "var(--mc-text)", cursor: "pointer",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "8px 20px", borderRadius: "4px", border: "none",
  backgroundColor: "var(--mc-accent)", color: "var(--mc-text-inverse)", cursor: "pointer", fontWeight: 600,
};
