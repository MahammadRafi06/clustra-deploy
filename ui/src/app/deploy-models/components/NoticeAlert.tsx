import React from 'react';

type NoticeVariant = 'info' | 'warning' | 'error';

interface NoticeAlertProps {
    message: string;
    variant?: NoticeVariant;
    actionLabel?: string;
    onAction?: () => void;
}

export function NoticeAlert({message, variant = 'info', actionLabel, onAction}: NoticeAlertProps) {
    const icon = variant === 'warning' ? 'fa fa-exclamation-triangle' : variant === 'error' ? 'fa fa-times-circle' : 'fa fa-info-circle';
    return (
        <div className={`deploy-models__notice deploy-models__notice--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
            <i className={icon} />
            <span>{message}</span>
            {actionLabel && onAction && (
                <button type='button' className='argo-button argo-button--base-o deploy-models__notice-action' onClick={onAction}>
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
