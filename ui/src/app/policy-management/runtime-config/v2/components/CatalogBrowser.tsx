import * as React from 'react';
import {useMemo, useState} from 'react';

import {getRoleSelection, itemDescription, itemDisplayKey, itemLabel, roleLabel, runtimeCatalogScopeLabel, setRoleValue} from '../../runtimeConfigUtils';
import type {FieldDensity, RoleFilter, RuntimeConfigCatalogItemRecord, RuntimeConfigKind, RuntimeConfigRoleEntry, RuntimeDocument} from '../types';
import {fieldErrorKey, groupByCategory, isModifiedRow, itemMatchesRoleFilter, roleFilterCounts} from '../utils';
import {FieldControl} from './FieldControl';
import {RadioGroup, RadioOption} from './RadioGroup';

const KIND_LABEL: Record<RuntimeConfigKind, string> = {args: 'CLI args', envs: 'Environment variables'};

const FILTER_OPTIONS: Array<{value: RoleFilter; label: string; helper: string}> = [
    {value: 'essentials', label: 'Essentials', helper: 'The few flags most users tune (5–15 fields)'},
    {value: 'latency', label: 'Latency', helper: 'Time-to-first-token, response time'},
    {value: 'throughput', label: 'Throughput', helper: 'Batching, parallelism'},
    {value: 'memory', label: 'Memory', helper: 'GPU memory, KV cache'},
    {value: 'stability', label: 'Stability', helper: 'Timeouts, health, retries'},
    {value: 'debug', label: 'Debug', helper: 'Logging, metrics, traces'},
    {value: 'all', label: 'All', helper: 'Every field in the catalog'}
];

