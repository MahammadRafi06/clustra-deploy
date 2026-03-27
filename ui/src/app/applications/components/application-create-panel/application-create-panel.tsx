/* eslint-disable no-prototype-builtins */
import {AutocompleteField, Checkbox, DataLoader, DropDownMenu, FormField, HelpIcon, Select} from 'argo-ui';
import * as deepMerge from 'deepmerge';
import * as React from 'react';
import {FieldApi, Form, FormApi, FormField as ReactFormField, Text} from 'react-form';
import {YamlEditor} from '../../../shared/components';
import * as models from '../../../shared/models';
import {services} from '../../../shared/services';
import {AuthSettingsCtx} from '../../../shared/context';
import {ApplicationParameters} from '../application-parameters/application-parameters';
import {ApplicationRetryOptions} from '../application-retry-options/application-retry-options';
import {ApplicationSyncOptionsField} from '../application-sync-options/application-sync-options';
import {SetFinalizerOnApplication} from './set-finalizer-on-application';
import {HydratorSourcePanel} from './hydrator-source-panel';
import {SourcePanel} from './source-panel';
import './application-create-panel.scss';
import {getAppDefaultSource} from '../utils';
import {debounce} from 'lodash-es';
import {MODELS, getSystems, getBackends, getBackendVersions, getModes, isCombinationValid} from './model-config';

const jsonMergePatch = require('json-merge-patch');

const appTypes = new Array<{field: string; type: models.AppSourceType}>(
    {type: 'Helm', field: 'helm'},
    {type: 'Kustomize', field: 'kustomize'},
    {type: 'Directory', field: 'directory'},
    {type: 'Plugin', field: 'plugin'}
);

const DEFAULT_APP: Partial<models.Application> = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
        name: ''
    },
    spec: {
        destination: {
            name: undefined,
            namespace: '',
            server: undefined
        },
        source: {
            path: '',
            repoURL: '',
            targetRevision: 'HEAD'
        },
        sources: [],
        project: ''
    }
};

const AutoSyncFormField = ReactFormField((props: {fieldApi: FieldApi; className: string}) => {
    const manual = 'Manual';
    const auto = 'Automatic';
    const {
        fieldApi: {getValue, setValue}
    } = props;
    const automated = getValue() as models.Automated;
    return (
        <React.Fragment>
            <label>Sync Policy</label>
            <Select
                value={automated ? auto : manual}
                options={[manual, auto]}
                onChange={opt => {
                    setValue(opt.value === auto ? {prune: false, selfHeal: false, enabled: true} : null);
                }}
            />
            {automated && (
                <div className='application-create-panel__sync-params'>
                    <div className='checkbox-container'>
                        <Checkbox onChange={val => setValue({...automated, enabled: val})} checked={automated.enabled === undefined ? true : automated.enabled} id='policyEnable' />
                        <label htmlFor='policyEnable'>Enable Auto-Sync</label>
                        <HelpIcon title='If checked, application will automatically sync when changes are detected' />
                    </div>
                    <div className='checkbox-container'>
                        <Checkbox onChange={val => setValue({...automated, prune: val})} checked={!!automated.prune} id='policyPrune' />
                        <label htmlFor='policyPrune'>Prune Resources</label>
                        <HelpIcon title='If checked, Argo will delete resources if they are no longer defined in Git' />
                    </div>
                    <div className='checkbox-container'>
                        <Checkbox onChange={val => setValue({...automated, selfHeal: val})} checked={!!automated.selfHeal} id='policySelfHeal' />
                        <label htmlFor='policySelfHeal'>Self Heal</label>
                        <HelpIcon title='If checked, Argo will force the state defined in Git into the cluster when a deviation in the cluster is detected' />
                    </div>
                </div>
            )}
        </React.Fragment>
    );
});

