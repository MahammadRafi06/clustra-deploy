// Clustra-specific sidebar navigation data.
//
// All in-place modifications to upstream `app.tsx`'s `navItems` definition live
// here so the host file's conflict surface against future upstream merges is
// limited to a single import + assignment.

export interface NavItem {
    title: string;
    tooltip?: string;
    path: string;
    iconClassName: string;
    children?: NavItem[];
}

export const CLUSTRA_BASE_NAV_ITEMS: NavItem[] = [
    {
        title: 'Applications',
        tooltip: 'Manage your applications, and diagnose health problems.',
        path: '/applications',
        iconClassName: 'argo-icon argo-icon-application'
    },
    {
        title: 'Repositories',
        tooltip: 'Configure connected repositories',
        path: '/settings/repos',
        iconClassName: 'fa fa-code-branch'
    },
    {
        title: 'Certificates',
        tooltip: 'Configure repository certificates and known hosts',
        path: '/settings/certs',
        iconClassName: 'fa fa-certificate'
    },
    {
        title: 'GnuPG Keys',
        tooltip: 'Configure GnuPG public keys for commit verification',
        path: '/settings/gpgkeys',
        iconClassName: 'fa fa-key'
    },
    {
        title: 'Clusters',
        tooltip: 'Configure connected Kubernetes clusters',
        path: '/settings/clusters',
        iconClassName: 'fa fa-server'
    },
    {
        title: 'Projects',
        tooltip: 'Configure Clustra Deploy projects',
        path: '/settings/projects',
        iconClassName: 'fa fa-folder'
    },
    {
        title: 'Accounts',
        tooltip: 'Configure accounts',
        path: '/settings/accounts',
        iconClassName: 'fa fa-users'
    },
    {
        title: 'Appearance',
        tooltip: 'Configure themes in UI',
        path: '/settings/appearance',
        iconClassName: 'fa fa-palette'
    },
    {
        title: 'User Info',
        path: '/user-info',
        iconClassName: 'fa fa-user-circle'
    }
];

export const CLUSTRA_MODEL_CACHE_NAV_ITEM: NavItem = {
    title: 'Model Inventory',
    tooltip: 'Manage model artifacts, cache health, jobs, and audit history.',
    path: '/model-cache',
    iconClassName: 'fa fa-database'
};

export const CLUSTRA_DEPLOY_MODELS_NAV_ITEM: NavItem = {
    title: 'Model Deployments',
    tooltip: 'Plan and run private model deployment workflows.',
    path: '/deploy-models',
    iconClassName: 'fa fa-rocket'
};

export const CLUSTRA_POLICY_MANAGEMENT_NAV_ITEMS: NavItem[] = [
    {
        title: 'Workload Policies',
        tooltip: 'Manage workload-level AI Configurator request policies.',
        path: '/policy-management/workload',
        iconClassName: 'fa fa-briefcase'
    },
    {
        title: 'Infrastructure Policies',
        tooltip: 'Manage infrastructure selection and placement policies.',
        path: '/policy-management/infrastructure',
        iconClassName: 'fa fa-server'
    },
    {
        title: 'Serving Policies',
        tooltip: 'Manage serving runtime and deployment policies.',
        path: '/policy-management/serving',
        iconClassName: 'fa fa-network-wired'
    },
    {
        title: 'Runtime Config Policies',
        tooltip: 'Manage role-scoped runtime args and env policies.',
        path: '/policy-management/runtime-config',
        iconClassName: 'fa fa-cogs'
    }
];
