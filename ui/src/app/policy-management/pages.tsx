import * as React from 'react';
import {useMemo, useState} from 'react';

import {EmptyState} from '../shared/components';
import {policyApiClient} from './api/client';
import type {ActiveFilter, FeatureBackendFilter, ManagedByFilter, PolicyApiClient, PolicyFamily, PolicyPageKey, PolicyRow, RequestPolicyType} from './api/types';
import {FEATURE_BACKENDS} from './api/types';
import {PolicyConfirmDialog} from './components/PolicyConfirmDialog';
import {PolicyDetailsDrawer} from './components/PolicyDetailsDrawer';
import {PolicyError} from './components/PolicyError';
import {PolicyFormDrawer} from './components/PolicyFormDrawer';
import {description as policyDescription, displayName, formatRelativeTime} from './formatters';
import {PolicyListFilters, usePolicies} from './hooks/usePolicies';
import {buildUsageSnippet, formatPolicyJson} from './validation';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = [25, 50, 100];

export type PolicyPageConfig =
    | {
          key: RequestPolicyType;
          family: 'request';
          title: string;
          description: string;
          requestType: RequestPolicyType;
      }
    | {
          key: 'features';
          family: 'feature';
          title: string;
          description: string;
      };

export const POLICY_PAGE_CONFIGS: PolicyPageConfig[] = [
    {key: 'workload', family: 'request', requestType: 'workload', title: 'Workload Policies', description: 'Manage workload-level AI Configurator request policies.'},
    {
        key: 'infrastructure',
        family: 'request',
        requestType: 'infrastructure',
        title: 'Infrastructure Policies',
        description: 'Manage infrastructure selection and placement policies.'
    },
    {key: 'serving', family: 'request', requestType: 'serving', title: 'Serving Policies', description: 'Manage serving runtime and deployment policies.'},
    {key: 'manifest', family: 'request', requestType: 'manifest', title: 'Manifest Policies', description: 'Manage manifest generation and patch policies.'},
    {key: 'features', family: 'feature', title: 'Feature Policies', description: 'Manage backend-specific engine feature policies.'}
];

export function resolvePolicyPagePath(pathname: string): PolicyPageConfig {
    const tail = pathname.split('/').filter(Boolean).pop() as PolicyPageKey | undefined;
    return POLICY_PAGE_CONFIGS.find(page => page.key === tail) || POLICY_PAGE_CONFIGS[0];
}

type EditorState =
    | {
          mode: 'create';
          family: PolicyFamily;
          document?: Record<string, unknown> | null;
          original?: null;
          requestType?: RequestPolicyType;
      }
    | {
          mode: 'edit';
          family: PolicyFamily;
          document: Record<string, unknown>;
          original: PolicyRow['record'];
      };

interface PolicyManagementWorkspaceProps {
    client?: PolicyApiClient;
    page: PolicyPageConfig;
}

function copyDocumentForDuplicate(row: PolicyRow): Record<string, unknown> {
    const document = JSON.parse(JSON.stringify(row.record.document || {})) as Record<string, unknown>;
    const currentName = typeof document.display_name === 'string' && document.display_name ? document.display_name : row.record.policy_id;
    return {
        ...document,
        policy_id: '',
        active: true,
        display_name: `Copy of ${currentName}`
    };
}

function rowAriaLabel(action: string, row: PolicyRow) {
    return `${action} ${row.id}`;
}

