import {
    applySglangStarterTemplate,
    buildFeaturePolicyTemplate,
    buildRequestPolicyTemplate,
    buildUsageSnippet,
    parseFeatureArgs,
    parsePolicyJson,
    serializeFeatureArgs,
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
    expect(result.errors).toContain('type must be one of: workload, infrastructure, serving, manifest.');
});

test('validatePolicyDocument rejects public extra_engine_args_config input', () => {
    const result = validatePolicyDocument(
        {
            policy_id: 'sglang-kv',
            backend: 'sglang',
            effects: {extra_engine_args_config: {'--trust-remote-code': null}}
        },
        {family: 'feature'}
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('extra_engine_args_config is not a public policy input. Use feature policy effects args instead.');
});

test('validatePolicyDocument checks feature args for flag shape and unsafe values', () => {
    const document = buildFeaturePolicyTemplate('sglang');
    (document.effects as any).agg.frontend.args = {
        flag: 'value',
        '--bad': 'line\nbreak'
    };

    const result = validatePolicyDocument(document, {family: 'feature'});

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('effects.agg.frontend.args.flag: flags must start with "-".');
    expect(result.errors).toContain('effects.agg.frontend.args.--bad: values cannot contain newlines or null bytes.');
});

test('validatePolicyDocument accepts feature args token arrays and preserves array serialization', () => {
    const document = buildFeaturePolicyTemplate('sglang');
    document.policy_id = 'sglang-routing';
    (document.effects as any).agg.frontend.args = ['--router-mode', 'kv', '--flag-only'];

    const result = validatePolicyDocument(document, {family: 'feature'});

    expect(result.valid).toBe(true);
    expect(parseFeatureArgs((document.effects as any).agg.frontend.args)).toEqual([
        {flag: '--router-mode', value: 'kv'},
        {flag: '--flag-only', value: null}
    ]);
    expect(serializeFeatureArgs([{flag: '--router-mode', value: 'round-robin'}], true)).toEqual(['--router-mode', 'round-robin']);
});

test('parseFeatureArgs treats negative numeric tokens as values', () => {
    expect(parseFeatureArgs(['--max-gpu-budget', '-1', '--temperature', '-0.5', '--flag-only'])).toEqual([
        {flag: '--max-gpu-budget', value: '-1'},
        {flag: '--temperature', value: '-0.5'},
        {flag: '--flag-only', value: null}
    ]);
});

test('validatePolicyDocument checks direct role token arrays', () => {
    const document = buildFeaturePolicyTemplate('sglang');
    document.policy_id = 'sglang-routing';
    (document.effects as any).agg.worker = ['flag', 'value'];

    const result = validatePolicyDocument(document, {family: 'feature'});

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('effects.agg.worker.args[0]: flags must start with "-".');
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

test('templates create expected feature and usage shapes', () => {
    const request = buildRequestPolicyTemplate('workload', {template: {effects: {resources: {gpu: 1}}}});
    const feature = applySglangStarterTemplate(buildFeaturePolicyTemplate('sglang'));

    expect((request.effects as any).resources.gpu).toBe(1);
    expect((feature.effects as any).disagg.prefill.args['--disaggregation-mode']).toBe('prefill');
    expect(buildUsageSnippet('feature', {policy_id: 'sglang-kv', backend: 'sglang'})).toEqual({
        backend: 'sglang',
        feature_policies: ['sglang-kv']
    });
});
