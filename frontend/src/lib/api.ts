/**
 * Orchestrator API client.
 *
 * Requests go to this origin and Next rewrites them to the FastAPI service
 * (see next.config.ts), so the browser never talks to a second origin.
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

export interface Provenance {
    engine?: string;
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
    skill: string;
    agents: string[];
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
    health: () => request<{ status: string; executor: string; engine: string }>('/health'),
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
    }) =>
        request<{ job_id: string; status: JobStatus }>('/jobs', {
            method: 'POST',
            body: JSON.stringify({ workflow: 'test-case-generation', ...payload }),
        }),

    cancelJob: (id: string) => request<Job>(`/jobs/${id}`, { method: 'DELETE' }),

    approveJob: (id: string, actor = 'anonymous') =>
        request<Job>(`/jobs/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ actor }),
        }),

    rejectJob: (id: string, actor = 'anonymous', reason = '') =>
        request<Job>(`/jobs/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ actor, reason }),
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
