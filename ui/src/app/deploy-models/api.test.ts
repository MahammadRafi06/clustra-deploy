import {deleteDeployment, listDeployments, setArgoProxyContext, submitDefault} from './api';

const mockFetch = jest.fn();

beforeEach(() => {
    mockFetch.mockReset();
    (global as any).fetch = mockFetch;
    setArgoProxyContext({
        applicationName: 'modeldeploy',
        applicationNamespace: 'argocd',
        projectName: 'default'
    });
});

afterEach(() => {
    setArgoProxyContext(null);
});

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
    return {
        ok: init.status ? init.status < 400 : true,
        status: init.status || 200,
        statusText: init.statusText || 'OK',
        headers: {
            get: () => null
        },
        json: jest.fn().mockResolvedValue(body)
    };
}

test('submitDefault posts policy-mode runtime config request shape', async () => {
    mockFetch.mockResolvedValue(jsonResponse({job_id: 'job-1', status: 'pending', poll_url: '/jobs/job-1'}));

    await submitDefault({
        model_path: 'Qwen/Qwen3-0.6B',
        public_model_name: 'qwen3-small',
        total_gpus: 1,
        policies: {
            workload: ['workload-default'],
            infrastructure: ['infra-default'],
            serving: ['serving-default']
        },
        runtime_config_policy_id: 'runtime-default',
        overlay_key: 'aws-vllm-disagg'
    });

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/default',
        expect.objectContaining({
            method: 'POST',
            credentials: 'same-origin',
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
                'Argocd-Application-Name': 'argocd:modeldeploy',
                'Argocd-Project-Name': 'default'
            }),
            body: JSON.stringify({
                model_path: 'Qwen/Qwen3-0.6B',
                public_model_name: 'qwen3-small',
                total_gpus: 1,
                policies: {
                    workload: ['workload-default'],
                    infrastructure: ['infra-default'],
                    serving: ['serving-default']
                },
                runtime_config_policy_id: 'runtime-default',
                overlay_key: 'aws-vllm-disagg'
            })
        })
    );
});

test('submitDefault omits blank values before posting', async () => {
    mockFetch.mockResolvedValue(jsonResponse({job_id: 'job-2', status: 'pending', poll_url: '/jobs/job-2'}));

    await submitDefault({
        model_path: 'Qwen/Qwen3-0.6B',
        public_model_name: '',
        total_gpus: 1,
        policies: {
            workload: ['workload-default'],
            infrastructure: ['infra-default'],
            serving: ['serving-default']
        },
        runtime_config_policy_id: 'runtime-default'
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
        model_path: 'Qwen/Qwen3-0.6B',
        total_gpus: 1,
        policies: {
            workload: ['workload-default'],
            infrastructure: ['infra-default'],
            serving: ['serving-default']
        },
        runtime_config_policy_id: 'runtime-default'
    });
});

test('listDeployments requests the global (owner-scoped) deployments path with no app headers', async () => {
    mockFetch.mockResolvedValue(jsonResponse({deployments: [], total: 0}));

    await listDeployments({limit: 100});

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/deployments?limit=100',
        expect.objectContaining({method: 'GET', credentials: 'same-origin'})
    );
    // The deployments path is globally scoped by the proxy, so the client must
    // NOT send an application context header.
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toBeUndefined();
});

test('listDeployments serializes optional filters into the query string', async () => {
    mockFetch.mockResolvedValue(jsonResponse({deployments: [], total: 0}));

    await listDeployments({appName: 'modeldeploy', status: 'active', includeRemoved: true, limit: 25, offset: 50});

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/ai-service/api/v1/deployments?app_name=modeldeploy&status=active&include_removed=true&limit=25&offset=50');
});

test('deleteDeployment issues a context-free DELETE to the deployment path', async () => {
    mockFetch.mockResolvedValue(
        jsonResponse({
            deployment_id: 'dep-1',
            status: 'removed',
            file_paths: ['manifests/dep-1.yaml'],
            commit_sha: null,
            removal_sha: 'abc123',
            removal_error: null,
            message: 'removed'
        })
    );

    await deleteDeployment('dep-1');

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/deployments/dep-1',
        expect.objectContaining({method: 'DELETE', credentials: 'same-origin'})
    );
});
