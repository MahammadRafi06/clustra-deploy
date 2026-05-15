import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';

import {fetchRuntimeConfigCatalogItems, activeRoleSchema, roleLabel, runtimeDescription, runtimeEngineLabel} from '../../runtimeConfigUtils';

import type {
    PolicyApiClient,
    RuntimeConfigCatalogItemRecord,
    RuntimeConfigKind,
    RuntimeConfigPolicyRecord,
    RuntimeConfigRoleEntry,
    RuntimeConfigRoleSchemaRecord
} from '../../../api/types';
import {comparePolicies} from '../utils';

type LoadState = 'loading' | 'loaded' | 'error';

export const CompareDialog: React.FC<{
    open: boolean;
    base: RuntimeConfigPolicyRecord | null;
    candidates: RuntimeConfigPolicyRecord[];
    roleSchemas: RuntimeConfigRoleSchemaRecord[];
    client: PolicyApiClient;
    onClose: () => void;
}> = ({open, base, candidates, roleSchemas, client, onClose}) => {
    const [otherId, setOtherId] = useState<string | null>(null);
    const [items, setItems] = useState<Record<string, RuntimeConfigCatalogItemRecord[]>>({});
    const [loadState, setLoadState] = useState<LoadState>('loaded');

    const other = useMemo(() => candidates.find(record => record.policy_id === otherId) || null, [candidates, otherId]);

    const roles: RuntimeConfigRoleEntry[] = useMemo(() => {
        if (!base) return [];
        const schema = activeRoleSchema(roleSchemas, base.deployment_type);
        return schema?.schema.roles || [];
    }, [base, roleSchemas]);

    useEffect(() => {
        if (!open) return;
        const firstOther = candidates.find(record => record.policy_id !== base?.policy_id);
        setOtherId(firstOther?.policy_id || null);
    }, [base, candidates, open]);

    useEffect(() => {
        if (!open || !base || !other || !roles.length) {
            return;
        }
        let cancelled = false;
        setLoadState('loading');
        (async () => {
            try {
                const entries = await Promise.all(
                    roles.flatMap(role =>
                        (['args', 'envs'] as RuntimeConfigKind[]).map(async kind => {
                            const catalogEngine = role.catalog_scope === 'frontend' ? 'frontend' : base.engine;
                            const version = role.catalog_scope === 'frontend' ? base.dynamo_version : base.engine_version;
                            const items = await fetchRuntimeConfigCatalogItems(client, {
                                engine: catalogEngine,
                                version,
                                dynamo_version: base.dynamo_version,
                                kind,
                                deployment_type: base.deployment_type,
                                role: role.role,
                                active: true
                            });
                            return [`${role.role}:${kind}`, items] as const;
                        })
                    )
                );
                if (!cancelled) {
                    setItems(Object.fromEntries(entries));
                    setLoadState('loaded');
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadState('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [base, client, open, other, roles]);

    const deltas = useMemo(() => {
        if (!base || !other) return [];
        return comparePolicies(base, other, items, roles);
    }, [base, items, other, roles]);

    const deltasByRole = useMemo(() => {
        const grouped = new Map<string, typeof deltas>();
        deltas.forEach(delta => {
            const list = grouped.get(delta.role) || [];
            list.push(delta);
            grouped.set(delta.role, list);
        });
        return grouped;
    }, [deltas]);

    if (!open || !base) return null;

    return (
        <div className='rcfg-v2-dialog' role='dialog' aria-modal='true' aria-label='Compare policies'>
            <div className='rcfg-v2-dialog__scrim' onClick={onClose} aria-hidden='true' />
            <div className='rcfg-v2-dialog__panel rcfg-v2-dialog__panel--wide'>
                <header className='rcfg-v2-dialog__head'>
                    <div>
                        <h2>Compare with another policy</h2>
                        <p>Side-by-side diff of every overridden arg and env across roles.</p>
                    </div>
                    <button type='button' className='rcfg-v2-dialog__close' onClick={onClose} aria-label='Close'>
                        <i className='fa fa-times' aria-hidden='true' />
                    </button>
                </header>
                <section className='rcfg-v2-compare__bar'>
                    <div className='rcfg-v2-compare__pick'>
                        <small>Base</small>
                        <strong>{runtimeDescription(base)}</strong>
                        <code>{base.policy_id}</code>
                    </div>
                    <span aria-hidden='true' className='rcfg-v2-compare__arrow'>
                        ⇄
                    </span>
                    <div className='rcfg-v2-compare__pick'>
                        <small>Compare with</small>
                        <select className='argo-field' aria-label='Pick a policy to compare' value={otherId || ''} onChange={event => setOtherId(event.target.value || null)}>
                            <option value=''>Pick a policy…</option>
                            {candidates
                                .filter(record => record.policy_id !== base.policy_id)
                                .map(record => (
                                    <option key={record.policy_id} value={record.policy_id}>
                                        {runtimeDescription(record)} · {record.policy_id}
                                    </option>
                                ))}
                        </select>
                    </div>
                </section>

                <section className='rcfg-v2-compare__body'>
                    {!other ? (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-arrows-h' aria-hidden='true' />
                            <p>Pick a second policy to see the diff.</p>
                        </div>
                    ) : loadState === 'loading' ? (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                            <p>Loading catalog…</p>
                        </div>
                    ) : loadState === 'error' ? (
                        <div className='rcfg-v2-empty rcfg-v2-empty--error'>
                            <i className='fa fa-exclamation-triangle' aria-hidden='true' />
                            <p>Could not load catalog items for the diff.</p>
                        </div>
                    ) : deltas.length === 0 ? (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-equals' aria-hidden='true' />
                            <p>These policies have identical overrides.</p>
                        </div>
                    ) : (
                        <>
                            <div className='rcfg-v2-compare__summary'>
                                <span>{deltas.length} field(s) differ</span>
                                <span>Engine: {runtimeEngineLabel(base.engine)}</span>
                                <span>Deployment: {base.deployment_type}</span>
                            </div>
                            {roles.map(role => {
                                const list = deltasByRole.get(role.role) || [];
                                if (!list.length) return null;
                                return (
                                    <section key={role.role} className='rcfg-v2-compare__role'>
                                        <header>
                                            <h3>{roleLabel(role)}</h3>
                                            <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{list.length} change(s)</span>
                                        </header>
                                        <table className='rcfg-v2-compare__table'>
                                            <thead>
                                                <tr>
                                                    <th>Field</th>
                                                    <th>{base.policy_id}</th>
                                                    <th>{other.policy_id}</th>
                                                    <th>Default</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {list.map(delta => (
                                                    <tr key={`${delta.role}:${delta.kind}:${delta.name}`}>
                                                        <td>
                                                            <strong>{delta.label}</strong>
                                                            <small>
                                                                <code>{delta.name}</code> · {delta.kind}
                                                            </small>
                                                        </td>
                                                        <td className='is-base'>
                                                            <code>{cell(delta.base)}</code>
                                                        </td>
                                                        <td className='is-other'>
                                                            <code>{cell(delta.other)}</code>
                                                        </td>
                                                        <td className='is-default'>
                                                            <code>{cell(delta.defaultValue)}</code>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                );
                            })}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

function cell(value: unknown): string {
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
