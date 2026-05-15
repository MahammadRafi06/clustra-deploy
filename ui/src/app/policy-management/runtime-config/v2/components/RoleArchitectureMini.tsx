import * as React from 'react';

import {roleLabel, runtimeCatalogScopeLabel} from '../../runtimeConfigUtils';
import type {RuntimeConfigRoleEntry} from '../types';

/**
 * Inline architecture strip rendered above a role configuration step.
 *
 * Shows every role in the active deployment as a labelled node connected
 * by arrows, with the role the user is currently editing highlighted.
 * The intent: orient the user so they understand which *node* in the
 * deployment pipeline they are configuring (frontend vs. prefill vs.
 * decode), without forcing them to remember the role schema.
 *
 * The component is decorative for screen readers — the surrounding step
 * label already announces the active role.
 */
export const RoleArchitectureMini: React.FC<{
    roles: RuntimeConfigRoleEntry[];
    activeRole?: string;
    onSelect?: (role: string) => void;
}> = ({roles, activeRole, onSelect}) => {
    if (!roles.length) return null;
    return (
        <nav className='rcfg-v2-arch' aria-hidden='true'>
            {roles.map((role, index) => {
                const isActive = role.role === activeRole;
                const node = (
                    <span className={`rcfg-v2-arch__node ${isActive ? 'is-active' : ''}`} title={`${roleLabel(role)} · ${runtimeCatalogScopeLabel(role.catalog_scope)}`}>
                        <span className='rcfg-v2-arch__name'>{roleLabel(role)}</span>
                        <span className='rcfg-v2-arch__scope'>{runtimeCatalogScopeLabel(role.catalog_scope)}</span>
                    </span>
                );
                return (
                    <React.Fragment key={role.role}>
                        {onSelect ? (
                            <button type='button' className='rcfg-v2-arch__btn' onClick={() => onSelect(role.role)} tabIndex={-1}>
                                {node}
                            </button>
                        ) : (
                            node
                        )}
                        {index < roles.length - 1 && (
                            <span className='rcfg-v2-arch__arrow' aria-hidden='true'>
                                <i className='fa fa-chevron-right' />
                            </span>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
};
