import React from 'react';

import {StatusPill, type PillTone} from '../../../shared/components';
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

// Map the model-cache tone vocabulary onto the shared StatusPill tones so every
// badge renders as the same tight, theme-aware pill (no more stretched blocks).
const TONE_MAP: Record<Tone, PillTone> = {
    success: 'success',
    danger: 'danger',
    warning: 'warning',
    accent: 'accent',
    violet: 'accent',
    muted: 'neutral'
};

export const StatusBadge: React.FC<Props> = ({status, tone, iconClassName, title, onClick, children}) => {
    const resolvedTone = (tone || statusTone(status || '')) as Tone;
    const pillTone: PillTone = TONE_MAP[resolvedTone] || 'neutral';
    const label = children || (status ? MODEL_STATUS_LABELS[status] || status.replace(/_/g, ' ') : null);

    if (!label) {
        return null;
    }

    const ariaLabel = status ? `Status: ${MODEL_STATUS_LABELS[status] || status.replace(/_/g, ' ')}` : undefined;

    return (
        <StatusPill tone={pillTone} icon={iconClassName} title={title} ariaLabel={ariaLabel} onClick={onClick}>
            {label}
        </StatusPill>
    );
};
