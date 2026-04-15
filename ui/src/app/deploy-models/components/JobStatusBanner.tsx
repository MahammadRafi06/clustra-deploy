import React, { useEffect, useRef, useState } from 'react';
import type { JobStatus } from '../types';

interface JobStatusBannerProps {
  jobId: string;
  status: JobStatus;
  onCancel: () => void;
  cancelling: boolean;
}

function statusLabel(s: JobStatus): string {
  switch (s) {
    case 'pending':   return 'Queued…';
    case 'running':   return 'Running…';
    case 'success':   return 'Completed';
    case 'failed':    return 'Failed';
    case 'cancelled': return 'Cancelled';
  }
}

function badgeClass(s: JobStatus): string {
  switch (s) {
    case 'success':   return 'cext-badge--success';
    case 'failed':    return 'cext-badge--error';
    case 'cancelled': return 'cext-badge--warning';
    default:          return 'cext-badge--info';
  }
}

export function JobStatusBanner({ jobId, status, onCancel, cancelling }: JobStatusBannerProps) {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const isTerminal = status === 'success' || status === 'failed' || status === 'cancelled';

  useEffect(() => {
    if (isTerminal) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isTerminal]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedStr = mins > 0
    ? `${mins}m ${secs}s`
    : `${secs}s`;

  return (
    <div className="cext-banner">
      <div className="cext-banner__left">
        {!isTerminal && <span className="cext-spinner" />}
        <div className="cext-banner__text">
          <div className="cext-banner__title">
            <span className={`cext-badge ${badgeClass(status)}`}>{statusLabel(status)}</span>
          </div>
          <div className="cext-banner__sub">
            Job {jobId.slice(0, 8)}…
            {!isTerminal && ` · ${elapsedStr}`}
          </div>
        </div>
      </div>
      {!isTerminal && (
        <button
          type="button"
          className="argo-button argo-button--base-o cext-btn cext-btn--danger"
          onClick={onCancel}
          disabled={cancelling}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
    </div>
  );
}
