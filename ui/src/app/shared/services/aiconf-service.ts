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

const AICONF_SERVICE_URL = 'http://127.0.0.1:8081/api/v1/default';

export class AIConfigService {
    constructor() {}

    public sendConfig(payload: AIConfigPayload): Promise<any> {
        return requests.agent
            .post(AICONF_SERVICE_URL)
            .set('Content-Type', 'application/json')
            .send(payload)
            .then(res => res.body);
    }
}
