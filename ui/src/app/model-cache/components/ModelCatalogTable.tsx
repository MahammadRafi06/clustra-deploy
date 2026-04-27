import {Checkbox} from 'argo-ui';
import React from 'react';

import {EmptyState, Paginate} from '../../shared/components';
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

function staleTone(iso: string | null): Tone {
    if (!iso) {
        return 'warning';
    }
    const days = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (days > 90) {
        return 'danger';
    }
    if (days > 30) {
        return 'warning';
    }
    return 'muted';
}

function lastUsedLabel(iso: string | null): string {
    return iso ? formatRelativeTime(iso) : 'never used';
}

export const ModelCatalogTable: React.FC<Props> = ({models, total, page, selectedIds, onSelect, onSelectAll, onRowClick, onPageChange, isLoading}) => {
    const renderTable = (pageModels: ModelSummary[]) => (
        <div className='argo-table-list argo-table-list--clickable'>
            <div className='argo-table-list__head'>
                <div className='row'>
                    <div className='columns small-1'>
                        <Checkbox checked={selectedIds.size === models.length && models.length > 0} onChange={onSelectAll} />
                    </div>
                    <div className='columns small-4'>MODEL</div>
                    <div className='columns small-2'>STATUS</div>
                    <div className='columns small-1'>SOURCE</div>
                    <div className='columns small-1'>SIZE</div>
                    <div className='columns small-1'>REVISION</div>
                    <div className='columns small-1'>LAST USED</div>
                    <div className='columns small-1'>UPDATED</div>
                </div>
            </div>

            {pageModels.map(model => (
                <div
                    key={model.id}
                    className={`argo-table-list__row model-cache__table-row${selectedIds.has(model.id) ? ' model-cache__table-row--selected' : ''}`}
                    onClick={() => onRowClick(model.id)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(model.id);
                        }
                    }}
                    role='button'
                    tabIndex={0}
                    aria-label={`Open details for ${model.display_name || model.repo_id}`}>
                    <div className='row'>
                        <div className='columns small-1' onClick={event => event.stopPropagation()}>
                            <Checkbox checked={selectedIds.has(model.id)} onChange={() => onSelect(model.id)} />
                        </div>
                        <div className='columns small-4'>
                            <div className='model-cache__model-main'>
                                <div className='model-cache__model-name'>
                                    {model.pinned && <i className='fa fa-thumb-tack model-cache__text--warning' />}
                                    <span>{model.display_name || model.repo_id}</span>
                                    {model.model_kind && (
                                        <StatusBadge tone={kindTone(model.model_kind)} size='small'>
                                            {model.model_kind}
                                        </StatusBadge>
                                    )}
                                    {model.update_available && (
                                        <StatusBadge tone='accent' size='small'>
                                            update
                                        </StatusBadge>
                                    )}
                                </div>
                                {model.display_name && <div className='model-cache__model-meta'>{model.repo_id}</div>}
                            </div>
                        </div>
                        <div className='columns small-2'>
                            <StatusBadge status={model.status} size='small' />
                        </div>
                        <div className='columns small-1'>
                            <span className='model-cache__table-meta'>{model.source}</span>
                        </div>
                        <div className='columns small-1'>{formatBytes(model.total_size_bytes)}</div>
                        <div className='columns small-1'>
                            <code className='model-cache__table-code'>{model.revision}</code>
                        </div>
                        <div className='columns small-1'>
                            <span className={`model-cache__text--${staleTone(model.last_used_at)}`}>{lastUsedLabel(model.last_used_at)}</span>
                        </div>
                        <div className='columns small-1'>
                            <span className='model-cache__table-meta'>{formatRelativeTime(model.updated_at)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    if (isLoading) {
        return (
            <div className='model-cache__catalog'>
                <div className='argo-table-list argo-table-list--clickable'>
                    <div className='argo-table-list__head'>
                        <div className='row'>
                            <div className='columns small-1'>
                                <Checkbox checked={false} onChange={() => undefined} />
                            </div>
                            <div className='columns small-4'>MODEL</div>
                            <div className='columns small-2'>STATUS</div>
                            <div className='columns small-1'>SOURCE</div>
                            <div className='columns small-1'>SIZE</div>
                            <div className='columns small-1'>REVISION</div>
                            <div className='columns small-1'>LAST USED</div>
                            <div className='columns small-1'>UPDATED</div>
                        </div>
                    </div>
                    <div className='argo-table-list__row'>
                        <div className='row'>
                            <div className='columns small-12 model-cache__table-empty'>Loading…</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                {pageModels => renderTable(pageModels)}
            </Paginate>
        </div>
    );
};
