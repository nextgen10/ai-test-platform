import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Activity, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Download,
    FileSpreadsheet, Loader2, RefreshCw, ShieldCheck, SkipForward, SquareArrowOutUpRight,
    UserCheck, XCircle,
} from 'lucide-react';

import EvaluationPanel from '@/components/EvaluationPanel';
import QualityReportPanel from '@/components/QualityReportPanel';
import RunCostPanel from '@/components/RunCostPanel';
import WorkflowStepper from '@/components/WorkflowStepper';
import { cx } from '@/components/ui/cx';
import {
    Alert, Button, Chip, Divider, IconButton, LinearProgress, LoadingBlock, Paper, Skeleton,
} from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import {
    ACTIVE_STATUSES, api, CATEGORY_LABEL, formatDuration, formatTimestamp, platformApi,
    STATUS_COLOR, statusBarColor,
} from '@/lib/api';
import { exportTestSuite } from '@/lib/export-xlsx';
// Shared with the stepper and the Workflow Builder, so every view of a run
// agrees on which stages exist and how far each one got.
import { BESPOKE_WORKFLOW_ID, derivePhases } from '@/lib/phases';

const PRIORITY_COLOR = {
    critical: 'error',
    high: 'warning',
    medium: 'info',
    low: 'default',
};

const META_LABEL = 'text-[0.68rem] font-medium uppercase tracking-[0.04em] text-subtle';

function PhaseIcon({ state }) {
    if (state === 'completed') return <CheckCircle2 size={15} className="shrink-0 text-success" />;
    if (state === 'skipped') return <SkipForward size={15} className="shrink-0 text-faint" />;
    if (state === 'failed') return <XCircle size={15} className="shrink-0 text-danger" />;
    if (state === 'blocked') return <UserCheck size={15} className="shrink-0 text-warning" />;
    if (state === 'running') {
        return (
            <span className="flex shrink-0 animate-ubs-spin text-warning">
                <Loader2 size={15} />
            </span>
        );
    }
    return <Circle size={15} className="shrink-0 text-faint" />;
}

const PHASE_TEXT = {
    skipped: 'italic text-faint',
    pending: 'text-subtle',
    running: 'font-medium text-warning',
    failed: 'text-danger',
    completed: 'text-success',
    blocked: 'text-ink',
};

