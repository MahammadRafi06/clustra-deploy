import * as React from 'react';

import {roleLabel, runtimeCatalogScopeLabel} from '../../runtimeConfigUtils';
import type {FieldDensity, RuntimeConfigCatalogItemRecord, RuntimeConfigRoleEntry, RuntimeDocument} from '../types';
import {modifiedCountByRole} from '../utils';

export type RailSection = 'scope' | 'role' | 'summary';

export interface RailSelection {
    section: RailSection;
    role?: string;
}

export const RolesRail: React.FC<{
    document: RuntimeDocument;
    roles: RuntimeConfigRoleEntry[];
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>;
    selection: RailSelection;
    onSelect: (selection: RailSelection) => void;
    onOpenSearch: () => void;
    onlyModified: boolean;
    onToggleOnlyModified: (next: boolean) => void;
    density: FieldDensity;
    onToggleDensity: () => void;
    /** Per-role count of live validation errors. */
    errorCountByRole?: Record<string, number>;
}> = ({document, roles, itemsByRoleKind, selection, onSelect, onOpenSearch, onlyModified, onToggleOnlyModified, density, onToggleDensity, errorCountByRole}) => {
    const stats = React.useMemo(() => modifiedCountByRole(document, roles, itemsByRoleKind), [document, itemsByRoleKind, roles]);
    const totalErrors = errorCountByRole ? Object.values(errorCountByRole).reduce((sum, count) => sum + count, 0) : 0;

    return (
        <nav className='rcfg-v2-rail' aria-label='Runtime config editor sections'>
            <section className='rcfg-v2-rail__group'>
                <header className='rcfg-v2-rail__group-title'>Sections</header>
                <RailButton
                    icon='fa-info-circle'
                    label='Scope & metadata'
                    sub='Engine · version · deployment'
                    active={selection.section === 'scope'}
                    onClick={() => onSelect({section: 'scope'})}
                />
                {roles.map(role => {
                    const stat = stats[role.role];
                    const total = (stat?.argsCount ?? 0) + (stat?.envsCount ?? 0);
                    const errs = errorCountByRole?.[role.role] || 0;
                    return (
                        <RailButton
                            key={role.role}
                            icon='fa-cube'
                            label={roleLabel(role)}
                            sub={runtimeCatalogScopeLabel(role.catalog_scope)}
                            count={total}
                            errorCount={errs}
                            active={selection.section === 'role' && selection.role === role.role}
                            onClick={() => onSelect({section: 'role', role: role.role})}
                        />
                    );
                })}
                <RailButton
                    icon='fa-check'
                    label='Review & save'
                    sub='Validate the full policy'
                    errorCount={totalErrors}
                    active={selection.section === 'summary'}
                    onClick={() => onSelect({section: 'summary'})}
                />
            </section>

            <section className='rcfg-v2-rail__group'>
                <header className='rcfg-v2-rail__group-title'>Tools</header>
                <button type='button' className='rcfg-v2-rail__tool' onClick={onOpenSearch}>
                    <i className='fa fa-search' aria-hidden='true' />
                    <span>Find anything</span>
                    <kbd>⌘K</kbd>
                </button>
                <label className='rcfg-v2-rail__tool rcfg-v2-rail__tool--toggle'>
                    <input type='checkbox' checked={onlyModified} onChange={event => onToggleOnlyModified(event.target.checked)} />
                    <span>Show only modified</span>
                </label>
                <button type='button' className='rcfg-v2-rail__tool' onClick={onToggleDensity} title='Toggle row / card density'>
                    <i className={`fa ${density === 'rows' ? 'fa-list' : 'fa-th-large'}`} aria-hidden='true' />
                    <span>{density === 'rows' ? 'Compact rows' : 'Card view'}</span>
                </button>
            </section>
        </nav>
    );
};

const RailButton: React.FC<{
    icon: string;
    label: string;
    sub?: string;
    count?: number;
    errorCount?: number;
    active: boolean;
    onClick: () => void;
}> = ({icon, label, sub, count, errorCount, active, onClick}) => {
    const hasErrors = (errorCount || 0) > 0;
    return (
        <button
            type='button'
            className={`rcfg-v2-rail__item ${active ? 'is-active' : ''} ${hasErrors ? 'has-errors' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={onClick}>
            <i className={`fa ${hasErrors ? 'fa-exclamation-circle' : icon}`} aria-hidden='true' />
            <span className='rcfg-v2-rail__item-text'>
                <strong>{label}</strong>
                {sub ? <small>{sub}</small> : null}
            </span>
            {hasErrors ? (
                <span className='rcfg-v2-rail__badge rcfg-v2-rail__badge--error' aria-label={`${errorCount} validation error${errorCount === 1 ? '' : 's'}`}>
                    {errorCount}
                </span>
            ) : (
                typeof count === 'number' && count > 0 && <span className='rcfg-v2-rail__badge'>{count}</span>
            )}
        </button>
    );
};
