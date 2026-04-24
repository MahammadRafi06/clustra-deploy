import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import * as api from '../api/client';
import type {ModelListParams} from '../api/client';
import type {ModelSummary, ModelDetail, PaginatedResponse, DownloadRequest, BulkActionRequest} from '../api/types';
import {POLL_INTERVAL_MODELS} from '../utils/constants';

const MAX_POLL_FAILURES = 3;

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function useModels(params: ModelListParams = {}) {
    const stableParams = useMemo(
        () => ({
            page: params.page,
            page_size: params.page_size,
            search: params.search,
            status: params.status,
            source: params.source,
            sort_by: params.sort_by,
            sort_order: params.sort_order,
            pinned: params.pinned,
            stale_days: params.stale_days
        }),
        [params.page, params.page_size, params.search, params.status, params.source, params.sort_by, params.sort_order, params.pinned, params.stale_days]
    );
    const [data, setData] = useState<PaginatedResponse<ModelSummary> | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [isPollingPaused, setIsPollingPaused] = useState(false);
    const failureCountRef = useRef(0);
    const pollingPausedRef = useRef(false);

    const resetPolling = useCallback(() => {
        failureCountRef.current = 0;
        pollingPausedRef.current = false;
        setIsPollingPaused(false);
    }, []);

    const fetch = useCallback(
        async (manual = false) => {
            if (manual) {
                resetPolling();
            }
            try {
                const result = await api.listModels(stableParams);
                setData(result);
                setError(null);
                resetPolling();
            } catch (e) {
                setError(toError(e));
                failureCountRef.current += 1;
                if (failureCountRef.current >= MAX_POLL_FAILURES && !manual) {
                    pollingPausedRef.current = true;
                    setIsPollingPaused(true);
                }
                if (manual) {
                    throw e;
                }
            } finally {
                setIsLoading(false);
            }
        },
        [stableParams, resetPolling]
    );

    useEffect(() => {
        setIsLoading(true);
        resetPolling();
        fetch();
        const id = setInterval(() => {
            if (!pollingPausedRef.current && isDocumentVisible()) {
                fetch();
            }
        }, POLL_INTERVAL_MODELS);
        return () => clearInterval(id);
    }, [fetch, resetPolling]);

    return {data, isLoading, error, isPollingPaused, refetch: () => fetch(true)};
}

export function useModelDetail(id: string | null) {
    const [data, setData] = useState<ModelDetail | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!id) {
            setData(undefined);
            setError(null);
            return;
        }
        setIsLoading(true);
        api.getModel(id)
            .then(result => {
                setData(result);
                setError(null);
            })
            .catch(error => setError(toError(error)))
            .finally(() => setIsLoading(false));
    }, [id]);

    return {data, isLoading, error};
}

export function useDownloadModel() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutate = useCallback(
        async (req: DownloadRequest, opts?: {onSuccess?: () => void}) => {
            if (isPending) return; // prevent duplicate submissions
            setIsPending(true);
            setError(null);
            try {
                const result = await api.downloadModel(req);
                opts?.onSuccess?.();
                return result;
            } catch (error) {
                setError(toError(error));
                throw error;
            } finally {
                setIsPending(false);
            }
        },
        [isPending]
    );

    return {mutate, isPending, error};
}

export function useSoftDelete() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (id: string) => {
        setIsPending(true);
        setError(null);
        try {
            return await api.softDeleteModel(id);
        } catch (error) {
            setError(toError(error));
            throw error;
        } finally {
            setIsPending(false);
        }
    }, []);
    return {mutate, isPending, error};
}

export function useHardDelete() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (id: string, opts?: {onSuccess?: () => void}) => {
        setIsPending(true);
        setError(null);
        try {
            const result = await api.hardDeleteModel(id);
            opts?.onSuccess?.();
            return result;
        } catch (error) {
            setError(toError(error));
            throw error;
        } finally {
            setIsPending(false);
        }
    }, []);
    return {mutate, isPending, error};
}

export function useRestoreModel() {
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (id: string) => {
        setError(null);
        try {
            return await api.restoreModel(id);
        } catch (error) {
            setError(toError(error));
            throw error;
        }
    }, []);
    return {mutate, error};
}

export function useUpdateModel() {
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (data: {id: string; display_name?: string; labels?: Record<string, string>; pinned?: boolean}) => {
        const {id, ...rest} = data;
        setError(null);
        try {
            return await api.updateModel(id, rest);
        } catch (error) {
            setError(toError(error));
            throw error;
        }
    }, []);
    return {mutate, error};
}

export function useBulkAction() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (req: BulkActionRequest) => {
        setIsPending(true);
        setError(null);
        try {
            return await api.bulkAction(req);
        } catch (error) {
            setError(toError(error));
            throw error;
        } finally {
            setIsPending(false);
        }
    }, []);
    return {mutate, isPending, error};
}
