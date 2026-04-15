import React from 'react';
import type { JobResult } from '../types';

interface JobResultViewProps {
  job: JobResult;
}

function GitStatus({ result }: { result: Record<string, unknown> }) {
  const committed = result.git_committed;
  if (committed === null || committed === undefined) return null;

  const label = committed === true
    ? 'Committed to repo'
    : typeof result.git_commit_error === 'string'
      ? 'Commit queued for retry'
      : (result.git_commit_message as string) ?? 'Nothing committed';

  const badgeCls = committed === true
    ? 'cext-badge--success'
    : typeof result.git_commit_error === 'string'
      ? 'cext-badge--warning'
      : 'cext-badge--muted';

  return (
    <div className="cext-result__git-row">
      <i className="fa fa-code-fork" />
      <span className={`cext-badge ${badgeCls}`}>{label}</span>
      {typeof result.git_repo_artifact_name === 'string' && (
        <span style={{ color: 'var(--brand-text-muted)', fontSize: 11 }}>
          {result.git_repo_artifact_name}
        </span>
      )}
    </div>
  );
}

interface MetricGridProps {
  items: { label: string; value: string | number }[];
}
function MetricGrid({ items }: MetricGridProps) {
  return (
    <div className="cext-result__grid">
      {items.map(({ label, value }) => (
        <div key={label} className="cext-result__metric">
          <div className="cext-result__metric-label">{label}</div>
          <div className="cext-result__metric-value">{value}</div>
        </div>
      ))}
    </div>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

export function JobResultView({ job }: JobResultViewProps) {
  const { result, error } = job;

  if (error) {
    return (
      <div className="cext-result">
        <div className="cext-result__section">
          <div className="cext-result__section-title">Error</div>
          <pre style={{ color: 'var(--brand-status-error)', fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>
            {error}
          </pre>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const chosen = result.chosen_exp as string | undefined;
  const throughputs = result.best_throughputs as Record<string, number> | undefined;
  const latencies = result.best_latencies as Record<string, Record<string, number>> | undefined;

  return (
    <div className="cext-result">
      {chosen && (
        <div className="cext-result__section">
          <div className="cext-result__section-title">Recommendation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cext-badge cext-badge--success">{chosen.toUpperCase()}</span>
            <span style={{ fontSize: 12, color: 'var(--brand-text-secondary)' }}>
              selected deployment mode
            </span>
          </div>
        </div>
      )}

      {throughputs && Object.keys(throughputs).length > 0 && (
        <div className="cext-result__section">
          <div className="cext-result__section-title">Best Throughput (tokens/s)</div>
          <MetricGrid
            items={Object.entries(throughputs).map(([mode, val]) => ({
              label: mode.toUpperCase(),
              value: typeof val === 'number' ? val.toFixed(1) : '—',
            }))}
          />
        </div>
      )}

      {latencies && Object.keys(latencies).length > 0 && (
        <div className="cext-result__section">
          <div className="cext-result__section-title">Best Latency (ms)</div>
          <MetricGrid
            items={Object.entries(latencies).flatMap(([mode, lats]) =>
              Object.entries(lats ?? {}).map(([metric, val]) => ({
                label: `${mode.toUpperCase()} ${metric.toUpperCase()}`,
                value: renderValue(val),
              })),
            )}
          />
        </div>
      )}

      <div className="cext-result__section">
        <GitStatus result={result} />
      </div>
    </div>
  );
}
