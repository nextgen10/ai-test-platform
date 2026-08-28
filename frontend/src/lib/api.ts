/**
 * Orchestrator API client.
 *
 * Requests go to this origin. A Next.js route handler proxies them to the
 * FastAPI service, so the browser never talks to a second origin.
 */

export const API_BASE = '/api/v1';

export type JobStatus =
    | 'QUEUED'
    | 'STARTING'
    | 'ANALYZING'
    | 'AWAITING_APPROVAL'
    | 'RUNNING'
    | 'VALIDATING'
    | 'EVALUATING'
    | 'COMPLETED'
    | 'REJECTED'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMEOUT';

/** Statuses where a background task is working. Excludes the human gate. */
export const ACTIVE_STATUSES: JobStatus[] = [
    'QUEUED', 'STARTING', 'ANALYZING', 'RUNNING', 'VALIDATING', 'EVALUATING',
];

export type Rating = 'bad' | 'average' | 'good' | 'very_good';

export const RATING_LABEL: Record<Rating, string> = {
    bad: 'Bad',
    average: 'Average',
    good: 'Good',
    very_good: 'Very Good',
};

export interface QualityCriterion {
    id: string;
    /** May be absent: the model sometimes omits it, so render `id` instead. */
    name?: string;
    rating: Rating;
    rationale: string;
    improvement?: string;
}

export interface QualityReport {
    requirement_reference: string;
    summary?: string;
    criteria: QualityCriterion[];
    overall: { score: number; rating: Rating; verdict?: string };
    blocking_issues?: string[];
    missing_information?: string[];
}

export interface EvaluationScore {
    id: string;
    name?: string;
    score: number;
    rationale?: string;
}

export interface Evaluation {
    requirement_reference?: string;
    scores: EvaluationScore[];
    overall: { score: number; rating: Rating; verdict?: string };
    gaps?: { area: string; detail: string; severity: 'low' | 'medium' | 'high' }[];
    recommendations?: { action: string; detail: string; target_ids?: string[] }[];
}

export interface JobSummary {
    total: number;
    by_category: Record<string, number>;
    by_priority: Record<string, number>;
    requirement_reference: string | null;
    assumptions: number;
}

export interface PhaseInfo {
    name: string;
    status: string;
    duration_ms: number;
    artifact: string | null;
    detail: string;
}

export interface ModelFallbackInfo {
    used: boolean;
    requested_model: string;
    effective_model: string;
    reason?: string;
}

/** One stage as the generic runner recorded it. */
export interface StageRecord {
    agent_id?: string;
    stage?: string;
    status?: 'completed' | 'failed' | 'skipped';
    duration_ms?: number;
    detail?: string;
    attempts?: number;
    contract?: string;
    resumed?: boolean;
    usage?: {
        input_tokens?: number | null;
        output_tokens?: number | null;
        total_tokens?: number | null;
        estimated?: boolean;
    };
}

export interface Provenance {
    engine?: string;
    /** Written by the generic runner. The bespoke chain writes `phases`. */
    stages?: StageRecord[];
    workflow_id?: string;
    runner?: 'bespoke' | 'generic';
    total_duration_ms?: number;
    usage?: Record<string, unknown>;
    copilot_model?: string;
    copilot_token_set?: boolean;
    model_fallback?: ModelFallbackInfo;
    skill?: string;
    agents?: string[];
    skill_version?: string;
    runner_version?: string;
    copilot_cli_version?: string | null;
    input_hash?: string;
    output_hash?: string;
    review_attempts?: number;
    phases?: PhaseInfo[];
}

export interface JobEvent {
    timestamp: string;
    event_type: string;
    message: string;
    event_metadata: Record<string, unknown> | null;
}

export interface Job {
    id: string;
    workflow: string;
    status: JobStatus;
    created_by: string;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    duration_ms: number | null;
    retry_count: number;
    kubernetes_job_name: string | null;
    summary: JobSummary | null;
    provenance: Provenance | null;
    quality_report: QualityReport | null;
    evaluation: Evaluation | null;
    approved_at: string | null;
    approved_by: string | null;
    reprocess_count: number;
    copilot_model?: string | null;
    copilot_token_set?: boolean;
    events?: JobEvent[];
}

