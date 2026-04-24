import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import * as api from '../api/client';
import type {JobSummary, PaginatedResponse} from '../api/types';
import {POLL_INTERVAL_JOBS} from '../utils/constants';

const MAX_POLL_FAILURES = 3;

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function useJobs(params: {page?: number; kind?: string; status?: string; model_id?: string} = {}) {
    const stableParams = useMemo(
        () => ({
            page: params.page,
            kind: params.kind,
            status: params.status,
            model_id: params.model_id
        }),
        [params.page, params.kind, params.status, params.model_id]
    );
    const [data, setData] = useState<PaginatedResponse<JobSummary> | undefined>();
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
                const result = await api.listJobs(stableParams);
                setData(result);
                setError(null);
                resetPolling();
            } catch (error) {
                setError(toError(error));
                failureCountRef.current += 1;
                if (failureCountRef.current >= MAX_POLL_FAILURES && !manual) {
                    pollingPausedRef.current = true;
                    setIsPollingPaused(true);
                }
                if (manual) {
                    throw error;
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
        }, POLL_INTERVAL_JOBS);
        return () => clearInterval(id);
    }, [fetch, resetPolling]);

    return {data, isLoading, error, isPollingPaused, refetch: () => fetch(true)};
}

export function useCancelJob() {
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (id: string) => {
        setError(null);
        try {
            return await api.cancelJob(id);
        } catch (error) {
            setError(toError(error));
            throw error;
        }
    }, []);
    return {mutate, error};
}

export function useRetryJob() {
    const [error, setError] = useState<Error | null>(null);
    const mutate = useCallback(async (id: string) => {
        setError(null);
        try {
            return await api.retryJob(id);
        } catch (error) {
            setError(toError(error));
            throw error;
        }
    }, []);
    return {mutate, error};
}
