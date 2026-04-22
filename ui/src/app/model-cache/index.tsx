import * as React from 'react';
import {Helmet} from 'react-helmet';

import {Page} from '../shared/components/page/page';

import {ModelCachePage} from './pages/ModelCachePage';

import './styles/model-cache.scss';

const ModelCacheContainer = () => (
    <>
        <Helmet>
            <title>Model Cache - Clustra Deploy</title>
        </Helmet>
        <Page title='Model Cache' toolbar={{breadcrumbs: [{title: 'Model Cache'}]}}>
            <ModelCachePage />
        </Page>
    </>
);

export default {
    component: ModelCacheContainer
};
