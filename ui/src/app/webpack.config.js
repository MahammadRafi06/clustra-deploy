'use strict;';

const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {codecovWebpackPlugin} = require('@codecov/webpack-plugin');
const webpack = require('webpack');

const isProd = process.env.NODE_ENV === 'production';

console.log(`Bundling in ${isProd ? 'production' : 'development'}...`);

const proxyConf = {
    target: process.env.ARGOCD_API_URL || 'https://localhost:8080',
    secure: false
};

const aiServiceProxyConf = {
    target: process.env.AI_SERVICE_API_URL || 'http://127.0.0.1:8000',
    secure: false,
    changeOrigin: true,
    pathRewrite: {'^/api/ai-service': ''},
    headers: {'X-Forwarded-User': process.env.AI_SERVICE_DEV_USER || 'alice'}
};

function sendJson(res, payload) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
}

function installLocalArgoStubs(app) {
    app.get('/extensions.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end('');
    });
    app.get('/api/version', (_req, res) =>
        sendJson(res, {
            Version: 'local-dev',
            BuildDate: '',
            GoVersion: '',
            Compiler: '',
            Platform: '',
            KustomizeVersion: '',
            HelmVersion: '',
            KubectlVersion: '',
            JsonnetVersion: ''
        })
    );
    app.get('/api/v1/settings', (_req, res) =>
        sendJson(res, {
            url: '',
            statusBadgeEnabled: false,
            statusBadgeRootUrl: '',
            googleAnalytics: {trackingID: '', anonymizeUsers: true},
            dexConfig: {connectors: []},
            oidcConfig: null,
            help: {chatUrl: '', chatText: '', binaryUrls: {}},
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
        })
    );
    app.get('/api/v1/session/userinfo', (_req, res) => sendJson(res, {loggedIn: true, username: 'local-dev', iss: 'local-dev', groups: []}));
    app.get('/api/v1/account/can-i/clustra-pages/get/:page', (_req, res) => sendJson(res, {value: 'yes'}));
}

const config = {
    entry: './src/app/index.tsx',
    output: {
        filename: '[name].[contenthash].js',
        chunkFilename: '[name].[contenthash].chunk.js',
        path: __dirname + '/../../dist/app'
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json'],
        alias: {react: require.resolve('react')},
        fallback: {fs: false}
    },
    ignoreWarnings: [
        {
            module: new RegExp('/node_modules/argo-ui/.*')
        }
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'esbuild-loader',
                options: {
                    loader: 'tsx',
                    target: 'es2015',
                    tsconfigRaw: require('./tsconfig.json')
                }
            },
            {
                enforce: 'pre',
                exclude: [/node_modules\/react-paginate/, /node_modules\/monaco-editor/],
                test: /\.js$/,
                use: ['esbuild-loader']
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'raw-loader', 'sass-loader']
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'raw-loader']
            }
        ]
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            'process.env.NODE_ONLINE_ENV': JSON.stringify(process.env.NODE_ONLINE_ENV || 'offline'),
            'process.env.HOST_ARCH': JSON.stringify(process.env.HOST_ARCH || 'amd64'),
            'process.platform': JSON.stringify('browser'),
            'SYSTEM_INFO': JSON.stringify({
                version: process.env.ARGO_VERSION || 'latest'
            })
        }),
        new HtmlWebpackPlugin({template: 'src/app/index.html'}),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'node_modules/argo-ui/src/assets',
                    to: 'assets',
                    globOptions: {
                        ignore: ['**/favicon/**', '**/images/logo.png']
                    }
                },
                {
                    from: 'src/assets',
                    to: 'assets'
                },
                {
                    from: 'node_modules/@fortawesome/fontawesome-free/webfonts',
                    to: 'assets/fonts'
                },
                {
                    from: 'node_modules/@fontsource/inter/files',
                    to: 'assets/fonts/inter',
                    globOptions: {
                        ignore: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/*ext*', '**/*italic*', '**/*.woff']
                    }
                },
                {
                    from: 'node_modules/@fontsource/geist-sans/files',
                    to: 'assets/fonts/geist-sans',
                    globOptions: {
                        ignore: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/*ext*', '**/*italic*', '**/*.woff']
                    }
                },
                {
                    from: 'node_modules/@fontsource/geist-mono/files',
                    to: 'assets/fonts/geist-mono',
                    globOptions: {
                        ignore: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/*ext*', '**/*italic*', '**/*.woff']
                    }
                },
                {
                    from: 'node_modules/redoc/bundles/redoc.standalone.js',
                    to: 'assets/scripts/redoc.standalone.js'
                },
                {
                    from: 'node_modules/monaco-editor/min/vs/base/browser/ui/codicons/codicon',
                    to: 'assets/fonts'
                }
            ]
        }),
        new MonacoWebpackPlugin({
            // https://github.com/microsoft/monaco-editor-webpack-plugin#options
            languages: ['yaml']
        }),
        codecovWebpackPlugin({
            enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
            bundleName: 'argo-cd-ui',
            uploadToken: process.env.CODECOV_TOKEN
        })
    ],
    devServer: {
        compress: false,
        historyApiFallback: {
            disableDotRule: true
        },
        port: 4000,
        host: process.env.ARGOCD_E2E_YARN_HOST || 'localhost',
        setupMiddlewares: (middlewares, devServer) => {
            if (!isProd && process.env.CLUSTRA_DISABLE_LOCAL_ARGO_STUBS !== 'true') {
                installLocalArgoStubs(devServer.app);
            }
            return middlewares;
        },
        proxy: {
            '/api/ai-service': aiServiceProxyConf,
            '/extensions': proxyConf,
            '/api': proxyConf,
            '/auth': proxyConf,
            '/terminal': {
                target: process.env.ARGOCD_API_URL || 'ws://localhost:8080',
                ws: true
            },
            '/swagger-ui': proxyConf,
            '/swagger.json': proxyConf
        }
    }
};

if (isProd) {
    config.performance = {
        hints: 'error',
        // Max size is 6MB before gzip.
        maxEntrypointSize: 6 * 1024 * 1024,
        maxAssetSize: 6 * 1024 * 1024
    };
}

if (!isProd) {
    config.devtool = 'eval-source-map';
}

module.exports = config;
