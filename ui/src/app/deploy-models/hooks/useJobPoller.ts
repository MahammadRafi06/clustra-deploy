import {useCallback, useEffect, useRef, useState} from 'react';

import {cancelJob, getJob} from '../api';
import {isJobSettled} from '../jobState';
import {IDLE_POLL_RECOVERY, nextPollDelayMs, type PollRecoveryState} from '../polling';
import type {JobResult} from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_INTERVAL_MS = 20000;

interface UseJobPollerReturn {
    job: JobResult | null;
    cancelling: boolean;
    cancelError: unknown | null;
    pollRecovery: PollRecoveryState;
    cancel: () => void;
    reset: () => void;
}

export function useJobPoller(jobId: string | null): UseJobPollerReturn {
    const [job, setJob] = useState<JobResult | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<unknown | null>(null);
    const [pollRecovery, setPollRecovery] = useState<PollRecoveryState>(IDLE_POLL_RECOVERY);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const failureCountRef = useRef(0);

    const clearTimer = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const poll = useCallback(async (id: string) => {
        try {
            const result = await getJob(id);
            failureCountRef.current = 0;
            setJob(result);
            setPollRecovery(IDLE_POLL_RECOVERY);
            if (!isJobSettled(result)) {
                timerRef.current = setTimeout(() => poll(id), POLL_INTERVAL_MS);
            }
        } catch (err) {
            failureCountRef.current += 1;
            const nextDelayMs = nextPollDelayMs(failureCountRef.current, POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
            setPollRecovery({
                reconnecting: true,
                retryCount: failureCountRef.current,
                nextDelayMs,
                error: err
            });
            timerRef.current = setTimeout(() => poll(id), nextDelayMs);
        }
    }, []);

    useEffect(() => {
        if (!jobId) return;
        setJob(null);
        setCancelling(false);
        setCancelError(null);
        setPollRecovery(IDLE_POLL_RECOVERY);
        failureCountRef.current = 0;
        clearTimer();
        poll(jobId);
        return clearTimer;
    }, [jobId, poll]);

    const cancel = useCallback(async () => {
        if (!jobId || cancelling) return;
        setCancelling(true);
        setCancelError(null);
        try {
            const result = await cancelJob(jobId);
            setJob(result);
        } catch (err) {
            setCancelError(err);
        } finally {
            setCancelling(false);
        }
    }, [jobId, cancelling]);

    const reset = useCallback(() => {
        clearTimer();
        failureCountRef.current = 0;
        setJob(null);
        setCancelling(false);
        setCancelError(null);
        setPollRecovery(IDLE_POLL_RECOVERY);
    }, []);

    return {job, cancelling, cancelError, pollRecovery, cancel, reset};
}
