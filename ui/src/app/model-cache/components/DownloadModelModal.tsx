import {Select} from 'argo-ui';
import React, { useState } from "react";
import type { DownloadRequest } from "../api/types";

interface Props {
  onSubmit: (req: DownloadRequest) => void;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
}

export const DownloadModelModal: React.FC<Props> = ({ onSubmit, onClose, isLoading, error }) => {
  const [form, setForm] = useState<DownloadRequest>({
    repo_id: "",
    source: "huggingface",
    revision: "main",
    target_pvc: "model-cache",
    target_namespace: "model-cache",
    labels: {},
    display_name: "",
  });
  const [labelKey, setLabelKey] = useState("");
  const [labelValue, setLabelValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const addLabel = () => {
    if (labelKey && labelValue) {
      setForm({ ...form, labels: { ...form.labels, [labelKey]: labelValue } });
      setLabelKey("");
      setLabelValue("");
    }
  };

  const removeLabel = (key: string) => {
    const next = { ...form.labels };
    delete next[key];
    setForm({ ...form, labels: next });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ margin: "0 0 16px 0", color: "var(--mc-text)" }}>Download New Model</h3>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Source</label>
            <div className="model-cache-argo-select">
              <Select
                value={form.source}
                options={[
                  {title: 'Hugging Face', value: 'huggingface'},
                  {title: 'Git Repository', value: 'git'},
                ]}
                placeholder="Choose a source"
                onChange={option => setForm({...form, source: option.value})}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              {form.source === "huggingface" ? "Model ID" : "Repository URL"}
            </label>
            <input
              type="text"
              value={form.repo_id}
              onChange={(e) => setForm({ ...form, repo_id: e.target.value })}
              placeholder={form.source === "huggingface" ? "nvidia/DeepSeek-V3.2-NVFP4" : "https://github.com/org/model.git"}
              style={inputStyle}
              required
              autoFocus
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Revision / Branch / Tag</label>
            <input
              type="text"
              value={form.revision}
              onChange={(e) => setForm({ ...form, revision: e.target.value })}
              placeholder="main"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Display Name (optional)</label>
            <input
              type="text"
              value={form.display_name || ""}
              onChange={(e) => setForm({ ...form, display_name: e.target.value || undefined })}
              placeholder="Friendly name for the model"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Target PVC</label>
              <input type="text" value={form.target_pvc} onChange={(e) => setForm({ ...form, target_pvc: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>Namespace</label>
              <input type="text" value={form.target_namespace} onChange={(e) => setForm({ ...form, target_namespace: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Labels</label>
            <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
              <input type="text" value={labelKey} onChange={(e) => setLabelKey(e.target.value)} placeholder="key" style={{ ...inputStyle, flex: 1 }} />
              <input type="text" value={labelValue} onChange={(e) => setLabelValue(e.target.value)} placeholder="value" style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={addLabel} style={addBtnStyle}>Add</button>
            </div>
            {form.labels && Object.entries(form.labels).map(([k, v]) => (
              <span key={k} style={labelBadge}>
                {k}: {v}
                <i className="fa fa-times" style={{ marginLeft: "4px", cursor: "pointer" }} onClick={() => removeLabel(k)} />
              </span>
            ))}
          </div>

          {error && <div style={{ color: "var(--mc-danger)", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={isLoading || !form.repo_id} style={submitBtnStyle}>
              {isLoading ? "Starting..." : "Download"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "var(--mc-bg-card)", borderRadius: "8px", padding: "24px",
  width: "520px", maxHeight: "80vh", overflowY: "auto", color: "var(--mc-text)",
};

const fieldStyle: React.CSSProperties = { marginBottom: "12px" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", color: "var(--mc-text-soft)", marginBottom: "4px" };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", backgroundColor: "var(--mc-bg)",
  border: "1px solid var(--mc-border-surface)", borderRadius: "4px", color: "var(--mc-text)",
  fontSize: "13px", boxSizing: "border-box",
};

const addBtnStyle: React.CSSProperties = {
  padding: "8px 12px", backgroundColor: "var(--mc-surface-muted)", border: "1px solid var(--mc-border-surface)",
  borderRadius: "4px", color: "var(--mc-text)", cursor: "pointer", fontSize: "12px",
};

const labelBadge: React.CSSProperties = {
  display: "inline-block", padding: "2px 8px", marginRight: "4px", marginBottom: "4px",
  backgroundColor: "var(--mc-surface-muted)", borderRadius: "3px", fontSize: "11px", color: "var(--mc-text-soft)",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "4px", border: "1px solid var(--mc-border-surface)",
  backgroundColor: "transparent", color: "var(--mc-text)", cursor: "pointer",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "8px 20px", borderRadius: "4px", border: "none",
  backgroundColor: "var(--mc-accent)", color: "var(--mc-text-inverse)", cursor: "pointer", fontWeight: 600,
};
