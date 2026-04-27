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
import {TOAST_DURATION_MS} from '../utils/constants';

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
    const [bulkSoftDeleteTarget, setBulkSoftDeleteTarget] = useState<{ids: string[]; count: number} | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [rescanning, setRescanning] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), TOAST_DURATION_MS);
    }, []);

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
        isPollingPaused,
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
    const {data: modelDetail, isLoading: detailLoading, error: detailError} = useModelDetail(detailId);
    const {data: healthData, error: healthError, isPollingPaused: healthPollingPaused, refetch: refetchHealth} = useHealth();

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
        hardDelete
            .mutate(hardDeleteTarget.id, {
                onSuccess: () => {
                    setHardDeleteTarget(null);
                    setDetailId(null);
                    setShowJobs(true);
                }
            })
            .catch(deleteError => showToast(`Hard delete failed: ${deleteError}`));
    }, [hardDelete, hardDeleteTarget, showToast]);

    const runBulkAction = useCallback(
        async (action: 'soft_delete' | 'pin' | 'unpin', ids = Array.from(selectedIds)) => {
            if (ids.length === 0) {
                return;
            }
            const actionLabel: Record<typeof action, string> = {
                soft_delete: 'Soft delete',
                pin: 'Pin',
                unpin: 'Unpin'
            };
            try {
                const result = await bulkAction.mutate({model_ids: ids, action});
                setSelectedIds(new Set());
                await refetch();
                const failureCopy = result.failed.length > 0 ? `, ${result.failed.length} failed` : '';
                showToast(`${actionLabel[action]} complete: ${result.succeeded.length} succeeded${failureCopy}`);
            } catch (bulkError) {
                showToast(`${actionLabel[action]} failed: ${bulkError}`);
            }
        },
        [bulkAction, refetch, selectedIds, showToast]
    );

    const confirmBulkSoftDelete = useCallback(() => {
        if (!bulkSoftDeleteTarget) {
            return;
        }
        const ids = bulkSoftDeleteTarget.ids;
        setBulkSoftDeleteTarget(null);
        runBulkAction('soft_delete', ids);
    }, [bulkSoftDeleteTarget, runBulkAction]);

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
                            <button
                                type='button'
                                className='argo-button argo-button--base-o model-cache__button'
                                onClick={() => setShowPresets(true)}
                                aria-label='Open cache warmup presets'>
                                <i className='fa fa-bookmark' aria-hidden='true' /> Presets
                            </button>
                        )}
                        <button
                            type='button'
                            className='argo-button argo-button--base-o model-cache__button'
                            onClick={() => setShowJobs(true)}
                            aria-label='Open model inventory jobs'>
                            <i className='fa fa-tasks' aria-hidden='true' /> Jobs
                        </button>
                    </div>
                </div>

                {toast && (
                    <div className='model-cache__toast' role='status' aria-live='polite'>
                        {toast}
                    </div>
                )}
                {error && <ErrorBanner message={`Failed to load model catalog${isPollingPaused ? '; polling paused' : ''}: ${error.message}`} onRetry={() => refetch()} />}
                {healthError && (
                    <ErrorBanner message={`Failed to load health status${healthPollingPaused ? '; polling paused' : ''}: ${healthError.message}`} onRetry={() => refetchHealth()} />
                )}
                {detailError && <ErrorBanner message={`Failed to load model details: ${detailError.message}`} />}
                {bulkAction.error && <ErrorBanner message={`Bulk action failed: ${bulkAction.error.message}`} />}
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
                            showToast('Catalog refreshed');
                        } catch (refreshError) {
                            showToast(`Refresh failed: ${refreshError}`);
                        } finally {
                            setRefreshing(false);
                        }
                    }}
                    onRescan={async () => {
                        setRescanning(true);
                        try {
                            const result = await api.rescanAll();
                            const failureCopy = result.failed.length > 0 ? `, ${result.failed.length} failed` : '';
                            showToast(`Rescan triggered on ${result.triggered.length} agent(s)${failureCopy}`);
                        } catch (refreshError) {
                            showToast(`Rescan failed: ${refreshError}`);
                        } finally {
                            setRescanning(false);
                        }
                    }}
                    onDownload={() => setShowDownload(true)}
                    refreshing={refreshing}
                    rescanning={rescanning}
                />

                <BulkActionBar
                    selectedCount={selectedIds.size}
                    onSoftDelete={() => {
                        const ids = Array.from(selectedIds);
                        setBulkSoftDeleteTarget({ids, count: ids.length});
                    }}
                    onPin={() => runBulkAction('pin')}
                    onUnpin={() => runBulkAction('unpin')}
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
                        api.integrityCheck(id)
                            .then(() => setShowJobs(true))
                            .catch(integrityError => showToast(`Integrity check failed: ${integrityError}`));
                    }}
                    onRestore={id => {
                        restoreModel
                            .mutate(id)
                            .then(() => {
                                setDetailId(null);
                                refetch();
                                showToast('Model restored');
                            })
                            .catch(restoreError => showToast(`Restore failed: ${restoreError}`));
                    }}
                    onSoftDelete={id => {
                        softDelete
                            .mutate(id)
                            .then(() => {
                                setDetailId(null);
                                refetch();
                                showToast('Model soft deleted');
                            })
                            .catch(deleteError => showToast(`Soft delete failed: ${deleteError}`));
                    }}
                    onTogglePin={(id, pinned) =>
                        updateModel
                            .mutate({id, pinned})
                            .then(() => {
                                refetch();
                                showToast(pinned ? 'Model pinned' : 'Model unpinned');
                            })
                            .catch(updateError => showToast(`Pin update failed: ${updateError}`))
                    }
                />
            )}

            {showDownload && (
                <DownloadModelModal
                    error={downloadModel.error ? String(downloadModel.error) : null}
                    isLoading={downloadModel.isPending}
                    onClose={() => setShowDownload(false)}
                    onSubmit={handleDownload}
                    defaultTargetPvc={healthData?.default_pvc_name}
                    defaultTargetNamespace={healthData?.default_namespace}
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
            {bulkSoftDeleteTarget && (
                <ConfirmDialog
                    confirmText='Soft Delete'
                    danger={true}
                    message={`Soft delete ${bulkSoftDeleteTarget.count} selected model${bulkSoftDeleteTarget.count > 1 ? 's' : ''}? This is recoverable, but the selected models will disappear from active cache views.`}
                    onCancel={() => setBulkSoftDeleteTarget(null)}
                    onConfirm={confirmBulkSoftDelete}
                    title='Soft Delete Models'
                />
            )}

            <JobsPanel onClose={() => setShowJobs(false)} visible={showJobs} />
            <PresetsPanel onClose={() => setShowPresets(false)} onToast={showToast} visible={showPresets} />
        </div>
    );
};

export const ModelCachePage: React.FC = () => (
    <main className='model-cache' role='main' aria-label='Model Inventory'>
        <ModelCacheWorkspace />
    </main>
);
