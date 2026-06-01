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

// Body backgrounds behind the app canvas, per theme (the .theme-* wrappers
// handle the in-app surfaces; this is the bleed/overscroll colour).
const CLUSTRA_BODY_BG = '#eef2f7';
const CLUSTRA_BODY_BG_DARK = '#0a0e16';

export const ThemeWrapper = (props: {children: React.ReactNode; theme: string}) => {
    const [theme] = useTheme({theme: props.theme});
    return <div className={'theme-' + theme}>{props.children}</div>;
};

export const Layout = (props: LayoutProps) => {
    const [theme] = useTheme({theme: props.pref.theme});
    React.useEffect(() => {
        document.body.style.background = theme === 'dark' ? CLUSTRA_BODY_BG_DARK : CLUSTRA_BODY_BG;
    }, [theme]);

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
