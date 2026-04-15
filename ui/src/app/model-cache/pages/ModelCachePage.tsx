import React, { useCallback, useState } from "react";

import * as api from "../api/client";
import type { DownloadRequest } from "../api/types";
import { BulkActionBar } from "../components/BulkActionBar";
import { DownloadModelModal } from "../components/DownloadModelModal";
import { FilterToolbar } from "../components/FilterToolbar";
import { HealthSummaryCards } from "../components/HealthSummaryCards";
import { JobsPanel } from "../components/JobsPanel";
import { ModelCatalogTable } from "../components/ModelCatalogTable";
import { ModelDetailDrawer } from "../components/ModelDetailDrawer";
import { PresetsPanel } from "../components/PresetsPanel";
import { StoragePressureBanner } from "../components/StoragePressureBanner";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { useHealth } from "../hooks/useHealth";
import {
  useBulkAction,
  useDownloadModel,
  useHardDelete,
  useModelDetail,
  useModels,
  useRestoreModel,
  useSoftDelete,
  useUpdateModel,
} from "../hooks/useModels";

interface Filters {
  search: string;
  status: string;
  source: string;
  sort_by: string;
  sort_order: string;
  pinned: boolean | undefined;
  stale_days: number | undefined;
}

const ModelCacheWorkspace: React.FC = () => {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "",
    source: "",
    sort_by: "created_at",
    sort_order: "desc",
    pinned: undefined,
    stale_days: undefined,
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showDownload, setShowDownload] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: modelsData, isLoading, error, refetch } = useModels({
    page,
    page_size: 25,
    search: filters.search || undefined,
    status: filters.status || undefined,
    source: filters.source || undefined,
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
    pinned: filters.pinned,
    stale_days: filters.stale_days,
  });
  const { data: modelDetail, isLoading: detailLoading } = useModelDetail(detailId);
  const { data: healthData } = useHealth();

  const downloadModel = useDownloadModel();
  const softDelete = useSoftDelete();
  const hardDelete = useHardDelete();
  const restoreModel = useRestoreModel();
  const updateModel = useUpdateModel();
  const bulkAction = useBulkAction();

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!modelsData) {
      return;
    }
    setSelectedIds(prev => {
      if (prev.size === modelsData.items.length) {
        return new Set();
      }
      return new Set(modelsData.items.map(model => model.id));
    });
  }, [modelsData]);

  const handleDownload = useCallback(
    (request: DownloadRequest) => {
      downloadModel.mutate(request, {
        onSuccess: () => {
          setShowDownload(false);
          setShowJobs(true);
        },
      });
    },
    [downloadModel],
  );

  const handleHardDelete = useCallback(
    (id: string) => {
      const model = modelsData?.items.find(item => item.id === id);
      setHardDeleteTarget({ id, name: model?.repo_id || id });
    },
    [modelsData],
  );

  const confirmHardDelete = useCallback(() => {
    if (!hardDeleteTarget) {
      return;
    }
    hardDelete.mutate(hardDeleteTarget.id, {
      onSuccess: () => {
        setHardDeleteTarget(null);
        setDetailId(null);
        setShowJobs(true);
      },
    });
  }, [hardDelete, hardDeleteTarget]);

  return (
    <div className="model-cache-workspace">
      <div className="model-cache-panel model-cache-panel--workspace-header">
        <div className="model-cache-workspace__header">
          <div>
            <div className="model-cache-panel__eyebrow">Operations Workspace</div>
            <div className="model-cache-panel__title">Browse, warm, and maintain shared model artifacts</div>
            <div className="model-cache-panel__subtitle">
              Use the catalog below to download new models, monitor job activity, and keep the cache healthy for downstream deploy flows.
            </div>
          </div>
          <div className="model-cache-workspace__actions">
            <div className="model-cache-target-pill model-cache-target-pill--muted">
              <span>Scope</span>
              <strong>Global workspace</strong>
            </div>
            {healthData?.airgapped && (
              <span className="model-cache-badge model-cache-badge--warning" title="Air-gapped mode: no internet access. Downloads disabled.">
                <i className="fa fa-plane fa-rotate-180" />
                Air-gapped
              </span>
            )}
          </div>
        </div>
        <div className="model-cache-workspace__toolbar">
          {!healthData?.airgapped && (
            <button className="model-cache-toolbar-btn" onClick={() => setShowPresets(!showPresets)}>
              <i className="fa fa-bookmark" />
              Presets
            </button>
          )}
          <button className="model-cache-toolbar-btn" onClick={() => setShowJobs(!showJobs)}>
            <i className="fa fa-tasks" />
            Jobs
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={String(error)} onRetry={() => refetch()} />}
      {healthData && <StoragePressureBanner health={healthData} />}

      <div className="model-cache-panel model-cache-panel--metrics">
        <div className="model-cache-panel__header">
          {healthData?.airgapped && <div />}
          <div>
            <div className="model-cache-panel__eyebrow">System Health</div>
            <div className="model-cache-panel__title">Current cache and node posture</div>
            <div className="model-cache-panel__subtitle">
              These cards summarize model volume, running operations, node freshness, and storage usage across the shared cache.
            </div>
          </div>
        </div>
        <HealthSummaryCards />
      </div>

      <div className="model-cache-panel model-cache-panel--catalog">
        <div className="model-cache-panel__header model-cache-panel__header--split">
          <div>
            <div className="model-cache-panel__eyebrow">Model Catalog</div>
            <div className="model-cache-panel__title">Search, filter, and operate on cached artifacts</div>
            <div className="model-cache-panel__subtitle">
              Bulk actions, rescans, and downloads all run from this panel so operators can see the current state before taking action.
            </div>
          </div>
          <div className="model-cache-summary-grid">
            <div className="model-cache-summary-grid__item">
              <span>Selected</span>
              <strong>{selectedIds.size}</strong>
            </div>
            <div className="model-cache-summary-grid__item">
              <span>Visible</span>
              <strong>{modelsData?.total ?? 0}</strong>
            </div>
          </div>
        </div>

        <FilterToolbar
          airgapped={healthData?.airgapped}
          filters={filters}
          onChange={nextFilters => {
            setFilters(nextFilters);
            setPage(1);
          }}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await refetch();
              setToast("Catalog refreshed");
            } finally {
              setRefreshing(false);
              setTimeout(() => setToast(null), 2000);
            }
          }}
          onRescan={async () => {
            setRescanning(true);
            try {
              const result = await api.rescanAll();
              setToast(`Rescan triggered on ${result.triggered.length} agent(s)`);
            } catch (error) {
              setToast(`Rescan failed: ${error}`);
            } finally {
              setRescanning(false);
              setTimeout(() => setToast(null), 3000);
            }
          }}
          onDownload={() => setShowDownload(true)}
          refreshing={refreshing}
          rescanning={rescanning}
        />

        <BulkActionBar
          selectedCount={selectedIds.size}
          onSoftDelete={() => {
            bulkAction.mutate({ model_ids: Array.from(selectedIds), action: "soft_delete" });
            setSelectedIds(new Set());
          }}
          onPin={() => {
            bulkAction.mutate({ model_ids: Array.from(selectedIds), action: "pin" });
            setSelectedIds(new Set());
          }}
          onUnpin={() => {
            bulkAction.mutate({ model_ids: Array.from(selectedIds), action: "unpin" });
            setSelectedIds(new Set());
          }}
          onClear={() => setSelectedIds(new Set())}
        />

        <ModelCatalogTable
          isLoading={isLoading}
          models={modelsData?.items || []}
          onPageChange={setPage}
          onRowClick={setDetailId}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          page={page}
          selectedIds={selectedIds}
          total={modelsData?.total || 0}
          totalPages={modelsData?.total_pages || 0}
        />
      </div>

      {toast && <div className="model-cache-toast">{toast}</div>}

      {detailId && (
        <ModelDetailDrawer
          airgapped={healthData?.airgapped}
          isLoading={detailLoading}
          model={modelDetail || null}
          onClose={() => setDetailId(null)}
          onHardDelete={handleHardDelete}
          onIntegrityCheck={id => {
            api.integrityCheck(id);
            setShowJobs(true);
          }}
          onRestore={id => {
            restoreModel.mutate(id);
            setDetailId(null);
          }}
          onSoftDelete={id => {
            softDelete.mutate(id);
            setDetailId(null);
          }}
          onTogglePin={(id, pinned) => updateModel.mutate({ id, pinned })}
        />
      )}

      {showDownload && (
        <DownloadModelModal
          error={downloadModel.error ? String(downloadModel.error) : null}
          isLoading={downloadModel.isPending}
          onClose={() => setShowDownload(false)}
          onSubmit={handleDownload}
        />
      )}

      {hardDeleteTarget && (
        <ConfirmDialog
          confirmText="Delete Permanently"
          confirmValue={hardDeleteTarget.name}
          danger
          message={`This will permanently remove all cached artifacts for "${hardDeleteTarget.name}" from disk. This action cannot be undone.`}
          onCancel={() => setHardDeleteTarget(null)}
          onConfirm={confirmHardDelete}
          title="Hard Delete Model"
        />
      )}

      <JobsPanel onClose={() => setShowJobs(false)} visible={showJobs} />
      <PresetsPanel
        onClose={() => setShowPresets(false)}
        onToast={message => {
          setToast(message);
          setTimeout(() => setToast(null), 3000);
        }}
        visible={showPresets}
      />
    </div>
  );
};

