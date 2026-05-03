import {ErrorNotification} from 'argo-ui';
import * as React from 'react';

import {formatErrorReference, toErrorInfo} from '../../deploy-models/errors';

export function PolicyError({error, prefix}: {error: unknown; prefix?: string}) {
    const info = toErrorInfo(error);
    const reference = formatErrorReference(error);
    const message = prefix ? `${prefix}: ${info.message}` : info.message;

    return (
        <div className='policy-management__error' role='alert'>
            <ErrorNotification e={{message}} />
            {reference && <div className='policy-management__error-reference'>{reference}</div>}
        </div>
    );
}
