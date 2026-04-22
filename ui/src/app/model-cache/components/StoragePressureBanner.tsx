import React from 'react';

import type {SystemHealth} from '../api/types';
import {formatBytes} from '../utils/formatters';

interface Props {
    health: SystemHealth;
}

const PRESSURE_CONFIG: Record<string, {icon: string; tone: 'warning' | 'danger'; message: string}> = {
    warning: {
        icon: 'fa-exclamation-triangle',
        tone: 'warning',
        message: 'Storage usage above 70%.'
    },
    critical: {
        icon: 'fa-exclamation-circle',
        tone: 'danger',
        message: 'Storage usage above 85%. Consider removing unused models.'
    },
    emergency: {
        icon: 'fa-ban',
        tone: 'danger',
        message: 'Storage nearly full (>95%). Downloads may fail. Remove models immediately.'
    }
};

export const StoragePressureBanner: React.FC<Props> = ({health}) => {
    const config = PRESSURE_CONFIG[health.storage_pressure];
    if (!config) {
        return null;
    }

    return (
        <div className={`model-cache__pressure-banner model-cache__pressure-banner--${config.tone}`}>
            <i className={`fa ${config.icon}`} />
            <div>
                <strong>{config.message}</strong>{' '}
                <span>
                    {health.storage_usage_percent}% used, {formatBytes(health.storage_free_bytes)} free of {formatBytes(health.storage_total_bytes)}
                </span>
            </div>
        </div>
    );
};
