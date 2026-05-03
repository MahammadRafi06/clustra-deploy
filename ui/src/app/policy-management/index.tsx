import * as React from 'react';
import {Helmet} from 'react-helmet';
import {Redirect, RouteComponentProps} from 'react-router';

import {Page} from '../shared/components/page/page';
import {PolicyManagementWorkspace, resolvePolicyPagePath} from './pages';

import './styles/policy-management.scss';

const PolicyManagementContainer = ({location}: RouteComponentProps) => {
    if (location.pathname === '/policy-management' || location.pathname === '/policy-management/') {
        return <Redirect to='/policy-management/workload' />;
    }

    const policyPage = resolvePolicyPagePath(location.pathname);
    return (
        <>
            <Helmet>
                <title>{policyPage.title} - Clustra Deploy</title>
            </Helmet>
            <Page
                title='AI Configurator Policies'
                toolbar={{
                    breadcrumbs: [
                        {title: 'Policies', path: '/policy-management/workload'},
                        {title: policyPage.title, path: location.pathname}
                    ]
                }}>
                <PolicyManagementWorkspace page={policyPage} />
            </Page>
        </>
    );
};

export default {
    component: PolicyManagementContainer
};
