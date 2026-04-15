import React, { useState } from 'react';

interface AdvancedSectionProps {
  children: React.ReactNode;
  label?: string;
}

export function AdvancedSection({ children, label = 'Advanced Configuration' }: AdvancedSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="cext-advanced">
      <button
        type="button"
        className="cext-advanced-toggle"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="cext-chevron">&#9658;</span>
        {label}
      </button>
      {open && <div className="cext-advanced-body">{children}</div>}
    </div>
  );
}
