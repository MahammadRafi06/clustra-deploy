// Clustra sidebar grouping taxonomy. Kept here so `sidebar.tsx`'s
// in-place diff vs upstream is limited to importing this data + helper.

import {NavItem} from './nav-items';

export interface NavGroup {
    key: string;
    title: string;
    itemPaths: string[];
}

export interface GroupedNavItem extends NavGroup {
    items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        key: 'workloads',
        title: 'Workloads',
        itemPaths: ['/applications', '/applicationsets', '/deploy-models', '/model-cache']
    },
    {
        key: 'policies',
        title: 'Policies',
        itemPaths: [
            '/policy-management/workload',
            '/policy-management/infrastructure',
            '/policy-management/serving',
            '/policy-management/runtime-config'
        ]
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

export function bucketNavItems(items: NavItem[]): GroupedNavItem[] {
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

export function isNavItemActive(item: NavItem, locationPath: string): boolean {
    return locationPath === item.path || locationPath.startsWith(`${item.path}/`) || (item.children || []).some(child => isNavItemActive(child, locationPath));
}
