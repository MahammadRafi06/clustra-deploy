import * as React from 'react';
import * as renderer from 'react-test-renderer';
import {act, ReactTestInstance} from 'react-test-renderer';

import type {FeaturePolicyRecord, PolicyApiClient, PolicyRecord, PolicyRow} from './api/types';
import {ArgsBuilder} from './components/ArgsBuilder';
import {PolicyDetailsDrawer} from './components/PolicyDetailsDrawer';
import {POLICY_PAGE_CONFIGS, PolicyManagementWorkspace, resolvePolicyPagePath} from './pages';

jest.mock('argo-ui', () => {
    const React = require('react');
    return {
        SlidingPanel: ({children, isShown}: {children: React.ReactNode; isShown: boolean}) => (isShown ? <div>{children}</div> : null),
        ErrorNotification: ({e}: {e: {message: string}}) => <div>{e.message}</div>,
        DataLoader: ({children}: {children: (value: unknown) => React.ReactNode}) => <>{children({})}</>
    };
});

const workloadPage = POLICY_PAGE_CONFIGS.find(page => page.key === 'workload');
const infrastructurePage = POLICY_PAGE_CONFIGS.find(page => page.key === 'infrastructure');
const featurePage = POLICY_PAGE_CONFIGS.find(page => page.key === 'features');

const requestPolicy: PolicyRecord = {
    policy_id: 'custom-workload',
    type: 'workload',
    active: true,
    managed_by: 'custom',
    document: {
        schema_version: 1,
        policy_id: 'custom-workload',
        type: 'workload',
        display_name: 'Custom workload',
        description: '',
        active: true,
        metadata: {ui: {sort_order: 100}, tags: ['team-a']},
        effects: {resources: {gpu: 1}}
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z'
};

const systemFeaturePolicy: FeaturePolicyRecord = {
    policy_id: 'sglang-system',
    backend: 'sglang',
    active: true,
    managed_by: 'system',
    document: {
        schema_version: 1,
        policy_id: 'sglang-system',
        backend: 'sglang',
        feature: 'routing',
        display_name: 'System routing',
        active: true,
        metadata: {ui: {sort_order: 10}, tags: ['sglang']},
        effects: {agg: {frontend: {args: ['--router-mode', 'kv', '--flag-only']}, worker: ['--max-gpu-budget', '-1']}, disagg: {frontend: {args: {}}, prefill: ['--trust-remote-code'], decode: {args: {}}}}
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z'
};

function makeClient(overrides: Partial<PolicyApiClient> = {}): PolicyApiClient {
    return {
        listPolicyTypes: jest.fn().mockResolvedValue({policy_types: [], total: 0}),
        getPolicyType: jest.fn(),
        listPolicies: jest.fn().mockImplementation(params =>
            Promise.resolve({
                policies: params?.type === 'workload' ? [requestPolicy] : [],
                total: params?.type === 'workload' ? 1 : 0
            })
        ),
        getPolicy: jest.fn().mockResolvedValue(requestPolicy),
        createPolicy: jest.fn().mockResolvedValue(requestPolicy),
        updatePolicy: jest.fn().mockResolvedValue(requestPolicy),
        deletePolicy: jest.fn().mockResolvedValue(undefined),
        listFeaturePolicies: jest.fn().mockImplementation(params =>
            Promise.resolve({
                feature_policies: params?.backend === 'sglang' ? [systemFeaturePolicy] : [],
                total: params?.backend === 'sglang' ? 1 : 0
            })
        ),
        getFeaturePolicy: jest.fn().mockResolvedValue(systemFeaturePolicy),
        createFeaturePolicy: jest.fn().mockResolvedValue(systemFeaturePolicy),
        updateFeaturePolicy: jest.fn().mockResolvedValue(systemFeaturePolicy),
        deleteFeaturePolicy: jest.fn().mockResolvedValue(undefined),
        ...overrides
    };
}

async function flush(times = 1) {
    for (let index = 0; index < times; index += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 0));
        act(() => undefined);
    }
}

async function renderWorkspace(client: PolicyApiClient, page = workloadPage) {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(<PolicyManagementWorkspace client={client} page={page} />);
    });
    await flush(2);
    return tree;
}

