import {Select} from 'argo-ui';
import React from "react";
import { MODEL_STATUS_OPTIONS, SOURCE_OPTIONS, SORT_OPTIONS } from "../utils/constants";

interface Filters {
  search: string;
  status: string;
  source: string;
  sort_by: string;
  sort_order: string;
  pinned: boolean | undefined;
  stale_days: number | undefined;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onRefresh: () => void;
  onRescan: () => void;
  onDownload: () => void;
  refreshing?: boolean;
  rescanning?: boolean;
  airgapped?: boolean;
}

export const FilterToolbar: React.FC<Props> = ({ filters, onChange, onRefresh, onRescan, onDownload, refreshing, rescanning, airgapped }) => {
  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <div style={toolbarStyle}>
      <input
        type="text"
        placeholder="Search models..."
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
        style={inputStyle}
      />

      <div className="model-cache-argo-select model-cache-argo-select--compact" style={{minWidth: 150}}>
        <Select
          value={filters.status}
          options={[{title: 'All Status', value: ''}, ...MODEL_STATUS_OPTIONS.map(option => ({title: option.label, value: option.value}))]}
          placeholder="All Status"
          onChange={option => update({status: option.value})}
        />
      </div>

      <div className="model-cache-argo-select model-cache-argo-select--compact" style={{minWidth: 150}}>
        <Select
          value={filters.source}
          options={[{title: 'All Sources', value: ''}, ...SOURCE_OPTIONS.map(option => ({title: option.label, value: option.value}))]}
          placeholder="All Sources"
          onChange={option => update({source: option.value})}
        />
      </div>

      <div className="model-cache-argo-select model-cache-argo-select--compact" style={{minWidth: 170}}>
        <Select
          value={filters.sort_by}
          options={SORT_OPTIONS.map(option => ({title: `Sort: ${option.label}`, value: option.value}))}
          placeholder="Sort"
          onChange={option => update({sort_by: option.value})}
        />
      </div>

      <button
        onClick={() => update({ sort_order: filters.sort_order === "desc" ? "asc" : "desc" })}
        style={btnStyle}
        title={filters.sort_order === "desc" ? "Descending" : "Ascending"}
      >
        <i className={`fa fa-sort-amount-${filters.sort_order === "desc" ? "desc" : "asc"}`} />
      </button>

      <button
        onClick={() => update({ pinned: filters.pinned === true ? undefined : true })}
        style={{ ...btnStyle, color: filters.pinned ? "var(--mc-warning)" : undefined }}
        title="Show pinned only"
      >
        <i className="fa fa-thumb-tack" />
      </button>

      <div className="model-cache-argo-select model-cache-argo-select--compact" style={{minWidth: 150}} title="Show models not used recently">
        <Select
          value={filters.stale_days != null ? String(filters.stale_days) : ''}
          options={[
            {title: 'All Models', value: ''},
            {title: 'Stale > 7d', value: '7'},
            {title: 'Stale > 30d', value: '30'},
            {title: 'Stale > 90d', value: '90'},
          ]}
          placeholder="All Models"
          onChange={option => update({stale_days: option.value ? Number(option.value) : undefined})}
        />
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{ ...btnStyle, opacity: refreshing ? 0.5 : 1, cursor: refreshing ? "wait" : "pointer" }}
        title="Refresh data"
      >
        <i className={`fa fa-refresh${refreshing ? " fa-spin" : ""}`} />
      </button>

      <button
        onClick={onRescan}
        disabled={rescanning}
        style={{ ...btnStyle, opacity: rescanning ? 0.5 : 1, cursor: rescanning ? "wait" : "pointer" }}
        title="Force agent rescan of disk"
      >
        <i className={`fa fa-hdd-o${rescanning ? " fa-spin" : ""}`} style={{ marginRight: "4px" }} />
        {rescanning ? "Rescanning..." : "Rescan"}
      </button>

      {!airgapped && (
        <button onClick={onDownload} style={primaryBtnStyle}>
          <i className="fa fa-download" style={{ marginRight: "6px" }} />
          Download Model
        </button>
      )}
    </div>
  );
};

const toolbarStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 12px", backgroundColor: "var(--mc-bg)", border: "1px solid var(--mc-border-surface)",
  borderRadius: "4px", color: "var(--mc-text)", fontSize: "13px", width: "220px",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 10px", backgroundColor: "var(--mc-surface-muted)", border: "1px solid var(--mc-border-surface)",
  borderRadius: "4px", color: "var(--mc-text)", cursor: "pointer", fontSize: "13px",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "6px 16px", backgroundColor: "var(--mc-accent)", border: "none",
  borderRadius: "4px", color: "var(--mc-text-inverse)", cursor: "pointer", fontSize: "13px", fontWeight: 600,
};
