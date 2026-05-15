import * as React from 'react';

import type {DeploymentType, RuntimeConfigCatalogRecord} from '../api/types';
import {formatRelativeTime} from '../formatters';
import {formatPolicyJson} from '../validation';
import {runtimeCatalogKindLabel, runtimeCatalogScopeLabel, runtimeDeploymentLabel, runtimeEngineLabel} from './runtimeConfigUtils';

type RuntimeSchemaRole = {
    role: string;
    label: string;
    catalog_scope: 'frontend' | 'engine' | string;
    [key: string]: unknown;
};

type RuntimeSchemaJson = {
    deployment_type?: DeploymentType;
    active?: boolean;
    roles?: RuntimeSchemaRole[];
    [key: string]: unknown;
};

export const RuntimeCatalogList: React.FC<{catalogs: RuntimeConfigCatalogRecord[]; onDelete: (catalog: RuntimeConfigCatalogRecord) => void}> = ({catalogs, onDelete}) => {
    if (!catalogs.length) {
        return <div className='policy-management__empty-inline'>No active catalogs found.</div>;
    }
    const sortedCatalogs = [...catalogs].sort((left, right) =>
        [left.dynamo_version, left.engine, left.engine_version, left.kind, left.catalog_id]
            .join('|')
            .localeCompare([right.dynamo_version, right.engine, right.engine_version, right.kind, right.catalog_id].join('|'))
    );

    return (
        <div className='policy-management__runtime-catalog-table-wrap'>
            <table className='policy-management__runtime-catalog-table'>
                <thead>
                    <tr>
                        <th>Dynamo version</th>
                        <th>Engine</th>
                        <th>Engine version</th>
                        <th>Catalog type</th>
                        <th>Last updated</th>
                        <th aria-label='Actions' />
                    </tr>
                </thead>
                <tbody>
                    {sortedCatalogs.map(catalog => (
                        <tr key={catalog.catalog_id}>
                            <td>{catalog.dynamo_version}</td>
                            <td className='policy-management__runtime-catalog-engine'>{runtimeEngineLabel(catalog.engine)}</td>
                            <td>
                                <code>{catalog.engine_version}</code>
                            </td>
                            <td>
                                <span className='policy-management__runtime-catalog-kind-badge'>{runtimeCatalogKindLabel(catalog.kind)}</span>
                            </td>
                            <td>{formatRelativeTime(catalog.updated_at)}</td>
                            <td className='policy-management__runtime-catalog-actions'>
                                <button
                                    type='button'
                                    className='argo-button argo-button--base-o policy-management__icon-button policy-management__button--danger'
                                    aria-label={`Delete catalog ${catalog.catalog_id}`}
                                    title={`Delete ${catalog.catalog_id}`}
                                    onClick={() => onDelete(catalog)}>
                                    <i className='fa fa-trash' aria-hidden='true' />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const RuntimeConfigAdminPanel: React.FC<{
    catalogs: RuntimeConfigCatalogRecord[];
    schemaDeployment: DeploymentType;
    schemaText: string;
    schemaPending: boolean;
    onSchemaDeploymentChange: (deploymentType: DeploymentType) => void;
    onSchemaTextChange: (value: string) => void;
    onSaveSchema: () => void;
    onDeleteCatalog: (catalog: RuntimeConfigCatalogRecord) => void;
}> = ({catalogs, schemaDeployment, schemaText, schemaPending, onSchemaDeploymentChange, onSchemaTextChange, onSaveSchema, onDeleteCatalog}) => {
    const parsedSchema = React.useMemo<RuntimeSchemaJson | null>(() => {
        try {
            return JSON.parse(schemaText) as RuntimeSchemaJson;
        } catch {
            return null;
        }
    }, [schemaText]);
    const schemaRoles = React.useMemo(
        () => (Array.isArray(parsedSchema?.roles) ? parsedSchema.roles.filter(role => typeof role.role === 'string' && role.role) : []),
        [parsedSchema]
    );
    const catalogSummary = React.useMemo(() => {
        const engines = new Set(catalogs.map(catalog => catalog.engine));
        const args = catalogs.filter(catalog => catalog.kind === 'args').length;
        const envs = catalogs.filter(catalog => catalog.kind === 'envs').length;
        return {engines: engines.size, args, envs};
    }, [catalogs]);
    const schemaError = parsedSchema ? null : 'Schema JSON is invalid. Fix the advanced JSON before editing roles.';
    const updateSchema = React.useCallback(
        (updater: (schema: RuntimeSchemaJson) => RuntimeSchemaJson) => {
            const baseSchema = parsedSchema || {deployment_type: schemaDeployment, active: true, roles: []};
            onSchemaTextChange(formatPolicyJson(updater({...baseSchema, roles: Array.isArray(baseSchema.roles) ? [...baseSchema.roles] : []})));
        },
        [onSchemaTextChange, parsedSchema, schemaDeployment]
    );
    const updateRole = React.useCallback(
        (index: number, patch: Partial<RuntimeSchemaRole>) => {
            updateSchema(schema => {
                const roles = Array.isArray(schema.roles) ? [...schema.roles] : [];
                roles[index] = {...roles[index], ...patch};
                return {...schema, roles};
            });
        },
        [updateSchema]
    );
    const addRole = React.useCallback(() => {
        updateSchema(schema => {
            const roles = Array.isArray(schema.roles) ? [...schema.roles] : [];
            const nextRoleNumber = roles.length + 1;
            roles.push({role: `role_${nextRoleNumber}`, label: `Role ${nextRoleNumber}`, catalog_scope: 'engine'});
            return {...schema, roles};
        });
    }, [updateSchema]);
    const removeRole = React.useCallback(
        (index: number) => {
            updateSchema(schema => {
                const roles = Array.isArray(schema.roles) ? [...schema.roles] : [];
                roles.splice(index, 1);
                return {...schema, roles};
            });
        },
        [updateSchema]
    );

    return (
        <section className='policy-management__runtime-admin-panel' aria-label='Runtime config administration'>
            <div className='policy-management__runtime-admin-grid'>
                <section className='policy-management__runtime-admin-card'>
                    <div className='policy-management__runtime-admin-card-header'>
                        <div>
                            <div className='policy-management__section-title'>Role schema</div>
                            <div className='policy-management__section-description'>Controls which role steps appear for each deployment type.</div>
                        </div>
                        <button type='button' className='argo-button argo-button--base policy-management__button' disabled={schemaPending} onClick={onSaveSchema}>
                            Save schema
                        </button>
                    </div>
                    <div className='policy-management__runtime-admin-toggle' role='tablist' aria-label='Role schema deployment type'>
                        {(['agg', 'disagg'] as DeploymentType[]).map(deploymentType => (
                            <button
                                key={deploymentType}
                                type='button'
                                className={`policy-management__runtime-admin-toggle-button ${schemaDeployment === deploymentType ? 'policy-management__runtime-admin-toggle-button--active' : ''}`}
                                aria-selected={schemaDeployment === deploymentType}
                                onClick={() => onSchemaDeploymentChange(deploymentType)}>
                                {runtimeDeploymentLabel(deploymentType)}
                            </button>
                        ))}
                    </div>
                    <div className='policy-management__runtime-schema-summary'>
                        <div className='policy-management__runtime-schema-summary-title'>
                            <span>Role designer</span>
                            <span className='policy-management__badge policy-management__badge--muted'>{schemaRoles.length} roles</span>
                        </div>
                        {schemaError && <div className='policy-management__inline-error'>{schemaError}</div>}
                        {!schemaError && (
                            <>
                                {schemaRoles.length ? (
                                    <div className='policy-management__runtime-schema-role-list'>
                                        {schemaRoles.map((role, index) => (
                                            <div className='policy-management__runtime-schema-role' key={`${role.role}-${index}`}>
                                                <div className='policy-management__runtime-schema-role-head'>
                                                    <div>
                                                        <span>{role.label || role.role}</span>
                                                        <small>
                                                            {runtimeCatalogScopeLabel(role.catalog_scope)} role · {role.role}
                                                        </small>
                                                    </div>
                                                    <button
                                                        type='button'
                                                        className='argo-button argo-button--base-o policy-management__icon-button policy-management__button--danger'
                                                        aria-label={`Remove role ${role.role}`}
                                                        onClick={() => removeRole(index)}>
                                                        <i className='fa fa-times' aria-hidden='true' />
                                                    </button>
                                                </div>
                                                <label className='policy-management__runtime-schema-field'>
                                                    <span>Display name</span>
                                                    <input className='argo-field' value={role.label || ''} onChange={event => updateRole(index, {label: event.target.value})} />
                                                </label>
                                                <label className='policy-management__runtime-schema-field'>
                                                    <span>Role key</span>
                                                    <input className='argo-field' value={role.role} onChange={event => updateRole(index, {role: event.target.value})} />
                                                </label>
                                                <label className='policy-management__runtime-schema-field'>
                                                    <span>Catalog scope</span>
                                                    <select
                                                        className='argo-field'
                                                        value={role.catalog_scope || 'engine'}
                                                        onChange={event => updateRole(index, {catalog_scope: event.target.value})}>
                                                        <option value='frontend'>Frontend catalogs</option>
                                                        <option value='engine'>Engine catalogs</option>
                                                    </select>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className='policy-management__empty-inline'>No roles are configured for this deployment type.</div>
                                )}
                                <button type='button' className='argo-button argo-button--base-o policy-management__button policy-management__runtime-add-role' onClick={addRole}>
                                    <i className='fa fa-plus' aria-hidden='true' /> Add role
                                </button>
                            </>
                        )}
                    </div>
                    <details className='policy-management__runtime-schema-advanced'>
                        <summary>Advanced JSON</summary>
                        <textarea
                            className='argo-field policy-management__textarea-code policy-management__runtime-schema-editor'
                            aria-label='Role schema JSON'
                            value={schemaText}
                            onChange={event => onSchemaTextChange(event.target.value)}
                        />
                    </details>
                </section>
                <section className='policy-management__runtime-admin-card'>
                    <div className='policy-management__runtime-admin-card-header'>
                        <div>
                            <div className='policy-management__section-title'>Active catalogs</div>
                        </div>
                        <span className='policy-management__badge policy-management__badge--muted'>{catalogs.length} catalogs</span>
                    </div>
                    <div className='policy-management__runtime-catalog-summary'>
                        <span>
                            <strong>{catalogSummary.engines}</strong> runtimes
                        </span>
                        <span>
                            <strong>{catalogSummary.args}</strong> Args catalogs
                        </span>
                        <span>
                            <strong>{catalogSummary.envs}</strong> Env catalogs
                        </span>
                    </div>
                    <RuntimeCatalogList catalogs={catalogs} onDelete={onDeleteCatalog} />
                </section>
            </div>
        </section>
    );
};
