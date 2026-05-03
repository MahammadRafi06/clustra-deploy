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

test('listFeaturePolicies requires explicit backend filter', async () => {
    mockFetch.mockResolvedValue(jsonResponse({feature_policies: [], total: 0}));

    await client.listFeaturePolicies({backend: 'sglang', active: false, limit: 25, offset: 0});

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/feature-policies?backend=sglang&active=false&limit=25&offset=0',
        expect.objectContaining({
            method: 'GET',
            credentials: 'same-origin'
        })
    );
});

test('createFeaturePolicy posts raw policy document JSON', async () => {
    mockFetch.mockResolvedValue(jsonResponse({policy_id: 'sglang-kv'}));

    await client.createFeaturePolicy({policy_id: 'sglang-kv', backend: 'sglang'});

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai-service/api/v1/feature-policies',
        expect.objectContaining({
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({policy_id: 'sglang-kv', backend: 'sglang'})
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
