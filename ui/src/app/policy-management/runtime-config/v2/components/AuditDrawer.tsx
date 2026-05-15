import * as React from 'react';
import {useEffect, useState} from 'react';

import type {AuditEventRecord, PolicyApiClient, RuntimeConfigPolicyRecord} from '../../../api/types';
import {PolicyError} from '../../../components/PolicyError';
import {formatRelativeTime} from '../../../formatters';
import {runtimeDescription} from '../../runtimeConfigUtils';
import {useFocusTrap} from './useFocusTrap';

type LoadState = 'loading' | 'loaded' | 'error';

const DEFAULT_LIMIT = 50;

/**
 * Audit history viewer for a single runtime config policy. Pulls from
 * GET /audit-events?policy_id=...; the backend masks sensitive values
 * before persisting, so payloads are safe to display verbatim.
 */
export const AuditDrawer: React.FC<{
    open: boolean;
    target: RuntimeConfigPolicyRecord | null;
    client: PolicyApiClient;
    onClose: () => void;
}> = ({open, target, client, onClose}) => {
    const trapRef = useFocusTrap<HTMLElement>(open);
    const [events, setEvents] = useState<AuditEventRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [loadState, setLoadState] = useState<LoadState>('loaded');
    const [loadError, setLoadError] = useState<unknown | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

    useEffect(() => {
        if (!open || !target) {
            setEvents([]);
            setTotal(0);
            setExpanded(new Set());
            setLoadError(null);
            return;
        }
        let cancelled = false;
        setLoadState('loading');
        setLoadError(null);
        (async () => {
            try {
                const result = await client.listAuditEvents({policy_id: target.policy_id, limit: DEFAULT_LIMIT, offset: 0});
                if (!cancelled) {
                    setEvents(result.events);
                    setTotal(result.total);
                    setLoadState('loaded');
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadError(error);
                    setLoadState('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [client, open, target]);

    function toggleExpanded(key: string) {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    if (!open || !target) return null;

    return (
        <div className='rcfg-v2-drawer' role='dialog' aria-modal='true' aria-label={`Audit history for ${runtimeDescription(target)}`}>
            <div className='rcfg-v2-drawer__backdrop' onClick={onClose} aria-hidden='true' />
            <aside ref={trapRef} className='rcfg-v2-drawer__panel' tabIndex={-1}>
                <header className='rcfg-v2-drawer__head'>
                    <div className='rcfg-v2-drawer__head-titles'>
                        <div className='rcfg-v2-drawer__eyebrow'>
                            <span className='rcfg-v2-chip rcfg-v2-chip--muted'>
                                <i className='fa fa-history' aria-hidden='true' /> Audit history
                            </span>
                            {loadState === 'loaded' && total > 0 && (
                                <span className='rcfg-v2-chip'>
                                    {total} event{total === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                        <h2>{runtimeDescription(target)}</h2>
                        <code className='rcfg-v2-drawer__id'>{target.policy_id}</code>
                    </div>
                    <button type='button' className='rcfg-v2-drawer__close' onClick={onClose} aria-label='Close audit history'>
                        <i className='fa fa-times' aria-hidden='true' />
                    </button>
                </header>

                <div className='rcfg-v2-drawer__body rcfg-v2-audit__body'>
                    {loadState === 'loading' && (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-spinner fa-spin' aria-hidden='true' />
                            <p>Loading audit events…</p>
                        </div>
                    )}

                    {loadState === 'error' && loadError && (
                        <PolicyError error={loadError} prefix='Could not load audit history' />
                    )}

                    {loadState === 'loaded' && events.length === 0 && (
                        <div className='rcfg-v2-empty'>
                            <i className='fa fa-history' aria-hidden='true' />
                            <p>No audit events recorded for this policy yet.</p>
                        </div>
                    )}

                    {loadState === 'loaded' && events.length > 0 && (
                        <ol className='rcfg-v2-audit__timeline'>
                            {events.map((event, index) => {
                                const key = `${event.request_id}:${index}`;
                                const isOpen = expanded.has(key);
                                const hasPayload = event.payload && Object.keys(event.payload).length > 0;
                                return (
                                    <li key={key} className='rcfg-v2-audit__row'>
                                        <div className='rcfg-v2-audit__row-head'>
                                            <span className={`rcfg-v2-audit__type rcfg-v2-audit__type--${eventVariant(event.event_type)}`}>
                                                {humanizeEventType(event.event_type)}
                                            </span>
                                            <span className='rcfg-v2-audit__when' title={event.created_at}>
                                                {formatRelativeTime(event.created_at)}
                                            </span>
                                            <span className='rcfg-v2-audit__by'>
                                                <i className='fa fa-user' aria-hidden='true' /> {event.triggered_by || 'system'}
                                            </span>
                                        </div>
                                        {hasPayload && (
                                            <button
                                                type='button'
                                                className='rcfg-v2-audit__toggle'
                                                onClick={() => toggleExpanded(key)}
                                                aria-expanded={isOpen}>
                                                <i className={`fa ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'}`} aria-hidden='true' /> Payload
                                            </button>
                                        )}
                                        {isOpen && hasPayload && (
                                            <pre className='rcfg-v2-audit__payload'>{safeStringify(event.payload)}</pre>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}

                    {loadState === 'loaded' && total > events.length && (
                        <div className='rcfg-v2-audit__more'>
                            Showing {events.length} of {total} events. Older entries are not paginated in this view yet.
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
};

function humanizeEventType(eventType: string): string {
    // runtime_config_policy_created → Policy created.
    const trimmed = eventType.replace(/^runtime_config_policy_/, '').replace(/_/g, ' ');
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function eventVariant(eventType: string): 'create' | 'update' | 'patch' | 'migrate' | 'delete' | 'other' {
    if (eventType.endsWith('_created')) return 'create';
    if (eventType.endsWith('_updated')) return 'update';
    if (eventType.endsWith('_patched')) return 'patch';
    if (eventType.endsWith('_migrated')) return 'migrate';
    if (eventType.endsWith('_deleted')) return 'delete';
    return 'other';
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
