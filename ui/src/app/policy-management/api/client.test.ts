import * as client from './client';

const mockFetch = jest.fn();

beforeEach(() => {
    mockFetch.mockReset();
    (global as any).fetch = mockFetch;
});

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
    return {
        ok: init.status ? init.status < 400 : true,
        status: init.status || 200,
        statusText: init.statusText || 'OK',
        headers: {
            get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null)
        },
        json: jest.fn().mockResolvedValue(body)
    };
}

test('listPolicies serializes filters through the ai-service proxy', async () => {
    mockFetch.mockResolvedValue(jsonResponse({policies: [], total: 0}));

    await client.listPolicies({type: 'workload', active: true, limit: 50, offset: 25});

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/policies?type=workload&active=true&limit=50&offset=25',
        expect.objectContaining({
            method: 'GET',
            credentials: 'same-origin'
        })
    );
});

test('runtime config catalog items serialize role-aware filters through the ai-service proxy', async () => {
    mockFetch.mockResolvedValue(jsonResponse({items: [], total: 0}));

    await client.listRuntimeConfigCatalogItems({
        engine: 'sglang',
        version: '0.5.10.post1',
        dynamo_version: '1.1.1',
        kind: 'args',
        deployment_type: 'disagg',
        role: 'prefill',
        ui: 'primary',
        q: 'lora',
        active: true,
        limit: 50,
        offset: 0
    });

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/runtime-config-catalog-items?engine=sglang&version=0.5.10.post1&dynamo_version=1.1.1&kind=args&deployment_type=disagg&role=prefill&ui=primary&q=lora&active=true&limit=50&offset=0',
        expect.objectContaining({
            method: 'GET',
            credentials: 'same-origin'
        })
    );
});

test('runtime config policy create and resolve use the runtime-config API', async () => {
    mockFetch.mockResolvedValue(jsonResponse({policy_id: 'runtime-smoke'}));

    await client.createRuntimeConfigPolicy({policy_id: 'runtime-smoke', engine: 'sglang'});
    await client.resolveRuntimeConfigPolicy('runtime-smoke');

    expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/ai-service/api/v1/runtime-config-policies',
        expect.objectContaining({
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({policy_id: 'runtime-smoke', engine: 'sglang'})
        })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/ai-service/api/v1/runtime-config-policies/runtime-smoke/resolve',
        expect.objectContaining({
            method: 'GET',
            credentials: 'same-origin'
        })
    );
});

test('runtime config role schema updates use deployment type path', async () => {
    mockFetch.mockResolvedValue(jsonResponse({deployment_type: 'disagg'}));

    await client.updateRuntimeConfigRoleSchema('disagg', {deployment_type: 'disagg', roles: []});

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/runtime-config-role-schemas/disagg',
        expect.objectContaining({
            method: 'PUT',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({deployment_type: 'disagg', roles: []})
        })
    );
});

test('validation errors preserve server detail message', async () => {
    mockFetch.mockResolvedValue(jsonResponse({detail: 'policy_id already exists'}, {status: 409, statusText: 'Conflict'}));

    await expect(client.createPolicy({policy_id: 'existing', type: 'workload'})).rejects.toThrow('policy_id already exists');
});

test('deletePolicy accepts empty 204 responses', async () => {
    mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: {get: () => null},
        json: jest.fn()
    });

    await expect(client.deletePolicy('custom-policy')).resolves.toBeUndefined();
});
