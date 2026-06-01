import {Checkbox} from 'argo-ui';
import React from 'react';

import {Column, DataTable, EmptyState, Paginate} from '../../shared/components';
import type {ModelSummary} from '../api/types';
import type {Tone} from '../utils/formatters';
import {formatBytes, formatRelativeTime} from '../utils/formatters';
import {StatusBadge} from './common/StatusBadge';

interface Props {
    models: ModelSummary[];
    total: number;
    page: number;
    selectedIds: Set<string>;
    onSelect: (id: string) => void;
    onSelectAll: () => void;
    onRowClick: (id: string) => void;
    onPageChange: (page: number) => void;
    isLoading: boolean;
}

function kindTone(kind: string | null): Tone {
    switch (kind) {
        case 'full':
            return 'success';
        case 'adapter':
            return 'violet';
        case 'tokenizer':
            return 'warning';
        case 'embedding':
            return 'accent';
        default:
            return 'muted';
    }
}

function staleClass(iso: string | null): string {
    if (!iso) {
        return 'model-cache__text--warning';
    }
    const days = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (days > 90) {
        return 'model-cache__text--danger';
    }
    if (days > 30) {
        return 'model-cache__text--warning';
    }
    return 'model-cache__text--muted';
}

export const ModelCatalogTable: React.FC<Props> = ({models, total, page, selectedIds, onSelect, onSelectAll, onRowClick, onPageChange, isLoading}) => {
    const columns: Array<Column<ModelSummary>> = [
        {
            key: 'select',
            width: '28px',
            header: <Checkbox checked={selectedIds.size === models.length && models.length > 0} onChange={onSelectAll} />,
            render: model => (
                <span onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(model.id)} onChange={() => onSelect(model.id)} />
                </span>
            )
        },
        {
            key: 'model',
            header: 'Model',
            width: 'minmax(0, 2.4fr)',
            render: model => (
                <div className='ctbl__stack'>
                    <div className='ctbl__line'>
                        {model.pinned && <i className='fa fa-thumb-tack model-cache__text--warning' aria-hidden='true' />}
                        <span className='ctbl__primary'>{model.display_name || model.repo_id}</span>
                        {model.model_kind && <StatusBadge tone={kindTone(model.model_kind)}>{model.model_kind}</StatusBadge>}
                        {model.update_available && <StatusBadge tone='accent'>update</StatusBadge>}
                    </div>
                    {model.display_name && model.display_name !== model.repo_id && <span className='ctbl__secondary'>{model.repo_id}</span>}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            width: 'minmax(0, 1fr)',
            render: model => <StatusBadge status={model.status} />
        },
        {
            key: 'source',
            header: 'Source',
            width: 'minmax(0, 0.9fr)',
            render: model => <span className='ctbl__secondary'>{model.source}</span>
        },
        {
            key: 'size',
            header: 'Size',
            width: 'minmax(0, 0.7fr)',
            render: model => <span>{formatBytes(model.total_size_bytes)}</span>
        },
        {
            key: 'revision',
            header: 'Revision',
            width: 'minmax(0, 0.9fr)',
            render: model => <span className='ctbl__mono'>{model.revision}</span>
        },
        {
            key: 'last_used',
            header: 'Last used',
            width: 'minmax(0, 0.9fr)',
            render: model => <span className={staleClass(model.last_used_at)}>{model.last_used_at ? formatRelativeTime(model.last_used_at) : 'never used'}</span>
        },
        {
            key: 'updated',
            header: 'Updated',
            width: 'minmax(0, 0.9fr)',
            render: model => <span className='ctbl__secondary'>{formatRelativeTime(model.updated_at)}</span>
        }
    ];

    return (
        <div className='model-cache__catalog'>
            <Paginate
                preferencesKey='model-cache-catalog'
                page={page}
                onPageChange={onPageChange}
                data={models}
                totalItems={total}
                serverSide={true}
                emptyState={() => (
                    <EmptyState icon='fa fa-database'>
                        <h4>No models found</h4>
                        <h5>Download a model to get started, or adjust your filters.</h5>
                    </EmptyState>
                )}>
                {pageModels => (
                    <DataTable<ModelSummary>
                        ariaLabel='Model catalog'
                        columns={columns}
                        rows={isLoading ? [] : pageModels}
                        loading={isLoading}
                        rowKey={model => model.id}
                        onRowClick={model => onRowClick(model.id)}
                        isRowSelected={model => selectedIds.has(model.id)}
                    />
                )}
            </Paginate>
        </div>
    );
};
