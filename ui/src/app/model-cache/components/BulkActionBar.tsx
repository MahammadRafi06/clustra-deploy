import React from "react";

interface Props {
  selectedCount: number;
  onSoftDelete: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onClear: () => void;
}

export const BulkActionBar: React.FC<Props> = ({ selectedCount, onSoftDelete, onPin, onUnpin, onClear }) => {
  if (selectedCount === 0) return null;

  return (
    <div style={barStyle}>
      <span style={{ fontSize: "13px", color: "var(--mc-text)" }}>
        {selectedCount} model{selectedCount > 1 ? "s" : ""} selected
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onPin} style={btnStyle}><i className="fa fa-thumb-tack" style={{ marginRight: "4px" }} />Pin</button>
        <button onClick={onUnpin} style={btnStyle}><i className="fa fa-thumb-tack" style={{ marginRight: "4px", opacity: 0.5 }} />Unpin</button>
        <button onClick={onSoftDelete} style={{ ...btnStyle, borderColor: "var(--mc-warning)", color: "var(--mc-warning)" }}>
          <i className="fa fa-eye-slash" style={{ marginRight: "4px" }} />Soft Delete
        </button>
        <button onClick={onClear} style={btnStyle}>Clear</button>
      </div>
    </div>
  );
};

const barStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "8px 16px", backgroundColor: "var(--mc-bg-card-alt)", borderRadius: "6px",
  border: "1px solid var(--mc-border-surface)", marginBottom: "8px",
};

const btnStyle: React.CSSProperties = {
  padding: "4px 12px", backgroundColor: "transparent", border: "1px solid var(--mc-border-surface)",
  borderRadius: "4px", color: "var(--mc-text)", cursor: "pointer", fontSize: "12px",
};
