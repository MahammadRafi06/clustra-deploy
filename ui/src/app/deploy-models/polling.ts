import {toErrorInfo} from './errors';

export interface PollRecoveryState {
    reconnecting: boolean;
    retryCount: number;
    nextDelayMs: number | null;
    error: unknown | null;
}

export const IDLE_POLL_RECOVERY: PollRecoveryState = {
    reconnecting: false,
    retryCount: 0,
    nextDelayMs: null,
    error: null
};

const JITTER_RATIO = 0.2;

export function nextPollDelayMs(failureCount: number, baseMs: number, maxMs: number): number {
    const capped = Math.min(maxMs, Math.round(baseMs * Math.pow(1.6, Math.max(0, failureCount - 1))));
    const min = Math.max(baseMs, Math.round(capped * (1 - JITTER_RATIO)));
    const max = Math.max(min, Math.round(capped * (1 + JITTER_RATIO)));
    return Math.round(min + Math.random() * (max - min));
}

function formatDelay(delayMs: number | null): string {
    if (!delayMs) {
        return 'soon';
    }
    const seconds = Math.max(1, Math.round(delayMs / 1000));
    return seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`;
}

export function formatPollRecoveryMessage(prefix: string, recovery: PollRecoveryState): string {
    const info = toErrorInfo(recovery.error);
    const reference = info.requestId ? ` Reference: ${info.requestId}.` : '';
    const stability = recovery.retryCount >= 3 ? ' Connection is still unstable.' : '';
    return `${prefix}. Retrying in about ${formatDelay(recovery.nextDelayMs)}.${stability}${reference}`;
}
