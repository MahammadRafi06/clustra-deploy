// Clustra feature-gating helpers used during `app.tsx` bootstrap.
//
// Keeps the permission checks, dev-mode fallbacks, and conditional nav-item
// injection out of the upstream class component so `app.tsx`'s
// `componentDidMount` diff vs upstream stays small.

import {services} from '../shared/services';
import {AuthSettings} from '../shared/models';

import {
    CLUSTRA_DEPLOY_MODELS_NAV_ITEM,
    CLUSTRA_MODEL_CACHE_NAV_ITEM,
    CLUSTRA_POLICY_MANAGEMENT_NAV_ITEMS,
    NavItem
} from './nav-items';

export const isDevelopmentBuild = process.env.NODE_ENV !== 'production';

export const defaultAuthSettings: AuthSettings = {
    url: '',
    statusBadgeEnabled: false,
    statusBadgeRootUrl: '',
    googleAnalytics: {
        trackingID: '',
        anonymizeUsers: true
    },
    dexConfig: {
        connectors: []
    },
    oidcConfig: null,
    help: {
        chatUrl: '',
        chatText: '',
        binaryUrls: {}
    },
    userLoginsDisabled: false,
    kustomizeVersions: [],
    uiCssURL: '',
    uiBannerContent: '',
    uiBannerURL: '',
    uiBannerPermanent: false,
    uiBannerPosition: '',
    execEnabled: false,
    appsInAnyNamespaceEnabled: false,
    hydratorEnabled: false,
    syncWithReplaceAllowed: false
};

export async function canSeeClustraPage(subresource: string): Promise<boolean> {
    try {
        return await services.accounts.canI('clustra-pages', 'get', subresource);
    } catch (error) {
        if (isDevelopmentBuild) {
            console.warn(`Showing Clustra page "${subresource}" because the local Argo CD permission API is unavailable.`, error);
            return true;
        }
        return false;
    }
}

export async function safeGetAuthSettings(): Promise<AuthSettings> {
    return services.authService.settings().catch(error => {
        if (isDevelopmentBuild) {
            console.warn('Using local development auth settings because the Argo CD settings API is unavailable.', error);
            return defaultAuthSettings;
        }
        throw error;
    });
}

export async function safeGetUser(): Promise<{loggedIn: boolean; username: string; iss: string; groups: string[]}> {
    return services.users.get().catch(error => {
        if (isDevelopmentBuild) {
            console.warn('Using local development user info because the Argo CD user API is unavailable.', error);
            return {loggedIn: true, username: 'local-dev', iss: 'local-dev', groups: []};
        }
        throw error;
    }) as Promise<{loggedIn: boolean; username: string; iss: string; groups: string[]}>;
}

// Inject Clustra feature nav items after the first base nav item (Applications),
// gated by per-feature permissions.
export async function applyClustraFeatureGuards(baseNavItems: NavItem[]): Promise<NavItem[]> {
    const [canSeeModelCache, canSeeDeployModels] = await Promise.all([
        canSeeClustraPage('model-cache'),
        canSeeClustraPage('deploy-models')
    ]);

    const featureNavItems: NavItem[] = [];
    if (canSeeModelCache) {
        featureNavItems.push(CLUSTRA_MODEL_CACHE_NAV_ITEM);
    }
    if (canSeeDeployModels) {
        featureNavItems.push(CLUSTRA_DEPLOY_MODELS_NAV_ITEM);
        featureNavItems.push(...CLUSTRA_POLICY_MANAGEMENT_NAV_ITEMS);
    }

    return [...baseNavItems.slice(0, 1), ...featureNavItems, ...baseNavItems.slice(1)];
}
