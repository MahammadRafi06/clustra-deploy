import * as React from 'react';

import type {DeploymentType, RuntimeConfigCatalogItemRecord, RuntimeConfigRoleEntry} from '../../api/types';
import type {RuntimeDocument} from '../runtimeConfigTypes';
import {formatRuntimeValue, getRoleSelection, itemLabel, roleKindKey, roleLabel, runtimeCatalogScopeLabel, runtimeDeploymentLabel, runtimeEngineLabel} from '../runtimeConfigUtils';

export const RuntimePolicySummaryStep: React.FC<{
    document: RuntimeDocument;
    roles: RuntimeConfigRoleEntry[];
    deploymentType: DeploymentType;
    engine: string;
    engineVersion: string;
    dynamoVersion: string;
    itemsByRoleKind: Record<string, RuntimeConfigCatalogItemRecord[]>;
    selectedCount: number;
}> = ({document, roles, deploymentType, engine, engineVersion, dynamoVersion, itemsByRoleKind, selectedCount}) => {
    const summaryFields = [
        ['Policy ID', String(document.policy_id || 'Not set')],
        ['Display name', String(document.display_name || 'Not set')],
        ['Deployment type', runtimeDeploymentLabel(deploymentType)],
        ['Engine', runtimeEngineLabel(engine)],
        ['Engine version', engineVersion || 'Not set'],
        ['Dynamo version', dynamoVersion || 'Not set']
    ];

    return (
        <section className='policy-management__runtime-review'>
            <div className='policy-management__runtime-review-panel'>
                <div className='policy-management__runtime-builder-bar'>
                    <div>
                        <div className='policy-management__section-title'>Summary</div>
                        <div className='policy-management__section-description'>Review the policy scope and selected overrides before validating and saving.</div>
                    </div>
                    <span className='policy-management__badge policy-management__badge--accent'>{selectedCount} selected</span>
                </div>
                <div className='policy-management__runtime-review-grid'>
                    {summaryFields.map(([label, value]) => (
                        <div key={label} className='policy-management__runtime-review-field'>
                            <span>{label}</span>
                            <strong>{value}</strong>
                        </div>
                    ))}
                </div>
            </div>

            <div className='policy-management__runtime-review-panel'>
                <div className='policy-management__runtime-role-card-header'>
                    <div>
                        <div className='policy-management__section-title'>Role overrides</div>
                        <div className='policy-management__section-description'>Only fields with user values are emitted in the saved policy.</div>
                    </div>
                </div>
                <div className='policy-management__runtime-review-roles'>
                    {roles.map(role => {
                        const args = getRoleSelection(document, role.role, 'args');
                        const envs = getRoleSelection(document, role.role, 'envs');
                        return (
                            <div key={role.role} className='policy-management__runtime-review-role'>
                                <div className='policy-management__runtime-review-role-header'>
                                    <div className='policy-management__runtime-role-title'>
                                        {roleLabel(role)}
                                        <span className='policy-management__badge policy-management__badge--muted'>{runtimeCatalogScopeLabel(role.catalog_scope)}</span>
                                    </div>
                                    <div className='policy-management__runtime-summary'>
                                        <span className='policy-management__badge policy-management__badge--muted'>{Object.keys(args).length} args</span>
                                        <span className='policy-management__badge policy-management__badge--muted'>{Object.keys(envs).length} envs</span>
                                    </div>
                                </div>
                                <RuntimeSummarySelection title='Args' selection={args} items={itemsByRoleKind[roleKindKey(role.role, 'args')] || []} />
                                <RuntimeSummarySelection title='Envs' selection={envs} items={itemsByRoleKind[roleKindKey(role.role, 'envs')] || []} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

const RuntimeSummarySelection: React.FC<{
    title: string;
    selection: Record<string, unknown>;
    items: RuntimeConfigCatalogItemRecord[];
}> = ({title, selection, items}) => {
    const entries = Object.entries(selection);
    const itemMap = new Map(items.map(item => [item.name, item]));
    return (
        <div className='policy-management__runtime-review-kind'>
            <span>{title}</span>
            {entries.length ? (
                <div className='policy-management__runtime-review-values'>
                    {entries.map(([name, value]) => {
                        const item = itemMap.get(name);
                        return (
                            <div key={name} className='policy-management__runtime-review-value'>
                                <span>{item ? itemLabel(item) : name}</span>
                                <code>{formatRuntimeValue(value)}</code>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className='policy-management__empty-inline'>No overrides</div>
            )}
        </div>
    );
};