function LiveJobSidePanel({ job, validation, workflow }) {
    const { phases, states, unknown } = derivePhases(job, workflow);
    const resolved = phases.filter(
        (phase) => states[phase.key].state === 'completed' || states[phase.key].state === 'skipped',
    ).length;
    // 'skipped' phases (e.g. OCR extraction on a text-only job) are resolved
    // before the job even starts, so they must not count as "real" progress —
    // otherwise the indeterminate/starting spinner below never shows.
    const completedCount = phases.filter((phase) => states[phase.key].state === 'completed').length;
    const running = ACTIVE_STATUSES.includes(job.status);
    const artifact = job.summary?.artifact;

    return (
        <div className="sticky top-20 flex w-full min-w-0 flex-col gap-4">
            {/* 1. Status & progress */}
            <Paper flat className="min-w-0 p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className={running ? 'text-warning' : 'text-subtle'} />
                        <p className="text-[0.9rem] font-medium">Job status &amp; progress</p>
                    </div>
                    <Chip color={STATUS_COLOR[job.status]} className="text-[0.7rem] font-medium">
                        {job.status}
                    </Chip>
                </div>

                <LinearProgress
                    className="mb-4 h-1.5"
                    color={statusBarColor(job.status)}
                    value={
                        running && completedCount === 0
                            ? undefined
                            : phases.length
                              ? (resolved / phases.length) * 100
                              : 0
                    }
                />

                <div className="mb-4 flex flex-col gap-2.5">
                    {unknown && (
                        <div className="flex items-center gap-3">
                            <Skeleton variant="circular" width={15} height={15} />
                            <Skeleton variant="text" width={160} height={16} />
                        </div>
                    )}
                    {phases.map((phase) => {
                        const { state, detail } = states[phase.key];
                        return (
                            <div
                                key={phase.key}
                                className={cx('flex min-w-0 items-center gap-3', state === 'skipped' && 'opacity-50')}
                            >
                                <PhaseIcon state={state} />
                                <span
                                    className={cx(
                                        'min-w-0 grow truncate text-[0.78rem]',
                                        PHASE_TEXT[state] ?? 'text-ink',
                                    )}
                                >
                                    {phase.label}
                                </span>
                                <span
                                    title={detail}
                                    className={cx(
                                        'max-w-[150px] shrink-0 truncate text-right text-[0.7rem]',
                                        state === 'running' ? 'text-warning' : 'text-faint',
                                        state === 'skipped' && 'italic',
                                    )}
                                >
                                    {state === 'running' && !detail ? 'running…' : detail}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <Divider className="my-3" />

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className={META_LABEL}>Duration</p>
                        <p className="ui-body2 mt-0.5 font-medium">{formatDuration(job.duration_ms)}</p>
                    </div>
                    <div className="min-w-0">
                        <p className={META_LABEL}>
                            {typeof job.summary?.total === 'number' ? 'Test cases' : 'Artifact'}
                        </p>
                        <p className="ui-body2 mt-0.5 truncate font-medium" title={artifact}>
                            {typeof job.summary?.total === 'number' ? job.summary.total : (artifact ?? '—')}
                        </p>
                    </div>
                    <div>
                        <p className={META_LABEL}>Started</p>
                        <p className="mt-0.5 text-[0.72rem] text-subtle">{formatTimestamp(job.started_at)}</p>
                    </div>
                    <div className="min-w-0">
                        <p className={META_LABEL}>Workflow</p>
                        <p className="mt-0.5 truncate text-[0.72rem] text-subtle">{job.workflow}</p>
                    </div>
                </div>
            </Paper>

            {/* 2. Validation gate */}
            {validation && (
                <Paper
                    flat
                    className={cx(
                        'min-w-0 p-5',
                        validation.valid
                            ? ''
                            : 'border-danger bg-[color-mix(in_srgb,var(--col-error)_3%,transparent)]',
                    )}
                >
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck
                                size={16}
                                className={validation.valid ? 'text-success' : 'text-danger'}
                            />
                            <p className="text-[0.88rem] font-medium">Validation gate</p>
                        </div>
                        <Chip
                            color={validation.valid ? 'success' : 'error'}
                            className="h-[22px] text-[0.68rem] font-medium"
                        >
                            {validation.valid ? 'Passed all gates' : 'Failed'}
                        </Chip>
                    </div>

                    {validation.errors?.length > 0 && (
                        <div className="mt-2">
                            <p className="mb-1 block text-[0.7rem] font-medium text-danger">
                                FAILED CHECKS ({validation.errors.length})
                            </p>
                            {validation.errors.map((item, index) => (
                                <div
                                    key={index}
                                    className="mb-1.5 rounded-ubs border border-[color-mix(in_srgb,var(--col-error)_20%,transparent)] bg-[color-mix(in_srgb,var(--col-error)_8%,transparent)] p-2"
                                >
                                    <p className="text-[0.72rem] font-medium text-danger">[{item.code}]</p>
                                    <p className="text-[0.72rem] leading-snug text-subtle">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {validation.warnings?.length > 0 && (
                        <div className="mt-2">
                            <p className="mb-1 block text-[0.7rem] font-medium text-warning">
                                WARNINGS ({validation.warnings.length})
                            </p>
                            {validation.warnings.map((item, index) => (
                                <div
                                    key={index}
                                    className="mb-1.5 rounded-ubs border border-[color-mix(in_srgb,var(--col-warning)_20%,transparent)] bg-[color-mix(in_srgb,var(--col-warning)_8%,transparent)] p-2"
                                >
                                    <p className="text-[0.72rem] font-medium text-warning">[{item.code}]</p>
                                    <p className="text-[0.72rem] leading-snug text-subtle">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {validation.valid && !validation.errors?.length && !validation.warnings?.length && (
                        <p className="text-[0.74rem] leading-snug text-subtle">
                            All JSON schema contracts, category coverage bounds, and traceability IDs verified.
                        </p>
                    )}
                </Paper>
            )}

            {/* 3. Reproducibility & provenance */}
            {(job.provenance || job.copilot_model || job.copilot_token_set) && (
                <Paper flat className="min-w-0 p-5">
                    <p className="mb-2 text-[0.88rem] font-medium">Reproducibility &amp; provenance</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.provenance?.engine && (
                            <Chip
                                variant="outlined"
                                color={job.provenance.engine === 'mock' ? 'warning' : 'default'}
                                className="h-[22px] text-[0.7rem]"
                            >
                                {`engine: ${job.provenance.engine}`}
                            </Chip>
                        )}
                        {(job.copilot_model || job.provenance?.copilot_model) && (
                            <Chip variant="outlined" color="primary" className="h-[22px] text-[0.7rem]">
                                {`model: ${job.copilot_model || job.provenance?.copilot_model}`}
                            </Chip>
                        )}
                        {job.provenance?.model_fallback?.used && (
                            <Chip
                                variant="outlined"
                                color="warning"
                                className="h-[22px] text-[0.7rem] font-medium"
                                title={
                                    job.provenance.model_fallback.reason ??
                                    'Specified model not permitted on Copilot account; fell back to default model.'
                                }
                            >
                                {`⚠️ Model fallback: ${job.provenance.model_fallback.requested_model} ➔ ${job.provenance.model_fallback.effective_model}`}
                            </Chip>
                        )}
                        {(job.copilot_token_set || job.provenance?.copilot_token_set) && (
                            <Chip variant="outlined" color="info" className="h-[22px] text-[0.7rem]">
                                custom PAT used
                            </Chip>
                        )}
                        {job.provenance?.review_attempts !== undefined && (
                            <Chip variant="outlined" className="h-[22px] text-[0.7rem]">
                                {`review attempts: ${job.provenance.review_attempts}`}
                            </Chip>
                        )}
                    </div>
                </Paper>
            )}

            {/* 4. Audit trail */}
            {job.events && job.events.length > 0 && (
                <Paper flat className="min-w-0 p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-[0.92rem] font-medium">Audit trail ({job.events.length})</p>
                        <Chip variant="outlined" color="info" className="h-5 text-[0.68rem] font-medium">
                            Live stream
                        </Chip>
                    </div>
                    <div className="custom-scrollbar max-h-[520px] overflow-y-auto rounded-ubs border border-hairline bg-elevated p-3">
                        {job.events.map((event, index) => (
                            <div
                                key={index}
                                className={cx(
                                    'py-2.5',
                                    index < job.events.length - 1 && 'border-b border-hairline',
                                )}
                            >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="text-[0.8rem] font-medium text-brand">
                                        {event.event_type}
                                    </span>
                                    <span className="font-mono text-[0.72rem] text-faint">
                                        {formatTimestamp(event.timestamp)}
                                    </span>
                                </div>
                                <p className="break-words text-[0.78rem] leading-relaxed text-subtle">
                                    {event.message}
                                </p>
                            </div>
                        ))}
                    </div>
                </Paper>
            )}
        </div>
    );
}

function ResultsTab({ suite, jobId }) {
    const [expanded, setExpanded] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const cases = suite.test_cases ?? [];

    const byCategory = cases.reduce((acc, testCase) => {
        acc[testCase.category] = (acc[testCase.category] ?? 0) + 1;
        return acc;
    }, {});

    const filteredCases = selectedCategory
        ? cases.filter((testCase) => testCase.category === selectedCategory)
        : cases;

    const tileClass = (active) =>
        cx(
            'cursor-pointer p-3 text-center transition-colors',
            active ? 'border-brand bg-brand-tint' : 'border-hairline bg-surface',
        );

    return (
        <div className="w-full min-w-0">
            {/* Category metrics, doubling as the filter. */}
            <div className="mb-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                <Paper flat className={tileClass(selectedCategory === null)} as="button" onClick={() => setSelectedCategory(null)}>
                    <p className="ui-caption font-medium text-subtle">TOTAL</p>
                    <p className="mt-0.5 text-xl font-medium">{cases.length}</p>
                </Paper>
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <Paper
                        key={key}
                        as="button"
                        flat
                        className={tileClass(selectedCategory === key)}
                        onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                    >
                        <p className="ui-caption font-medium text-subtle">{label.toUpperCase()}</p>
                        <p
                            className={cx(
                                'mt-0.5 text-xl font-medium',
                                byCategory[key] ? 'text-ink' : 'text-faint',
                            )}
                        >
                            {byCategory[key] ?? 0}
                        </p>
                    </Paper>
                ))}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="ui-subtitle2 text-subtle">
                    {selectedCategory
                        ? `${CATEGORY_LABEL[selectedCategory]} cases (${filteredCases.length})`
                        : `All test cases (${cases.length})`}
                </p>
                <Button
                    variant="contained"
                    size="small"
                    onClick={() => exportTestSuite(suite, jobId)}
                >
                    <FileSpreadsheet size={16} />
                    Export to Excel (.xlsx)
                </Button>
            </div>

            <Paper flat className="w-full overflow-x-auto">
                <table className="ui-table ui-table-dense w-full min-w-[680px] table-fixed">
                    <thead>
                        <tr>
                            <th className="w-11 p-2" />
                            <th className="w-[140px]">ID</th>
                            <th>Title</th>
                            <th className="w-[125px]">Category</th>
                            <th className="w-[110px]">Priority</th>
                            <th className="w-[130px]">Requirement</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCases.map((testCase) => {
                            const open = expanded === testCase.id;
                            return (
                                <Fragment key={testCase.id}>
                                    <tr
                                        className="cursor-pointer"
                                        onClick={() => setExpanded(open ? null : testCase.id)}
                                    >
                                        <td className="p-2 text-center">
                                            <IconButton size="small" aria-label={open ? 'Collapse' : 'Expand'}>
                                                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </IconButton>
                                        </td>
                                        <td className="font-mono text-[0.8rem] font-medium">{testCase.id}</td>
                                        <td className="truncate">{testCase.title}</td>
                                        <td>
                                            <Chip variant="outlined" className="h-[22px] text-[0.72rem]">
                                                {CATEGORY_LABEL[testCase.category] ?? testCase.category}
                                            </Chip>
                                        </td>
                                        <td>
                                            <Chip
                                                color={PRIORITY_COLOR[testCase.priority] ?? 'default'}
                                                className="h-[22px] text-[0.7rem] uppercase"
                                            >
                                                {testCase.priority}
                                            </Chip>
                                        </td>
                                        <td className="font-mono text-[0.78rem] text-subtle">
                                            {testCase.requirement_reference}
                                        </td>
                                    </tr>
                                    {open && (
                                        <tr>
                                            <td colSpan={6} className="bg-[color-mix(in_srgb,var(--col-text-primary)_2%,transparent)] px-6 py-4">
                                                {testCase.preconditions?.length > 0 && (
                                                    <div className="mb-3">
                                                        <p className="ui-caption font-medium text-subtle">
                                                            PRECONDITIONS
                                                        </p>
                                                        <ul className="mt-1 list-disc pl-6">
                                                            {testCase.preconditions.map((item, index) => (
                                                                <li key={index} className="text-[0.82rem]">
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                <p className="ui-caption font-medium text-subtle">EXECUTION STEPS</p>
                                                <ol className="mb-3 mt-1 list-decimal pl-6">
                                                    {testCase.steps.map((item, index) => (
                                                        <li key={index} className="text-[0.82rem]">
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ol>

                                                <div className="rounded-ubs border border-[color-mix(in_srgb,var(--col-background-brand)_20%,transparent)] bg-[color-mix(in_srgb,var(--col-background-brand)_6%,transparent)] p-3">
                                                    <p className="ui-caption mb-0.5 block font-medium text-brand">
                                                        EXPECTED OBSERVABLE RESULT
                                                    </p>
                                                    <p className="text-[0.85rem] font-medium">
                                                        {testCase.expected_result}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </Paper>
        </div>
    );
}

export default function JobDetailPage() {
    const { id: jobId } = useParams();
    const navigate = useNavigate();

    const [job, setJob] = useState(null);
    // The workflow definition, so the phase list reflects what actually ran
    // rather than the test-generation chain.
    const [workflow, setWorkflow] = useState(null);
    const [breakdown, setBreakdown] = useState(null);
    const [suite, setSuite] = useState(null);
    const [validation, setValidation] = useState(null);
    const [logs, setLogs] = useState('');
    const [artifacts, setArtifacts] = useState([]);
    const [tabKey, setTabKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            const jobData = await api.getJob(jobId);
            setJob(jobData);
            setError(null);

            const [logsResult, artifactsResult] = await Promise.allSettled([
                api.getLogs(jobId),
                api.listArtifacts(jobId),
            ]);
            if (logsResult.status === 'fulfilled') setLogs(logsResult.value.logs);
            if (artifactsResult.status === 'fulfilled') setArtifacts(artifactsResult.value);

            if (jobData.status === 'COMPLETED') {
                try {
                    const resultData = await api.getResult(jobId);
                    setSuite(resultData.result);
                    setValidation(resultData.validation);
                } catch {
                    /* result not readable yet */
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load job');
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        load();
    }, [load]);

    // The workflow changes only if the job does, and the cost breakdown is
    // worth refreshing as stages land.
    const jobWorkflow = job?.workflow;
    useEffect(() => {
        if (!jobWorkflow) return;
        api
            .workflows()
            .then((all) => setWorkflow(all.find((item) => item.id === jobWorkflow) ?? null))
            .catch(() => setWorkflow(null));
    }, [jobWorkflow]);

    const currentJobId = job?.id;
    const jobStatus = job?.status;
    useEffect(() => {
        if (!currentJobId) return;
        platformApi.jobBreakdown(currentJobId).then(setBreakdown).catch(() => setBreakdown(null));
    }, [currentJobId, jobStatus]);

    useEffect(() => {
        if (!job || !ACTIVE_STATUSES.includes(job.status)) return undefined;
        const timer = setInterval(load, 2000);
        return () => clearInterval(timer);
    }, [job, load]);

    // Until the catalog lands, guess from the job's workflow id — treating an
    // unknown workflow as bespoke drew the test-generation tabs and stages
    // over a builder run.
    const isBespoke =
        workflow?.runner === 'bespoke' || (!workflow && job?.workflow === BESPOKE_WORKFLOW_ID);

    const availableTabs = useMemo(() => {
        const tabs = [];
        if (isBespoke || job?.quality_report) {
            tabs.push({ key: 'quality', label: 'Requirement Quality', disabled: !job?.quality_report });
        }
        if (isBespoke || suite) {
            tabs.push({ key: 'results', label: 'Generated Test Cases', disabled: !suite });
        }
        if (isBespoke || job?.evaluation) {
            tabs.push({ key: 'evaluation', label: '5-D Evaluation (RQS)', disabled: !job?.evaluation });
        }
        if (!isBespoke && !suite && job?.summary && job?.status === 'COMPLETED') {
            tabs.push({ key: 'result_summary', label: 'Result Summary' });
        }
        tabs.push({ key: 'logs', label: 'Execution Logs' });
        tabs.push({ key: 'artifacts', label: 'Artifacts' });
        return tabs;
    }, [isBespoke, job, suite]);

    useEffect(() => {
        if (!tabKey && availableTabs.length > 0) {
            const firstActive = availableTabs.find((tab) => !tab.disabled);
            if (firstActive) setTabKey(firstActive.key);
        }
    }, [availableTabs, tabKey]);

    const [autoSwitched, setAutoSwitched] = useState(false);
    useEffect(() => {
        if (autoSwitched || !job) return;
        if (job.status === 'AWAITING_APPROVAL' && availableTabs.some((tab) => tab.key === 'quality')) {
            setTabKey('quality');
            setAutoSwitched(true);
        } else if (suite && availableTabs.some((tab) => tab.key === 'results')) {
            setTabKey('results');
            setAutoSwitched(true);
        } else if (
            !isBespoke &&
            job.status === 'COMPLETED' &&
            availableTabs.some((tab) => tab.key === 'result_summary')
        ) {
            setTabKey('result_summary');
            setAutoSwitched(true);
        }
    }, [job, suite, autoSwitched, isBespoke, availableTabs]);

    if (loading) return <LoadingBlock />;

    if (error || !job) {
        return (
            <div>
                <Button onClick={() => navigate('/jobs')}>
                    <ChevronLeft size={16} />
                    Back to jobs
                </Button>
                <Alert severity="error" className="mt-4">
                    {error ?? 'Job not found'}
                </Alert>
            </div>
        );
    }

    const active = ACTIVE_STATUSES.includes(job.status);

    // A reprocess is two agents — gap-closer, then the evaluator re-scoring the
    // amended suite. The gap-closer rewrites the results first, so the output
    // updates a full agent before the job is done and the run *looks* finished
    // while it is still working. One run was cancelled by hand for exactly that
    // reason, so say which pass is running and mark the output provisional.
    const reprocessing = active && job.reprocess_count > 0;
    const runningPhase = reprocessing
        ? [...(job.events ?? [])].reverse().find((event) => event.event_type === 'phase.started')?.message
        : undefined;

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1560px] pb-12">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <Button variant="outlined" size="small" className="h-9" onClick={() => navigate('/jobs')}>
                        <ChevronLeft size={16} />
                        Back to jobs
                    </Button>
                    <span className="hidden h-5 w-px bg-hairline sm:block" />
                    <h1 className="whitespace-nowrap text-xl font-medium">Job {job.id}</h1>
                    <p className="ui-body2 font-medium text-subtle">
                        • {job.workflow} • created by {job.created_by}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {/* A workflow with its own page knows how to present its result —
                        the builder installs what it generated, rather than leaving a
                        raw artifact for someone to find and interpret. This is the
                        only route back to it, so it belongs on the run, not just in
                        the Use Cases menu. */}
                    {workflow?.has_custom_ui && workflow.custom_ui_route && (
                        <Button
                            variant="contained"
                            size="small"
                            className="h-9"
                            onClick={() =>
                                navigate(`${workflow.custom_ui_route}?job=${encodeURIComponent(job.id)}`)
                            }
                        >
                            <SquareArrowOutUpRight size={15} />
                            Open in {workflow.name}
                        </Button>
                    )}
                    <Button variant="outlined" size="small" className="h-9" onClick={load}>
                        <RefreshCw size={15} />
                        Refresh
                    </Button>
                    {active && (
                        <Button
                            variant="outlined-danger"
                            size="small"
                            className="h-9"
                            onClick={async () => {
                                try {
                                    await api.cancelJob(job.id);
                                    load();
                                } catch (err) {
                                    setError(err instanceof Error ? err.message : 'Failed to cancel job');
                                }
                            }}
                        >
                            <XCircle size={15} />
                            {reprocessing ? 'Cancel reprocess' : 'Cancel'}
                        </Button>
                    )}
                </div>
            </div>

            {reprocessing && (
                <Alert severity="info" icon={<RefreshCw size={16} />} className="mb-5">
                    <p className="mb-0.5 font-medium">Reprocess in progress — these results are not final</p>
                    {runningPhase
                        ? `Currently running: ${runningPhase}. `
                        : 'The amended suite is being re-scored. '}
                    The test cases below have already been amended by the gap-closer; the evaluation updates
                    when the run finishes.
                </Alert>
            )}

            <WorkflowStepper job={job} workflow={workflow} />

            {job.error_message && (
                <Alert severity={job.status === 'TIMEOUT' ? 'warning' : 'error'} className="mb-5">
                    {job.error_message}
                </Alert>
            )}

            <div className="grid w-full min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="w-full min-w-0">
                    <Paper flat className="mb-5 overflow-hidden">
                        <Tabs
                            className="px-4"
                            value={tabKey}
                            onChange={setTabKey}
                            items={availableTabs.map((tab) => ({
                                value: tab.key,
                                label: tab.label,
                                disabled: tab.disabled,
                            }))}
                        />
                    </Paper>

                    {tabKey === 'quality' && job.quality_report && (
                        <QualityReportPanel
                            job={job}
                            report={job.quality_report}
                            onApprove={async () => {
                                await api.approveJob(job.id);
                                await load();
                            }}
                            onReject={async (reason) => {
                                await api.rejectJob(job.id, reason);
                                await load();
                            }}
                        />
                    )}

                    {tabKey === 'results' && suite && <ResultsTab suite={suite} jobId={job.id} />}

                    {tabKey === 'evaluation' && job.evaluation && (
                        <EvaluationPanel
                            job={job}
                            evaluation={job.evaluation}
                            onReprocess={async () => {
                                await api.reprocessJob(job.id);
                                await load();
                            }}
                        />
                    )}

                    {tabKey === 'result_summary' && job.summary && (
                        <Paper flat className="p-6">
                            <h2 className="ui-h6 mb-4">Result summary</h2>
                            <div className="grid gap-4">
                                {Object.entries(job.summary).map(([key, value]) => (
                                    <div key={key}>
                                        <p className="ui-caption font-medium uppercase text-subtle">
                                            {key.replace(/_/g, ' ')}
                                        </p>
                                        <p className="ui-body2 font-medium">{String(value)}</p>
                                    </div>
                                ))}
                            </div>
                        </Paper>
                    )}

                    {tabKey === 'logs' && (
                        <Paper
                            flat
                            className="custom-scrollbar w-full min-w-0 max-h-[560px] overflow-auto bg-sunken p-5"
                        >
                            <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[0.8rem] text-ink">
                                {logs || 'No logs yet.'}
                            </pre>
                        </Paper>
                    )}

                    {tabKey === 'artifacts' && (
                        <Paper flat className="w-full min-w-0 overflow-x-auto">
                            <table className="ui-table ui-table-dense w-full table-fixed">
                                <thead>
                                    <tr>
                                        <th>Artifact path</th>
                                        <th className="w-[120px] text-right">Size</th>
                                        <th className="w-[100px] text-right">Download</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {artifacts.map((artifact) => (
                                        <tr
                                            key={artifact.path}
                                            className={
                                                artifact.path === workflow?.output?.primary_artifact
                                                    ? 'bg-sunken'
                                                    : undefined
                                            }
                                        >
                                            <td className="truncate font-mono text-[0.8rem]">
                                                {artifact.path}
                                                {/* Every run writes intermediates beside its deliverable.
                                                    The workflow already declares which one it owes, so say
                                                    so rather than leaving the reader to guess from paths. */}
                                                {artifact.path === workflow?.output?.primary_artifact && (
                                                    <Chip
                                                        variant="outlined"
                                                        color="primary"
                                                        className="ml-2 h-[18px] text-[0.68rem]"
                                                    >
                                                        Result
                                                    </Chip>
                                                )}
                                            </td>
                                            <td className="text-right">{artifact.size_bytes} B</td>
                                            <td className="text-right">
                                                <a
                                                    className="ui-icon-btn ui-icon-btn-sm inline-flex"
                                                    href={api.artifactUrl(job.id, artifact.path)}
                                                    download
                                                    aria-label={`Download ${artifact.path}`}
                                                >
                                                    <Download size={15} />
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {artifacts.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center">
                                                <p className="ui-body2 text-subtle">No artifacts yet.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </Paper>
                    )}
                </div>

                <div className="w-full min-w-0">
                    <LiveJobSidePanel job={job} validation={validation} workflow={workflow} />
                    {breakdown && breakdown.stages.length > 0 && <RunCostPanel breakdown={breakdown} />}
                </div>
            </div>
        </div>
    );
}
