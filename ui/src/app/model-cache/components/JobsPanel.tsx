import {Select, SlidingPanel} from 'argo-ui';
import React, {useEffect, useState} from "react";

import {useCancelJob, useJobs, useRetryJob} from "../hooks/useJobs";
import {formatRelativeTime} from "../utils/formatters";
import {JobLogViewer} from "./JobLogViewer";
import {StatusBadge} from "./common/StatusBadge";

export const JobsPanel: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [logJobId, setLogJobId] = useState<string | null>(null);

  const { data, isLoading } = useJobs({ kind: kindFilter || undefined, status: statusFilter || undefined });
  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();

  useEffect(() => {
    if (!visible) {
      setLogJobId(null);
    }
  }, [visible]);

  return (
    <>
      <SlidingPanel
        hasCloseButton={true}
        hasNoPadding={true}
        header={<strong>Jobs</strong>}
        isNarrow={true}
        isShown={visible}
        onClose={onClose}>
        <div style={{padding: "16px", borderBottom: "1px solid var(--mc-border-table)", display: "flex", gap: "10px", flexWrap: "wrap"}}>
          <div className="model-cache-argo-select model-cache-argo-select--compact" style={{minWidth: 160, flex: "1 1 160px"}}>
            <Select
              value={kindFilter}
              options={[
                {title: "All Types", value: ""},
                {title: "Download", value: "download"},
                {title: "Delete", value: "hard_delete"},
                {title: "Integrity", value: "integrity_check"},
              ]}
              placeholder="All Types"
              onChange={option => setKindFilter(option.value)}
            />
          </div>
          <div className="model-cache-argo-select model-cache-argo-select--compact" style={{minWidth: 160, flex: "1 1 160px"}}>
            <Select
              value={statusFilter}
              options={[
                {title: "All Status", value: ""},
                {title: "Queued", value: "queued"},
                {title: "Running", value: "running"},
                {title: "Succeeded", value: "succeeded"},
                {title: "Failed", value: "failed"},
                {title: "Cancelled", value: "cancelled"},
              ]}
              placeholder="All Status"
              onChange={option => setStatusFilter(option.value)}
            />
          </div>
        </div>

        <div style={{padding: "16px 16px 24px"}}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--mc-text-soft)" }}>Loading...</div>
          ) : !data || data.items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--mc-text-soft)" }}>No jobs found</div>
          ) : (
            data.items.map((job) => (
              <div key={job.id} style={jobCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <i className={`fa ${kindIcon(job.kind)}`} style={{ color: "var(--mc-text-soft)", fontSize: "12px" }} />
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--mc-text)" }}>
                      {(job.parameters as Record<string, string>).repo_id || job.kind}
                    </span>
                  </div>
                  <StatusBadge status={job.status} size="small" />
                </div>
                <div style={{ fontSize: "11px", color: "var(--mc-text-soft)", marginBottom: "6px" }}>
                  {job.k8s_job_name || "pending"} | {formatRelativeTime(job.created_at)}
                  {job.result_message && <div style={{ marginTop: "2px" }}>{job.result_message}</div>}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {(job.status === "running" || job.status === "queued") && (
                    <button className="argo-button argo-button--base-o" onClick={() => cancelJob.mutate(job.id)}>Cancel</button>
                  )}
                  {job.status === "failed" && (
                    <button className="argo-button argo-button--base-o" onClick={() => retryJob.mutate(job.id)}>Retry</button>
                  )}
                  {job.k8s_job_name && (
                    <button className="argo-button argo-button--base-o" onClick={() => setLogJobId(job.id)}>
                      <i className="fa fa-file-text-o" style={{ marginRight: "4px" }} />
                      Logs
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SlidingPanel>

      {logJobId && <JobLogViewer jobId={logJobId} onClose={() => setLogJobId(null)} />}
    </>
  );
};

function kindIcon(kind: string): string {
  const icons: Record<string, string> = {
    download: "fa-download",
    hard_delete: "fa-trash",
    integrity_check: "fa-check-circle",
    rescan: "fa-refresh",
  };
  return icons[kind] || "fa-cog";
}

const jobCardStyle: React.CSSProperties = {
  padding: "10px 12px", backgroundColor: "var(--mc-bg-card-alt)", borderRadius: "6px",
  border: "1px solid var(--mc-border-table)", marginBottom: "8px",
};
