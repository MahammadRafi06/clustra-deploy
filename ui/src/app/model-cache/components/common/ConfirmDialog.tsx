import React, { useState } from "react";

interface Props {
  title: string;
  message: string;
  confirmText?: string;
  confirmValue?: string; // If set, user must type this to confirm
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({
  title,
  message,
  confirmText = "Confirm",
  confirmValue,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState("");
  const canConfirm = !confirmValue || inputValue === confirmValue;

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>{title}</h3>
        <p style={{ margin: "0 0 16px 0", color: "var(--mc-text-soft)", fontSize: "13px" }}>
          {message}
        </p>
        {confirmValue && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", color: "var(--mc-text-soft)", display: "block", marginBottom: "4px" }}>
              Type <strong>{confirmValue}</strong> to confirm
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              ...confirmBtnStyle,
              backgroundColor: danger ? "var(--mc-danger)" : "var(--mc-accent)",
              opacity: canConfirm ? 1 : 0.5,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  backgroundColor: "var(--mc-bg-card)", borderRadius: "8px", padding: "24px",
  minWidth: "400px", maxWidth: "500px", color: "var(--mc-text)",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px", backgroundColor: "var(--mc-bg)",
  border: "1px solid var(--mc-border-surface)", borderRadius: "4px", color: "var(--mc-text)",
  fontSize: "13px", boxSizing: "border-box",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "6px 16px", borderRadius: "4px", border: "1px solid var(--mc-border-surface)",
  backgroundColor: "transparent", color: "var(--mc-text)", cursor: "pointer", fontSize: "13px",
};

const confirmBtnStyle: React.CSSProperties = {
  padding: "6px 16px", borderRadius: "4px", border: "none",
  color: "var(--mc-text-inverse)", cursor: "pointer", fontSize: "13px", fontWeight: 600,
};
