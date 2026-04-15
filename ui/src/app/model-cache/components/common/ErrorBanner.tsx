import {ErrorNotification} from 'argo-ui';
import React from "react";

interface Props {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<Props> = ({ message, onRetry }) => (
  <div style={{
    padding: "12px 16px", backgroundColor: "var(--mc-danger-faint)", border: "1px solid var(--mc-danger)",
    borderRadius: "6px", display: "flex", alignItems: "center", gap: "12px",
    margin: "0 0 16px 0", color: "var(--mc-danger)", fontSize: "13px",
  }}>
    <span style={{ flex: 1 }}><ErrorNotification e={{message}} /></span>
    {onRetry && (
      <button onClick={onRetry} style={{
        padding: "4px 12px", borderRadius: "4px", border: "1px solid var(--mc-danger)",
        backgroundColor: "transparent", color: "var(--mc-danger)", cursor: "pointer", fontSize: "12px",
      }}>
        Retry
      </button>
    )}
  </div>
);
