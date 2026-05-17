// Clustra plugin module: aggregates all fork-specific registrations and helpers
// imported by upstream files (`app.tsx`, `sidebar/sidebar.tsx`). Keeping these
// behind a single re-export surface limits the diff vs upstream to one import
// line per consumer, which keeps merge conflicts small on upstream syncs.

export {CLUSTRA_BASE_NAV_ITEMS, CLUSTRA_DEPLOY_MODELS_NAV_ITEM, CLUSTRA_MODEL_CACHE_NAV_ITEM, CLUSTRA_POLICY_MANAGEMENT_NAV_ITEMS, NavItem} from './nav-items';
export {CLUSTRA_ROUTES, Routes} from './routes';
export {applyClustraFeatureGuards, canSeeClustraPage, defaultAuthSettings, isDevelopmentBuild, safeGetAuthSettings, safeGetUser} from './feature-gates';
export {NAV_GROUPS, GroupedNavItem, NavGroup, bucketNavItems, isNavItemActive} from './nav-groups';