function textContent(node: ReactTestInstance): string {
    const collect = (value: ReactTestInstance | string): string => {
        if (typeof value === 'string') {
            return value;
        }
        return value.children.map(child => (typeof child === 'string' ? child : collect(child as ReactTestInstance))).join(' ');
    };
    return collect(node);
}

function findButton(root: ReactTestInstance, label: string) {
    return root.findAllByType('button').find(button => textContent(button).includes(label) || button.props['aria-label'] === label);
}

function findLastButton(root: ReactTestInstance, label: string) {
    const button = root
        .findAllByType('button')
        .filter(item => textContent(item).includes(label) || item.props['aria-label'] === label)
        .pop();
    if (!button) {
        throw new Error(`Button not found: ${label}`);
    }
    return button;
}

function findInput(root: ReactTestInstance, label: string) {
    return root.findAll(node => (node.type === 'input' || node.type === 'textarea' || node.type === 'select') && node.props['aria-label'] === label)[0];
}

test('routes resolve one page per policy type', () => {
    expect(resolvePolicyPagePath('/policy-management/workload').key).toBe('workload');
    expect(resolvePolicyPagePath('/policy-management/infrastructure').key).toBe('infrastructure');
    expect(resolvePolicyPagePath('/policy-management/serving').key).toBe('serving');
    expect(resolvePolicyPagePath('/policy-management/manifest').key).toBe('manifest');
    expect(resolvePolicyPagePath('/policy-management/features').key).toBe('features');
});

test('request pages list only their policy type', async () => {
    const client = makeClient();

    await renderWorkspace(client, infrastructurePage);

    expect(client.listPolicies).toHaveBeenCalledWith(expect.objectContaining({type: 'infrastructure', active: true, limit: 25, offset: 0}));
    expect(client.listFeaturePolicies).not.toHaveBeenCalled();
});

test('policy name opens details without adding an extra table row or AWS-style icons', async () => {
    const client = makeClient();
    const tree = await renderWorkspace(client, workloadPage);

    expect(tree.root.findAll(node => typeof node.props?.className === 'string' && node.props.className.includes('fa-cube'))).toHaveLength(0);
    expect(tree.root.findAll(node => typeof node.props?.className === 'string' && node.props.className.includes('fa-eye'))).toHaveLength(0);
    expect(tree.root.findAll(node => typeof node.props?.['aria-label'] === 'string' && node.props['aria-label'].includes('Expand details'))).toHaveLength(0);
    expect(tree.root.findAll(node => node.children?.[0] === 'TYPE/BACKEND')).toHaveLength(0);
    expect(tree.root.findAll(node => typeof node.props?.className === 'string' && node.props.className.includes('policy-management__table-expansion'))).toHaveLength(0);

    act(() => {
        findButton(tree.root, 'custom-workload').props.onClick();
    });

    expect(textContent(tree.root)).toContain('Policy details');
    expect(textContent(tree.root)).toContain('custom-workload');
    expect(tree.root.findAll(node => typeof node.props?.className === 'string' && node.props.className.includes('policy-management__table-expansion'))).toHaveLength(0);
});

test('policy details render highlighted JSON without a usage snippet tab', () => {
    const row: PolicyRow = {
        id: 'custom-workload',
        family: 'request',
        kindLabel: 'Request policy',
        typeOrBackend: 'workload',
        record: requestPolicy
    };
    const details = renderer.create(<PolicyDetailsDrawer row={row} onClose={jest.fn()} />);

    expect(textContent(details.root)).not.toContain('Usage snippet');
    expect(details.root.findAllByProps({className: 'policy-management__json-key'}).length).toBeGreaterThan(0);
    expect(details.root.findAllByProps({className: 'policy-management__json-value'}).length).toBeGreaterThan(0);
});

test('create request flow defaults to the page type and uses policy-type effects defaults', async () => {
    const client = makeClient({
        listPolicyTypes: jest.fn().mockResolvedValue({
            policy_types: [{policy_type: 'workload', template: {effects: {resources: {gpu: 1}, placement: {zone: 'default'}}}}],
            total: 1
        }),
        listPolicies: jest.fn().mockResolvedValue({policies: [], total: 0})
    });
    const tree = await renderWorkspace(client, workloadPage);

    act(() => {
        findButton(tree.root, 'Create').props.onClick();
    });
    await flush(3);
    act(() => {
        findInput(tree.root, 'policy_id').props.onChange({target: {value: 'custom-from-template'}});
    });
    act(() => {
        tree.root.findByType('form').props.onSubmit({preventDefault: jest.fn()});
    });
    await flush(2);

    expect(client.listPolicyTypes).toHaveBeenCalledWith({active: true, limit: 50, offset: 0});
    expect(client.createPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
            policy_id: 'custom-from-template',
            type: 'workload',
            effects: {resources: {gpu: 1}, placement: {zone: 'default'}}
        })
    );
});

