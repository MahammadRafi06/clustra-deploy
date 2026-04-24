import {toErrorInfo} from './errors';

export interface PollingConfig {
    baseMs: number;
    maxMs: number;
    maxRetries: number;
}

export interface PollRecoveryState {
    reconnecting: boolean;
    exhausted: boolean;
    retryCount: number;
    nextDelayMs: number | null;
    error: unknown | null;
}

export const POLLING_CONFIG = {
    job: {baseMs: 3000, maxMs: 20000, maxRetries: 12},
    audit: {baseMs: 4000, maxMs: 25000, maxRetries: 12},
    recentRuns: {baseMs: 5000, maxMs: 25000, maxRetries: 12}
} as const satisfies Record<string, PollingConfig>;

export const IDLE_POLL_RECOVERY: PollRecoveryState = {
    reconnecting: false,
    exhausted: false,
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

export function buildPollRecoveryState(error: unknown, failureCount: number, config: PollingConfig): PollRecoveryState {
    if (failureCount >= config.maxRetries) {
        return {
            reconnecting: false,
            exhausted: true,
            retryCount: failureCount,
            nextDelayMs: null,
            error
        };
    }
    return {
        reconnecting: true,
        exhausted: false,
        retryCount: failureCount,
        nextDelayMs: nextPollDelayMs(failureCount, config.baseMs, config.maxMs),
        error
    };
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
    if (recovery.exhausted) {
        return `${prefix}. Updates stopped after repeated failures. Retry manually.${reference}`;
    }
    const stability = recovery.retryCount >= 3 ? ' Connection is still unstable.' : '';
    return `${prefix}. Retrying in about ${formatDelay(recovery.nextDelayMs)}.${stability}${reference}`;
}
