// Clustra-specific route registrations. Kept here so `app.tsx`'s
// in-place diff vs upstream is limited to importing this map.

import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import applications from '../applications';
import deployModels from '../deploy-models';
import login from '../login';
import modelCache from '../model-cache';
import policyManagement from '../policy-management';
import settings from '../settings';
import userInfo from '../user-info';

export type Routes = {[path: string]: {component: React.ComponentType<RouteComponentProps<any>>; noLayout?: boolean}};

export const CLUSTRA_ROUTES: Routes = {
    '/login': {component: login.component as any, noLayout: true},
    '/applications': {component: applications.component},
    '/model-cache': {component: modelCache.component},
    '/policy-management': {component: policyManagement.component},
    '/deploy-models': {component: deployModels.component},
    // TODO: Uncomment when ApplicationSet details page is fully implemented
    // '/applicationsets': {component: applications.component},
    '/settings': {component: settings.component},
    '/user-info': {component: userInfo.component}
};
