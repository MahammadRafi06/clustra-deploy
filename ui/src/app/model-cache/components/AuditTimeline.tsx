import React, {useEffect, useState} from 'react';

import {modelAuditTrail} from '../api/client';
import type {AuditLogEntry} from '../api/types';
import {formatRelativeTime} from '../utils/formatters';

interface Props {
    modelId: string;
}

const ACTION_CONFIG: Record<string, {icon: string; tone: string; label: string}> = {
    download_requested: {icon: 'fa-cloud-download', tone: 'accent', label: 'Download requested'},
    download_succeeded: {icon: 'fa-check-circle', tone: 'success', label: 'Download complete'},
    download_failed: {icon: 'fa-times-circle', tone: 'danger', label: 'Download failed'},
    download_cancelled: {icon: 'fa-ban', tone: 'muted', label: 'Download cancelled'},
    soft_delete: {icon: 'fa-eye-slash', tone: 'warning', label: 'Soft deleted'},
    hard_delete_requested: {icon: 'fa-trash', tone: 'danger', label: 'Hard delete started'},
    hard_delete_succeeded: {icon: 'fa-trash', tone: 'success', label: 'Hard delete confirmed'},
    hard_delete_failed: {icon: 'fa-exclamation-triangle', tone: 'danger', label: 'Hard delete failed'},
    restore: {icon: 'fa-undo', tone: 'accent', label: 'Restored'},
    integrity_check_requested: {icon: 'fa-shield', tone: 'accent', label: 'Integrity check'},
    rescan_requested: {icon: 'fa-refresh', tone: 'accent', label: 'Rescan requested'}
};

function reasonText(details: Record<string, unknown>): string {
    if (details && typeof details === 'object' && 'reason' in details) {
        return String(details.reason);
    }
    return '';
}

export const AuditTimeline: React.FC<Props> = ({modelId}) => {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        modelAuditTrail(modelId, {page: 1})
            .then(response => {
                const seen = new Set<string>();
                const deduped = response.items.filter(entry => {
                    const key = `${entry.action}-${entry.created_at}`;
                    if (seen.has(key)) {
                        return false;
                    }
                    seen.add(key);
                    return true;
                });
                setEntries(deduped);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [modelId]);

    if (loading) {
        return <div className='model-cache__table-meta'>Loading timeline…</div>;
    }
    if (entries.length === 0) {
        return <div className='model-cache__table-meta'>No activity recorded</div>;
    }

    return (
        <div className='model-cache__timeline'>
            {entries.map(entry => {
                const config = ACTION_CONFIG[entry.action] || {icon: 'fa-circle', tone: 'muted', label: entry.action};
                const reason = reasonText(entry.details);
                return (
                    <div key={entry.id} className='model-cache__timeline-entry'>
                        <div className={`model-cache__timeline-bullet model-cache__timeline-bullet--${config.tone}`}>
                            <i className={`fa ${config.icon}`} />
                        </div>
                        <div className='model-cache__timeline-copy'>
                            <div>{config.label}</div>
                            <div className='model-cache__table-meta'>
                                by {entry.actor} {formatRelativeTime(entry.created_at)}
                                {reason && <span className='model-cache__text--danger'> · {reason}</span>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
