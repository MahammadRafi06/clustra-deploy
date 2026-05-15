import * as React from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';

import {itemLabel, roleLabel} from '../../runtimeConfigUtils';
import type {RuntimeConfigCatalogItemRecord, RuntimeConfigKind, RuntimeConfigRoleEntry} from '../types';
import {buildSearchIndex} from '../utils';

/**
 * Cmd+K palette for "jump to any flag in any role".
 *
 * Open/close is controlled by the parent so the global ⌘K shortcut can be
 * wired anywhere. Selection emits the (role, kind, item.name) tuple back to
 * the parent for navigation + scroll-to.
 */
export const GlobalSearch: React.FC<{
    open: boolean;
    onClose: () => void;
    roles: RuntimeConfigRoleEntry[];
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>;
    onJump: (role: string, kind: RuntimeConfigKind, name: string) => void;
}> = ({open, onClose, roles, itemsByRoleKind, onJump}) => {
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    const index = useMemo(() => buildSearchIndex(itemsByRoleKind, roles), [itemsByRoleKind, roles]);
    const results = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) {
            return index.slice(0, 12);
        }
        const tokens = trimmed.split(/\s+/);
        return index.filter(entry => tokens.every(token => entry.haystack.includes(token))).slice(0, 60);
    }, [index, query]);

    useEffect(() => {
        if (open) {
            setQuery('');
            setHighlight(0);
            window.setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => {
        setHighlight(0);
    }, [query]);

    useEffect(() => {
        if (!open) return;
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlight(idx => Math.min(results.length - 1, idx + 1));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlight(idx => Math.max(0, idx - 1));
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const target = results[highlight];
                if (target) {
                    onJump(target.role, target.kind, target.item.name);
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [highlight, onClose, onJump, open, results]);

    useEffect(() => {
        const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
        node?.scrollIntoView({block: 'nearest'});
    }, [highlight]);

    if (!open) return null;

    return (
        <div className='rcfg-v2-palette' role='dialog' aria-modal='true' aria-label='Find any flag'>
            <div className='rcfg-v2-palette__scrim' onClick={onClose} aria-hidden='true' />
            <div className='rcfg-v2-palette__panel'>
                <div className='rcfg-v2-palette__input-row'>
                    <i className='fa fa-search' aria-hidden='true' />
                    <input
                        ref={inputRef}
                        type='text'
                        className='rcfg-v2-palette__input'
                        placeholder='Find any arg or env across all roles…'
                        value={query}
                        aria-label='Search flags'
                        onChange={event => setQuery(event.target.value)}
                    />
                    <kbd>Esc</kbd>
                </div>
                <div ref={listRef} className='rcfg-v2-palette__results' role='listbox'>
                    {!results.length ? (
                        <div className='rcfg-v2-palette__empty'>No matches.</div>
                    ) : (
                        results.map((entry, index) => (
                            <button
                                key={`${entry.role}:${entry.kind}:${entry.item.name}`}
                                role='option'
                                aria-selected={index === highlight}
                                data-index={index}
                                type='button'
                                className={`rcfg-v2-palette__result ${index === highlight ? 'is-highlighted' : ''}`}
                                onMouseEnter={() => setHighlight(index)}
                                onClick={() => {
                                    onJump(entry.role, entry.kind, entry.item.name);
                                    onClose();
                                }}>
                                <div className='rcfg-v2-palette__result-main'>
                                    <span className='rcfg-v2-palette__result-name'>{itemLabel(entry.item)}</span>
                                    <code>{entry.item.name}</code>
                                </div>
                                <div className='rcfg-v2-palette__result-meta'>
                                    <span>{roleFromEntry(entry, roles)}</span>
                                    <span className='rcfg-v2-palette__result-kind'>{entry.kind}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
                <footer className='rcfg-v2-palette__footer'>
                    <span>
                        <kbd>↑↓</kbd> navigate
                    </span>
                    <span>
                        <kbd>↵</kbd> jump
                    </span>
                    <span>
                        <kbd>Esc</kbd> close
                    </span>
                </footer>
            </div>
        </div>
    );
};

function roleFromEntry(entry: {role: string; roleLabel: string}, roles: RuntimeConfigRoleEntry[]): string {
    const match = roles.find(role => role.role === entry.role);
    return match ? roleLabel(match) : entry.roleLabel;
}
