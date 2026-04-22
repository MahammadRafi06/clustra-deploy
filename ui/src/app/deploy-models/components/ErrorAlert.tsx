import {ErrorNotification} from 'argo-ui';
import React from 'react';

interface ErrorAlertProps {
    message: string;
}

export function ErrorAlert({message}: ErrorAlertProps) {
    return <ErrorNotification e={{message}} />;
}
