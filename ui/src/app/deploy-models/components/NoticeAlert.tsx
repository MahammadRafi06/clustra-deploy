import React from 'react';

type NoticeVariant = 'info' | 'warning';

interface NoticeAlertProps {
  message: string;
  variant?: NoticeVariant;
}

export function NoticeAlert({ message, variant = 'info' }: NoticeAlertProps) {
  const icon = variant === 'warning' ? 'fa fa-exclamation-triangle' : 'fa fa-info-circle';
  return (
    <div className={`cext-notice cext-notice--${variant}`} role="status">
      <i className={icon} />
      <span>{message}</span>
    </div>
  );
}
