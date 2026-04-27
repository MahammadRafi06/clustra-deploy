import React from 'react';

import type {SystemHealth} from '../api/types';
import {formatBytes} from '../utils/formatters';

interface Props {
    health: SystemHealth | null | undefined;
}

export const HealthSummaryCards: React.FC<Props> = ({health}) => {
    if (!health) {
        return (
            <div className='model-cache__health-grid'>
                {[1, 2, 3, 4].map(item => (
                    <div key={item} className='model-cache__health-card'>
                        <div className='model-cache__health-label'>Loading</div>
                        <div className='model-cache__health-value'>—</div>
                    </div>
                ))}
            </div>
        );
    }

    const usagePercent = health.storage_total_bytes > 0 ? Math.round((health.storage_used_bytes / health.storage_total_bytes) * 100) : 0;
    const usageTone = usagePercent > 85 ? 'danger' : usagePercent > 70 ? 'warning' : 'success';

    return (
        <div className='model-cache__health-grid'>
            <div className='model-cache__health-card'>
                <div className='model-cache__health-label'>Total Models</div>
                <div className='model-cache__health-value'>{health.total_models}</div>
                <div className='model-cache__health-meta'>
                    {Object.entries(health.models_by_status)
                        .filter(([, value]) => value > 0)
                        .map(([status, value]) => `${value} ${status}`)
                        .join(', ')}
                </div>
            </div>

            <div className='model-cache__health-card'>
                <div className='model-cache__health-label'>Active Jobs</div>
                <div className='model-cache__health-value'>{health.active_jobs}</div>
                <div className='model-cache__health-meta'>downloads and operations</div>
            </div>

            <div className='model-cache__health-card'>
                <div className='model-cache__health-label'>Nodes</div>
                <div className='model-cache__health-value'>
                    <span className='model-cache__text--success'>{health.nodes_healthy}</span>
                    {health.nodes_stale > 0 && <span className='model-cache__text--danger'> / {health.nodes_stale} stale</span>}
                </div>
                <div className='model-cache__health-meta'>{health.nodes_total} total</div>
            </div>

            <div className='model-cache__health-card'>
                <div className='model-cache__health-label'>Model Inventory</div>
                <div className='model-cache__health-value'>{formatBytes(health.models_total_size_bytes)}</div>
                <div className='model-cache__health-meta'>
                    {formatBytes(health.storage_free_bytes)} free of {formatBytes(health.storage_total_bytes)}
                </div>
                <div className='model-cache__progress'>
                    <div className={`model-cache__progress-fill model-cache__progress-fill--${usageTone}`} style={{width: `${usagePercent}%`}} />
                </div>
            </div>
        </div>
    );
};
