import {ErrorNotification} from 'argo-ui';
import React from 'react';

import {formatErrorReference, toErrorInfo} from '../errors';

interface ErrorAlertProps {
    error?: unknown;
    message?: string;
    prefix?: string;
}

export function ErrorAlert({error, message, prefix}: ErrorAlertProps) {
    const info = toErrorInfo(error ?? message ?? 'Unexpected error');
    const reference = formatErrorReference(error ?? message ?? null);
    const displayMessage = prefix ? `${prefix}: ${info.message}` : info.message;

    return (
        <div className='deploy-models__error'>
            <ErrorNotification e={{message: displayMessage}} />
            {reference && <div className='deploy-models__error-reference'>{reference}</div>}
        </div>
    );
}
