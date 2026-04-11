import * as React from 'react';
import {Sidebar} from '../../../sidebar/sidebar';
import {ViewPreferences} from '../../services';
import {useTheme} from '../../utils';

require('./layout.scss');

export interface LayoutProps {
    navItems: Array<{path: string; iconClassName: string; title: string}>;
    onVersionClick?: () => void;
    children?: React.ReactNode;
    pref: ViewPreferences;
}

// Clustra Deploy is dark-only; body bg is always navy. See ui/BRANDING.md.
// Value must match $brand-navy in ui/src/app/shared/brand-tokens.scss.
const CLUSTRA_BODY_BG = '#0a192f';

export const ThemeWrapper = (props: {children: React.ReactNode; theme: string}) => {
    // useTheme is a no-op shim that always returns 'dark'; kept so the
    // existing call-site shape doesn't have to change.
    const [systemTheme] = useTheme({theme: props.theme});
    return <div className={'theme-' + systemTheme}>{props.children}</div>;
};

export const Layout = (props: LayoutProps) => {
    const [theme] = useTheme({theme: props.pref.theme});
    React.useEffect(() => {
        document.body.style.background = CLUSTRA_BODY_BG;
    }, []);

    return (
        <div className={`theme-${theme}`}>
            <div className={'cd-layout'}>
                <Sidebar onVersionClick={props.onVersionClick} navItems={props.navItems} pref={props.pref} />
                <div className={`cd-layout__content ${props.pref.hideSidebar ? 'cd-layout__content--sb-collapsed' : 'cd-layout__content--sb-expanded'} custom-styles`}>
                    {props.children}
                </div>
            </div>
        </div>
    );
};