test('create flow posts a custom feature policy after backend selection', async () => {
    const client = makeClient({
        listPolicies: jest.fn().mockResolvedValue({policies: [], total: 0}),
        listFeaturePolicies: jest.fn().mockResolvedValue({feature_policies: [], total: 0})
    });
    const tree = await renderWorkspace(client, featurePage);

    act(() => {
        findButton(tree.root, 'Create').props.onClick();
    });
    act(() => {
        findLastButton(tree.root, 'sglang').props.onClick();
    });
    act(() => {
        findInput(tree.root, 'policy_id').props.onChange({target: {value: 'sglang-kv'}});
    });
    act(() => {
        findInput(tree.root, 'feature').props.onChange({target: {value: 'kv-routing'}});
    });
    act(() => {
        findInput(tree.root, 'display_name').props.onChange({target: {value: 'SGLang KV routing'}});
    });
    act(() => {
        tree.root.findByType('form').props.onSubmit({preventDefault: jest.fn()});
    });
    await flush();

    expect(client.createFeaturePolicy).toHaveBeenCalledWith(
        expect.objectContaining({
            policy_id: 'sglang-kv',
            backend: 'sglang',
            feature: 'kv-routing',
            display_name: 'SGLang KV routing'
        })
    );
});

test('edit flow fetches latest custom policy before update', async () => {
    const client = makeClient();
    const tree = await renderWorkspace(client, workloadPage);

    act(() => {
        findInput(tree.root, 'Select custom-workload').props.onChange();
    });
    act(() => {
        findButton(tree.root, 'Actions').props.onClick();
    });
    act(() => {
        findButton(tree.root, 'Edit').props.onClick();
    });
    await flush();
    act(() => {
        findInput(tree.root, 'display_name').props.onChange({target: {value: 'Updated workload'}});
    });
    act(() => {
        tree.root.findByType('form').props.onSubmit({preventDefault: jest.fn()});
    });
    await flush();

    expect(client.getPolicy).toHaveBeenCalledWith('custom-workload');
    expect(client.updatePolicy).toHaveBeenCalledWith('custom-workload', expect.objectContaining({display_name: 'Updated workload'}));
});

test('delete flow soft-disables custom request policies', async () => {
    const client = makeClient();
    const tree = await renderWorkspace(client, workloadPage);

    act(() => {
        findInput(tree.root, 'Select custom-workload').props.onChange();
    });
    act(() => {
        findButton(tree.root, 'Delete').props.onClick();
    });
    act(() => {
        findButton(tree.root, 'Disable').props.onClick();
    });
    await flush();

    expect(client.deletePolicy).toHaveBeenCalledWith('custom-workload');
});

test('system-managed feature policies stay read-only', async () => {
    const client = makeClient();
    const tree = await renderWorkspace(client, featurePage);

    act(() => {
        findInput(tree.root, 'Select sglang-system').props.onChange();
    });

    expect(findButton(tree.root, 'Delete').props.disabled).toBe(true);
    act(() => {
        findButton(tree.root, 'Actions').props.onClick();
    });
    expect(findButton(tree.root, 'Edit').props.disabled).toBe(true);
});

test('request page pagination uses server offset for the selected type', async () => {
    const client = makeClient({
        listPolicies: jest.fn().mockResolvedValue({policies: [requestPolicy], total: 50})
    });
    const tree = await renderWorkspace(client, workloadPage);

    act(() => {
        findButton(tree.root, 'Next').props.onClick();
    });
    await flush(2);

    expect(client.listPolicies).toHaveBeenCalledWith(expect.objectContaining({type: 'workload', active: true, limit: 25, offset: 0}));
    expect(client.listPolicies).toHaveBeenCalledWith(expect.objectContaining({type: 'workload', active: true, limit: 25, offset: 25}));
});

