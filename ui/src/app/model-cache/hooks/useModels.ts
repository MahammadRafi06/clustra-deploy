import {useState, useEffect, useCallback} from 'react';
import * as api from '../api/client';
import type {ModelListParams} from '../api/client';
import type {ModelSummary, ModelDetail, PaginatedResponse, DownloadRequest, BulkActionRequest} from '../api/types';
import {POLL_INTERVAL_MODELS} from '../utils/constants';

export function useModels(params: ModelListParams = {}) {
    const [data, setData] = useState<PaginatedResponse<ModelSummary> | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetch = useCallback(async () => {
        try {
            const result = await api.listModels(params);
            setData(result);
        } catch (e) {
            setError(e as Error);
        } finally {
            setIsLoading(false);
        }
    }, [JSON.stringify(params)]);

    useEffect(() => {
        setIsLoading(true);
        fetch();
        const id = setInterval(fetch, POLL_INTERVAL_MODELS);
        return () => clearInterval(id);
    }, [fetch]);

    return {data, isLoading, error, refetch: fetch};
}

export function useModelDetail(id: string | null) {
    const [data, setData] = useState<ModelDetail | undefined>();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!id) {
            setData(undefined);
            return;
        }
        setIsLoading(true);
        api.getModel(id)
            .then(setData)
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, [id]);

    return {data, isLoading};
}

export function useDownloadModel() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutate = useCallback(
        (req: DownloadRequest, opts?: {onSuccess?: () => void}) => {
            if (isPending) return; // prevent duplicate submissions
            setIsPending(true);
            setError(null);
            api.downloadModel(req)
                .then(() => opts?.onSuccess?.())
                .catch(setError)
                .finally(() => setIsPending(false));
        },
        [isPending]
    );

    return {mutate, isPending, error};
}

export function useSoftDelete() {
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback((id: string) => {
        setIsPending(true);
        api.softDeleteModel(id)
            .catch(() => {})
            .finally(() => setIsPending(false));
    }, []);
    return {mutate, isPending};
}

export function useHardDelete() {
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback((id: string, opts?: {onSuccess?: () => void}) => {
        setIsPending(true);
        api.hardDeleteModel(id)
            .then(() => opts?.onSuccess?.())
            .catch(() => {})
            .finally(() => setIsPending(false));
    }, []);
    return {mutate, isPending};
}

export function useRestoreModel() {
    const mutate = useCallback((id: string) => {
        api.restoreModel(id).catch(() => {});
    }, []);
    return {mutate};
}

export function useUpdateModel() {
    const mutate = useCallback((data: {id: string; display_name?: string; labels?: Record<string, string>; pinned?: boolean}) => {
        const {id, ...rest} = data;
        api.updateModel(id, rest).catch(() => {});
    }, []);
    return {mutate};
}

export function useBulkAction() {
    const mutate = useCallback((req: BulkActionRequest) => {
        api.bulkAction(req).catch(() => {});
    }, []);
    return {mutate};
}