export const PolicyManagementWorkspace: React.FC<PolicyManagementWorkspaceProps> = ({client = policyApiClient, page: policyPage}) => {
    const [search, setSearch] = useState('');
    const [active, setActive] = useState<ActiveFilter>('active');
    const [managedBy, setManagedBy] = useState<ManagedByFilter>('all');
    const [backend, setBackend] = useState<FeatureBackendFilter>('all');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [refreshTick, setRefreshTick] = useState(0);
    const [detailsRow, setDetailsRow] = useState<PolicyRow | null>(null);
    const [editor, setEditor] = useState<EditorState | null>(null);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<PolicyRow | null>(null);
    const [deletePending, setDeletePending] = useState(false);
    const [actionError, setActionError] = useState<unknown | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const filters = useMemo<PolicyListFilters>(
        () => ({
            family: policyPage.family,
            search,
            active,
            managedBy,
            requestType: policyPage.family === 'request' ? policyPage.requestType : undefined,
            backend,
            page,
            pageSize
        }),
        [active, backend, managedBy, page, pageSize, policyPage, search]
    );
    const {data, isLoading, error, refetch} = usePolicies(client, filters, refreshTick);
    const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
    const selectedRow = data.rows.find(row => row.id === selectedRowId) || null;
    const selectedIsSystem = selectedRow?.record.managed_by === 'system';
    const showBackendColumn = policyPage.family === 'feature';

    function resetPageAnd(action: () => void) {
        setPage(0);
        action();
    }

    function showToast(message: string) {
        setToast(message);
        window.setTimeout(() => setToast(null), 3000);
    }

    async function refreshAfterMutation() {
        setRefreshTick(tick => tick + 1);
        await refetch();
    }

    function selectRow(row: PolicyRow) {
        setSelectedRowId(row.id);
        setActionsOpen(false);
    }

    function handleView(row: PolicyRow) {
        setActionError(null);
        selectRow(row);
        if (expandedRowId === row.id && detailsRow) {
            setDetailsRow(null);
            setExpandedRowId(null);
            return;
        }
        setEditor(null);
        setDetailsRow(row);
        setExpandedRowId(row.id);
    }

    async function handleEdit(row: PolicyRow) {
        setActionError(null);
        selectRow(row);
        setDetailsRow(null);
        try {
            const latest = row.family === 'request' ? await client.getPolicy(row.id) : await client.getFeaturePolicy(row.id);
            setEditor({
                mode: 'edit',
                family: row.family,
                document: latest.document || {},
                original: latest
            });
            setExpandedRowId(row.id);
        } catch (error) {
            setActionError(error);
        }
    }

    function handleDuplicate(row: PolicyRow) {
        setActionError(null);
        selectRow(row);
        setDetailsRow(null);
        setExpandedRowId(row.id);
        setEditor({
            mode: 'create',
            family: row.family,
            requestType: row.family === 'request' ? (row.record as {type: RequestPolicyType}).type : undefined,
            document: copyDocumentForDuplicate(row),
            original: null
        });
    }

    function handleCreate() {
        setActionError(null);
        setDetailsRow(null);
        setExpandedRowId(null);
        setSelectedRowId(null);
        setActionsOpen(false);
        setEditor({
            mode: 'create',
            family: policyPage.family,
            requestType: policyPage.family === 'request' ? policyPage.requestType : undefined,
            document: null,
            original: null
        });
    }

    function handleCopyUsage(row: PolicyRow) {
        const snippet = formatPolicyJson(buildUsageSnippet(row.family, row.record.document || {}));
        navigator.clipboard?.writeText(snippet);
        setActionError(null);
        selectRow(row);
        showToast(row.family === 'feature' ? 'Usage copied. Use feature_policies; do not send extra_engine_args_config directly.' : 'Usage copied.');
    }

    async function confirmDelete() {
        if (!deleteRow) {
            return;
        }
        setDeletePending(true);
        setActionError(null);
        try {
            if (deleteRow.family === 'request') {
                await client.deletePolicy(deleteRow.id);
            } else {
                await client.deleteFeaturePolicy(deleteRow.id);
            }
            setDeleteRow(null);
            setDetailsRow(null);
            setExpandedRowId(null);
            setSelectedRowId(null);
            setActionsOpen(false);
            await refreshAfterMutation();
            showToast('Policy disabled.');
        } catch (error) {
            setActionError(error);
        } finally {
            setDeletePending(false);
        }
    }

    function closeExpandedPanel() {
        setDetailsRow(null);
        setEditor(null);
        setExpandedRowId(null);
    }

    function handleSelectedAction(action: 'edit' | 'duplicate' | 'copy') {
        if (!selectedRow) {
            return;
        }
        setActionsOpen(false);
        if (action === 'edit') {
            handleEdit(selectedRow);
        } else if (action === 'duplicate') {
            handleDuplicate(selectedRow);
        } else {
            handleCopyUsage(selectedRow);
        }
    }

    function handleSelectedDelete() {
        if (!selectedRow || selectedIsSystem) {
            return;
        }
        setActionsOpen(false);
        setDeleteRow(selectedRow);
    }

    function expandedContent(): React.ReactNode {
        if (!expandedRowId) {
            return null;
        }
        const row = data.rows.find(item => item.id === expandedRowId);
        if (!row) {
            return null;
        }
        if (editor) {
            return (
                <PolicyFormDrawer
                    mode={editor.mode}
                    client={client}
                    initialFamily={editor.family}
                    initialDocument={editor.document}
                    initialRequestType={editor.mode === 'create' ? editor.requestType : undefined}
                    originalRecord={editor.mode === 'edit' ? editor.original : null}
                    onClose={closeExpandedPanel}
                    onSaved={async () => {
                        closeExpandedPanel();
                        await refreshAfterMutation();
                        showToast(editor.mode === 'edit' ? 'Policy updated.' : 'Policy created.');
                    }}
                />
            );
        }
        if (detailsRow?.id === row.id) {
            return <PolicyDetailsDrawer row={detailsRow} onClose={closeExpandedPanel} />;
        }
        return null;
    }

    return (
        <main className='policy-management' role='main' aria-label='AI Configurator Policies'>
            <section className='policy-management__panel'>
                <div className='policy-management__list-header'>
                    <div>
                        <div className='policy-management__page-title'>
                            {policyPage.title} <span className='policy-management__count'>({data.total})</span> <span className='policy-management__info-link'>Info</span>
                        </div>
                        <div className='policy-management__section-description'>{policyPage.description}</div>
                    </div>
                    <div className='policy-management__toolbar-actions'>
                        <button
                            type='button'
                            className='argo-button argo-button--base-o policy-management__round-button'
                            aria-label='Refresh policies'
                            title='Refresh policies'
                            onClick={() => refetch()}>
                            <i className='fa fa-sync' aria-hidden='true' />
                        </button>
                        {selectedRow && <span className='policy-management__selected-target'>Selected: {selectedRow.id}</span>}
                        <div className='policy-management__action-menu'>
                            <button
                                type='button'
                                className='argo-button argo-button--base-o policy-management__button'
                                disabled={!selectedRow}
                                aria-expanded={actionsOpen}
                                onClick={() => setActionsOpen(open => !open)}>
                                Actions <i className='fa fa-caret-down' aria-hidden='true' />
                            </button>
                            {actionsOpen && selectedRow && (
                                <div className='policy-management__action-menu-panel' role='menu'>
                                    <button
                                        type='button'
                                        className='policy-management__action-menu-item'
                                        role='menuitem'
                                        disabled={selectedIsSystem}
                                        onClick={() => handleSelectedAction('edit')}>
                                        Edit
                                    </button>
                                    <button type='button' className='policy-management__action-menu-item' role='menuitem' onClick={() => handleSelectedAction('duplicate')}>
                                        Duplicate as custom
                                    </button>
                                    <button type='button' className='policy-management__action-menu-item' role='menuitem' onClick={() => handleSelectedAction('copy')}>
                                        Copy usage
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type='button'
                            className='argo-button argo-button--base-o policy-management__button'
                            disabled={!selectedRow || selectedIsSystem}
                            title={selectedIsSystem ? 'System-managed policies are read-only' : 'Delete selected policy'}
                            onClick={handleSelectedDelete}>
                            Delete
                        </button>
                        <button type='button' className='argo-button argo-button--base policy-management__create-button' onClick={handleCreate}>
                            Create policy
                        </button>
                    </div>
                </div>

                {policyPage.family === 'feature' && (
                    <div className='policy-management__backend-filter' role='tablist' aria-label='Feature backend'>
                        <span className='policy-management__filter-label'>Filter by Backend</span>
                        {(['all', ...FEATURE_BACKENDS] as FeatureBackendFilter[]).map(item => (
                            <button
                                key={item}
                                type='button'
                                className={`argo-button ${backend === item ? 'argo-button--base' : 'argo-button--base-o'} policy-management__button`}
                                onClick={() => resetPageAnd(() => setBackend(item))}>
                                {item === 'all' ? 'All' : item}
                            </button>
                        ))}
                    </div>
                )}

                <div className='policy-management__filters' role='search' aria-label='Policy filters'>
                    <label className='policy-management__filter-field policy-management__filter-field--search'>
                        <span className='policy-management__filter-label'>Search</span>
                        <span className='policy-management__search-shell'>
                            <i className='fa fa-search' aria-hidden='true' />
                            <input
                                className='argo-field policy-management__search'
                                value={search}
                                placeholder='Search'
                                aria-label='Search policies'
                                onChange={event => resetPageAnd(() => setSearch(event.target.value))}
                            />
                        </span>
                    </label>
                    <label className='policy-management__filter-field'>
                        <span className='policy-management__filter-label'>Filter by Status</span>
                        <select
                            className='argo-field policy-management__select'
                            value={active}
                            aria-label='Active filter'
                            onChange={event => resetPageAnd(() => setActive(event.target.value as ActiveFilter))}>
                            <option value='all'>All status</option>
                            <option value='active'>Active</option>
                            <option value='inactive'>Inactive</option>
                        </select>
                    </label>
                    <label className='policy-management__filter-field'>
                        <span className='policy-management__filter-label'>Filter by Manager</span>
                        <select
                            className='argo-field policy-management__select'
                            value={managedBy}
                            aria-label='Managed by filter'
                            onChange={event => resetPageAnd(() => setManagedBy(event.target.value as ManagedByFilter))}>
                            <option value='all'>All managers</option>
                            <option value='system'>System</option>
                            <option value='custom'>Custom</option>
                        </select>
                    </label>
                </div>

                <PolicyPagination page={page} pageSize={pageSize} total={data.total} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} />

                {toast && (
                    <div className='policy-management__toast' role='status' aria-live='polite'>
                        {toast}
                    </div>
                )}
                {error && <PolicyError error={error} prefix='Failed to load policies' />}
                {actionError && <PolicyError error={actionError} prefix='Policy action failed' />}

                {editor && expandedRowId == null && (
                    <PolicyFormDrawer
                        mode={editor.mode}
                        client={client}
                        initialFamily={editor.family}
                        initialDocument={editor.document}
                        initialRequestType={editor.mode === 'create' ? editor.requestType : undefined}
                        originalRecord={editor.mode === 'edit' ? editor.original : null}
                        onClose={() => setEditor(null)}
                        onSaved={async () => {
                            setEditor(null);
                            await refreshAfterMutation();
                            showToast(editor.mode === 'edit' ? 'Policy updated.' : 'Policy created.');
                        }}
                    />
                )}

                <PolicyTable
                    rows={data.rows}
                    isLoading={isLoading}
                    expandedRowId={expandedRowId}
                    selectedRowId={selectedRowId}
                    showBackendColumn={showBackendColumn}
                    onView={handleView}
                    onSelect={selectRow}
                />

                {expandedContent()}

                <PolicyPagination
                    page={page}
                    pageSize={pageSize}
                    total={data.total}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    isBottom={true}
                />
            </section>

            {deleteRow && (
                <PolicyConfirmDialog
                    title='Disable Policy'
                    message={`Disable ${deleteRow.id}? DELETE is a soft delete and the policy will remain visible when inactive policies are included.`}
                    confirmLabel='Disable'
                    pending={deletePending}
                    onCancel={() => setDeleteRow(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </main>
    );
};

const PolicyPagination: React.FC<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    isBottom?: boolean;
    onPageChange: (page: number | ((current: number) => number)) => void;
    onPageSizeChange: (pageSize: number) => void;
}> = ({page, pageSize, total, totalPages, isBottom = false, onPageChange, onPageSizeChange}) => (
    <div className={`policy-management__pagination ${isBottom ? 'policy-management__pagination--bottom' : ''}`}>
        <div className='policy-management__table-meta'>
            Page {page + 1} of {totalPages} · {total} total
        </div>
        <div className='policy-management__toolbar-actions'>
            <select
                className='argo-field policy-management__page-size'
                aria-label='Page size'
                value={pageSize}
                onChange={event => {
                    onPageChange(0);
                    onPageSizeChange(Number(event.target.value));
                }}>
                {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>
                        {size} / page
                    </option>
                ))}
            </select>
            <button
                type='button'
                className='argo-button argo-button--base-o policy-management__button'
                disabled={page === 0}
                onClick={() => onPageChange(current => Math.max(0, current - 1))}>
                <i className='fa fa-chevron-left' aria-hidden='true' /> Prev
            </button>
            <button
                type='button'
                className='argo-button argo-button--base-o policy-management__button'
                disabled={page + 1 >= totalPages}
                onClick={() => onPageChange(current => current + 1)}>
                Next <i className='fa fa-chevron-right' aria-hidden='true' />
            </button>
        </div>
    </div>
);

const PolicyTable: React.FC<{
    rows: PolicyRow[];
    isLoading: boolean;
    expandedRowId: string | null;
    selectedRowId: string | null;
    showBackendColumn: boolean;
    onView: (row: PolicyRow) => void;
    onSelect: (row: PolicyRow) => void;
}> = ({rows, isLoading, expandedRowId, selectedRowId, showBackendColumn, onView, onSelect}) => {
    if (isLoading) {
        return (
            <div className='policy-management__table-scroll'>
                <div className='argo-table-list policy-management__table'>
                    <PolicyTableHeader showBackendColumn={showBackendColumn} />
                    <div className='argo-table-list__row'>
                        <div className='row'>
                            <div className='columns small-12 policy-management__table-empty'>Loading...</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className='policy-management__empty-state'>
                <EmptyState icon='fa fa-sliders-h'>
                    <h4>No policies found</h4>
                    <h5>Create a custom policy or adjust the filters.</h5>
                </EmptyState>
            </div>
        );
    }

    return (
        <div className='policy-management__table-scroll'>
            <div className='argo-table-list argo-table-list--clickable policy-management__table'>
                <PolicyTableHeader showBackendColumn={showBackendColumn} />
                {rows.map(row => {
                    const document = row.record.document || {};
                    const isExpanded = expandedRowId === row.id;
                    const isSelected = selectedRowId === row.id;
                    const description = policyDescription(document) || displayName(document) || '-';
                    return (
                        <div
                            key={`${row.family}-${row.id}`}
                            className={`argo-table-list__row policy-management__table-row ${isExpanded ? 'policy-management__table-row--expanded' : ''} ${
                                isSelected ? 'policy-management__table-row--selected' : ''
                            }`}>
                            <div className='row'>
                                <div className='columns small-1'>
                                    <input
                                        type='radio'
                                        name='policy-management-selected-policy'
                                        className='policy-management__row-radio'
                                        aria-label={rowAriaLabel('Select', row)}
                                        checked={isSelected}
                                        onChange={() => onSelect(row)}
                                    />
                                </div>
                                <div className={`columns ${showBackendColumn ? 'small-3' : 'small-4'}`}>
                                    <div className='policy-management__policy-name-cell'>
                                        <button
                                            type='button'
                                            className='policy-management__link-button policy-management__truncate'
                                            title={displayName(document) ? `${row.id} - ${displayName(document)}` : row.id}
                                            aria-label={rowAriaLabel(isExpanded ? 'Collapse details' : 'View details', row)}
                                            onClick={() => onView(row)}>
                                            {row.id}
                                        </button>
                                    </div>
                                </div>
                                {showBackendColumn && (
                                    <div className='columns small-1'>
                                        <code className='policy-management__table-code'>{row.typeOrBackend}</code>
                                    </div>
                                )}
                                <div className='columns small-1'>
                                    <span className='policy-management__table-cell-text'>{row.record.active ? 'active' : 'inactive'}</span>
                                </div>
                                <div className='columns small-1'>
                                    <span className='policy-management__table-cell-text'>{row.record.managed_by}</span>
                                </div>
                                <div className='columns small-4'>
                                    <span
                                        className='policy-management__truncate'
                                        title={typeof document.feature === 'string' && document.feature ? `${description} - ${document.feature}` : description}>
                                        {description}
                                    </span>
                                </div>
                                <div className='columns small-1'>
                                    <span className='policy-management__table-cell-text'>{formatRelativeTime(row.record.updated_at)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

function PolicyTableHeader({showBackendColumn = false}: {showBackendColumn?: boolean}) {
    return (
        <div className='argo-table-list__head'>
            <div className='row'>
                <div className='columns small-1' />
                <div className={`columns ${showBackendColumn ? 'small-3' : 'small-4'}`}>POLICY NAME</div>
                {showBackendColumn && <div className='columns small-1'>BACKEND</div>}
                <div className='columns small-1'>Status</div>
                <div className='columns small-1'>Owner</div>
                <div className='columns small-4'>DESCRIPTION</div>
                <div className='columns small-1'>UPDATED</div>
            </div>
        </div>
    );
}