test('request search fetches all records before local filtering', async () => {
    const laterPolicy: PolicyRecord = {
        ...requestPolicy,
        policy_id: 'custom-later',
        document: {...requestPolicy.document, policy_id: 'custom-later', display_name: 'Later match'}
    };
    const listPolicies = jest.fn().mockImplementation(params =>
        Promise.resolve({
            policies: params?.limit === 200 ? [laterPolicy] : [],
            total: 26
        })
    );
    const client = makeClient({listPolicies});
    const tree = await renderWorkspace(client, workloadPage);

    act(() => {
        findInput(tree.root, 'Search policies').props.onChange({target: {value: 'later'}});
    });
    await flush(2);

    expect(listPolicies).toHaveBeenCalledWith(expect.objectContaining({type: 'workload', active: true, limit: 200, offset: 0}));
    expect(textContent(tree.root)).toContain('custom-later');
});

test('feature policies page filters by backend tab', async () => {
    const client = makeClient();
    const tree = await renderWorkspace(client, featurePage);

    act(() => {
        findButton(tree.root, 'sglang').props.onClick();
    });
    await flush(2);

    expect(client.listFeaturePolicies).toHaveBeenCalledWith(expect.objectContaining({backend: 'sglang', active: true, limit: 25, offset: 0}));
});

test('backend-specific feature managed_by filter fetches all records before local filtering', async () => {
    const customFeaturePolicy: FeaturePolicyRecord = {
        ...systemFeaturePolicy,
        policy_id: 'sglang-custom',
        managed_by: 'custom',
        document: {...systemFeaturePolicy.document, policy_id: 'sglang-custom', display_name: 'Custom feature'}
    };
    const listFeaturePolicies = jest.fn().mockImplementation(params =>
        Promise.resolve({
            feature_policies: params?.backend === 'sglang' && params?.limit === 200 ? [customFeaturePolicy] : [],
            total: params?.backend === 'sglang' ? 26 : 0
        })
    );
    const client = makeClient({listFeaturePolicies});
    const tree = await renderWorkspace(client, featurePage);

    listFeaturePolicies.mockClear();
    act(() => {
        findButton(tree.root, 'sglang').props.onClick();
    });
    await flush(2);
    expect(listFeaturePolicies).toHaveBeenCalledWith(expect.objectContaining({backend: 'sglang', active: true, limit: 25, offset: 0}));

    listFeaturePolicies.mockClear();
    act(() => {
        findInput(tree.root, 'Managed by filter').props.onChange({target: {value: 'custom'}});
    });
    await flush(2);

    expect(listFeaturePolicies).toHaveBeenCalledWith(expect.objectContaining({backend: 'sglang', active: true, limit: 200, offset: 0}));
    expect(textContent(tree.root)).toContain('sglang-custom');
});

test('array-form feature args display in details and edit as token arrays', () => {
    const row: PolicyRow = {
        id: 'sglang-system',
        family: 'feature',
        kindLabel: 'Feature policy',
        typeOrBackend: 'sglang',
        record: systemFeaturePolicy
    };
    const details = renderer.create(<PolicyDetailsDrawer row={row} onClose={jest.fn()} />);

    expect(textContent(details.root)).toContain('--router-mode');
    expect(textContent(details.root)).toContain('kv');
    expect(textContent(details.root)).toContain('--flag-only');
    expect(textContent(details.root)).toContain('--trust-remote-code');
    expect(textContent(details.root)).toContain('--max-gpu-budget');
    expect(textContent(details.root)).toContain('-1');

    const onChange = jest.fn();
    const builder = renderer.create(<ArgsBuilder document={systemFeaturePolicy.document} onChange={onChange} />);
    const valueInputs = builder.root.findAll(node => node.type === 'input' && node.props['aria-label'] === 'agg frontend value');
    act(() => {
        valueInputs[0].props.onChange({target: {value: 'round-robin'}});
    });

    expect(onChange.mock.calls[0][0].effects.agg.frontend.args).toEqual(['--router-mode', 'round-robin', '--flag-only']);

    const workerValueInputs = builder.root.findAll(node => node.type === 'input' && node.props['aria-label'] === 'agg worker value');
    act(() => {
        workerValueInputs[0].props.onChange({target: {value: '-2'}});
    });
    expect(onChange.mock.calls[1][0].effects.agg.worker).toEqual(['--max-gpu-budget', '-2']);
});
