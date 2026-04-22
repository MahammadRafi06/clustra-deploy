import React from 'react';

import {useAppContext} from './AppContext';

export function AppNameBadge() {
    const {appName, projectName} = useAppContext();
    if (!appName && !projectName) {
        return null;
    }

    return (
        <div className='deploy-models__context-badges'>
            {projectName && (
                <span className='deploy-models__context-badge deploy-models__context-badge--project'>
                    <i className='fa fa-folder-open' />
                    {projectName}
                </span>
            )}
            {appName && (
                <span className='deploy-models__context-badge'>
                    <i className='fa fa-cube' />
                    {appName}
                </span>
            )}
        </div>
    );
}