const ModelAutocompleteFormField = ReactFormField((props: any) => {
    const {fieldApi, onValueChange, ...rest} = props;
    const value = fieldApi.getValue();
    const previousValue = React.useRef(value);

    React.useEffect(() => {
        if (onValueChange && previousValue.current !== value) {
            onValueChange(value, previousValue.current);
        }
        previousValue.current = value;
    }, [onValueChange, value]);

    return <AutocompleteField {...rest} fieldApi={fieldApi} />;
});

const ModelSelectFormField = ReactFormField((props: any) => {
    const {fieldApi, onValueChange, ...rest} = props;
    const value = fieldApi.getValue() || '';
    const previousValue = React.useRef(value);

    React.useEffect(() => {
        if (onValueChange && previousValue.current !== value) {
            onValueChange(value, previousValue.current);
        }
        previousValue.current = value;
    }, [onValueChange, value]);

    return <Select {...rest} value={value} onChange={opt => fieldApi.setValue(opt.value)} />;
});

function normalizeAppSource(app: models.Application, type: string): boolean {
    const source = getAppDefaultSource(app);
    const repoType = source.repoURL.startsWith('oci://') ? 'oci' : (source.hasOwnProperty('chart') && 'helm') || 'git';
    if (repoType !== type) {
        if (type === 'git' || type === 'oci') {
            source.path = source.chart;
            delete source.chart;
            source.targetRevision = 'HEAD';
        } else {
            source.chart = source.path;
            delete source.path;
            source.targetRevision = '';
        }
        return true;
    }
    return false;
}

