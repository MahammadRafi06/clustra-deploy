import * as React from 'react';
import {Page} from '../../../shared/components';

require('./appearance-list.scss');

// Clustra Deploy is dark-only (see ui/BRANDING.md). The theme selector
// has been removed; this page is kept so /settings/appearance routes
// still resolve and stays a natural home for any future appearance
// settings we might add.
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
                        <p>Clustra Deploy uses a dark-mode-only theme.</p>
                    </div>
                </div>
            </div>
        </Page>
    );
};
