import {useCallback, useEffect, useRef, useState} from 'react';

import {getJobAudit} from '../api';
import {IDLE_POLL_RECOVERY, POLLING_CONFIG, buildPollRecoveryState, type PollRecoveryState} from '../polling';
import type {AuditTrailResponse} from '../types';

interface UseJobAuditReturn {
    audit: AuditTrailResponse | null;
    auditError: unknown | null;
    auditLoading: boolean;
    auditRecovery: PollRecoveryState;
    retryAudit: () => void;
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
                    }, POLLING_CONFIG.audit.baseMs);
                }
            } catch (err) {
                setAuditError(err);
                if (keepPolling) {
                    failureCountRef.current += 1;
                    const nextRecovery = buildPollRecoveryState(err, failureCountRef.current, POLLING_CONFIG.audit);
                    setAuditRecovery(nextRecovery);
                    if (!nextRecovery.exhausted && nextRecovery.nextDelayMs != null) {
                        timerRef.current = setTimeout(() => {
                            void load(true, true);
                        }, nextRecovery.nextDelayMs);
                    }
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

    const retryAudit = useCallback(() => {
        if (!jobId) {
            return;
        }
        clearTimer();
        failureCountRef.current = 0;
        setAuditRecovery(IDLE_POLL_RECOVERY);
        void load(false, active);
    }, [jobId, active, load]);

    return {audit, auditError, auditLoading, auditRecovery, retryAudit};
}