export const ApplicationCreatePanel = (props: {
    app: models.Application;
    onAppChanged: (app: models.Application) => any;
    createApp: (app: models.Application) => any;
    getFormApi: (api: FormApi) => any;
}) => {
    const [yamlMode, setYamlMode] = React.useState(false);
    const [explicitPathType, setExplicitPathType] = React.useState<{path: string; type: models.AppSourceType}>(null);
    const [retry, setRetry] = React.useState(false);
    const app = deepMerge(DEFAULT_APP, props.app || {});
    const debouncedOnAppChanged = debounce(props.onAppChanged, 800);
    const [destinationFieldChanges, setDestinationFieldChanges] = React.useState({destFormat: 'URL', destFormatChanged: null});
    const comboSwitchedFromPanel = React.useRef(false);
    const currentRepoType = React.useRef(undefined);
    const lastGitOrHelmUrl = React.useRef('');
    const lastOciUrl = React.useRef('');
    const [isHydratorEnabled, setIsHydratorEnabled] = React.useState(!!app.spec.sourceHydrator);
    const [savedSyncSource, setSavedSyncSource] = React.useState(app.spec.sourceHydrator?.syncSource || {targetBranch: '', path: ''});
    let destinationComboValue = destinationFieldChanges.destFormat;
    const authSettingsCtx = React.useContext(AuthSettingsCtx);

    React.useEffect(() => {
        comboSwitchedFromPanel.current = false;
    }, []);

    React.useEffect(() => {
        return () => {
            debouncedOnAppChanged.cancel();
        };
    }, [debouncedOnAppChanged]);

    function normalizeTypeFields(formApi: FormApi, type: models.AppSourceType) {
        const appToNormalize = formApi.getFormState().values;
        for (const item of appTypes) {
            if (item.type !== type) {
                delete appToNormalize.spec.source[item.field];
            }
        }
        formApi.setAllValues(appToNormalize);
    }

    const currentName = app.spec.destination.name;
    const currentServer = app.spec.destination.server;
    if (destinationFieldChanges.destFormatChanged !== null) {
        if (destinationComboValue == 'NAME') {
            if (currentName === undefined && currentServer !== undefined && comboSwitchedFromPanel.current === false) {
                destinationComboValue = 'URL';
            } else {
                delete app.spec.destination.server;
                if (currentName === undefined) {
                    app.spec.destination.name = '';
                }
            }
        } else {
            if (currentServer === undefined && currentName !== undefined && comboSwitchedFromPanel.current === false) {
                destinationComboValue = 'NAME';
            } else {
                delete app.spec.destination.name;
                if (currentServer === undefined) {
                    app.spec.destination.server = '';
                }
            }
        }
    } else {
        if (currentName === undefined && currentServer === undefined) {
            destinationComboValue = destinationFieldChanges.destFormat;
            app.spec.destination.server = '';
        } else {
            if (currentName != undefined) {
                destinationComboValue = 'NAME';
            } else {
                destinationComboValue = 'URL';
            }
        }
    }

    const onCreateApp = (data: models.Application) => {
        if (destinationComboValue === 'URL') {
            delete data.spec.destination.name;
        } else {
            delete data.spec.destination.server;
        }

        if (data.spec.sourceHydrator && !data.spec.sourceHydrator.hydrateTo?.targetBranch) {
            delete data.spec.sourceHydrator.hydrateTo;
        }

        props.createApp(data);
    };

    return (
        <DataLoader
            key='creation-deps'
            load={() =>
                Promise.all([
                    services.projects.list('items.metadata.name').then(projects => projects.map(proj => proj.metadata.name).sort()),
                    services.clusters.list().then(clusters => clusters.sort()),
                    services.repos.list()
                ]).then(([projects, clusters, reposInfo]) => ({projects, clusters, reposInfo}))
            }>
            {({projects, clusters, reposInfo}) => {
                const repos = reposInfo.map(info => info.repo).sort();
                const repoInfo = reposInfo.find(info => info.repo === app.spec.source.repoURL);
                if (repoInfo) {
                    normalizeAppSource(app, repoInfo.type || currentRepoType.current || 'git');
                }
                return (
                    <div className='application-create-panel'>
                        {(yamlMode && (
                            <YamlEditor
                                minHeight={800}
                                initialEditMode={true}
                                input={app}
                                onCancel={() => setYamlMode(false)}
                                onSave={async patch => {
                                    props.onAppChanged(jsonMergePatch.apply(app, JSON.parse(patch)));
                                    setYamlMode(false);
                                    return true;
                                }}
                            />
                        )) || (
                            <Form
                                validateError={(a: models.Application) => {
                                    const hasHydrator = !!a.spec.sourceHydrator;
                                    const source = a.spec.source;

                                    const ann = (a as any).metadata?.annotations || {};
                                    const modelComboInvalid =
                                        ann.model_path &&
                                        ann.system &&
                                        ann.backend &&
                                        ann.backend_version &&
                                        ann.mode &&
                                        !isCombinationValid(ann.model_path, ann.system, ann.backend, ann.backend_version, ann.mode);

                                    return {
                                        'metadata.annotations.model_path': modelComboInvalid && 'Combination not supported',
                                        'metadata.name': !a.metadata.name && 'Application Name is required',
                                        'spec.project': !a.spec.project && 'Project Name is required',
                                        'spec.source.repoURL': !hasHydrator && !source?.repoURL && 'Repository URL is required',
                                        'spec.source.targetRevision': !hasHydrator && !source?.targetRevision && source?.hasOwnProperty('chart') && 'Version is required',
                                        'spec.source.path': !hasHydrator && !source?.path && !source?.chart && 'Path is required',
                                        'spec.source.chart': !hasHydrator && !source?.path && !source?.chart && 'Chart is required',
                                        // Verify cluster URL when there is no cluster name field or the name value is empty
                                        'spec.destination.server':
                                            !a.spec.destination.server &&
                                            (!a.spec.destination.hasOwnProperty('name') || a.spec.destination.name === '') &&
                                            'Cluster URL is required',
                                        // Verify cluster name when there is no cluster URL field or the URL value is empty
                                        'spec.destination.name':
                                            !a.spec.destination.name &&
                                            (!a.spec.destination.hasOwnProperty('server') || a.spec.destination.server === '') &&
                                            'Cluster name is required'
                                    };
                                }}
                                defaultValues={app}
                                formDidUpdate={state => debouncedOnAppChanged(state.values as any)}
                                onSubmit={onCreateApp}
                                getApi={props.getFormApi}>
                                {api => {
                                    const generalPanel = () => (
                                        <div className='white-box'>
                                            <p>GENERAL</p>
                                            {/*
                                                    Need to specify "type='button'" because the default type 'submit'
                                                    will activate yaml mode whenever enter is pressed while in the panel.
                                                    This causes problems with some entry fields that require enter to be
                                                    pressed for the value to be accepted.

                                                    See https://github.com/argoproj/argo-cd/issues/4576
                                                */}
                                            {/* Edit as YAML button hidden */}
                                            <div className='argo-form-row'>
                                                <FormField formApi={api} label='Application Name' qeId='application-create-field-app-name' field='metadata.name' component={Text} />
                                            </div>
                                            <div className='argo-form-row'>
                                                <FormField
                                                    formApi={api}
                                                    label='Project Name'
                                                    qeId='application-create-field-project'
                                                    field='spec.project'
                                                    component={AutocompleteField}
                                                    componentProps={{
                                                        items: projects,
                                                        filterSuggestions: true
                                                    }}
                                                />
                                            </div>
                                            <div className='argo-form-row'>
                                                <FormField
                                                    formApi={api}
                                                    field='spec.syncPolicy.automated'
                                                    qeId='application-create-field-sync-policy'
                                                    component={AutoSyncFormField}
                                                />
                                            </div>
                                            <div className='argo-form-row'>
                                                <FormField formApi={api} field='metadata.finalizers' component={SetFinalizerOnApplication} />
                                            </div>
                                            <div className='argo-form-row'>
                                                <label>Sync Options</label>
                                                <FormField formApi={api} field='spec.syncPolicy.syncOptions' component={ApplicationSyncOptionsField} />
                                                <ApplicationRetryOptions
                                                    formApi={api}
                                                    field='spec.syncPolicy.retry'
                                                    retry={retry || (api.getFormState().values.spec.syncPolicy && api.getFormState().values.spec.syncPolicy.retry)}
                                                    setRetry={setRetry}
                                                    initValues={api.getFormState().values.spec.syncPolicy ? api.getFormState().values.spec.syncPolicy.retry : null}
                                                />
                                            </div>
                                        </div>
                                    );

                                    const sourcePanel = () => (
                                        <div className='white-box'>
                                            <p>SOURCE</p>
                                            {/* Only show hydrator checkbox if hydrator is enabled in auth settings */}
                                            {authSettingsCtx?.hydratorEnabled && (
                                                <div className='row argo-form-row'>
                                                    <div className='columns small-12'>
                                                        <div className='checkbox-container'>
                                                            <Checkbox
                                                                onChange={(val: boolean) => {
                                                                    const updatedApp = api.getFormState().values as models.Application;
                                                                    if (val) {
                                                                        if (!updatedApp.spec.sourceHydrator) {
                                                                            updatedApp.spec.sourceHydrator = {
                                                                                drySource: {
                                                                                    repoURL: updatedApp.spec.source.repoURL,
                                                                                    targetRevision: updatedApp.spec.source.targetRevision,
                                                                                    path: updatedApp.spec.source.path
                                                                                },
                                                                                syncSource: savedSyncSource
                                                                            };
                                                                            delete updatedApp.spec.source;
                                                                        }
                                                                    } else if (updatedApp.spec.sourceHydrator) {
                                                                        setSavedSyncSource(updatedApp.spec.sourceHydrator.syncSource);
                                                                        updatedApp.spec.source = updatedApp.spec.sourceHydrator.drySource;
                                                                        delete updatedApp.spec.sourceHydrator;
                                                                    }
                                                                    api.setAllValues(updatedApp);
                                                                    setIsHydratorEnabled(val);
                                                                }}
                                                                checked={!!(api.getFormState().values as models.Application).spec.sourceHydrator}
                                                                id='enable-source-hydrator'
                                                            />
                                                            <label htmlFor='enable-source-hydrator'>enable source hydrator</label>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {isHydratorEnabled ? (
                                                <HydratorSourcePanel formApi={api} repos={repos} />
                                            ) : (
                                                <SourcePanel
                                                    formApi={api}
                                                    repos={repos}
                                                    repoInfo={repoInfo}
                                                    currentRepoType={currentRepoType}
                                                    lastGitOrHelmUrl={lastGitOrHelmUrl}
                                                    lastOciUrl={lastOciUrl}
                                                />
                                            )}
                                        </div>
                                    );
                                    const destinationPanel = () => (
                                        <div className='white-box'>
                                            <p>DESTINATION</p>
                                            <div className='row argo-form-row'>
                                                {(destinationComboValue.toUpperCase() === 'URL' && (
                                                    <div className='columns small-10'>
                                                        <FormField
                                                            formApi={api}
                                                            label='Cluster URL'
                                                            qeId='application-create-field-cluster-url'
                                                            field='spec.destination.server'
                                                            componentProps={{
                                                                items: clusters.map(cluster => cluster.server),
                                                                filterSuggestions: true
                                                            }}
                                                            component={AutocompleteField}
                                                        />
                                                    </div>
                                                )) || (
                                                    <div className='columns small-10'>
                                                        <FormField
                                                            formApi={api}
                                                            label='Cluster Name'
                                                            qeId='application-create-field-cluster-name'
                                                            field='spec.destination.name'
                                                            componentProps={{
                                                                items: clusters.map(cluster => cluster.name),
                                                                filterSuggestions: true
                                                            }}
                                                            component={AutocompleteField}
                                                        />
                                                    </div>
                                                )}
                                                <div className='columns small-2'>
                                                    <div style={{paddingTop: '1.5em'}}>
                                                        <DropDownMenu
                                                            anchor={() => (
                                                                <p>
                                                                    {destinationComboValue} <i className='fa fa-caret-down' />
                                                                </p>
                                                            )}
                                                            qeId='application-create-dropdown-destination'
                                                            items={['URL', 'NAME'].map((type: 'URL' | 'NAME') => ({
                                                                title: type,
                                                                action: () => {
                                                                    if (destinationComboValue !== type) {
                                                                        destinationComboValue = type;
                                                                        comboSwitchedFromPanel.current = true;
                                                                        setDestinationFieldChanges({destFormat: type, destFormatChanged: 'changed'});
                                                                    }
                                                                }
                                                            }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='argo-form-row'>
                                                <FormField
                                                    qeId='application-create-field-namespace'
                                                    formApi={api}
                                                    label='Namespace'
                                                    field='spec.destination.namespace'
                                                    component={Text}
                                                />
                                            </div>
                                        </div>
                                    );

                                    const typePanel = () => (
                                        <DataLoader
                                            input={{
                                                repoURL: app.spec.source.repoURL,
                                                path: app.spec.source.path,
                                                chart: app.spec.source.chart,
                                                targetRevision: app.spec.source.targetRevision,
                                                appName: app.metadata.name
                                            }}
                                            load={async src => {
                                                if (src.repoURL && src.targetRevision && (src.path || src.chart)) {
                                                    return services.repos.appDetails(src, src.appName, app.spec.project, 0, 0).catch(() => ({
                                                        type: 'Directory',
                                                        details: {}
                                                    }));
                                                } else {
                                                    return {
                                                        type: 'Directory',
                                                        details: {}
                                                    };
                                                }
                                            }}>
                                            {(details: models.RepoAppDetails) => {
                                                const type = (explicitPathType && explicitPathType.path === app.spec.source.path && explicitPathType.type) || details.type;
                                                if (details.type !== type) {
                                                    switch (type) {
                                                        case 'Helm':
                                                            details = {
                                                                type,
                                                                path: details.path,
                                                                helm: {name: '', valueFiles: [], path: '', parameters: [], fileParameters: []}
                                                            };
                                                            break;
                                                        case 'Kustomize':
                                                            details = {type, path: details.path, kustomize: {path: ''}};
                                                            break;
                                                        case 'Plugin':
                                                            details = {type, path: details.path, plugin: {name: '', env: []}};
                                                            break;
                                                        // Directory
                                                        default:
                                                            details = {type, path: details.path, directory: {}};
                                                            break;
                                                    }
                                                }
                                                return (
                                                    <React.Fragment>
                                                        <DropDownMenu
                                                            anchor={() => (
                                                                <p>
                                                                    {type} <i className='fa fa-caret-down' />
                                                                </p>
                                                            )}
                                                            qeId='application-create-dropdown-source'
                                                            items={appTypes.map(item => ({
                                                                title: item.type,
                                                                action: () => {
                                                                    setExplicitPathType({type: item.type, path: app.spec.source.path});
                                                                    normalizeTypeFields(api, item.type);
                                                                }
                                                            }))}
                                                        />
                                                        <ApplicationParameters
                                                            noReadonlyMode={true}
                                                            application={app}
                                                            details={details}
                                                            save={async updatedApp => {
                                                                api.setAllValues(updatedApp);
                                                            }}
                                                        />
                                                    </React.Fragment>
                                                );
                                            }}
                                        </DataLoader>
                                    );

                                    const modelPanel = () => {
                                        const ann = (api.getFormState().values as any)?.metadata?.annotations || {};
                                        const selectedModel = ann.model_path || '';
                                        const selectedSystem = ann.system || '';
                                        const selectedBackend = ann.backend || '';
                                        const selectedBackendVersion = ann.backend_version || '';
                                        const selectedMode = ann.mode || '';
                                        const systems = getSystems(selectedModel);
                                        const backends = getBackends(selectedModel, selectedSystem);
                                        const backendVersions = getBackendVersions(selectedModel, selectedSystem, selectedBackend);
                                        const modes = getModes(selectedModel, selectedSystem, selectedBackend, selectedBackendVersion);
                                        const combinationValid = isCombinationValid(selectedModel, selectedSystem, selectedBackend, selectedBackendVersion, selectedMode);
                                        const allSelected = selectedModel && selectedSystem && selectedBackend && selectedBackendVersion && selectedMode;
                                        const setAnnotation = (key: string, value: string, clearKeys?: string[]) => {
                                            const updatedApp = deepMerge({}, api.getFormState().values as any);
                                            updatedApp.metadata = updatedApp.metadata || {};
                                            updatedApp.metadata.annotations = updatedApp.metadata.annotations || {};
                                            updatedApp.metadata.annotations[key] = value;
                                            if (clearKeys) {
                                                clearKeys.forEach(k => {
                                                    updatedApp.metadata.annotations[k] = '';
                                                });
                                            }
                                            api.setAllValues(updatedApp);
                                        };
                                        return (
                                            <div className='white-box'>
                                                <p>MODEL</p>
                                                {/* Row 1: Model | Total GPUs */}
                                                <div className='row argo-form-row'>
                                                    <div className='columns small-9'>
                                                        <FormField
                                                            formApi={api}
                                                            label='Model'
                                                            field='metadata.annotations.model_path'
                                                            component={ModelAutocompleteFormField}
                                                            componentProps={{
                                                                items: MODELS,
                                                                filterSuggestions: true,
                                                                onValueChange: (val: string, prev: string) => {
                                                                    if (val !== prev) {
                                                                        setAnnotation('model_path', val, ['system', 'backend', 'backend_version', 'mode']);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className='columns small-3'>
                                                        <FormField formApi={api} label='Total GPUs' field='metadata.annotations.total_gpus' component={Text} />
                                                    </div>
                                                </div>
                                                {/* Row 2: System | Backend | Backend Version | Mode */}
                                                <div className='row argo-form-row'>
                                                    <div className='columns small-3'>
                                                        <FormField
                                                            formApi={api}
                                                            label='System'
                                                            field='metadata.annotations.system'
                                                            component={ModelSelectFormField}
                                                            componentProps={{
                                                                options: systems.length > 0 ? systems : ['Select model first'],
                                                                onValueChange: (val: string, prev: string) => {
                                                                    if (val !== prev) {
                                                                        setAnnotation('system', val, ['backend', 'backend_version', 'mode']);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className='columns small-3'>
                                                        <FormField
                                                            formApi={api}
                                                            label='Backend'
                                                            field='metadata.annotations.backend'
                                                            component={ModelSelectFormField}
                                                            componentProps={{
                                                                options: backends.length > 0 ? backends : ['Select system first'],
                                                                onValueChange: (val: string, prev: string) => {
                                                                    if (val !== prev) {
                                                                        setAnnotation('backend', val, ['backend_version', 'mode']);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className='columns small-3'>
                                                        <FormField
                                                            formApi={api}
                                                            label='Backend Version'
                                                            field='metadata.annotations.backend_version'
                                                            component={ModelSelectFormField}
                                                            componentProps={{
                                                                options: backendVersions.length > 0 ? backendVersions : ['Select backend first'],
                                                                onValueChange: (val: string, prev: string) => {
                                                                    if (val !== prev) {
                                                                        setAnnotation('backend_version', val, ['mode']);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className='columns small-3'>
                                                        <FormField
                                                            formApi={api}
                                                            label='Mode'
                                                            field='metadata.annotations.mode'
                                                            component={ModelSelectFormField}
                                                            componentProps={{
                                                                options: modes.length > 0 ? modes : ['Select version first']
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {allSelected && !combinationValid && (
                                                    <div
                                                        className='argo-form-row'
                                                        style={{
                                                            background: '#fff3cd',
                                                            border: '1px solid #ffc107',
                                                            borderRadius: '4px',
                                                            padding: '8px 12px',
                                                            color: '#856404',
                                                            fontSize: '13px',
                                                            marginTop: '0.5em'
                                                        }}>
                                                        Combination not supported: {selectedModel} on {selectedSystem} with {selectedBackend} {selectedBackendVersion} (
                                                        {selectedMode})
                                                    </div>
                                                )}
                                                <p style={{marginTop: '1em', marginBottom: '0.5em', fontSize: '13px', color: '#6d7f8b'}}>Optional fields</p>
                                                {/* Decode System | Database Mode */}
                                                <div className='row argo-form-row'>
                                                    <div className='columns small-6'>
                                                        <FormField formApi={api} label='Decode System' field='metadata.annotations.decode_system' component={Text} />
                                                    </div>
                                                    <div className='columns small-6'>
                                                        <FormField formApi={api} label='Database Mode' field='metadata.annotations.database_mode' component={Text} />
                                                    </div>
                                                </div>
                                                {/* ISL | OSL | TTFT | TPOT | Top N */}
                                                <div className='row argo-form-row'>
                                                    <div className='columns small-2'>
                                                        <FormField formApi={api} label='ISL' field='metadata.annotations.isl' component={Text} />
                                                    </div>
                                                    <div className='columns small-2'>
                                                        <FormField formApi={api} label='OSL' field='metadata.annotations.osl' component={Text} />
                                                    </div>
                                                    <div className='columns small-3'>
                                                        <FormField formApi={api} label='TTFT' field='metadata.annotations.ttft' component={Text} />
                                                    </div>
                                                    <div className='columns small-3'>
                                                        <FormField formApi={api} label='TPOT' field='metadata.annotations.tpot' component={Text} />
                                                    </div>
                                                    <div className='columns small-2'>
                                                        <FormField formApi={api} label='Top N' field='metadata.annotations.top_n' component={Text} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <form onSubmit={api.submitForm} role='form' className='width-control'>
                                            {modelPanel()}

                                            {generalPanel()}

                                            {sourcePanel()}

                                            {destinationPanel()}

                                            {typePanel()}
                                        </form>
                                    );
                                }}
                            </Form>
                        )}
                    </div>
                );
            }}
        </DataLoader>
    );
};
