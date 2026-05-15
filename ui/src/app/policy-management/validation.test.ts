import {
    buildRequestPolicyTemplate,
    buildUsageSnippet,
    parsePolicyJson,
    validatePolicyDocument
} from './validation';

test('parsePolicyJson reports invalid JSON', () => {
    const result = parsePolicyJson('{bad');

    expect(result.document).toBeNull();
    expect(result.errors[0]).toContain('Invalid JSON');
});

test('validatePolicyDocument rejects invalid slugs and unsupported request types', () => {
    const result = validatePolicyDocument({policy_id: 'Bad ID', type: 'other'}, {family: 'request'});

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('policy_id must be a lowercase slug using letters, numbers, dots, underscores, or hyphens.');
    expect(result.errors).toContain('type must be one of: workload, infrastructure, serving.');
});

test('validatePolicyDocument rejects public extra_engine_args_config input', () => {
    const result = validatePolicyDocument(
        {
            policy_id: 'custom-workload',
            type: 'workload',
            effects: {extra_engine_args_config: {'--trust-remote-code': null}}
        },
        {family: 'request'}
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('extra_engine_args_config is not a public policy input.');
});

test('validatePolicyDocument rejects slugs that do not start with a lowercase letter or number', () => {
    const result = validatePolicyDocument({policy_id: '.bad', type: 'workload', effects: {enabled: true}}, {family: 'request'});

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('policy_id must be a lowercase slug using letters, numbers, dots, underscores, or hyphens.');
});

test('edit validation forbids changing request policy_id and type', () => {
    const result = validatePolicyDocument({policy_id: 'next', type: 'serving'}, {family: 'request', mode: 'edit', originalPolicyId: 'original', originalType: 'workload'});

    expect(result.errors).toContain('policy_id cannot be changed while editing.');
    expect(result.errors).toContain('type cannot be changed while editing a request policy.');
});

test('templates create expected request and usage shapes', () => {
    const request = buildRequestPolicyTemplate('workload', {template: {effects: {resources: {gpu: 1}}}});

    expect((request.effects as any).resources.gpu).toBe(1);
    expect(buildUsageSnippet('request', {policy_id: 'custom-workload', type: 'workload'})).toEqual({
        policies: {
            workload: ['custom-workload']
        }
    });
});
