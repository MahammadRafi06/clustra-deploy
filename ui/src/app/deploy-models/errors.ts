export interface ErrorInfo {
    message: string;
    requestId: string | null;
    traceId: string | null;
    status: number | null;
    /** Machine-readable code from RFC 7807 extension (e.g. "policy.constraint_violation"). */
    code: string | null;
    /** Dotted JSON path to the offending field from RFC 7807 extension. */
    fieldPath: string | null;
}

interface ApiErrorInit {
    message: string;
    status?: number;
    requestId?: string | null;
    traceId?: string | null;
    code?: string | null;
    fieldPath?: string | null;
}

export class ApiError extends Error {
    status: number | null;
    requestId: string | null;
    traceId: string | null;
    code: string | null;
    fieldPath: string | null;

    constructor({message, status, requestId, traceId, code, fieldPath}: ApiErrorInit) {
        super(message);
        this.name = 'ApiError';
        this.status = status ?? null;
        this.requestId = requestId ?? null;
        this.traceId = traceId ?? null;
        this.code = code ?? null;
        this.fieldPath = fieldPath ?? null;
    }
}

function formatValidationIssue(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const item = value as {loc?: unknown; msg?: unknown};
    const location = Array.isArray(item.loc) ? item.loc.join('.') : typeof item.loc === 'string' ? item.loc : null;
    const message = typeof item.msg === 'string' ? item.msg : null;
    if (!message) {
        return null;
    }
    return location ? `${location}: ${message}` : message;
}

export function formatErrorDetail(detail: unknown, fallback = 'Unexpected error'): string {
    if (typeof detail === 'string' && detail.trim()) {
        return detail;
    }
    if (Array.isArray(detail)) {
        const issues = detail.map(item => formatValidationIssue(item) || JSON.stringify(item)).filter(Boolean);
        if (issues.length > 0) {
            return issues.join('; ');
        }
    }
    if (detail && typeof detail === 'object') {
        try {
            return JSON.stringify(detail);
        } catch {
            return fallback;
        }
    }
    return fallback;
}

export function toErrorInfo(error: unknown): ErrorInfo {
    if (error instanceof ApiError) {
        return {
            message: error.message,
            requestId: error.requestId,
            traceId: error.traceId,
            status: error.status,
            code: error.code,
            fieldPath: error.fieldPath
        };
    }
    if (error instanceof Error) {
        return {
            message: error.message,
            requestId: null,
            traceId: null,
            status: null,
            code: null,
            fieldPath: null
        };
    }
    if (typeof error === 'string') {
        return {
            message: error,
            requestId: null,
            traceId: null,
            status: null,
            code: null,
            fieldPath: null
        };
    }
    return {
        message: 'Unexpected error',
        requestId: null,
        traceId: null,
        status: null,
        code: null,
        fieldPath: null
    };
}

export function formatErrorReference(error: unknown): string | null {
    const info = toErrorInfo(error);
    if (!info.requestId && !info.traceId) {
        return null;
    }
    if (info.requestId && info.traceId) {
        return `Request ID: ${info.requestId} · Trace ID: ${info.traceId}`;
    }
    if (info.requestId) {
        return `Request ID: ${info.requestId}`;
    }
    return `Trace ID: ${info.traceId}`;
}
