import * as React from 'react';
import {Helmet} from 'react-helmet';

import {Page} from '../shared/components/page/page';

import {DeployModelsPage} from './App';

import './styles.scss';

const DeployModelsContainer = () => (
    <>
        <Helmet>
            <title>Deploy Models - Clustra Deploy</title>
        </Helmet>
        <Page title='Deploy Models'>
            <DeployModelsPage />
        </Page>
    </>
);

export default {
    component: DeployModelsContainer
};