export const CatalogBrowser: React.FC<{
    role: RuntimeConfigRoleEntry;
    document: RuntimeDocument;
    items: Record<RuntimeConfigKind, RuntimeConfigCatalogItemRecord[]>;
    onChange: (next: RuntimeDocument) => void;
    onlyModified: boolean;
    density: FieldDensity;
    /** Unified axis state replacing the previous bucket + goal pair. */
    filter: RoleFilter;
    onFilterChange: (next: RoleFilter) => void;
    hideAic: boolean;
    onToggleHideAic: (next: boolean) => void;
    /** Names of fields the parent policy locks. Locked fields render disabled. */
    lockedFields?: Set<string>;
    lockedByLabel?: string;
    /** Function returning the inherited value for a field, when available. */
    inheritedValueFor?: (kind: RuntimeConfigKind, name: string) => unknown;
    /** Live validation errors keyed by `role:kind:name`. */
    fieldErrors?: Record<string, string>;
}> = ({
    role,
    document,
    items,
    onChange,
    onlyModified,
    density,
    filter,
    onFilterChange,
    hideAic,
    onToggleHideAic,
    lockedFields,
    lockedByLabel,
    inheritedValueFor,
    fieldErrors
}) => {
    const [activeKind, setActiveKind] = useState<RuntimeConfigKind>('args');
    const [query, setQuery] = useState('');

    const kindItems = items[activeKind] || [];
    const selection = getRoleSelection(document, role.role, activeKind);
    const totalArgs = Object.keys(getRoleSelection(document, role.role, 'args')).length;
    const totalEnvs = Object.keys(getRoleSelection(document, role.role, 'envs')).length;
    const totalOverrides = totalArgs + totalEnvs;

    // Counts for the unified axis (calculated against the post-AIC / post-onlyModified base set
    // so the chips reflect what's actually reachable now).
    const visibleAfterAicAndOnlyModified = useMemo(() => {
        return kindItems.filter(item => {
            if (hideAic && item.aic && !(item.name in selection)) return false;
            if (onlyModified && !isModifiedRow(item, selection)) return false;
            return true;
        });
    }, [kindItems, hideAic, onlyModified, selection]);

    const fCounts = useMemo(() => roleFilterCounts(visibleAfterAicAndOnlyModified), [visibleAfterAicAndOnlyModified]);

    // Final filtered set: axis + search + only-modified + hideAic
    const filtered = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        return kindItems.filter(item => {
            // Always keep a row if the user has explicitly set it — visibility
            // should never lose a user's existing override.
            const userSet = item.name in selection;
            if (hideAic && item.aic && !userSet) return false;
            if (onlyModified && !isModifiedRow(item, selection)) return false;
            // Search bypasses axis filter so power users can reach any field.
            if (trimmed) {
                const haystack = [item.name, itemLabel(item), itemDescription(item), itemDisplayKey(item)].join(' ').toLowerCase();
                return haystack.includes(trimmed);
            }
            if (!userSet) {
                if (!itemMatchesRoleFilter(item, filter)) return false;
            }
            return true;
        });
    }, [kindItems, hideAic, onlyModified, selection, query, filter]);

    const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

    function setField(item: RuntimeConfigCatalogItemRecord, value: unknown) {
        onChange(setRoleValue(document, role.role, item.kind, item.name, value));
    }

    function reset(item: RuntimeConfigCatalogItemRecord) {
        onChange(setRoleValue(document, role.role, item.kind, item.name, undefined));
    }

    return (
        <section className='rcfg-v2-browser' aria-label={`Configure ${roleLabel(role)}`}>
            <header className='rcfg-v2-browser__head'>
                <div>
                    <h2 className='rcfg-v2-browser__title'>{roleLabel(role)}</h2>
                    <div className='rcfg-v2-browser__sub'>
                        <span className='rcfg-v2-chip'>{runtimeCatalogScopeLabel(role.catalog_scope)}</span>
                        <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{totalOverrides} override(s) in this role</span>
                    </div>
                </div>
                <div className='rcfg-v2-kind-toggle' role='tablist' aria-label='Switch between CLI args and env vars'>
                    {(['args', 'envs'] as RuntimeConfigKind[]).map(kind => {
                        const count = Object.keys(getRoleSelection(document, role.role, kind)).length;
                        return (
                            <button
                                key={kind}
                                type='button'
                                role='tab'
                                aria-selected={activeKind === kind}
                                className={`rcfg-v2-kind-toggle__opt ${activeKind === kind ? 'is-active' : ''}`}
                                onClick={() => setActiveKind(kind)}>
                                {KIND_LABEL[kind]}
                                {count > 0 && <span className='rcfg-v2-kind-toggle__count'>{count}</span>}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Unified filter axis: replaces the previous Goal + Bucket dual-axis
                pair. Options whose count is 0 are hidden (except the currently
                selected one, which stays visible so the user can see "you've
                filtered yourself into nothing"). */}
            <RadioGroup label='Filter fields' value={filter} onChange={value => onFilterChange(value as RoleFilter)} className='rcfg-v2-axis'>
                {FILTER_OPTIONS.filter(option => option.value === filter || option.value === 'essentials' || option.value === 'all' || fCounts[option.value] > 0).map(option => (
                    <RadioOption key={option.value} value={option.value} className='rcfg-v2-axis__opt' title={option.helper}>
                        <span>{option.label}</span>
                        <small>{fCounts[option.value]}</small>
                    </RadioOption>
                ))}
            </RadioGroup>

            {/* Inline search + AIC toggle row */}
            <div className='rcfg-v2-disclosure-bar'>
                <div className='rcfg-v2-search'>
                    <i className='fa fa-search' aria-hidden='true' />
                    <input
                        className='argo-field'
                        type='search'
                        placeholder={`Search ${KIND_LABEL[activeKind].toLowerCase()}…`}
                        value={query}
                        aria-label={`Search ${KIND_LABEL[activeKind]} in ${roleLabel(role)}`}
                        onChange={event => setQuery(event.target.value)}
                    />
                    {query && (
                        <button type='button' className='rcfg-v2-search__clear' onClick={() => setQuery('')} aria-label='Clear search'>
                            <i className='fa fa-times' aria-hidden='true' />
                        </button>
                    )}
                </div>
                <label className='rcfg-v2-aic-toggle' title='Show fields controlled by AI Configurator (read-only)'>
                    <input type='checkbox' checked={!hideAic} onChange={event => onToggleHideAic(!event.target.checked)} />
                    <span>Show AIC</span>
                </label>
            </div>

            {!filtered.length ? (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-filter' aria-hidden='true' />
                    {query ? (
                        <>
                            <p>
                                No fields match <code>{query}</code>.
                            </p>
                            <button type='button' className='argo-button argo-button--base-o' onClick={() => setQuery('')}>
                                Clear search
                            </button>
                        </>
                    ) : onlyModified ? (
                        <p>You haven't modified anything in this role yet.</p>
                    ) : filter !== 'all' ? (
                        <>
                            <p>
                                No fields under <strong>{filter}</strong>.
                            </p>
                            <button type='button' className='argo-button argo-button--base-o' onClick={() => onFilterChange('all')}>
                                Show all fields
                            </button>
                        </>
                    ) : (
                        <p>The catalog has no items for this role yet.</p>
                    )}
                </div>
            ) : (
                <>
                    <div className='rcfg-v2-browser__result-meta'>
                        Showing <strong>{filtered.length}</strong> of {kindItems.length} field(s)
                        {filter !== 'all' && !query && (
                            <>
                                {' '}
                                ·{' '}
                                <button type='button' className='rcfg-v2-link' onClick={() => onFilterChange('all')}>
                                    Show all {kindItems.length}
                                </button>
                            </>
                        )}
                    </div>
                    <div className='rcfg-v2-browser__groups'>
                        {grouped.map(group => (
                            <CategoryBlock
                                key={`${role.role}:${activeKind}:${group.key}`}
                                label={group.label}
                                items={group.items}
                                selection={selection}
                                onChange={setField}
                                onReset={reset}
                                role={role.role}
                                kind={activeKind}
                                density={density}
                                lockedFields={lockedFields}
                                lockedByLabel={lockedByLabel}
                                inheritedValueFor={inheritedValueFor}
                                fieldErrors={fieldErrors}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
};

const CategoryBlock: React.FC<{
    label: string;
    items: RuntimeConfigCatalogItemRecord[];
    selection: Record<string, unknown>;
    onChange: (item: RuntimeConfigCatalogItemRecord, value: unknown) => void;
    onReset: (item: RuntimeConfigCatalogItemRecord) => void;
    role: string;
    kind: RuntimeConfigKind;
    density: FieldDensity;
    lockedFields?: Set<string>;
    lockedByLabel?: string;
    inheritedValueFor?: (kind: RuntimeConfigKind, name: string) => unknown;
    fieldErrors?: Record<string, string>;
}> = ({label, items, selection, onChange, onReset, role, kind, density, lockedFields, lockedByLabel, inheritedValueFor, fieldErrors}) => {
    const overrideCount = items.filter(item => isModifiedRow(item, selection)).length;
    // Auto-collapse big "wall" categories so the user isn't dumped into 24+ rows on land.
    // Categories with overrides stay open — the user clearly cares about those.
    const LARGE_CATEGORY_THRESHOLD = 12;
    const initiallyOpen = overrideCount > 0 || items.length <= LARGE_CATEGORY_THRESHOLD;
    const [open, setOpen] = useState(initiallyOpen);
    return (
        <section className='rcfg-v2-category'>
            <header className={`rcfg-v2-category__head ${open ? 'is-open' : ''}`}>
                <button type='button' className='rcfg-v2-category__toggle' onClick={() => setOpen(value => !value)} aria-expanded={open}>
                    <i className={`fa ${open ? 'fa-chevron-down' : 'fa-chevron-right'}`} aria-hidden='true' />
                    <span>{label}</span>
                    <small>{items.length} field(s)</small>
                </button>
                {overrideCount > 0 && <span className='rcfg-v2-chip rcfg-v2-chip--accent'>{overrideCount} modified</span>}
            </header>
            {open && (
                <div className={`rcfg-v2-category__list rcfg-v2-category__list--${density}`}>
                    {density === 'rows' && (
                        <div className='rcfg-v2-field-row-headings' aria-hidden='true'>
                            <span>Field</span>
                            <span>Default</span>
                            <span>Value</span>
                            <span>Impact</span>
                            <span />
                        </div>
                    )}
                    {items.map(item => {
                        const value = selection[item.name];
                        const isOverridden = item.name in selection && isModifiedRow(item, selection);
                        const locked = !!lockedFields?.has(item.name);
                        const inherited = inheritedValueFor ? inheritedValueFor(kind, item.name) : undefined;
                        const error = fieldErrors?.[fieldErrorKey(role, kind, item.name)];
                        return (
                            <FieldControl
                                key={item.name}
                                item={item}
                                role={role}
                                kind={kind}
                                value={value}
                                defaultValue={item.default_value}
                                isOverridden={isOverridden}
                                onChange={next => onChange(item, next)}
                                onReset={() => onReset(item)}
                                onRemove={item.name in selection ? () => onReset(item) : undefined}
                                density={density}
                                locked={locked}
                                lockedByLabel={lockedByLabel}
                                inheritedValue={inherited}
                                error={error}
                            />
                        );
                    })}
                </div>
            )}
        </section>
    );
};