export const ModelCachePage: React.FC = () => (
  <div className="model-cache">
    <div className="model-cache-shell">
      <header className="model-cache-hero">
        <div className="model-cache-hero__copy">
          <div className="model-cache-hero__eyebrow">Shared GPU Artifact Operations</div>
          <h1 className="model-cache-hero__title">
            <i className="fa fa-database" />
            Model Cache
          </h1>
          <p className="model-cache-hero__subtitle">
            Manage downloaded models, monitor storage health, and keep warmup workflows ready without leaving Argo CD.
          </p>
        </div>
        <div className="model-cache-hero__aside">
          <div className="model-cache-hero__hint">
            <i className="fa fa-shield" />
            Requests flow through the Clustra Deploy server, which forwards authenticated identity headers to the backend.
          </div>
          <div className="model-cache-hero__context">
            <span>Access</span>
            <strong>Global Clustra workspace</strong>
          </div>
        </div>
      </header>

      <div className="model-cache-layout">
        <section className="model-cache-main">
          <ModelCacheWorkspace />
        </section>

        <aside className="model-cache-rail">
          <div className="model-cache-sidecard">
            <div className="model-cache-sidecard__title">How This Works</div>
            <div className="model-cache-sidecard__steps">
              <div className="model-cache-sidecard__step">
                <span className="model-cache-sidecard__num">1</span>
                <span>Open the catalog, search cached artifacts, and review current cache health from one shared workspace.</span>
              </div>
              <div className="model-cache-sidecard__step">
                <span className="model-cache-sidecard__num">2</span>
                <span>Trigger downloads, rescans, pinning, or cleanup actions directly from the main panels.</span>
              </div>
              <div className="model-cache-sidecard__step">
                <span className="model-cache-sidecard__num">3</span>
                <span>Use jobs and presets whenever you need operational detail or a quick warmup flow for downstream teams.</span>
              </div>
            </div>
          </div>

          <div className="model-cache-sidecard">
            <div className="model-cache-sidecard__title">Production Notes</div>
            <div className="model-cache-sidecard__list">
              <div>Argo CD authenticates the browser request and the server forwards the user identity to the backend.</div>
              <div>Model-level download and delete permissions continue to be enforced by the model-cache backend itself.</div>
              <div>The page is global in the UI, so operators no longer need to pick an Argo application just to inspect the cache.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
);
