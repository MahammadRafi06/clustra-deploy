import {useState, useEffect, useCallback, useRef} from 'react';
import * as api from '../api/client';
import type {SystemHealth, NodeInfo} from '../api/types';
import {POLL_INTERVAL_HEALTH} from '../utils/constants';

const MAX_POLL_FAILURES = 3;

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function useHealth() {
    const [data, setData] = useState<SystemHealth | undefined>();
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
                const result = await api.getSystemHealth();
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
        [resetPolling]
    );

    useEffect(() => {
        setIsLoading(true);
        resetPolling();
        fetch();
        const id = setInterval(() => {
            if (!pollingPausedRef.current && isDocumentVisible()) {
                fetch();
            }
        }, POLL_INTERVAL_HEALTH);
        return () => clearInterval(id);
    }, [fetch, resetPolling]);

    return {data, isLoading, error, isPollingPaused, refetch: () => fetch(true)};
}

export function useNodes() {
    const [data, setData] = useState<NodeInfo[]>([]);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchNodes = () =>
            api
                .listNodes()
                .then(result => {
                    setData(result);
                    setError(null);
                })
                .catch(error => setError(toError(error)));

        api.listNodes()
            .then(result => {
                setData(result);
                setError(null);
            })
            .catch(error => setError(toError(error)));
        const id = setInterval(() => {
            if (isDocumentVisible()) {
                fetchNodes();
            }
        }, POLL_INTERVAL_HEALTH);
        return () => clearInterval(id);
    }, []);

    return {data, error};
}
