import {Application} from '../models';
import requests from './requests';

export interface AIConfigPayload {
    application_name: string;
    model_path: string;
    system: string;
    backend: string;
    backend_version: string;
    mode: string;
    total_gpus: number;
    decode_system?: string;
    database_mode?: string;
    isl?: number;
    osl?: number;
    ttft?: number;
    tpot?: number;
    top_n?: number;
    [key: string]: string | number | undefined;
}

const AICONF_EXTENSION_NAME = 'aiconf';
const AICONF_EXTENSION_PATH = `/extensions/${AICONF_EXTENSION_NAME}/api/v1/default`;
const DEFAULT_APPLICATION_NAMESPACE = 'clustra';

export function getAIConfigProxyURL(): string {
    return requests.toAbsURL(AICONF_EXTENSION_PATH);
}

export function getAIConfigProxyHeaders(app: Application): Record<string, string> {
    return {
        'Argocd-Application-Name': `${app.metadata.namespace || DEFAULT_APPLICATION_NAMESPACE}:${app.metadata.name}`,
        'Argocd-Project-Name': app.spec.project
    };
}

export class AIConfigService {
    constructor() {}

    public sendConfig(app: Application, payload: AIConfigPayload): Promise<any> {
        const headers = getAIConfigProxyHeaders(app);
        return requests.agent
            .post(getAIConfigProxyURL())
            .set('Content-Type', 'application/json')
            .set(headers)
            .send(payload)
            .then(res => res.body);
    }
}
