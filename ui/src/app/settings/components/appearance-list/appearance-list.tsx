import * as React from 'react';
import {Page} from '../../../shared/components';

require('./appearance-list.scss');

// Clustra Deploy uses the Clustra light theme. The theme selector is
// intentionally hidden so this page stays a stable route for future
// appearance settings without exposing unsupported modes.
export const AppearanceList = () => {
    return (
        <Page
            title={'Appearance'}
            toolbar={{
                breadcrumbs: [{title: 'Settings', path: '/settings'}, {title: 'Appearance'}]
            }}>
            <div className='appearance-list'>
                <div className='argo-container'>
                    <div className='appearance-list__panel'>
                        <p>Clustra Deploy uses the Clustra light theme.</p>
                    </div>
                </div>
            </div>
        </Page>
    );
};
