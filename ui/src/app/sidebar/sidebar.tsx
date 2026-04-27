import {Tooltip} from 'argo-ui';
import {Boundary, Placement} from 'popper.js';
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

interface NavGroup {
    key: string;
    title: string;
    itemPaths: string[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        key: 'workloads',
        title: 'Workloads',
        itemPaths: ['/applications', '/applicationsets', '/deploy-models', '/model-cache']
    },
    {
        key: 'platform',
        title: 'Platform',
        itemPaths: ['/settings/repos', '/settings/clusters', '/settings/projects']
    },
    {
        key: 'security',
        title: 'Security & Access',
        itemPaths: ['/settings/certs', '/settings/gpgkeys', '/settings/accounts']
    },
    {
        key: 'preferences',
        title: 'Preferences',
        itemPaths: ['/settings/appearance', '/user-info']
    },
    {
        key: 'more',
        title: 'More',
        itemPaths: []
    }
];

const NAV_GROUP_LOOKUP = NAV_GROUPS.reduce((memo, group) => {
    group.itemPaths.forEach(path => {
        memo.set(path, group.key);
    });
    return memo;
}, new Map<string, string>());

const NAV_ITEM_ORDER = NAV_GROUPS.flatMap(group => group.itemPaths).reduce((memo, path, index) => {
    memo.set(path, index);
    return memo;
}, new Map<string, number>());

function bucketNavItems(items: NavItem[]) {
    const buckets = new Map<string, NavItem[]>();
    NAV_GROUPS.forEach(group => buckets.set(group.key, []));

    items.forEach(item => {
        const groupKey = NAV_GROUP_LOOKUP.get(item.path) || 'more';
        buckets.get(groupKey).push(item);
    });

    return NAV_GROUPS.map(group => ({
        ...group,
        items: (buckets.get(group.key) || []).sort((a, b) => {
            const left = NAV_ITEM_ORDER.has(a.path) ? NAV_ITEM_ORDER.get(a.path) : Number.MAX_SAFE_INTEGER;
            const right = NAV_ITEM_ORDER.has(b.path) ? NAV_ITEM_ORDER.get(b.path) : Number.MAX_SAFE_INTEGER;
            return left === right ? a.title.localeCompare(b.title) : left - right;
        })
    })).filter(group => group.items.length > 0);
}

function isNavItemActive(item: NavItem, locationPath: string): boolean {
    return locationPath === item.path || locationPath.startsWith(`${item.path}/`) || (item.children || []).some(child => isNavItemActive(child, locationPath));
}

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
    const locationPath = context.history.location.pathname;
    const groupedNavItems = React.useMemo(() => bucketNavItems(props.navItems || []), [props.navItems]);

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
                    <img title={'Go to start page'} src='assets/images/logo-blue.svg' alt='Clustra Deploy' className='sidebar__logo__icon' />
                    {!props.pref.hideSidebar && <div className='sidebar__brand-name'>Clustra Deploy</div>}
                </div>

                <nav className='sidebar__nav' aria-label='Primary navigation'>
                    {groupedNavItems.map(group => (
                        <div className='sidebar__nav-group' key={group.key}>
                            {!props.pref.hideSidebar && (
                                <div className='sidebar__nav-group-header'>
                                    <span className='sidebar__nav-group-title'>{group.title}</span>
                                </div>
                            )}
                            <div className='sidebar__nav-group-items'>
                                {group.items.map(item => {
                                    const isActive = isNavItemActive(item, locationPath);
                                    return (
                                        <React.Fragment key={item.path}>
                                            <Tooltip content={<div className='sidebar__tooltip'>{item?.tooltip || item.title}</div>} {...tooltipProps}>
                                                <div className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`} onClick={() => context.history.push(item.path)}>
                                                    <div>{!props.pref.hideSidebar && <span className='sidebar__nav-title'>{item.title}</span>}</div>
                                                </div>
                                            </Tooltip>
                                            {isActive && !props.pref.hideSidebar && item.children && item.children.length > 0 && (
                                                <div className='sidebar__subnav'>
                                                    {item.children.map(child => (
                                                        <Tooltip key={child.path} content={<div className='sidebar__tooltip'>{child.title}</div>} {...tooltipProps}>
                                                            <div
                                                                className={`sidebar__subnav-item ${isNavItemActive(child, locationPath) ? 'sidebar__subnav-item--active' : ''}`}
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    context.history.push(child.path);
                                                                }}>
                                                                <span className='sidebar__nav-title'>{child.title}</span>
                                                            </div>
                                                        </Tooltip>
                                                    ))}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

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
