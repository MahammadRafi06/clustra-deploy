import * as React from 'react';
import {useEffect, useMemo} from 'react';

import {formatRelativeTime} from '../../../formatters';
import type {RuntimeConfigPolicyRecord, RuntimeConfigRoleSchemaRecord} from '../../../api/types';
import {formatPolicyJson} from '../../../validation';
import {
    getRoleSelection,
    isRecord,
    roleLabel,
    runtimeCatalogScopeLabel,
    runtimeDeploymentLabel,
    runtimeDescription,
    runtimeEngineLabel
} from '../../runtimeConfigUtils';
import type {TuningIntent} from '../types';
import {readPolicyTags} from '../utils';
import {useFocusTrap} from './useFocusTrap';

const INTENT_LABEL: Record<TuningIntent, string> = {
    latency: 'Latency-tuned',
    throughput: 'Throughput-tuned',
    cost: 'Cost-tuned',
    balanced: 'Balanced',
    debug: 'Debug / dev'
};

/**
 * Read-only details surface for a runtime config policy.
 *
 * Replaces the previous behavior of "Details opens the editor" — a card click
 * should let the user *read* the policy and decide what action to take, not
 * drop them into an edit context they didn't ask for.
 */
export const PolicyDetailsDrawer: React.FC<{
    open: boolean;
    record: RuntimeConfigPolicyRecord | null;
    roleSchemas: RuntimeConfigRoleSchemaRecord[];
    onClose: () => void;
    onEdit: (record: RuntimeConfigPolicyRecord) => void;
    onClone: (record: RuntimeConfigPolicyRecord) => void;
    onCompare: (record: RuntimeConfigPolicyRecord) => void;
    onArchive?: (record: RuntimeConfigPolicyRecord) => void;
    onAudit?: (record: RuntimeConfigPolicyRecord) => void;
}> = ({open, record, roleSchemas, onClose, onEdit, onClone, onCompare, onArchive, onAudit}) => {
    const trapRef = useFocusTrap<HTMLElement>(open);

    useEffect(() => {
        if (!open) return;
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open || !record) return null;

    return (
        <div className='rcfg-v2-drawer' role='dialog' aria-modal='true' aria-label={`Details for ${runtimeDescription(record)}`}>
            <div className='rcfg-v2-drawer__backdrop' onClick={onClose} aria-hidden='true' />
            <aside ref={trapRef} className='rcfg-v2-drawer__panel' tabIndex={-1}>
                <DrawerContent
                    record={record}
                    roleSchemas={roleSchemas}
                    onClose={onClose}
                    onEdit={onEdit}
                    onClone={onClone}
                    onCompare={onCompare}
                    onArchive={onArchive}
                    onAudit={onAudit}
                />
            </aside>
        </div>
    );
};

const DrawerContent: React.FC<{
    record: RuntimeConfigPolicyRecord;
    roleSchemas: RuntimeConfigRoleSchemaRecord[];
    onClose: () => void;
    onEdit: (record: RuntimeConfigPolicyRecord) => void;
    onClone: (record: RuntimeConfigPolicyRecord) => void;
    onCompare: (record: RuntimeConfigPolicyRecord) => void;
    onArchive?: (record: RuntimeConfigPolicyRecord) => void;
    onAudit?: (record: RuntimeConfigPolicyRecord) => void;
}> = ({record, roleSchemas, onClose, onEdit, onClone, onCompare, onArchive, onAudit}) => {
    const document = isRecord(record.document) ? record.document : {};
    const tags = readPolicyTags(record);
    const isSystem = record.managed_by === 'system';
    const schemaRoles = useMemo(
        () => roleSchemas.find(schema => schema.deployment_type === record.deployment_type)?.schema.roles || [],
        [record.deployment_type, roleSchemas]
    );
    const roles = schemaRoles.length
        ? schemaRoles
        : Object.keys(isRecord(document.selections) ? (document.selections as Record<string, unknown>) : {}).map(role => ({
              role,
              label: role,
              catalog_scope: 'engine' as const
          }));

    const overrideCount = roles.reduce((sum, role) => {
        return sum + Object.keys(getRoleSelection(document, role.role, 'args')).length + Object.keys(getRoleSelection(document, role.role, 'envs')).length;
    }, 0);

    return (
        <>
            <header className='rcfg-v2-drawer__head'>
                <div className='rcfg-v2-drawer__head-titles'>
                    <div className='rcfg-v2-drawer__eyebrow'>
                        <span className={`rcfg-v2-chip ${record.active ? 'rcfg-v2-chip--accent' : 'rcfg-v2-chip--muted'}`}>{record.active ? 'Active' : 'Archived'}</span>
                        {isSystem && <span className='rcfg-v2-chip rcfg-v2-chip--template'>Template</span>}
                        {tags.intent && <span className='rcfg-v2-chip'>{INTENT_LABEL[tags.intent]}</span>}
                    </div>
                    <h2>{runtimeDescription(record)}</h2>
                    <code className='rcfg-v2-drawer__id'>{record.policy_id}</code>
                </div>
                <button type='button' className='rcfg-v2-drawer__close' onClick={onClose} aria-label='Close details'>
                    <i className='fa fa-times' aria-hidden='true' />
                </button>
            </header>

            <div className='rcfg-v2-drawer__body'>
                <section className='rcfg-v2-drawer__section'>
                    <h3>Scope</h3>
                    <dl className='rcfg-v2-drawer__grid'>
                        <Field label='Engine' value={runtimeEngineLabel(record.engine)} />
                        <Field label='Engine version' value={record.engine_version || '—'} />
                        <Field label='Dynamo' value={record.dynamo_version || '—'} />
                        <Field label='Deployment' value={runtimeDeploymentLabel(record.deployment_type)} />
                        <Field label='Owner' value={isSystem ? 'System' : 'Custom'} />
                        <Field label='Updated' value={formatRelativeTime(record.updated_at)} />
                        <Field label='Updated by' value={record.updated_by || record.created_by || '—'} />
                        <Field label='Overrides' value={String(overrideCount)} accent />
                    </dl>
                </section>

                {(tags.tags.length > 0 || tags.workloadClass) && (
                    <section className='rcfg-v2-drawer__section'>
                        <h3>Tags &amp; classification</h3>
                        <div className='rcfg-v2-drawer__tags'>
                            {tags.workloadClass && <span className='rcfg-v2-chip rcfg-v2-chip--workload'>{tags.workloadClass}</span>}
                            {tags.tags.map(tag => (
                                <span key={tag} className='rcfg-v2-tag'>
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                <section className='rcfg-v2-drawer__section'>
                    <h3>Overrides by role</h3>
                    {roles.length === 0 ? (
                        <p className='rcfg-v2-drawer__empty'>No roles for this deployment type.</p>
                    ) : (
                        <div className='rcfg-v2-drawer__roles'>
                            {roles.map(role => {
                                const args = getRoleSelection(document, role.role, 'args');
                                const envs = getRoleSelection(document, role.role, 'envs');
                                const total = Object.keys(args).length + Object.keys(envs).length;
                                if (total === 0) {
                                    return (
                                        <article key={role.role} className='rcfg-v2-drawer__role rcfg-v2-drawer__role--empty'>
                                            <header>
                                                <strong>{roleLabel(role)}</strong>
                                                <small>{runtimeCatalogScopeLabel(role.catalog_scope)}</small>
                                            </header>
                                            <p className='rcfg-v2-drawer__empty'>No overrides — engine defaults apply.</p>
                                        </article>
                                    );
                                }
                                return (
                                    <article key={role.role} className='rcfg-v2-drawer__role'>
                                        <header>
                                            <strong>{roleLabel(role)}</strong>
                                            <small>{runtimeCatalogScopeLabel(role.catalog_scope)}</small>
                                            <span className='rcfg-v2-chip rcfg-v2-chip--accent'>{total} override{total === 1 ? '' : 's'}</span>
                                        </header>
                                        <RoleValueTable kind='args' values={args} />
                                        <RoleValueTable kind='envs' values={envs} />
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <details className='rcfg-v2-drawer__json'>
                    <summary>Raw document JSON</summary>
                    <pre>{formatPolicyJson(record.document)}</pre>
                </details>
            </div>

            <footer className='rcfg-v2-drawer__footer'>
                <button
                    type='button'
                    className='argo-button argo-button--base policy-management__create-button'
                    disabled={isSystem}
                    onClick={() => onEdit(record)}
                    title={isSystem ? 'Templates are read-only — clone to customize' : undefined}>
                    Edit
                </button>
                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => onClone(record)}>
                    Clone
                </button>
                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => onCompare(record)}>
                    Compare…
                </button>
                {onAudit && (
                    <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => onAudit(record)} title='View audit history'>
                        <i className='fa fa-history' aria-hidden='true' /> Audit
                    </button>
                )}
                {onArchive && record.active && !isSystem && (
                    <button
                        type='button'
                        className='argo-button argo-button--base-o policy-management__button policy-management__button--danger'
                        onClick={() => onArchive(record)}>
                        Archive
                    </button>
                )}
            </footer>
        </>
    );
};

const Field: React.FC<{label: string; value: string; accent?: boolean}> = ({label, value, accent}) => (
    <div className={`rcfg-v2-drawer__field ${accent ? 'rcfg-v2-drawer__field--accent' : ''}`}>
        <dt>{label}</dt>
        <dd>{value}</dd>
    </div>
);

const RoleValueTable: React.FC<{kind: 'args' | 'envs'; values: Record<string, unknown>}> = ({kind, values}) => {
    const entries = Object.entries(values);
    if (entries.length === 0) return null;
    return (
        <div className='rcfg-v2-drawer__kv'>
            <header>
                <span>{kind === 'args' ? 'CLI args' : 'Environment variables'}</span>
                <small>{entries.length}</small>
            </header>
            <table>
                <tbody>
                    {entries.map(([name, value]) => (
                        <tr key={name}>
                            <td>
                                <code>{name}</code>
                            </td>
                            <td>
                                <code>{formatValue(value)}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

function formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return value || '""';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
