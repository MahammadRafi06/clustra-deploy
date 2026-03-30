import {Tooltip} from 'argo-ui';
import {Boundary, Placement} from 'popper.js';
import {useData} from 'argo-ui/v2';
import * as React from 'react';
import {Context} from '../shared/context';
import {services, ViewPreferences} from '../shared/services';

require('./sidebar.scss');

interface NavItem {
    path: string;
    iconClassName: string;
    title: string;
    tooltip?: string;
    children?: NavItem[];
}

interface SidebarProps {
    onVersionClick: () => void;
    navItems: NavItem[];
    pref: ViewPreferences;
}

export const SIDEBAR_TOOLS_ID = 'sidebar-tools';

export const useSidebarTarget = () => {
    const sidebarTarget = React.useRef(document.createElement('div'));

    React.useEffect(() => {
        const sidebar = document.getElementById(SIDEBAR_TOOLS_ID);
        sidebar.appendChild(sidebarTarget?.current);
        return () => {
            sidebarTarget.current?.remove();
        };
    }, []);

    return sidebarTarget;
};

export const Sidebar = (props: SidebarProps) => {
    const context = React.useContext(Context);
    const [version, loading, error] = useData(() => services.version.version());
    const locationPath = context.history.location.pathname;

    const tooltipProps = {
        placement: 'right' as Placement,
        popperOptions: {
            modifiers: {
                preventOverflow: {
                    boundariesElement: 'window' as Boundary
                }
            }
        }
    };

    return (
        <div className={`sidebar ${props.pref.hideSidebar ? 'sidebar--collapsed' : ''}`}>
            <div className='sidebar__container'>
                <div className='sidebar__logo-container' onClick={() => context.history.push('/')}>
                    <img
                        title={'Go to start page'}
                        src='assets/images/logo-transparent.png'
                        alt='Clustra Deploy'
                        className='sidebar__logo__icon'
                    />
                    {!props.pref.hideSidebar && <div className='sidebar__brand-name'>Clustra Deploy</div>}
                </div>

                {(props.navItems || []).map(item => {
                    const isActive = locationPath === item.path || locationPath.startsWith(`${item.path}/`);
                    return (
                        <React.Fragment key={item.path}>
                            <Tooltip content={<div className='sidebar__tooltip'>{item?.tooltip || item.title}</div>} {...tooltipProps}>
                                <div
                                    className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                                    onClick={() => context.history.push(item.path)}>
                                    <div>
                                        <i className={item?.iconClassName || ''} />
                                        {!props.pref.hideSidebar && item.title}
                                    </div>
                                </div>
                            </Tooltip>
                            {isActive && !props.pref.hideSidebar && item.children && item.children.length > 0 && (
                                <div className='sidebar__subnav'>
                                    {item.children.map(child => (
                                        <Tooltip key={child.path} content={<div className='sidebar__tooltip'>{child.title}</div>} {...tooltipProps}>
                                            <div
                                                className={`sidebar__subnav-item ${locationPath === child.path || locationPath.startsWith(`${child.path}/`) ? 'sidebar__subnav-item--active' : ''}`}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    context.history.push(child.path);
                                                }}>
                                                <i className={child.iconClassName || ''} />
                                                {child.title}
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}

                {props.pref.hideSidebar && (
                    <Tooltip content='Show Filters' {...tooltipProps}>
                        <div
                            onClick={() => services.viewPreferences.updatePreferences({...props.pref, hideSidebar: !props.pref.hideSidebar})}
                            className='sidebar__nav-item sidebar__filter-button'>
                            <div>
                                <i className={`fas fa-filter`} />
                            </div>
                        </div>
                    </Tooltip>
                )}
            </div>
            <div className='sidebar__bottom'>
                <div onClick={() => services.viewPreferences.updatePreferences({...props.pref, hideSidebar: !props.pref.hideSidebar})} className='sidebar__collapse-button'>
                    <i className={`fas fa-arrow-${props.pref.hideSidebar ? 'right' : 'left'}`} />
                </div>
            </div>
            <div id={SIDEBAR_TOOLS_ID} />
        </div>
    );
};
