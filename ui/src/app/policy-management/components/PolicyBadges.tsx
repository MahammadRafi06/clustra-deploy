import * as React from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'muted' | 'violet';

export const PolicyBadge: React.FC<{tone?: Tone; children: React.ReactNode; title?: string}> = ({tone = 'muted', children, title}) => (
    <span className={`policy-management__badge policy-management__badge--${tone}`} title={title}>
        {children}
    </span>
);

export function statusTone(active: boolean): Tone {
    return active ? 'success' : 'warning';
}

export function managedByTone(managedBy: string): Tone {
    return managedBy === 'system' ? 'violet' : 'accent';
}
