import * as React from 'react';
import {Helmet} from 'react-helmet';

import {Page} from '../shared/components/page/page';

import {ModelCachePage} from './pages/ModelCachePage';

import './styles/model-cache.scss';

const ModelCacheContainer = () => (
    <>
        <Helmet>
            <title>Model Inventory - Clustra Deploy</title>
        </Helmet>
        <Page title='Model Inventory' toolbar={{breadcrumbs: [{title: 'Model Inventory'}]}}>
            <ModelCachePage />
        </Page>
    </>
);

export default {
    component: ModelCacheContainer
};
