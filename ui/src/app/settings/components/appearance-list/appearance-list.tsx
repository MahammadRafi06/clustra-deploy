import * as React from 'react';
import {DataLoader, Page} from '../../../shared/components';
import {services} from '../../../shared/services';

require('./appearance-list.scss');

const THEMES: Array<{value: string; label: string; icon: string; hint: string}> = [
    {value: 'light', label: 'Light', icon: 'fa-sun', hint: 'Bright Clustra surfaces'},
    {value: 'dark', label: 'Dark', icon: 'fa-moon', hint: 'Dim, low-glare surfaces'},
    {value: 'auto', label: 'System', icon: 'fa-adjust', hint: 'Match your OS setting'}
];

export const AppearanceList = () => {
    return (
        <Page
            title={'Appearance'}
            toolbar={{
                breadcrumbs: [{title: 'Settings', path: '/settings'}, {title: 'Appearance'}]
            }}>
            <div className='appearance-list'>
                <div className='argo-container'>
                    <DataLoader load={() => services.viewPreferences.getPreferences()}>
                        {pref => (
                            <div className='appearance-list__panel'>
                                <div className='appearance-list__heading'>
                                    <h4>Theme</h4>
                                    <p>Choose how Clustra Deploy looks. “System” follows your operating system setting.</p>
                                </div>
                                <div className='appearance-list__themes'>
                                    {THEMES.map(option => {
                                        const active = (pref.theme || 'light') === option.value;
                                        return (
                                            <button
                                                type='button'
                                                key={option.value}
                                                className={`appearance-list__theme${active ? ' appearance-list__theme--active' : ''}`}
                                                aria-pressed={active}
                                                onClick={() => services.viewPreferences.updatePreferences({theme: option.value})}>
                                                <i className={`fa ${option.icon}`} aria-hidden='true' />
                                                <span className='appearance-list__theme-label'>{option.label}</span>
                                                <span className='appearance-list__theme-hint'>{option.hint}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </DataLoader>
                </div>
            </div>
        </Page>
    );
};
