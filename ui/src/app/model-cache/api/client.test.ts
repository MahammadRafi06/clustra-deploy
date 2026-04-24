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

test('listModels serializes supported query params', async () => {
    mockFetch.mockResolvedValue(jsonResponse({items: [], total: 0, page: 2, page_size: 50, total_pages: 0}));

    await client.listModels({
        page: 2,
        page_size: 50,
        search: 'qwen',
        status: 'available',
        pinned: true
    });

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/model-cache/api/v1/models?page=2&page_size=50&search=qwen&status=available&pinned=true',
        expect.objectContaining({credentials: 'same-origin'})
    );
});

test('downloadModel posts JSON to the proxied endpoint', async () => {
    mockFetch.mockResolvedValue(jsonResponse({id: 'job-1'}));

    await client.downloadModel({repo_id: 'org/model', source: 'huggingface', revision: 'main'});

    expect(mockFetch).toHaveBeenCalledWith(
        '/api/model-cache/api/v1/models/download',
        expect.objectContaining({
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({repo_id: 'org/model', source: 'huggingface', revision: 'main'})
        })
    );
});

test('bulkAction maps non-ok API details to Error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({detail: 'nope'}, {status: 409, statusText: 'Conflict'}));

    await expect(client.bulkAction({model_ids: ['model-1'], action: 'soft_delete'})).rejects.toThrow('nope');
});

test('deletePreset accepts empty 204 responses', async () => {
    mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: {get: () => null},
        json: jest.fn()
    });

    await expect(client.deletePreset('preset-1')).resolves.toBeUndefined();
});
