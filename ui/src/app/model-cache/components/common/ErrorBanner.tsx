import {ErrorNotification} from 'argo-ui';
import React from 'react';

interface Props {
    message: string;
    onRetry?: () => void;
}

export const ErrorBanner: React.FC<Props> = ({message, onRetry}) => (
    <div className='model-cache__error-banner' role='alert'>
        <div className='model-cache__error-banner-copy'>
            <ErrorNotification e={{message}} />
        </div>
        {onRetry && (
            <button type='button' className='argo-button argo-button--base-o model-cache__button model-cache__button--danger' onClick={onRetry} aria-label='Retry failed request'>
                Retry
            </button>
        )}
    </div>
);
