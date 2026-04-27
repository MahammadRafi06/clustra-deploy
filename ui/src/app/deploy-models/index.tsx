import * as React from 'react';
import {Helmet} from 'react-helmet';

import {Page} from '../shared/components/page/page';

import {DeployModelsPage} from './App';

import './styles.scss';

const DeployModelsContainer = () => (
    <>
        <Helmet>
            <title>Model Deployments - Clustra Deploy</title>
        </Helmet>
        <Page title='Model Deployments' toolbar={{breadcrumbs: [{title: 'Model Deployments'}]}}>
            <DeployModelsPage />
        </Page>
    </>
);

export default {
    component: DeployModelsContainer
};
