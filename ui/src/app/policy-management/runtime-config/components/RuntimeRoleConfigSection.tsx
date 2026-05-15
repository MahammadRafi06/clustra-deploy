import * as React from 'react';

import type {RuntimeConfigCatalogItemRecord, RuntimeConfigKind, RuntimeConfigRoleEntry} from '../../api/types';
import type {RuntimeDocument} from '../runtimeConfigTypes';
import {
    editableDefaultValue,
    formatRuntimeValue,
    getRoleSelection,
    hasDefaultValue,
    isFlagArg,
    itemChoices,
    itemDefault,
    itemDescription,
    itemDisplayKey,
    itemLabel,
    itemRowKey,
    itemType
} from '../runtimeConfigUtils';

export const RuntimeRoleConfigSection: React.FC<{
    role: RuntimeConfigRoleEntry;
    kind: RuntimeConfigKind;
    document: RuntimeDocument;
    items: RuntimeConfigCatalogItemRecord[];
    hiddenRows: Record<string, boolean>;
    addedRows: Record<string, boolean>;
    advancedOpen: boolean;
    lessFrequentSearch: string;
    onToggleAdvanced: (value: boolean) => void;
    onSearch: (value: string) => void;
    onAdd: (item: RuntimeConfigCatalogItemRecord) => void;
    onRemove: (item: RuntimeConfigCatalogItemRecord) => void;
    onRestore: () => void;
    onChange: (item: RuntimeConfigCatalogItemRecord, value: unknown) => void;
}> = ({role, kind, document, items, hiddenRows, addedRows, advancedOpen, lessFrequentSearch, onToggleAdvanced, onSearch, onAdd, onRemove, onRestore, onChange}) => {
    const selection = getRoleSelection(document, role.role, kind);
    const search = lessFrequentSearch.trim().toLowerCase();
    const configurableItems = items.filter(item => !item.aic || selection[item.name] !== undefined);
    const visibleItems = configurableItems.filter(item => {
        const key = itemRowKey(role.role, kind, item.name);
        const selected = selection[item.name] !== undefined;
        if (hiddenRows[key]) {
            return false;
        }
        if (item.ui === 'primary') {
            return true;
        }
        if (item.ui === 'advanced') {
            return advancedOpen || selected || addedRows[key];
        }
        return selected || addedRows[key];
    });
    const visibleNames = new Set(visibleItems.map(item => item.name));
    const advancedCount = configurableItems.filter(item => item.ui === 'advanced').length;
    const lessFrequentMatches = search
        ? configurableItems
              .filter(item => !visibleNames.has(item.name))
              .filter(item => item.ui === 'less_frequent')
              .filter(item => `${item.name} ${itemDescription(item)} ${itemDisplayKey(item)}`.toLowerCase().includes(search))
              .slice(0, 12)
        : [];
    const selected = Object.keys(selection).length;
    const title = kind === 'args' ? 'Args' : 'Envs';
    return (
        <section className='policy-management__runtime-role-card'>
            <div className='policy-management__runtime-role-card-header'>
                <div>
                    <div className='policy-management__runtime-role-title'>
                        {title}
                        <span className='policy-management__badge policy-management__badge--accent'>{selected} selected</span>
                    </div>
                </div>
                <div className='policy-management__toolbar-actions'>
                    <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => onToggleAdvanced(!advancedOpen)}>
                        {advancedOpen ? 'Hide advanced' : `Advanced (${advancedCount})`}
                    </button>
                    <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={onRestore}>
                        Reset rows
                    </button>
                </div>
            </div>
            <RuntimeConfigValueTable items={visibleItems} role={role.role} kind={kind} document={document} onChange={onChange} onRemove={onRemove} />
            <div className='policy-management__runtime-less-frequent'>
                <label className='policy-management__filter-field policy-management__filter-field--search'>
                    <span className='policy-management__filter-label'>Add less-frequent {kind}</span>
                    <span className='policy-management__search-shell'>
                        <i className='fa fa-search' aria-hidden='true' />
                        <input
                            className='argo-field policy-management__search'
                            aria-label={`${role.role}.${kind}.less_frequent_search`}
                            placeholder='Search catalog by name or description'
                            value={lessFrequentSearch}
                            onChange={event => onSearch(event.target.value)}
                        />
                    </span>
                </label>
                {search && (
                    <div className='policy-management__runtime-add-list'>
                        {lessFrequentMatches.length ? (
                            lessFrequentMatches.map(item => (
                                <button key={item.name} type='button' className='policy-management__runtime-add-row' onClick={() => onAdd(item)}>
                                    <span>
                                        <strong>{itemLabel(item)}</strong>
                                    </span>
                                    <i className='fa fa-info-circle' aria-hidden='true' title={itemDescription(item)} />
                                    <i className='fa fa-plus' aria-hidden='true' />
                                </button>
                            ))
                        ) : (
                            <div className='policy-management__empty-inline'>No less-frequent matches.</div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

const RuntimeConfigValueTable: React.FC<{
    items: RuntimeConfigCatalogItemRecord[];
    role: string;
    kind: RuntimeConfigKind;
    document: RuntimeDocument;
    onChange: (item: RuntimeConfigCatalogItemRecord, value: unknown) => void;
    onRemove: (item: RuntimeConfigCatalogItemRecord) => void;
}> = ({items, role, kind, document, onChange, onRemove}) => {
    if (!items.length) {
        return <div className='policy-management__empty-inline'>No visible {kind}. Use Advanced or search to add more fields.</div>;
    }
    return (
        <div className='policy-management__runtime-value-table'>
            <div className='policy-management__runtime-value-head'>
                <div>Field</div>
                <div>Default value</div>
                <div>User value</div>
                <div>Actions</div>
            </div>
            {items.map(item => {
                const value = getRoleSelection(document, role, kind)[item.name];
                return (
                    <div className='policy-management__runtime-value-row' key={`${item.catalog_id}:${item.name}`}>
                        <div className='policy-management__runtime-item-meta'>
                            <div className='policy-management__runtime-item-title'>
                                <span>{itemLabel(item)}</span>
                                <i className='fa fa-info-circle policy-management__runtime-help-icon' aria-hidden='true' title={itemDescription(item)} />
                                {item.aic && <span className='policy-management__badge policy-management__badge--warning'>AIC</span>}
                            </div>
                        </div>
                        <div className='policy-management__runtime-default-cell'>
                            <code>{itemDefault(item)}</code>
                        </div>
                        <div className='policy-management__runtime-value-cell'>
                            <RuntimeValueInput item={item} role={role} kind={kind} value={value} onChange={value => onChange(item, value)} />
                        </div>
                        <div className='policy-management__row-actions'>
                            <button
                                type='button'
                                className='argo-button argo-button--base-o policy-management__icon-button'
                                title='Copy default'
                                aria-label={`Copy default ${role}.${kind}.${item.name}`}
                                disabled={item.aic || !hasDefaultValue(item)}
                                onClick={() => onChange(item, editableDefaultValue(item))}>
                                <i className='fa fa-clone' aria-hidden='true' />
                            </button>
                            <button
                                type='button'
                                className='argo-button argo-button--base-o policy-management__icon-button policy-management__button--danger'
                                title='Remove row'
                                aria-label={`Remove ${role}.${kind}.${item.name}`}
                                onClick={() => onRemove(item)}>
                                <i className='fa fa-times' aria-hidden='true' />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const RuntimeValueInput: React.FC<{
    item: RuntimeConfigCatalogItemRecord;
    role: string;
    kind: RuntimeConfigKind;
    value: unknown;
    onChange: (value: unknown) => void;
}> = ({item, role, kind, value, onChange}) => {
    const disabled = item.aic;
    const type = itemType(item);
    const label = `${role}.${kind}.${item.name}`;
    const choices = itemChoices(item);
    if (choices?.length) {
        const selectedValue = value === undefined || value === '' ? '' : JSON.stringify(value) || String(value);
        return (
            <select
                className='argo-field'
                aria-label={label}
                disabled={disabled}
                value={selectedValue}
                onChange={event => {
                    if (!event.target.value) {
                        onChange(undefined);
                        return;
                    }
                    try {
                        onChange(JSON.parse(event.target.value));
                    } catch {
                        onChange(event.target.value);
                    }
                }}>
                <option value=''>Not emitted</option>
                {choices.map(choice => {
                    const optionValue = JSON.stringify(choice) || String(choice);
                    return (
                        <option key={optionValue} value={optionValue}>
                            {String(choice)}
                        </option>
                    );
                })}
            </select>
        );
    }
    if (isFlagArg(item)) {
        return (
            <select
                className='argo-field'
                aria-label={label}
                disabled={disabled}
                value={value === false ? 'false' : value === true || value === null ? 'true' : ''}
                onChange={event => onChange(event.target.value || undefined)}>
                <option value=''>Not emitted</option>
                <option value='true'>Enabled</option>
                {item.record?.false_arg && <option value='false'>Disabled</option>}
            </select>
        );
    }
    if (type.includes('bool')) {
        return (
            <select
                className='argo-field'
                aria-label={label}
                disabled={disabled}
                value={value === true ? 'true' : value === false ? 'false' : ''}
                onChange={event => onChange(event.target.value || undefined)}>
                <option value=''>Not emitted</option>
                <option value='true'>true</option>
                <option value='false'>false</option>
            </select>
        );
    }
    if (type.includes('dict') || type.includes('object') || type.includes('list') || type.includes('array')) {
        return (
            <textarea
                className='argo-field policy-management__runtime-json-value'
                aria-label={label}
                disabled={disabled}
                value={formatRuntimeValue(value)}
                placeholder={type.includes('list') || type.includes('array') ? 'JSON array, not emitted when empty' : 'JSON object, not emitted when empty'}
                onChange={event => onChange(event.target.value)}
            />
        );
    }
    return (
        <input
            className='argo-field'
            aria-label={label}
            disabled={disabled}
            value={formatRuntimeValue(value)}
            placeholder='Not emitted'
            onChange={event => onChange(event.target.value)}
        />
    );
};
