import {useCallback, useEffect, useRef, useState} from 'react';
import {cancelJob, getJob} from '../api';
import type {JobResult, JobStatus} from '../types';

const POLL_INTERVAL_MS = 3000;
const TERMINAL = new Set<JobStatus>(['success', 'failed', 'cancelled']);

interface UseJobPollerReturn {
    job: JobResult | null;
    cancelling: boolean;
    cancel: () => void;
    reset: () => void;
}

export function useJobPoller(jobId: string | null): UseJobPollerReturn {
    const [job, setJob] = useState<JobResult | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const poll = useCallback(async (id: string) => {
        try {
            const result = await getJob(id);
            setJob(result);
            if (!TERMINAL.has(result.status)) {
                timerRef.current = setTimeout(() => poll(id), POLL_INTERVAL_MS);
            }
        } catch {
            // network error — retry after interval
            timerRef.current = setTimeout(() => poll(id), POLL_INTERVAL_MS);
        }
    }, []);

    useEffect(() => {
        if (!jobId) return;
        setJob(null);
        setCancelling(false);
        clearTimer();
        poll(jobId);
        return clearTimer;
    }, [jobId, poll]);

    const cancel = useCallback(async () => {
        if (!jobId || cancelling) return;
        setCancelling(true);
        try {
            const result = await cancelJob(jobId);
            setJob(result);
        } catch {
            // ignore — banner will reflect stale state
        } finally {
            setCancelling(false);
        }
    }, [jobId, cancelling]);

    const reset = useCallback(() => {
        clearTimer();
        setJob(null);
        setCancelling(false);
    }, []);

    return {job, cancelling, cancel, reset};
}
