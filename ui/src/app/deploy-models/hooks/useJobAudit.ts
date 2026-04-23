import {useCallback, useEffect, useState} from 'react';

import {getJobAudit} from '../api';
import type {AuditTrailResponse} from '../types';

const POLL_INTERVAL_MS = 4000;

interface UseJobAuditReturn {
    audit: AuditTrailResponse | null;
    auditError: string | null;
    auditLoading: boolean;
}

export function useJobAudit(jobId: string | null, active = false): UseJobAuditReturn {
    const [audit, setAudit] = useState<AuditTrailResponse | null>(null);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);

    const load = useCallback(
        async (silent = false) => {
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
            } catch (err) {
                setAuditError(err instanceof Error ? err.message : String(err));
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
            setAudit(null);
            setAuditError(null);
            setAuditLoading(false);
            return;
        }

        void load();
        if (!active) {
            return;
        }

        const intervalId = window.setInterval(() => {
            void load(true);
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [jobId, active, load]);

    return {audit, auditError, auditLoading};
}
