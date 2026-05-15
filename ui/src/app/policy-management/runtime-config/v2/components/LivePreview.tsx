import * as React from 'react';
import {useMemo, useState} from 'react';

import type {RuntimeConfigCatalogItemRecord, RuntimeConfigRoleEntry, RuntimeDocument} from '../types';
import {buildPreviewLines, collectModified} from '../utils';
import {runtimeCatalogScopeLabel, roleLabel} from '../../runtimeConfigUtils';

type Tab = 'cli' | 'env' | 'diff' | 'json';

export const LivePreview: React.FC<{
    document: RuntimeDocument;
    roles: RuntimeConfigRoleEntry[];
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>;
    onJumpTo?: (role: string) => void;
    /** Auto-collapse when this changes between renders (e.g. on Scope view). */
    autoCollapse?: boolean;
}> = ({document, roles, itemsByRoleKind, onJumpTo, autoCollapse}) => {
    const [tab, setTab] = useState<Tab>('cli');
    const [collapsed, setCollapsed] = useState(!!autoCollapse);
    // When the parent flips autoCollapse (e.g. user navigates Scope ↔ Role),
    // sync the panel state. User can still manually collapse/expand from
    // the chevron, but the default tracks the context.
    React.useEffect(() => {
        setCollapsed(!!autoCollapse);
    }, [autoCollapse]);
    const {args, envs} = useMemo(() => buildPreviewLines(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const modified = useMemo(() => collectModified(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const byRole = useMemo(() => groupBy(args, line => line.role), [args]);
    const envsByRole = useMemo(() => groupBy(envs, line => line.role), [envs]);

    if (collapsed) {
        return (
            <aside className='rcfg-v2-preview rcfg-v2-preview--collapsed' aria-label='Live preview (collapsed)'>
                <button type='button' className='rcfg-v2-preview__collapse' onClick={() => setCollapsed(false)} aria-label='Expand live preview' title='Expand preview'>
                    <i className='fa fa-chevron-left' aria-hidden='true' />
                    <span>Preview ({args.length + envs.length})</span>
                </button>
            </aside>
        );
    }

    return (
        <aside className='rcfg-v2-preview' aria-label='Live preview of the deployment configuration'>
            <header className='rcfg-v2-preview__head'>
                <div>
                    <h3>Live preview</h3>
                    <p>What your deployment will receive.</p>
                </div>
                <button type='button' className='rcfg-v2-preview__collapse' onClick={() => setCollapsed(true)} aria-label='Collapse live preview' title='Collapse preview'>
                    <i className='fa fa-chevron-right' aria-hidden='true' />
                </button>
            </header>
            <div className='rcfg-v2-preview__tabs' role='tablist'>
                {(
                    [
                        {key: 'cli', label: 'CLI', count: args.length},
                        {key: 'env', label: 'Env', count: envs.length},
                        {key: 'diff', label: 'Diff', count: modified.length},
                        {key: 'json', label: 'JSON', count: undefined}
                    ] as Array<{key: Tab; label: string; count?: number}>
                ).map(option => (
                    <button
                        key={option.key}
                        role='tab'
                        type='button'
                        aria-selected={tab === option.key}
                        className={`rcfg-v2-preview__tab ${tab === option.key ? 'is-active' : ''}`}
                        onClick={() => setTab(option.key)}>
                        {option.label}
                        {typeof option.count === 'number' && <span className='rcfg-v2-preview__tab-count'>{option.count}</span>}
                    </button>
                ))}
            </div>
            <div className='rcfg-v2-preview__body'>
                {tab === 'cli' && <RoleSections roles={roles} groups={byRole} emptyLabel='No CLI args set yet.' copyAllLabel='Copy CLI' onJumpTo={onJumpTo} />}
                {tab === 'env' && <RoleSections roles={roles} groups={envsByRole} emptyLabel='No environment variables set yet.' copyAllLabel='Copy env' onJumpTo={onJumpTo} />}
                {tab === 'diff' && <DiffList modified={modified} onJumpTo={onJumpTo} />}
                {tab === 'json' && <JsonView document={document} />}
            </div>
        </aside>
    );
};

const RoleSections: React.FC<{
    roles: RuntimeConfigRoleEntry[];
    groups: Map<string, Array<{text: string; isModified: boolean}>>;
    emptyLabel: string;
    copyAllLabel: string;
    onJumpTo?: (role: string) => void;
}> = ({roles, groups, emptyLabel, copyAllLabel, onJumpTo}) => {
    if (!Array.from(groups.values()).some(lines => lines.length > 0)) {
        return <div className='rcfg-v2-preview__empty'>{emptyLabel}</div>;
    }
    return (
        <div className='rcfg-v2-preview__sections'>
            {roles.map(role => {
                const lines = groups.get(role.role) || [];
                if (!lines.length) {
                    return null;
                }
                const text = lines.map(line => line.text).join(' \\\n  ');
                return (
                    <section key={role.role} className='rcfg-v2-preview__section'>
                        <header className='rcfg-v2-preview__section-head'>
                            <button type='button' className='rcfg-v2-preview__role-link' onClick={() => onJumpTo?.(role.role)}>
                                {roleLabel(role)}
                            </button>
                            <span className='rcfg-v2-preview__scope-chip'>{runtimeCatalogScopeLabel(role.catalog_scope)}</span>
                            <span className='rcfg-v2-preview__count'>{lines.length}</span>
                            <button type='button' className='rcfg-v2-preview__copy' onClick={() => copy(text)} title={`${copyAllLabel} for ${roleLabel(role)}`}>
                                <i className='fa fa-clone' aria-hidden='true' /> Copy
                            </button>
                        </header>
                        <pre className='rcfg-v2-preview__code'>
                            {lines.map((line, index) => (
                                <code key={`${role.role}-${index}`} className={line.isModified ? 'is-modified' : ''}>
                                    {line.text}
                                </code>
                            ))}
                        </pre>
                    </section>
                );
            })}
        </div>
    );
};

const DiffList: React.FC<{modified: ReturnType<typeof collectModified>; onJumpTo?: (role: string) => void}> = ({modified, onJumpTo}) => {
    if (!modified.length) {
        return <div className='rcfg-v2-preview__empty'>No overrides yet — nothing differs from defaults.</div>;
    }
    return (
        <div className='rcfg-v2-preview__diff'>
            <div className='rcfg-v2-preview__diff-count'>{modified.length} field(s) differ from defaults</div>
            <table>
                <thead>
                    <tr>
                        <th>Role</th>
                        <th>Field</th>
                        <th>Default</th>
                        <th>Override</th>
                    </tr>
                </thead>
                <tbody>
                    {modified.map(entry => (
                        <tr key={`${entry.role}:${entry.kind}:${entry.name}`}>
                            <td>
                                <button type='button' className='rcfg-v2-link' onClick={() => onJumpTo?.(entry.role)}>
                                    {entry.role}
                                </button>
                                <small>{entry.kind}</small>
                            </td>
                            <td>
                                <code>{entry.item ? entry.item.name : entry.name}</code>
                            </td>
                            <td className='is-default'>
                                <code>{formatPreviewCell(entry.defaultValue)}</code>
                            </td>
                            <td className='is-modified'>
                                <code>{formatPreviewCell(entry.value)}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const JsonView: React.FC<{document: RuntimeDocument}> = ({document}) => <pre className='rcfg-v2-preview__json'>{JSON.stringify(document, null, 2)}</pre>;

function groupBy<T>(values: T[], keyFn: (value: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    values.forEach(value => {
        const key = keyFn(value);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)?.push(value);
    });
    return map;
}

function copy(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => undefined);
    }
}

function formatPreviewCell(value: unknown): string {
    if (value === undefined) {
        return '(not set)';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return value || '""';
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
