import {useCallback, useEffect, useRef, useState} from 'react';

import {cancelJob, getJob} from '../api';
import {isJobSettled} from '../jobState';
import {IDLE_POLL_RECOVERY, POLLING_CONFIG, buildPollRecoveryState, type PollRecoveryState} from '../polling';
import type {JobResult} from '../types';

interface UseJobPollerReturn {
    job: JobResult | null;
    cancelling: boolean;
    cancelError: unknown | null;
    pollRecovery: PollRecoveryState;
    cancel: () => void;
    retry: () => void;
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
                timerRef.current = setTimeout(() => poll(id), POLLING_CONFIG.job.baseMs);
            }
        } catch (err) {
            failureCountRef.current += 1;
            const nextRecovery = buildPollRecoveryState(err, failureCountRef.current, POLLING_CONFIG.job);
            setPollRecovery(nextRecovery);
            if (!nextRecovery.exhausted && nextRecovery.nextDelayMs != null) {
                timerRef.current = setTimeout(() => poll(id), nextRecovery.nextDelayMs);
            }
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

    const retry = useCallback(() => {
        if (!jobId) {
            return;
        }
        clearTimer();
        failureCountRef.current = 0;
        setPollRecovery(IDLE_POLL_RECOVERY);
        void poll(jobId);
    }, [jobId, poll]);

    return {job, cancelling, cancelError, pollRecovery, cancel, retry, reset};
}
