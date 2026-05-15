import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';

import type {
    PolicyApiClient,
    RuntimeConfigCatalogConcept,
    RuntimeConfigCatalogItemRecord,
    RuntimeConfigKind
} from '../../../api/types';
import {PolicyError} from '../../../components/PolicyError';
import {runtimeEngineLabel} from '../../runtimeConfigUtils';

type ListState = 'loading' | 'loaded' | 'error';
type ExpandedState = Record<string, {state: ListState; items?: RuntimeConfigCatalogItemRecord[]; error?: unknown}>;

const KIND_OPTIONS: Array<{value: '' | RuntimeConfigKind; label: string}> = [
    {value: '', label: 'Args + envs'},
    {value: 'args', label: 'Args only'},
    {value: 'envs', label: 'Envs only'}
];

/**
 * Cross-engine catalog browser organized by `concept` (e.g. tensor_parallel,
 * pipeline_parallel). Drilling into a concept fetches the matching items and
 * groups them by engine so an admin can see "how does each engine spell this?".
 */
export const ConceptBrowser: React.FC<{client: PolicyApiClient}> = ({client}) => {
    const [concepts, setConcepts] = useState<RuntimeConfigCatalogConcept[]>([]);
    const [total, setTotal] = useState(0);
    const [listState, setListState] = useState<ListState>('loaded');
    const [listError, setListError] = useState<unknown | null>(null);
    const [kindFilter, setKindFilter] = useState<'' | RuntimeConfigKind>('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<ExpandedState>({});

    useEffect(() => {
        let cancelled = false;
        setListState('loading');
        setListError(null);
        (async () => {
            try {
                const result = await client.listRuntimeConfigCatalogConcepts({kind: kindFilter || undefined});
                if (!cancelled) {
                    setConcepts(result.concepts);
                    setTotal(result.total);
                    setListState('loaded');
                    setExpanded({}); // re-collapse on filter change
                }
            } catch (error) {
                if (!cancelled) {
                    setListError(error);
                    setListState('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [client, kindFilter]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return concepts;
        return concepts.filter(entry => {
            if (entry.concept.toLowerCase().includes(query)) return true;
            return entry.engines.some(engine => engine.toLowerCase().includes(query) || runtimeEngineLabel(engine).toLowerCase().includes(query));
        });
    }, [concepts, search]);

    async function toggleExpand(concept: string) {
        if (expanded[concept]) {
            setExpanded(prev => {
                const next = {...prev};
                delete next[concept];
                return next;
            });
            return;
        }
        setExpanded(prev => ({...prev, [concept]: {state: 'loading'}}));
        try {
            const result = await client.listRuntimeConfigCatalogItems({
                concept,
                kind: kindFilter || undefined,
                active: true,
                limit: 500,
                offset: 0
            });
            setExpanded(prev => ({...prev, [concept]: {state: 'loaded', items: result.items}}));
        } catch (error) {
            setExpanded(prev => ({...prev, [concept]: {state: 'error', error}}));
        }
    }

    return (
        <section className='rcfg-v2-concept-browser' aria-label='Catalog concepts'>
            <header className='rcfg-v2-concept-browser__head'>
                <div>
                    <h2><i className='fa fa-link' aria-hidden='true' /> Catalog concepts</h2>
                    <p>
                        Cross-engine map of catalog items grouped by <code>concept</code>. Useful for "set X on every engine that supports this knob".
                    </p>
                </div>
                <div className='rcfg-v2-concept-browser__controls'>
                    <label className='rcfg-v2-select'>
                        <span>Kind</span>
                        <select
                            className='argo-field'
                            value={kindFilter}
                            aria-label='Filter by kind'
                            onChange={event => setKindFilter(event.target.value as '' | RuntimeConfigKind)}>
                            {KIND_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className='rcfg-v2-search rcfg-v2-search--inline'>
                        <i className='fa fa-search' aria-hidden='true' />
                        <input
                            className='argo-field'
                            type='search'
                            placeholder='Search concept or engine…'
                            value={search}
                            aria-label='Search concepts'
                            onChange={event => setSearch(event.target.value)}
                        />
                        {search && (
                            <button type='button' className='rcfg-v2-search__clear' onClick={() => setSearch('')} aria-label='Clear search'>
                                <i className='fa fa-times' aria-hidden='true' />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {listError && <PolicyError error={listError} prefix='Could not load concept list' />}

            {listState === 'loading' ? (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                    <p>Loading concepts…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className='rcfg-v2-empty'>
                    <i className='fa fa-link' aria-hidden='true' />
                    <p>{total === 0 ? 'No catalog records carry a concept yet.' : 'No concepts match your search.'}</p>
                </div>
            ) : (
                <ul className='rcfg-v2-concept-list'>
                    {filtered.map(entry => {
                        const detail = expanded[entry.concept];
                        const isOpen = !!detail;
                        return (
                            <li key={entry.concept} className='rcfg-v2-concept-row'>
                                <button
                                    type='button'
                                    className='rcfg-v2-concept-row__head'
                                    onClick={() => toggleExpand(entry.concept)}
                                    aria-expanded={isOpen}>
                                    <i className={`fa ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'} rcfg-v2-concept-row__caret`} aria-hidden='true' />
                                    <code className='rcfg-v2-concept-row__name'>{entry.concept}</code>
                                    <span className='rcfg-v2-concept-row__count'>{entry.item_count} item{entry.item_count === 1 ? '' : 's'}</span>
                                    <span className='rcfg-v2-concept-row__engines'>
                                        {entry.engines.map(engine => (
                                            <span key={engine} className='rcfg-v2-chip rcfg-v2-chip--engine'>{runtimeEngineLabel(engine)}</span>
                                        ))}
                                    </span>
                                </button>
                                {isOpen && (
                                    <div className='rcfg-v2-concept-row__detail'>
                                        {detail.state === 'loading' && (
                                            <div className='rcfg-v2-empty'>
                                                <i className='fa fa-spinner fa-spin' aria-hidden='true' /> Loading items…
                                            </div>
                                        )}
                                        {detail.state === 'error' && detail.error && (
                                            <PolicyError error={detail.error} prefix='Could not load items' />
                                        )}
                                        {detail.state === 'loaded' && detail.items && (
                                            <ItemsByEngine items={detail.items} />
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

const ItemsByEngine: React.FC<{items: RuntimeConfigCatalogItemRecord[]}> = ({items}) => {
    const grouped = useMemo(() => {
        const buckets = new Map<string, RuntimeConfigCatalogItemRecord[]>();
        items.forEach(item => {
            const list = buckets.get(item.engine) || [];
            list.push(item);
            buckets.set(item.engine, list);
        });
        return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [items]);

    if (grouped.length === 0) {
        return <p className='rcfg-v2-concept-row__empty'>No active items carry this concept.</p>;
    }

    return (
        <div className='rcfg-v2-concept-row__engines-detail'>
            {grouped.map(([engine, engineItems]) => (
                <article key={engine} className='rcfg-v2-concept-engine'>
                    <header>
                        <strong>{runtimeEngineLabel(engine)}</strong>
                        <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{engineItems.length}</span>
                    </header>
                    <table className='rcfg-v2-concept-engine__table'>
                        <thead>
                            <tr>
                                <th>Catalog name</th>
                                <th>Kind</th>
                                <th>Surface</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {engineItems.map(item => {
                                const argName = typeof item.record.arg === 'string' ? item.record.arg : null;
                                const envName = typeof item.record.env_var === 'string' ? item.record.env_var : null;
                                const surface = item.kind === 'args' ? (argName || '—') : (envName || item.name);
                                return (
                                    <tr key={`${item.catalog_id}:${item.name}`}>
                                        <td>
                                            <strong>{item.display_name || item.name}</strong>
                                            <small><code>{item.name}</code> · v{item.engine_version}</small>
                                        </td>
                                        <td><code>{item.kind}</code></td>
                                        <td><code>{surface}</code></td>
                                        <td>{item.type || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </article>
            ))}
        </div>
    );
};
