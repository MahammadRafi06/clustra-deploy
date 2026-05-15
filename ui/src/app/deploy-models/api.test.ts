import {setArgoProxyContext, submitDefault} from './api';

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

test('submitDefault includes explicit public model name', async () => {
    mockFetch.mockResolvedValue(jsonResponse({job_id: 'job-1', status: 'pending', poll_url: '/jobs/job-1'}));

    await submitDefault({
        model_path: 'Qwen/Qwen3-0.6B',
        public_model_name: 'qwen3-small',
        total_gpus: 1,
        workload_policy: 'workload-default',
        infrastructure_policy: 'infra-default',
        serving_policy: 'serving-default',
        runtime_policy: 'runtime-default'
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
                workload_policy: 'workload-default',
                infrastructure_policy: 'infra-default',
                serving_policy: 'serving-default',
                runtime_policy: 'runtime-default'
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
        workload_policy: 'workload-default',
        infrastructure_policy: 'infra-default',
        serving_policy: 'serving-default',
        runtime_policy: 'runtime-default'
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
        model_path: 'Qwen/Qwen3-0.6B',
        total_gpus: 1,
        workload_policy: 'workload-default',
        infrastructure_policy: 'infra-default',
        serving_policy: 'serving-default',
        runtime_policy: 'runtime-default'
    });
});
