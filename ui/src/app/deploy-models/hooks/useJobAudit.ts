import {useCallback, useEffect, useRef, useState} from 'react';

import {getJobAudit} from '../api';
import {IDLE_POLL_RECOVERY, nextPollDelayMs, type PollRecoveryState} from '../polling';
import type {AuditTrailResponse} from '../types';

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_INTERVAL_MS = 25000;

interface UseJobAuditReturn {
    audit: AuditTrailResponse | null;
    auditError: unknown | null;
    auditLoading: boolean;
    auditRecovery: PollRecoveryState;
}

export function useJobAudit(jobId: string | null, active = false): UseJobAuditReturn {
    const [audit, setAudit] = useState<AuditTrailResponse | null>(null);
    const [auditError, setAuditError] = useState<unknown | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditRecovery, setAuditRecovery] = useState<PollRecoveryState>(IDLE_POLL_RECOVERY);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const failureCountRef = useRef(0);

    const clearTimer = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const load = useCallback(
        async (silent = false, keepPolling = false) => {
            if (!jobId) {
                return;
            }
            if (!silent) {
                setAuditLoading(true);
            }
            try {
                const nextAudit = await getJobAudit(jobId);
                setAudit(nextAudit);
                setAuditError(null);
                failureCountRef.current = 0;
                setAuditRecovery(IDLE_POLL_RECOVERY);
                if (keepPolling) {
                    timerRef.current = setTimeout(() => {
                        void load(true, true);
                    }, POLL_INTERVAL_MS);
                }
            } catch (err) {
                setAuditError(err);
                if (keepPolling) {
                    failureCountRef.current += 1;
                    const nextDelayMs = nextPollDelayMs(failureCountRef.current, POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
                    setAuditRecovery({
                        reconnecting: true,
                        retryCount: failureCountRef.current,
                        nextDelayMs,
                        error: err
                    });
                    timerRef.current = setTimeout(() => {
                        void load(true, true);
                    }, nextDelayMs);
                }
            } finally {
                if (!silent) {
                    setAuditLoading(false);
                }
            }
        },
        [jobId]
    );

    useEffect(() => {
        if (!jobId) {
            clearTimer();
            setAudit(null);
            setAuditError(null);
            setAuditLoading(false);
            setAuditRecovery(IDLE_POLL_RECOVERY);
            failureCountRef.current = 0;
            return;
        }

        clearTimer();
        failureCountRef.current = 0;
        setAuditRecovery(IDLE_POLL_RECOVERY);
        void load(false, active);

        return clearTimer;
    }, [jobId, active, load]);

    return {audit, auditError, auditLoading, auditRecovery};
}
