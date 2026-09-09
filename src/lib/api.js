/**
 * Orchestrator API client.
 *
 * Every call goes through the shared axios instance in `./http`, so the base
 * URL, the auth header and error normalisation are decided in one place.
 */

import { apiUrl, del, get, post, put, API_BASE } from './http';

export { API_BASE };

/**
 * Shortest requirement `POST /jobs` will accept.
 *
 * Mirrors `min_length` on the server's JobCreateRequest. Worth checking before
 * submitting: a validation failure comes back as a 422 whose `detail` is a list
 * rather than a string, so it degrades to "Request failed (422)" and tells the
 * user nothing about what to do.
 */
export const MIN_JOB_BRIEF_CHARS = 20;

/** Statuses where a background task is working. Excludes the human gate. */
export const ACTIVE_STATUSES = [
    'QUEUED', 'STARTING', 'ANALYZING', 'RUNNING', 'VALIDATING', 'EVALUATING',
];

export const RATING_LABEL = {
    bad: 'Bad',
    average: 'Average',
    good: 'Good',
    very_good: 'Very Good',
};

export const api = {
    health: () => get('/health'),
    /** Platform configuration, including whether the server holds its own Copilot token. */
    settings: () => get('/settings'),
    stats: () => get('/stats'),
    workflows: () => get('/workflows'),
    models: () => get('/models'),
    skills: () => get('/skills'),
    agents: () => get('/agents'),
    benchmarks: () => get('/evaluations/benchmarks'),

    listJobs: (limit = 50) => get(`/jobs?limit=${limit}`),
    getJob: (id) => get(`/jobs/${id}`),

    /** Submit a workflow run. `requirement` must satisfy MIN_JOB_BRIEF_CHARS. */
    createJob: (payload) => post('/jobs', payload),

    cancelJob: (id) => del(`/jobs/${id}`),

    approveJob: (id) => post(`/jobs/${id}/approve`, {}),

    rejectJob: (id, reason = '') => post(`/jobs/${id}/reject`, { reason }),

    reprocessJob: (id) => post(`/jobs/${id}/reprocess`),

    getLogs: (id) => get(`/jobs/${id}/logs`),

    getResult: (id) => get(`/jobs/${id}/result`),

    listArtifacts: (id) => get(`/jobs/${id}/artifacts`),

    artifactUrl: (id, path) => apiUrl(`/jobs/${id}/artifacts/${path}`),

    extractDocumentOcr: (payload) =>
        // OCR is a model call on a whole document, so it outlives the default.
        post('/ocr/extract', payload, { timeout: 300_000 }),
};

// ------------------------------------------------------------------ helpers

export const STATUS_COLOR = {
    QUEUED: 'warning',
    STARTING: 'warning',
    ANALYZING: 'warning',
    AWAITING_APPROVAL: 'warning',
    RUNNING: 'warning',
    VALIDATING: 'warning',
    EVALUATING: 'warning',
    COMPLETED: 'success',
    REJECTED: 'error',
    FAILED: 'error',
    CANCELLED: 'default',
    TIMEOUT: 'error',
};

/** The progress bar accepts a subset of the chip tones. */
export function statusBarColor(status) {
    const tone = STATUS_COLOR[status];
    if (tone === 'success' || tone === 'error' || tone === 'warning') return tone;
    return 'inherit';
}

export const RATING_COLOR = {
    bad: 'error',
    average: 'warning',
    good: 'info',
    very_good: 'success',
};

export const CATEGORY_LABEL = {
    functional: 'Functional',
    negative: 'Negative',
    boundary: 'Boundary',
    validation: 'Validation',
    data: 'Data',
};

export function formatDuration(ms) {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function formatTimestamp(value) {
    if (!value) return '—';
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Queue, insights, agent testing and automation
// ═══════════════════════════════════════════════════════════════════════════

export const platformApi = {
    queue: () => get('/queue'),

    // --- insights
    jobBreakdown: (id) => get(`/insights/jobs/${id}`),
    agentUsage: (days = 30) => get(`/insights/agents?days=${days}`),
    workflowUsage: (days = 30) => get(`/insights/workflows?days=${days}`),
    compareRuns: (left, right) => get(`/insights/compare?left=${left}&right=${right}`),

    // --- agent lab
    // A live agent run is the one call here that legitimately takes minutes.
    testAgent: (agentId, payload) =>
        post(`/agents/${agentId}/test`, payload, { timeout: 600_000 }),
    agentFingerprint: (agentId) => get(`/agents/${agentId}/fingerprint`),

    // --- schedules
    listSchedules: () => get('/schedules'),
    createSchedule: (payload) => post('/schedules', payload),
    updateSchedule: (id, payload) => put(`/schedules/${id}`, payload),
    deleteSchedule: (id) => del(`/schedules/${id}`),
    runSchedule: (id) => post(`/schedules/${id}/run`),
    previewCron: (expression) => post('/cron/preview', { cron: expression }),

    // --- webhooks
    listDeliveries: (params = {}) => {
        const query = new URLSearchParams(
            Object.entries(params).filter(([, value]) => Boolean(value)),
        );
        return get(`/webhooks/deliveries?${query.toString()}`);
    },
    retryDelivery: (id) => post(`/webhooks/deliveries/${id}/retry`),

    // --- bulk
    submitBulk: (payload) => post('/jobs/bulk', payload),
};

/** Format a USD amount for display, or an em dash when the cost is unknown. */
export function formatCost(usd) {
    if (usd === null || usd === undefined) return '—';
    if (usd === 0) return '$0.00';
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

/** Format a token count compactly. */
export function formatTokens(count) {
    if (count === null || count === undefined) return '—';
    if (count < 1000) return String(count);
    if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1_000_000).toFixed(2)}M`;
}
