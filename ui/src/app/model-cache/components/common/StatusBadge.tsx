import React from "react";
import { statusTone } from "../../utils/formatters";

interface Props {
  status: string;
  size?: "small" | "normal";
}

export const StatusBadge: React.FC<Props> = ({ status, size = "normal" }) => {
  const tone = statusTone(status);
  const label = status.replace(/_/g, " ");
  const fontSize = size === "small" ? "11px" : "12px";
  const padding = size === "small" ? "1px 6px" : "2px 8px";

  return (
    <span
      style={{
        display: "inline-block",
        padding,
        borderRadius: "4px",
        backgroundColor: tone.background,
        color: tone.color,
        fontSize,
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};
