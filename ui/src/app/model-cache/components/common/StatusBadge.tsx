import React from 'react';

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
    const label = children || (status ? status.replace(/_/g, ' ') : null);

    if (!label) {
        return null;
    }

    const className = `model-cache__status-badge model-cache__status-badge--${badgeTone} model-cache__status-badge--${size}${onClick ? ' model-cache__status-badge--button' : ''}`;

    if (onClick) {
        return (
            <button type='button' className={className} onClick={onClick} title={title}>
                {iconClassName && <i className={iconClassName} />}
                <span>{label}</span>
            </button>
        );
    }

    return (
        <span className={className} title={title}>
            {iconClassName && <i className={iconClassName} />}
            <span>{label}</span>
        </span>
    );
};
