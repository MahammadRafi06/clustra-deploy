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
        <div className='model-cache__filters'>
            <input type='text' className='argo-field model-cache__search' placeholder='Search models' value={filters.search} onChange={e => update({search: e.target.value})} />

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
                title={filters.sort_order === 'desc' ? 'Descending' : 'Ascending'}>
                <i className={`fa fa-sort-amount-${filters.sort_order === 'desc' ? 'desc' : 'asc'}`} />
            </button>

            <button
                type='button'
                className={`argo-button ${filters.pinned ? 'argo-button--base' : 'argo-button--base-o'} model-cache__button`}
                onClick={() => update({pinned: filters.pinned === true ? undefined : true})}
                title='Show pinned only'>
                <i className='fa fa-thumb-tack' /> Pinned
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

            <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={onRefresh} disabled={refreshing} title='Refresh data'>
                <i className={`fa fa-refresh${refreshing ? ' fa-spin' : ''}`} /> Refresh
            </button>

            <button type='button' className='argo-button argo-button--base-o model-cache__button' onClick={onRescan} disabled={rescanning} title='Force agent rescan of disk'>
                <i className={`fa fa-hdd-o${rescanning ? ' fa-spin' : ''}`} /> {rescanning ? 'Rescanning…' : 'Rescan'}
            </button>

            {!airgapped && (
                <button type='button' className='argo-button argo-button--base model-cache__button' onClick={onDownload}>
                    <i className='fa fa-download' /> Download Model
                </button>
            )}
        </div>
    );
};
