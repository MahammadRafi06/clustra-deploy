import {getAIConfigProxyHeaders, getAIConfigProxyURL} from './aiconf-service';
import requests from './requests';

test('builds same-origin proxy URL for AI config requests', () => {
    requests.setBaseHRef('/');

    expect(getAIConfigProxyURL()).toBe('/extensions/aiconf/api/v1/default');
});

test('builds required Argo CD proxy headers from the created application', () => {
    expect(
        getAIConfigProxyHeaders({
            metadata: {
                name: 'demo-app',
                namespace: 'clustra'
            },
            spec: {
                project: 'default'
            }
        } as any)
    ).toEqual({
        'Argocd-Application-Name': 'clustra:demo-app',
        'Argocd-Project-Name': 'default'
    });
});

test('falls back to clustra application namespace when one is not provided', () => {
    expect(
        getAIConfigProxyHeaders({
            metadata: {
                name: 'demo-app'
            },
            spec: {
                project: 'default'
            }
        } as any)
    ).toEqual({
        'Argocd-Application-Name': 'clustra:demo-app',
        'Argocd-Project-Name': 'default'
    });
});
