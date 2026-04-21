import React, {useCallback, useEffect, useState} from 'react';

import * as api from '../api/client';
import type {DownloadRequest} from '../api/types';
import {services} from '../../shared/services';
import {BulkActionBar} from '../components/BulkActionBar';
import {DownloadModelModal} from '../components/DownloadModelModal';
import {FilterToolbar} from '../components/FilterToolbar';
import {HealthSummaryCards} from '../components/HealthSummaryCards';
import {JobsPanel} from '../components/JobsPanel';
import {ModelCatalogTable} from '../components/ModelCatalogTable';
import {ModelDetailDrawer} from '../components/ModelDetailDrawer';
import {PresetsPanel} from '../components/PresetsPanel';
import {StoragePressureBanner} from '../components/StoragePressureBanner';
import {StatusBadge} from '../components/common/StatusBadge';
import {ConfirmDialog} from '../components/common/ConfirmDialog';
import {ErrorBanner} from '../components/common/ErrorBanner';
import {useHealth} from '../hooks/useHealth';
import {useBulkAction, useDownloadModel, useHardDelete, useModelDetail, useModels, useRestoreModel, useSoftDelete, useUpdateModel} from '../hooks/useModels';

interface Filters {
    search: string;
    status: string;
    source: string;
    sort_by: string;
    sort_order: string;
    pinned: boolean | undefined;
    stale_days: number | undefined;
}

const MODEL_CACHE_PREFERENCES_KEY = 'model-cache-catalog';
const DEFAULT_PAGE_SIZE = 25;

const ModelCacheWorkspace: React.FC = () => {
    const [filters, setFilters] = useState<Filters>({
        search: '',
        status: '',
        source: '',
        sort_by: 'created_at',
        sort_order: 'desc',
        pinned: undefined,
        stale_days: undefined
    });
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [detailId, setDetailId] = useState<string | null>(null);
    const [showDownload, setShowDownload] = useState(false);
    const [showJobs, setShowJobs] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    const [hardDeleteTarget, setHardDeleteTarget] = useState<{id: string; name: string} | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [rescanning, setRescanning] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        const subscription = services.viewPreferences.getPreferences().subscribe(pref => {
            const nextPageSize = pref.pageSizes[MODEL_CACHE_PREFERENCES_KEY] || DEFAULT_PAGE_SIZE;
            if (!pref.pageSizes[MODEL_CACHE_PREFERENCES_KEY]) {
                services.viewPreferences.updatePreferences({
                    pageSizes: {...pref.pageSizes, [MODEL_CACHE_PREFERENCES_KEY]: DEFAULT_PAGE_SIZE}
                });
            }
            setPageSize(nextPageSize);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [pageSize]);

    const {
        data: modelsData,
        isLoading,
        error,
        refetch
    } = useModels({
        page: page + 1,
        page_size: pageSize,
        search: filters.search || undefined,
        status: filters.status || undefined,
        source: filters.source || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        pinned: filters.pinned,
        stale_days: filters.stale_days
    });
    const {data: modelDetail, isLoading: detailLoading} = useModelDetail(detailId);
    const {data: healthData} = useHealth();

    const downloadModel = useDownloadModel();
    const softDelete = useSoftDelete();
    const hardDelete = useHardDelete();
    const restoreModel = useRestoreModel();
    const updateModel = useUpdateModel();
    const bulkAction = useBulkAction();

    const handleSelect = useCallback((id: string) => {
        setSelectedIds(previous => {
            const next = new Set(previous);
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
        setSelectedIds(previous => {
            if (previous.size === modelsData.items.length) {
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
                }
            });
        },
        [downloadModel]
    );

    const handleHardDelete = useCallback(
        (id: string) => {
            const model = modelsData?.items.find(item => item.id === id);
            setHardDeleteTarget({id, name: model?.repo_id || id});
        },
        [modelsData]
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
            }
        });
    }, [hardDelete, hardDeleteTarget]);

    return (
        <div className='model-cache__page'>
            <section className='white-box model-cache__panel'>
                <div className='model-cache__toolbar'>
                    <div className='model-cache__toolbar-meta'>
                        <StatusBadge tone='muted'>Global workspace</StatusBadge>
                        {healthData?.airgapped && (
                            <StatusBadge tone='warning' iconClassName='fa fa-plane fa-rotate-180'>
                                Air-gapped
                            </StatusBadge>
                        )}
                    </div>
                    <div className='model-cache__toolbar-actions'>
                        {!healthData?.airgapped && (
                            <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => setShowPresets(true)}>
                                <i className='fa fa-bookmark' /> Presets
                            </button>
                        )}
                        <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={() => setShowJobs(true)}>
                            <i className='fa fa-tasks' /> Jobs
                        </button>
                    </div>
                </div>

                {toast && <div className='model-cache__toast'>{toast}</div>}
                {error && <ErrorBanner message={String(error)} onRetry={() => refetch()} />}
                {healthData && <StoragePressureBanner health={healthData} />}
                <HealthSummaryCards health={healthData || null} />
            </section>

            <section className='white-box model-cache__panel'>
                <div className='model-cache__section-header'>
                    <div>
                        <div className='model-cache__section-title'>Model Catalog</div>
                        <div className='model-cache__section-description'>Search cached artifacts and run cache operations.</div>
                    </div>
                    <div className='model-cache__section-stats'>
                        <span>Selected: {selectedIds.size}</span>
                        <span>Visible: {modelsData?.total || 0}</span>
                    </div>
                </div>

                <FilterToolbar
                    airgapped={healthData?.airgapped}
                    filters={filters}
                    onChange={nextFilters => {
                        setFilters(nextFilters);
                        setPage(0);
                    }}
                    onRefresh={async () => {
                        setRefreshing(true);
                        try {
                            await refetch();
                            setToast('Catalog refreshed');
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
                        } catch (refreshError) {
                            setToast(`Rescan failed: ${refreshError}`);
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
                        bulkAction.mutate({model_ids: Array.from(selectedIds), action: 'soft_delete'});
                        setSelectedIds(new Set());
                    }}
                    onPin={() => {
                        bulkAction.mutate({model_ids: Array.from(selectedIds), action: 'pin'});
                        setSelectedIds(new Set());
                    }}
                    onUnpin={() => {
                        bulkAction.mutate({model_ids: Array.from(selectedIds), action: 'unpin'});
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
                />
            </section>

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
                    onTogglePin={(id, pinned) => updateModel.mutate({id, pinned})}
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
                    confirmText='Delete Permanently'
                    confirmValue={hardDeleteTarget.name}
                    danger={true}
                    message={`This will permanently remove all cached artifacts for "${hardDeleteTarget.name}" from disk. This action cannot be undone.`}
                    onCancel={() => setHardDeleteTarget(null)}
                    onConfirm={confirmHardDelete}
                    title='Hard Delete Model'
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
    <div className='model-cache'>
        <div className='argo-container'>
            <ModelCacheWorkspace />
        </div>
    </div>
);
