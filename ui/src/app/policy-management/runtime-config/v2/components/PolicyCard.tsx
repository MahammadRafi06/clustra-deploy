import * as React from 'react';

import {formatRelativeTime} from '../../../formatters';
import {runtimeConfigKeyLabel, runtimeDeploymentLabel, runtimeDescription, runtimeEngineLabel} from '../../runtimeConfigUtils';
import type {RuntimeConfigPolicyRecord, TuningIntent} from '../types';
import {readPolicyTags, summarizePolicyOverrides} from '../utils';

const INTENT_LABEL: Record<TuningIntent, string> = {
    latency: 'Latency-tuned',
    throughput: 'Throughput-tuned',
    cost: 'Cost-tuned',
    balanced: 'Balanced',
    debug: 'Debug / dev'
};

const INTENT_COLOR: Record<TuningIntent, string> = {
    latency: 'rcfg-v2-intent--latency',
    throughput: 'rcfg-v2-intent--throughput',
    cost: 'rcfg-v2-intent--cost',
    balanced: 'rcfg-v2-intent--balanced',
    debug: 'rcfg-v2-intent--debug'
};

export const PolicyCard: React.FC<{
    record: RuntimeConfigPolicyRecord;
    selected: boolean;
    onSelect: (record: RuntimeConfigPolicyRecord) => void;
    onEdit: (record: RuntimeConfigPolicyRecord) => void;
    onClone: (record: RuntimeConfigPolicyRecord) => void;
    onCompare: (record: RuntimeConfigPolicyRecord) => void;
    onDetails: (record: RuntimeConfigPolicyRecord) => void;
    onMigrate?: (record: RuntimeConfigPolicyRecord) => void;
}> = ({record, selected, onSelect, onEdit, onClone, onCompare, onDetails, onMigrate}) => {
    const tags = readPolicyTags(record);
    const summary = React.useMemo(() => summarizePolicyOverrides(record), [record]);
    const isSystem = record.managed_by === 'system';
    const usageCount = deploymentUsageCount(record);
    const updatedBy = record.updated_by || record.created_by || 'unknown';
    const hasDrift = typeof record.drift_count === 'number' && record.drift_count > 0;
    return (
        <article className={`rcfg-v2-card ${selected ? 'is-selected' : ''} ${isSystem ? 'rcfg-v2-card--template' : ''}`} aria-label={runtimeDescription(record)}>
            <header className='rcfg-v2-card__head'>
                <div className='rcfg-v2-card__head-titles'>
                    <button type='button' className='rcfg-v2-card__name' onClick={() => onDetails(record)}>
                        {runtimeDescription(record)}
                    </button>
                    <code className='rcfg-v2-card__id'>{record.policy_id}</code>
                </div>
                <div className='rcfg-v2-card__head-badges'>
                    {tags.intent && <span className={`rcfg-v2-intent ${INTENT_COLOR[tags.intent]}`}>{INTENT_LABEL[tags.intent]}</span>}
                    <button
                        type='button'
                        className='rcfg-v2-card__select'
                        onClick={() => onSelect(record)}
                        aria-pressed={selected}
                        aria-label={selected ? `Deselect ${runtimeDescription(record)}` : `Select ${runtimeDescription(record)}`}
                        title='Select for compare or bulk actions'>
                        <i className={`fa ${selected ? 'fa-check-circle' : 'fa-circle-thin'}`} aria-hidden='true' />
                    </button>
                </div>
            </header>

            <div className='rcfg-v2-card__scope-line'>
                <span className='rcfg-v2-card__scope-engine'>{runtimeEngineLabel(record.engine)}</span>
                <code className='rcfg-v2-card__scope-version'>{record.engine_version}</code>
                <span className='rcfg-v2-card__scope-sep' aria-hidden='true'>•</span>
                <span>{runtimeDeploymentLabel(record.deployment_type)}</span>
                <span className='rcfg-v2-card__scope-sep' aria-hidden='true'>•</span>
                <span>Dynamo {record.dynamo_version}</span>
            </div>

            {summary.total > 0 ? (
                <div className='rcfg-v2-card__summary' aria-label='Override summary'>
                    <div className='rcfg-v2-card__summary-head'>
                        <span className='rcfg-v2-card__summary-title'>
                            <strong>{summary.total}</strong> override{summary.total === 1 ? '' : 's'}
                        </span>
                        <ul className='rcfg-v2-card__summary-roles'>
                            {summary.byRole.map(entry => (
                                <li key={entry.role}>
                                    <span className='rcfg-v2-card__summary-role'>{runtimeConfigKeyLabel(entry.role)}</span>
                                    <span className='rcfg-v2-card__summary-count'>{entry.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {summary.headline && (
                        <div className='rcfg-v2-card__summary-headline'>
                            <code className='rcfg-v2-card__summary-field'>{summary.headline.name}</code>
                            <i className='fa fa-arrow-right' aria-hidden='true' />
                            <code className='rcfg-v2-card__summary-value'>{formatHeadlineValue(summary.headline.value)}</code>
                        </div>
                    )}
                </div>
            ) : (
                <div className='rcfg-v2-card__summary rcfg-v2-card__summary--empty' aria-label='Override summary'>
                    <i className='fa fa-info-circle' aria-hidden='true' /> Uses engine defaults — no overrides.
                </div>
            )}

            <div className='rcfg-v2-card__meta'>
                <span className='rcfg-v2-card__meta-time'>Updated {formatRelativeTime(record.updated_at)} by {updatedBy}</span>
                <div className='rcfg-v2-card__meta-flags'>
                    {tags.workloadClass && <span className='rcfg-v2-card__flag'>{tags.workloadClass}</span>}
                    {tags.isTemplate && <span className='rcfg-v2-card__flag rcfg-v2-card__flag--template'>Template</span>}
                    {!record.active && <span className='rcfg-v2-card__flag rcfg-v2-card__flag--archived'>Archived</span>}
                    {hasDrift && (
                        onMigrate && !isSystem ? (
                            <button
                                type='button'
                                className='rcfg-v2-card__flag rcfg-v2-card__flag--drift rcfg-v2-card__flag--clickable'
                                onClick={() => onMigrate(record)}
                                title='Catalog has been replaced since this policy was authored. Click to migrate.'>
                                <i className='fa fa-exclamation-triangle' aria-hidden='true' /> Catalog drift
                            </button>
                        ) : (
                            <span
                                className='rcfg-v2-card__flag rcfg-v2-card__flag--drift'
                                title={`This policy was authored against ${record.drift_count} catalog version${record.drift_count === 1 ? '' : 's'} that has since been replaced.`}>
                                <i className='fa fa-exclamation-triangle' aria-hidden='true' /> Catalog drift
                            </span>
                        )
                    )}
                    {usageCount > 0 && (
                        <span className='rcfg-v2-card__flag rcfg-v2-card__flag--inuse' title='Number of deployments currently using this policy'>
                            <i className='fa fa-cube' aria-hidden='true' /> {usageCount} deployment{usageCount === 1 ? '' : 's'}
                        </span>
                    )}
                </div>
            </div>

            {tags.tags.length > 0 && (
                <ul className='rcfg-v2-card__tags' aria-label='Tags'>
                    {tags.tags.slice(0, 4).map(tag => (
                        <li key={tag}>
                            <span className='rcfg-v2-tag'>#{tag}</span>
                        </li>
                    ))}
                    {tags.tags.length > 4 && <li className='rcfg-v2-card__tags-more'>+{tags.tags.length - 4}</li>}
                </ul>
            )}

            <footer className='rcfg-v2-card__actions'>
                <button
                    type='button'
                    className='argo-button argo-button--base'
                    onClick={() => onEdit(record)}
                    disabled={isSystem}
                    title={isSystem ? 'Templates are read-only — clone to customize' : undefined}>
                    {isSystem ? 'Use as template' : 'Edit'}
                </button>
                <button type='button' className='argo-button argo-button--base-o' onClick={() => onClone(record)}>
                    Clone
                </button>
                {hasDrift && onMigrate && !isSystem && (
                    <button
                        type='button'
                        className='argo-button argo-button--base-o rcfg-v2-card__migrate-action'
                        onClick={() => onMigrate(record)}
                        title='Re-resolve aliases against the current catalog'>
                        <i className='fa fa-sync' aria-hidden='true' /> Migrate
                    </button>
                )}
                <button type='button' className='rcfg-v2-card__quiet-action' onClick={() => onCompare(record)} title='Compare with another policy'>
                    Compare
                </button>
            </footer>
        </article>
    );
};

/**
 * Returns the number of deployments using this policy. We don't have the
 * backend linkage yet (no policy → deployment table), so we read an optional
 * cache from metadata.deployment_count for now. Returns 0 when unset, and
 * the card surfaces it so the answer is always present.
 */
function deploymentUsageCount(record: RuntimeConfigPolicyRecord): number {
    const metadata = record.document?.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        const raw = (metadata as Record<string, unknown>).deployment_count;
        if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
            return Math.floor(raw);
        }
    }
    return 0;
}

function formatHeadlineValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return '—';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 24 ? trimmed.slice(0, 22) + '…' : trimmed || '""';
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        const json = JSON.stringify(value);
        return json.length > 24 ? json.slice(0, 22) + '…' : json;
    } catch {
        return String(value);
    }
}