export interface TestCase {
    id: string;
    title: string;
    category: 'functional' | 'negative' | 'boundary' | 'validation' | 'data';
    priority: 'critical' | 'high' | 'medium' | 'low';
    preconditions: string[];
    steps: string[];
    expected_result: string;
    requirement_reference: string;
}

export interface TestSuite {
    requirement_reference?: string;
    assumptions?: string[];
    test_cases: TestCase[];
}

export interface ValidationReport {
    valid: boolean;
    errors: { code: string; detail: string; where: string }[];
    warnings: { code: string; detail: string; where: string }[];
    stats: Record<string, unknown>;
}

export interface PlatformStats {
    total_jobs: number;
    by_status: Record<string, number>;
    active_jobs: number;
    awaiting_approval: number;
    success_rate: number | null;
    mean_duration_ms: number | null;
    mean_test_cases: number | null;
    total_test_cases: number;
    executor: string;
    engine: string;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    available: boolean;
    /** Why it cannot run, when `available` is false. */
    unavailable_reason?: string;
    skill: string | null;
    agents: { id: string; stage: string; optional: boolean; description?: string }[];
    runner: 'bespoke' | 'generic';
    approval_gate: boolean;
    has_custom_ui: boolean;
    custom_ui_route: string | null;
}

export interface SkillInfo {
    id: string;
    name: string;
    path: string;
    content: string;
    version: string;
    available: boolean;
}

export interface AgentInfo {
    id: string;
    name: string;
    role: string;
    description: string;
    tools: string[];
    input_artifact: string;
    output_artifact: string;
    stage: string;
    content: string;
    file: string;
}

export interface BenchmarkItem {
    id: string;
    title: string;
    filename: string;
    content: string;
    size_bytes: number;
}

export interface BenchmarkDimension {
    id: string;
    name: string;
    weight: number;
    description: string;
}

export interface BenchmarkResponse {
    dimensions: BenchmarkDimension[];
    benchmarks: BenchmarkItem[];
    platform_stats: PlatformStats;
}

export interface ModelOption {
    id: string;
    name: string;
    provider: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: 'same-origin',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : detail;
        } catch {
            /* non-JSON error body; keep the status-based message */
        }
        throw new Error(detail);
    }
    return response.json() as Promise<T>;
}

