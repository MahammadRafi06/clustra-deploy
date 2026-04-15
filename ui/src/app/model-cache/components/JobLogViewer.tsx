import React, { useEffect, useRef, useState } from "react";
import { streamJobLogs } from "../api/client";

interface Props {
  jobId: string;
  onClose: () => void;
}

export const JobLogViewer: React.FC<Props> = ({ jobId, onClose }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
    const stop = streamJobLogs(jobId, {
      onOpen: () => setConnected(true),
      onMessage: (line) => {
        setLines((prev) => [...prev, line]);
      },
      onDone: () => {
        setConnected(false);
      },
      onError: (message) => {
        setConnected(false);
        setLines((prev) => [...prev, `Log stream error: ${message}`]);
      },
    });

    return () => {
      stop();
      setConnected(false);
    };
  }, [jobId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const copyLogs = () => {
    navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--mc-text)" }}>Job Logs</h3>
            <span style={{ fontSize: "11px", color: connected ? "var(--mc-success)" : "var(--mc-text-soft)" }}>
              {connected ? "streaming" : "disconnected"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={copyLogs} style={btnStyle} title="Copy logs">
              <i className="fa fa-copy" />
            </button>
            <button onClick={onClose} style={btnStyle}>
              <i className="fa fa-times" />
            </button>
          </div>
        </div>
        <div ref={containerRef} style={logContainerStyle}>
          {lines.length === 0 ? (
            <div style={{ color: "var(--mc-text-soft)" }}>Waiting for logs...</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} style={logLineStyle}>{line}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.6)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1100,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "var(--mc-bg)", borderRadius: "8px", border: "1px solid var(--mc-border-table)",
  width: "800px", maxHeight: "80vh", display: "flex", flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 16px", borderBottom: "1px solid var(--mc-border-table)",
};

const btnStyle: React.CSSProperties = {
  padding: "4px 8px", backgroundColor: "transparent", border: "none",
  color: "var(--mc-text-soft)", cursor: "pointer", fontSize: "14px",
};

const logContainerStyle: React.CSSProperties = {
  flex: 1, overflowY: "auto", padding: "12px 16px",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "12px",
  lineHeight: "1.6", minHeight: "300px", maxHeight: "60vh",
};

const logLineStyle: React.CSSProperties = {
  color: "var(--mc-text)", whiteSpace: "pre-wrap", wordBreak: "break-all",
};
