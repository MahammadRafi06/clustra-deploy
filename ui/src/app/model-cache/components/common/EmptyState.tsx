import React from "react";

interface Props {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<Props> = ({ icon = "fa-inbox", title, message, action }) => (
  <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--mc-text-soft)" }}>
    <i className={`fa ${icon}`} style={{ fontSize: "48px", marginBottom: "16px", display: "block", opacity: 0.5 }} />
    <h3 style={{ margin: "0 0 8px 0", color: "var(--mc-text)", fontSize: "16px" }}>{title}</h3>
    {message && <p style={{ margin: "0 0 16px 0", fontSize: "13px" }}>{message}</p>}
    {action}
  </div>
);
