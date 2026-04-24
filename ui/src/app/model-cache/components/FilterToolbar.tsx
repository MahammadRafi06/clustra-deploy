import {Select} from 'argo-ui';
import React from 'react';

import {MODEL_STATUS_OPTIONS, SORT_OPTIONS, SOURCE_OPTIONS} from '../utils/constants';

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

export const FilterToolbar: React.FC<Props> = ({filters, onChange, onRefresh, onRescan, onDownload, refreshing, rescanning, airgapped}) => {
    const update = (partial: Partial<Filters>) => onChange({...filters, ...partial});

    return (
        <div className='model-cache__filters' role='search' aria-label='Model catalog filters'>
            <input
                type='text'
                className='argo-field model-cache__search'
                placeholder='Search models'
                value={filters.search}
                onChange={e => update({search: e.target.value})}
                aria-label='Search models'
            />

            <div className='model-cache__select model-cache__filter-select'>
                <Select
                    value={filters.status}
                    options={[{title: 'All Status', value: ''}, ...MODEL_STATUS_OPTIONS.map(option => ({title: option.label, value: option.value}))]}
                    placeholder='All Status'
                    onChange={option => update({status: option.value})}
                />
            </div>

            <div className='model-cache__select model-cache__filter-select'>
                <Select
                    value={filters.source}
                    options={[{title: 'All Sources', value: ''}, ...SOURCE_OPTIONS.map(option => ({title: option.label, value: option.value}))]}
                    placeholder='All Sources'
                    onChange={option => update({source: option.value})}
                />
            </div>

            <div className='model-cache__select model-cache__filter-select'>
                <Select
                    value={filters.sort_by}
                    options={SORT_OPTIONS.map(option => ({title: `Sort: ${option.label}`, value: option.value}))}
                    placeholder='Sort'
                    onChange={option => update({sort_by: option.value})}
                />
            </div>

            <button
                type='button'
                className={`argo-button ${filters.sort_order === 'desc' ? 'argo-button--base' : 'argo-button--base-o'} model-cache__button`}
                onClick={() => update({sort_order: filters.sort_order === 'desc' ? 'asc' : 'desc'})}
                title={filters.sort_order === 'desc' ? 'Descending' : 'Ascending'}
                aria-label={`Sort ${filters.sort_order === 'desc' ? 'descending' : 'ascending'}`}
            >
                <i className={`fa fa-sort-amount-${filters.sort_order === 'desc' ? 'desc' : 'asc'}`} aria-hidden='true' />
            </button>

            <button
                type='button'
                className={`argo-button ${filters.pinned ? 'argo-button--base' : 'argo-button--base-o'} model-cache__button`}
                onClick={() => update({pinned: filters.pinned === true ? undefined : true})}
                title='Show pinned only'
                aria-pressed={filters.pinned === true}
            >
                <i className='fa fa-thumb-tack' aria-hidden='true' /> Pinned
            </button>

            <div className='model-cache__select model-cache__filter-select'>
                <Select
                    value={filters.stale_days != null ? String(filters.stale_days) : ''}
                    options={[
                        {title: 'All Models', value: ''},
                        {title: 'Stale > 7d', value: '7'},
                        {title: 'Stale > 30d', value: '30'},
                        {title: 'Stale > 90d', value: '90'}
                    ]}
                    placeholder='All Models'
                    onChange={option => update({stale_days: option.value ? Number(option.value) : undefined})}
                />
            </div>

            <div className='model-cache__filters-spacer' />

            <button
                type='button'
                className='argo-button argo-button--base-o model-cache__button'
                onClick={onRefresh}
                disabled={refreshing}
                title='Refresh data'
                aria-label='Refresh model catalog'
            >
                <i className={`fa fa-refresh${refreshing ? ' fa-spin' : ''}`} aria-hidden='true' /> Refresh
            </button>

            <button
                type='button'
                className='argo-button argo-button--base-o model-cache__button'
                onClick={onRescan}
                disabled={rescanning}
                title='Force agent rescan of disk'
                aria-label='Force agent rescan of disk'
            >
                <i className={`fa fa-hdd-o${rescanning ? ' fa-spin' : ''}`} aria-hidden='true' /> {rescanning ? 'Rescanning…' : 'Rescan'}
            </button>

            {!airgapped && (
                <button type='button' className='argo-button argo-button--base model-cache__button' onClick={onDownload} aria-label='Download model'>
                    <i className='fa fa-download' aria-hidden='true' /> Download Model
                </button>
            )}
        </div>
    );
};
