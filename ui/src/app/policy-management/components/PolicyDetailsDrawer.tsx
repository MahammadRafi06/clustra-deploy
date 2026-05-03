import * as React from 'react';

import type {PolicyRow} from '../api/types';
import {displayName, formatRelativeTime, tags, uiMetadata} from '../formatters';
import {FeatureArgEntry, formatPolicyJson, parseFeatureArgs} from '../validation';
import {PolicyBadge, managedByTone, statusTone} from './PolicyBadges';

interface PolicyDetailsDrawerProps {
    row: PolicyRow | null;
    onClose: () => void;
}

type DetailsTab = 'document' | 'featureArgs' | 'metadata';

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function roleArgs(document: Record<string, unknown>, mode: 'agg' | 'disagg', role: string) {
    const effects = isObject(document.effects) ? document.effects : {};
    const modeValue = isObject(effects[mode]) ? (effects[mode] as Record<string, unknown>) : {};
    if (Array.isArray(modeValue[role])) {
        return parseFeatureArgs(modeValue[role]);
    }
    const roleValue = isObject(modeValue[role]) ? (modeValue[role] as Record<string, unknown>) : {};
    return parseFeatureArgs(roleValue.args);
}

function CopyButton({value, label = 'Copy'}: {value: string; label?: string}) {
    return (
        <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={() => navigator.clipboard?.writeText(value)}>
            <i className='fa fa-copy' aria-hidden='true' /> {label}
        </button>
    );
}

function DetailsField({label, value}: {label: string; value: React.ReactNode}) {
    return (
        <div className='policy-management__details-field'>
            <div className='policy-management__meta-label'>{label}</div>
            <div className='policy-management__details-value'>{value || '—'}</div>
        </div>
    );
}

function documentDescription(document: Record<string, unknown>, fallback: string): string {
    return typeof document.description === 'string' && document.description ? document.description : fallback;
}

function splitTrailingComma(value: string) {
    const trimmed = value.trimEnd();
    if (trimmed.endsWith(',')) {
        return {value: trimmed.slice(0, -1), comma: ','};
    }
    return {value: trimmed, comma: ''};
}

