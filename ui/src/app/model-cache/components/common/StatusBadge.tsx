import React from 'react';

import {MODEL_STATUS_LABELS} from '../../utils/constants';
import {statusTone, type Tone} from '../../utils/formatters';

interface Props {
    status?: string;
    tone?: Tone;
    size?: 'small' | 'normal';
    iconClassName?: string;
    title?: string;
    onClick?: () => void;
    children?: React.ReactNode;
}

export const StatusBadge: React.FC<Props> = ({status, tone, size = 'normal', iconClassName, title, onClick, children}) => {
    const badgeTone = tone || statusTone(status || '');
    const label = children || (status ? MODEL_STATUS_LABELS[status] || status.replace(/_/g, ' ') : null);

    if (!label) {
        return null;
    }

    const className = `model-cache__status-badge model-cache__status-badge--${badgeTone} model-cache__status-badge--${size}${onClick ? ' model-cache__status-badge--button' : ''}`;
    const ariaLabel = status ? `Status: ${MODEL_STATUS_LABELS[status] || status.replace(/_/g, ' ')}` : undefined;

    if (onClick) {
        return (
            <button type='button' className={className} onClick={onClick} title={title} aria-label={title || ariaLabel}>
                {iconClassName && <i className={iconClassName} />}
                <span>{label}</span>
            </button>
        );
    }

    return (
        <span className={className} title={title} aria-label={ariaLabel}>
            {iconClassName && <i className={iconClassName} />}
            <span>{label}</span>
        </span>
    );
};