export const api = {
    health: () => request<{ status: string }>('/health'),
    /** Platform configuration, including whether the server holds its own Copilot token. */
    settings: () =>
        request<{
            status: string;
            executor: string;
            engine: string;
            app_name: string;
            auth_mode: string;
            server_token_configured: boolean;
        }>('/settings'),
    stats: () => request<PlatformStats>('/stats'),
    workflows: () => request<Workflow[]>('/workflows'),
    models: () => request<ModelOption[]>('/models'),
    skills: () => request<SkillInfo[]>('/skills'),
    agents: () => request<AgentInfo[]>('/agents'),
    benchmarks: () => request<BenchmarkResponse>('/evaluations/benchmarks'),

    listJobs: (limit = 50) => request<Job[]>(`/jobs?limit=${limit}`),
    getJob: (id: string) => request<Job>(`/jobs/${id}`),

    createJob: (payload: {
        requirement: string;
        workflow?: string;
        created_by?: string;
        copilot_model?: string;
        github_token?: string;
        engine?: string;
        used_ocr?: boolean;
        webhook_url?: string;
    }) =>
        request<{ job_id: string; status: JobStatus }>('/jobs', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    cancelJob: (id: string) => request<Job>(`/jobs/${id}`, { method: 'DELETE' }),

    approveJob: (id: string) =>
        request<Job>(`/jobs/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({}),
        }),

    rejectJob: (id: string, reason = '') =>
        request<Job>(`/jobs/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    reprocessJob: (id: string) => request<Job>(`/jobs/${id}/reprocess`, { method: 'POST' }),

    getLogs: (id: string) =>
        request<{ job_id: string; status: JobStatus; logs: string }>(`/jobs/${id}/logs`),

    getResult: (id: string) =>
        request<{
            job_id: string;
            status: JobStatus;
            result: TestSuite;
            validation: ValidationReport | null;
            summary: JobSummary | null;
        }>(`/jobs/${id}/result`),

    listArtifacts: (id: string) =>
        request<{ path: string; size_bytes: number }[]>(`/jobs/${id}/artifacts`),

    artifactUrl: (id: string, path: string) => `${API_BASE}/jobs/${id}/artifacts/${path}`,

    extractDocumentOcr: (payload: {
        image_base64: string;
        mime_type?: string;
        filename?: string;
        copilot_model?: string;
        github_token?: string;
        instructions?: string;
    }) =>
        request<{
            markdown: string;
            filename: string | null;
            char_count: number;
            engine: string;
        }>('/ocr/extract', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};

// ------------------------------------------------------------------ helpers

export const STATUS_COLOR: Record<
    JobStatus,
    'default' | 'info' | 'success' | 'error' | 'warning' | 'secondary'
> = {
    QUEUED: 'default',
    STARTING: 'info',
    ANALYZING: 'info',
    AWAITING_APPROVAL: 'warning',
    RUNNING: 'info',
    VALIDATING: 'info',
    EVALUATING: 'info',
    COMPLETED: 'success',
    REJECTED: 'error',
    FAILED: 'error',
    CANCELLED: 'default',
    TIMEOUT: 'error',
};

export const RATING_COLOR: Record<Rating, 'error' | 'warning' | 'info' | 'success'> = {
    bad: 'error',
    average: 'warning',
    good: 'info',
    very_good: 'success',
};

export const CATEGORY_LABEL: Record<string, string> = {
    functional: 'Functional',
    negative: 'Negative',
    boundary: 'Boundary',
    validation: 'Validation',
    data: 'Data',
};

export function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function formatTimestamp(value: string | null | undefined): string {
    if (!value) return '—';
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Queue, insights, agent testing and automation
// ═══════════════════════════════════════════════════════════════════════════

export interface QueueStatus {
    waiting: number;
    in_flight: number;
    active_workers: number;
    worker_id: string;
    lease_seconds: number;
    concurrency: number;
    max_attempts: number;
}

/** One agent invocation within a run. */
export interface StageBreakdown {
    stage: string | null;
    agent_id: string | null;
    status: string | null;
    duration_ms: number;
    attempts: number;
    /** Which schema the output was checked against, if any. */
    contract: string;
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
    cost_usd: number | null;
    /** True when the stage was skipped because a previous attempt did it. */
    resumed: boolean;
}

export interface JobBreakdown {
    job_id: string;
    workflow: string;
    model: string | null;
    status: JobStatus;
    duration_ms: number | null;
    stages: StageBreakdown[];
    totals: {
        input_tokens: number | null;
        output_tokens: number | null;
        total_tokens: number | null;
        cost_usd: number | null;
        stage_duration_ms: number;
        /** Token counts were derived from character counts, not reported. */
        tokens_estimated: boolean;
        cost_known: boolean;
    };
    pricing_version: string;
}

export interface AgentUsage {
    agent_id: string;
    runs: number;
    failures: number;
    failure_rate: number;
    retries: number;
    total_duration_ms: number;
    mean_duration_ms: number;
    total_tokens: number | null;
    cost_usd: number | null;
}

export interface WorkflowUsage {
    workflow: string;
    total: number;
    completed: number;
    failed: number;
    success_rate: number | null;
    mean_duration_ms: number | null;
}

export interface AgentTestResult {
    agent_id: string;
    ok: boolean;
    engine: string;
    duration_ms: number;
    output: string;
    output_artifact: string | null;
    contract_ok: boolean;
    contract_checked: string;
    contract_errors: string[];
    log: string;
    usage: Record<string, unknown>;
}

export interface Schedule {
    id: string;
    name: string;
    workflow: string;
    cron: string;
    requirement: string;
    enabled: boolean;
    created_at: string;
    created_by: string;
    copilot_model: string | null;
    engine: string | null;
    webhook_url: string | null;
    next_run_at: string | null;
    last_run_at: string | null;
    last_job_id: string | null;
    run_count: number;
    last_error: string | null;
    cron_description: string;
}

export interface SchedulePayload {
    name: string;
    workflow: string;
    cron: string;
    requirement: string;
    enabled?: boolean;
    copilot_model?: string | null;
    engine?: string | null;
    webhook_url?: string | null;
}

export interface WebhookDelivery {
    id: string;
    job_id: string;
    url: string;
    status: 'pending' | 'delivered' | 'failed';
    attempts: number;
    response_status: number | null;
    error: string | null;
    created_at: string | null;
    delivered_at: string | null;
}

export const platformApi = {
    queue: () => request<QueueStatus>('/queue'),

    // --- insights
    jobBreakdown: (id: string) => request<JobBreakdown>(`/insights/jobs/${id}`),
    agentUsage: (days = 30) =>
        request<{ days: number; agents: AgentUsage[]; pricing_version: string }>(
            `/insights/agents?days=${days}`,
        ),
    workflowUsage: (days = 30) =>
        request<{ days: number; workflows: WorkflowUsage[] }>(`/insights/workflows?days=${days}`),
    compareRuns: (left: string, right: string) =>
        request<Record<string, unknown>>(`/insights/compare?left=${left}&right=${right}`),

    // --- agent lab
    testAgent: (
        agentId: string,
        payload: { input: string; engine?: string | null; model?: string | null; skill_id?: string | null },
    ) =>
        request<AgentTestResult>(`/agents/${agentId}/test`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    agentFingerprint: (agentId: string) =>
        request<{ agent_id: string; fingerprint: string }>(`/agents/${agentId}/fingerprint`),

    // --- schedules
    listSchedules: () => request<Schedule[]>('/schedules'),
    createSchedule: (payload: SchedulePayload) =>
        request<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(payload) }),
    updateSchedule: (id: string, payload: SchedulePayload) =>
        request<Schedule>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteSchedule: (id: string) =>
        request<{ deleted: string }>(`/schedules/${id}`, { method: 'DELETE' }),
    runSchedule: (id: string) =>
        request<{ job_id: string; status: JobStatus }>(`/schedules/${id}/run`, { method: 'POST' }),
    previewCron: (expression: string) =>
        request<{ cron: string; description: string; next_runs: string[] }>('/cron/preview', {
            method: 'POST',
            body: JSON.stringify({ cron: expression }),
        }),

    // --- webhooks
    listDeliveries: (params: { job_id?: string; status?: string } = {}) => {
        const query = new URLSearchParams(
            Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
        );
        return request<WebhookDelivery[]>(`/webhooks/deliveries?${query.toString()}`);
    },
    retryDelivery: (id: string) =>
        request<{ id: string; status: string }>(`/webhooks/deliveries/${id}/retry`, {
            method: 'POST',
        }),

    // --- bulk
    submitBulk: (payload: {
        workflow: string;
        items: { requirement: string; reference?: string }[];
        engine?: string | null;
        copilot_model?: string | null;
        webhook_url?: string | null;
    }) =>
        request<{
            submitted: number;
            rejected: number;
            jobs: { index: number; job_id: string; reference: string | null }[];
            errors: { index: number; reference: string | null; detail: string }[];
        }>('/jobs/bulk', { method: 'POST', body: JSON.stringify(payload) }),
};

/** Format a USD amount for display, or an em dash when the cost is unknown. */
export function formatCost(usd: number | null | undefined): string {
    if (usd === null || usd === undefined) return '—';
    if (usd === 0) return '$0.00';
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

/** Format a token count compactly. */
export function formatTokens(count: number | null | undefined): string {
    if (count === null || count === undefined) return '—';
    if (count < 1000) return String(count);
    if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1_000_000).toFixed(2)}M`;
}