function renderJsonValue(value: string, key: string) {
    const primitive = /^(?:"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/.test(value);
    return (
        <span key={key} className={primitive ? 'policy-management__json-value' : 'policy-management__json-punctuation'}>
            {value}
        </span>
    );
}

function renderJsonLine(line: string, index: number) {
    const property = line.match(/^(\s*)("(?:\\.|[^"\\])*")(: )(.*)$/);
    if (property) {
        const [, indent, key, colon, tail] = property;
        const {value, comma} = splitTrailingComma(tail);
        return (
            <span key={index} className='policy-management__json-line'>
                {indent}
                <span className='policy-management__json-key'>{key}</span>
                <span className='policy-management__json-punctuation'>{colon}</span>
                {renderJsonValue(value, 'value')}
                {comma && <span className='policy-management__json-punctuation'>{comma}</span>}
            </span>
        );
    }

    const indent = line.match(/^\s*/)?.[0] || '';
    const {value, comma} = splitTrailingComma(line.slice(indent.length));
    return (
        <span key={index} className='policy-management__json-line'>
            {indent}
            {renderJsonValue(value, 'value')}
            {comma && <span className='policy-management__json-punctuation'>{comma}</span>}
        </span>
    );
}

function JsonDocument({document}: {document: Record<string, unknown>}) {
    return <pre className='policy-management__code-block policy-management__json-highlight'>{formatPolicyJson(document).split('\n').map(renderJsonLine)}</pre>;
}

function ArgsBreakdown({document}: {document: Record<string, unknown>}) {
    const sections: Array<[string, FeatureArgEntry[]]> = [
        ['agg.frontend args', roleArgs(document, 'agg', 'frontend')],
        ['agg.worker args', roleArgs(document, 'agg', 'worker')],
        ['disagg.frontend args', roleArgs(document, 'disagg', 'frontend')],
        ['disagg.prefill args', roleArgs(document, 'disagg', 'prefill')],
        ['disagg.decode args', roleArgs(document, 'disagg', 'decode')]
    ];

    return (
        <div className='policy-management__args-summary'>
            {sections.map(([title, args]) => (
                <div key={title} className='policy-management__role-card'>
                    <div className='policy-management__role-card-header'>{title}</div>
                    {args.length === 0 ? (
                        <div className='policy-management__empty-inline'>No args</div>
                    ) : (
                        <div className='policy-management__arg-summary-list'>
                            {args.map((entry, index) => (
                                <div key={`${entry.flag}-${index}`} className='policy-management__arg-summary-row'>
                                    <code>{entry.flag}</code>
                                    <span>{entry.value == null ? 'flag-only' : entry.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export const PolicyDetailsDrawer: React.FC<PolicyDetailsDrawerProps> = ({row, onClose}) => {
    const [tab, setTab] = React.useState<DetailsTab>(() => (row?.family === 'feature' ? 'featureArgs' : 'document'));

    React.useEffect(() => {
        setTab(row?.family === 'feature' ? 'featureArgs' : 'document');
    }, [row?.id, row?.family]);

    if (!row) {
        return null;
    }
    const {record} = row;
    const document = record.document || {};
    const json = formatPolicyJson(document);
    const tagList = tags(document);
    const title = displayName(document) || record.policy_id;
    const tabItems: Array<{key: DetailsTab; label: string}> = [
        {key: 'document', label: 'Document'},
        ...(row.family === 'feature' ? [{key: 'featureArgs' as DetailsTab, label: 'Feature args'}] : []),
        {key: 'metadata', label: 'Metadata'}
    ];

    return (
        <section className='policy-management__inline-panel policy-management__details-panel' role='region' aria-label='Policy details'>
            <div className='policy-management__details-hero'>
                <div>
                    <div className='policy-management__details-title-row'>
                        <h3>{title}</h3>
                        <span className='policy-management__info-link' title='AI Configurator policy document'>
                            Info
                        </span>
                    </div>
                    <div className='policy-management__section-description'>{documentDescription(document, row.kindLabel)}</div>
                </div>
                <button type='button' className='argo-button argo-button--base-o policy-management__button' onClick={onClose}>
                    Close
                </button>
            </div>

            <section className='policy-management__details-card'>
                <h4>Policy details</h4>
                <div className='policy-management__details-grid'>
                    <DetailsField label='Kind' value={row.kindLabel} />
                    <DetailsField label={row.family === 'feature' ? 'Backend' : 'Type'} value={<code>{row.typeOrBackend}</code>} />
                    <DetailsField label='Creation time' value={record.created_at} />
                    <DetailsField label='Edited time' value={record.updated_at} />
                    <DetailsField
                        label='Policy ID'
                        value={
                            <span className='policy-management__copy-value'>
                                <button
                                    type='button'
                                    className='policy-management__copy-icon-button'
                                    aria-label={`Copy ${record.policy_id}`}
                                    onClick={() => navigator.clipboard?.writeText(record.policy_id)}>
                                    <i className='fa fa-copy' aria-hidden='true' />
                                </button>
                                <code>{record.policy_id}</code>
                            </span>
                        }
                    />
                    <DetailsField
                        label='State'
                        value={
                            <div className='policy-management__chip-list'>
                                <PolicyBadge tone={statusTone(record.active)}>{record.active ? 'active' : 'inactive'}</PolicyBadge>
                                <PolicyBadge tone={managedByTone(record.managed_by)}>{record.managed_by}</PolicyBadge>
                            </div>
                        }
                    />
                </div>
            </section>

            <div className='policy-management__details-tabs' role='tablist' aria-label='Policy detail sections'>
                {tabItems.map(item => (
                    <button
                        key={item.key}
                        type='button'
                        role='tab'
                        aria-selected={tab === item.key}
                        className={`policy-management__details-tab ${tab === item.key ? 'policy-management__details-tab--active' : ''}`}
                        onClick={() => setTab(item.key)}>
                        {item.label}
                    </button>
                ))}
            </div>

            <div className='policy-management__details-tab-panel' role='tabpanel'>
                {tab === 'document' && (
                    <section className='policy-management__drawer-section'>
                        <div className='policy-management__drawer-toolbar'>
                            <h4 className='policy-management__section-title'>Document</h4>
                            <CopyButton value={json} />
                        </div>
                        <JsonDocument document={document} />
                    </section>
                )}

                {tab === 'metadata' && (
                    <section className='policy-management__drawer-section'>
                        <div className='policy-management__meta-grid'>
                            <DetailsField label='Display name' value={displayName(document)} />
                            <DetailsField label='Updated' value={formatRelativeTime(record.updated_at)} />
                            <DetailsField label='Created by' value={record.created_by || '—'} />
                            <DetailsField label='Updated by' value={record.updated_by || '—'} />
                        </div>
                        <div className='policy-management__chip-list'>
                            {tagList.length === 0 ? <span className='policy-management__table-meta'>No tags</span> : tagList.map(tag => <PolicyBadge key={tag}>{tag}</PolicyBadge>)}
                        </div>
                        <JsonDocument document={uiMetadata(document)} />
                    </section>
                )}

                {tab === 'featureArgs' && row.family === 'feature' && (
                    <section className='policy-management__drawer-section'>
                        <h4 className='policy-management__section-title'>Feature Args</h4>
                        <ArgsBreakdown document={document} />
                    </section>
                )}
            </div>
        </section>
    );
};
