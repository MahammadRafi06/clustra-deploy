import * as React from 'react';
import {useEffect, useState} from 'react';

import type {PolicyApiClient, RuntimeConfigPolicyMigrationChange, RuntimeConfigPolicyMigrationResponse, RuntimeConfigPolicyRecord} from '../../../api/types';
import {PolicyError} from '../../../components/PolicyError';
import {runtimeConfigKeyLabel, runtimeDescription} from '../../runtimeConfigUtils';

type LoadState = 'loading' | 'loaded' | 'error';

/**
 * Migration dialog for runtime config policies whose authoring catalog has
 * been replaced. Always runs a dry-run on open so the admin sees the proposed
 * renames / drops before deciding to apply.
 */
export const MigrateDialog: React.FC<{
    open: boolean;
    target: RuntimeConfigPolicyRecord | null;
    client: PolicyApiClient;
    onClose: () => void;
    onApplied: () => void;
}> = ({open, target, client, onClose, onApplied}) => {
    const [preview, setPreview] = useState<RuntimeConfigPolicyMigrationResponse | null>(null);
    const [loadState, setLoadState] = useState<LoadState>('loaded');
    const [previewError, setPreviewError] = useState<unknown | null>(null);
    const [applyError, setApplyError] = useState<unknown | null>(null);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (!open || !target) {
            setPreview(null);
            setPreviewError(null);
            setApplyError(null);
            return;
        }
        let cancelled = false;
        setLoadState('loading');
        setPreviewError(null);
        setApplyError(null);
        (async () => {
            try {
                const dryRun = await client.migrateRuntimeConfigPolicy(target.policy_id, false);
                if (!cancelled) {
                    setPreview(dryRun);
                    setLoadState('loaded');
                }
            } catch (error) {
                if (!cancelled) {
                    setPreviewError(error);
                    setLoadState('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [client, open, target]);

    async function applyMigration() {
        if (!target) return;
        setApplying(true);
        setApplyError(null);
        try {
            const result = await client.migrateRuntimeConfigPolicy(target.policy_id, true);
            if (result.applied) {
                onApplied();
            } else {
                // Apply rejected — refresh preview so the user sees the new validation_errors.
                setPreview(result);
            }
        } catch (error) {
            setApplyError(error);
        } finally {
            setApplying(false);
        }
    }

    if (!open || !target) return null;

    const changes = preview?.changes ?? [];
    const validationErrors = preview?.validation_errors ?? [];
    const renames = changes.filter(c => c.type === 'rename');
    const drops = changes.filter(c => c.type === 'dropped');
    const hasChanges = changes.length > 0;
    const canApply = loadState === 'loaded' && validationErrors.length === 0 && hasChanges && !applying;

    return (
        <div className='rcfg-v2-dialog' role='dialog' aria-modal='true' aria-label='Migrate policy'>
            <div className='rcfg-v2-dialog__scrim' onClick={applying ? undefined : onClose} aria-hidden='true' />
            <div className='rcfg-v2-dialog__panel'>
                <header className='rcfg-v2-dialog__head'>
                    <div>
                        <h2>Migrate to current catalog</h2>
                        <p>
                            <strong>{runtimeDescription(target)}</strong>
                            <span className='rcfg-v2-migrate__sep' aria-hidden='true'> · </span>
                            <code>{target.policy_id}</code>
                        </p>
                    </div>
                    <button
                        type='button'
                        className='rcfg-v2-dialog__close'
                        onClick={onClose}
                        disabled={applying}
                        aria-label='Close'>
                        <i className='fa fa-times' aria-hidden='true' />
                    </button>
                </header>

                <section className='rcfg-v2-dialog__body rcfg-v2-migrate__body'>
                    {previewError && <PolicyError error={previewError} prefix='Dry-run preview failed' />}
                    {applyError && <PolicyError error={applyError} prefix='Apply failed' />}

                    {loadState === 'loading' && (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                            <p>Resolving aliases against the current catalog…</p>
                        </div>
                    )}

                    {loadState === 'loaded' && !hasChanges && validationErrors.length === 0 && (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-check-circle' aria-hidden='true' />
                            <p>This policy is already up to date — no renames or drops needed.</p>
                        </div>
                    )}

                    {validationErrors.length > 0 && (
                        <div className='rcfg-v2-migrate__errors' role='alert'>
                            <strong>Cannot apply yet</strong>
                            <ul>
                                {validationErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                            <small>The migrated document still violates catalog rules. Open the editor to fix manually.</small>
                        </div>
                    )}

                    {renames.length > 0 && (
                        <section className='rcfg-v2-migrate__section'>
                            <header>
                                <h3><i className='fa fa-pencil' aria-hidden='true' /> Renames</h3>
                                <span className='rcfg-v2-chip rcfg-v2-chip--muted'>{renames.length}</span>
                            </header>
                            <p className='rcfg-v2-migrate__hint'>
                                Catalog refresh renamed these keys; values carry over to the new names.
                            </p>
                            <ChangeTable changes={renames} />
                        </section>
                    )}

                    {drops.length > 0 && (
                        <section className='rcfg-v2-migrate__section rcfg-v2-migrate__section--warn'>
                            <header>
                                <h3><i className='fa fa-trash' aria-hidden='true' /> Drops</h3>
                                <span className='rcfg-v2-chip rcfg-v2-chip--warning'>{drops.length}</span>
                            </header>
                            <p className='rcfg-v2-migrate__hint'>
                                These keys are no longer in the active catalog and will be removed.
                            </p>
                            <ChangeTable changes={drops} />
                        </section>
                    )}
                </section>

                <footer className='rcfg-v2-dialog__foot rcfg-v2-migrate__foot'>
                    <small>
                        Dry-run by default. Click <strong>Apply</strong> to persist and re-snapshot catalog sha256.
                    </small>
                    <div className='rcfg-v2-migrate__foot-actions'>
                        <button
                            type='button'
                            className='argo-button argo-button--base-o'
                            onClick={onClose}
                            disabled={applying}>
                            Cancel
                        </button>
                        <button
                            type='button'
                            className='argo-button argo-button--base'
                            onClick={applyMigration}
                            disabled={!canApply}
                            title={
                                validationErrors.length > 0
                                    ? 'Resolve validation errors before applying'
                                    : !hasChanges
                                      ? 'No changes to apply'
                                      : 'Apply renames and drops, save the policy'
                            }>
                            {applying ? (
                                <>
                                    <i className='fa fa-spinner fa-spin' aria-hidden='true' /> Applying…
                                </>
                            ) : (
                                <>
                                    Apply migration
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

const ChangeTable: React.FC<{changes: RuntimeConfigPolicyMigrationChange[]}> = ({changes}) => (
    <table className='rcfg-v2-migrate__table'>
        <thead>
            <tr>
                <th>Role</th>
                <th>Kind</th>
                <th>From</th>
                <th>{changes[0]?.type === 'rename' ? 'To' : 'Reason'}</th>
            </tr>
        </thead>
        <tbody>
            {changes.map((change, index) => (
                <tr key={`${change.role}:${change.kind}:${change.from_name}:${index}`}>
                    <td>{runtimeConfigKeyLabel(change.role)}</td>
                    <td><code>{change.kind}</code></td>
                    <td><code>{change.from_name}</code></td>
                    <td>
                        {change.type === 'rename' ? (
                            <code className='rcfg-v2-migrate__to'>{change.to_name}</code>
                        ) : (
                            <small>{change.reason || 'no longer present in active catalog'}</small>
                        )}
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);
