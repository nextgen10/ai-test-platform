import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle, Check, ChevronDown, Circle, Download, ExternalLink, Layers, Loader2,
    PackagePlus, Play, RotateCcw, ScrollText, Sparkles, X,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { cx } from '@/components/ui/cx';
import {
    Alert, Button, Chip, IconButton, LinearProgress, Paper, Skeleton, Spinner, Tooltip,
} from '@/components/ui/primitives';
import { TextArea } from '@/components/ui/inputs';
import { ACTIVE_STATUSES, api } from '@/lib/api';
import { currentToken } from '@/lib/http';
import { hubApi } from '@/lib/hub-api';
// Shared with the job-detail stepper and side panel, so every view of a run agrees.
import { derivePhases, humanise } from '@/lib/phases';
import { getSavedSettings, getSessionGithubToken } from '@/lib/settings';
import { bundleWorkflowId, installOrder, parseGeneratedFiles } from '@/lib/workflow-code';
import { alpha, getTokens } from '@/theme';
import { useThemeMode } from '@/contexts/ThemeContext';

const WORKFLOW_ID = 'workflow-builder';

/** Where the workflow declares it writes its finished document. */
const PRIMARY_ARTIFACT = 'output/workflow-code.md';

const EXAMPLES = [
    {
        label: 'Paste and summarise',
        text: 'A workflow that reads pasted page text from the job brief, has one agent clean and structure that text, and a second agent write a one-page summary with key points and open questions. (No live URL fetch — paste the page content into the brief.)',
    },
    {
        label: 'Incident post-mortem',
        text: 'A workflow that reads an incident timeline and produces a blameless post-mortem. One agent extracts the sequence of events, two agents work in parallel on contributing factors and customer impact, and a final agent merges them into a report with action items.',
    },
    {
        label: 'API contract review',
        text: 'A workflow that reviews an OpenAPI spec. One agent checks naming and versioning consistency, another checks error responses and status codes, and a reviewer merges both into a prioritised list of changes.',
    },
];

const keyOf = (file) => `${file.kind}:${file.id}`;

export default function WorkflowBuilderPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { mode } = useThemeMode();
    const tokens = getTokens(mode);

    const [workflow, setWorkflow] = useState(null);
    const [catalogReady, setCatalogReady] = useState(false);
    const [brief, setBrief] = useState('');
    const [job, setJob] = useState(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState(null);

    const [generated, setGenerated] = useState(null);
    const [files, setFiles] = useState([]);
    const [install, setInstall] = useState({});
    const [installingAll, setInstallingAll] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [showRaw, setShowRaw] = useState(false);

    // Describe the page from the registry rather than restating the workflow's
    // name and stages in a second place.
    useEffect(() => {
        api
            .workflows()
            .then((all) => setWorkflow(all.find((item) => item.id === WORKFLOW_ID) ?? null))
            .catch(() => setWorkflow(null))
            .finally(() => setCatalogReady(true));
    }, []);

    /**
     * Reopen a run from `?job=<id>`.
     *
     * The run used to live only in this component's state, so leaving the page
     * lost it: a build still in flight could not be got back to, and a finished
     * one left its generated files reachable only as a raw artifact download
     * from the run-details page.
     */
    const restored = useRef(false);
    useEffect(() => {
        if (restored.current) return;
        restored.current = true;

        const wanted = searchParams.get('job');
        if (!wanted) return;

        api
            .getJob(wanted)
            .then((loaded) => {
                if (loaded.workflow !== WORKFLOW_ID) {
                    setError(
                        `Job ${wanted} ran the ${loaded.workflow} workflow, not the builder. ` +
                            'Open it from the Jobs list instead.',
                    );
                    return;
                }
                setJob(loaded);
            })
            .catch(() => setError(`Job ${wanted} could not be loaded. It may have been deleted.`));
    }, [searchParams]);

    const running = Boolean(job && ACTIVE_STATUSES.includes(job.status));
    const finished = job?.status === 'COMPLETED';
    const failed = Boolean(job && !running && !finished);

    // ------------------------------------------------------------- polling

    const jobId = job?.id;
    useEffect(() => {
        if (!jobId || !running) return undefined;
        const timer = setInterval(() => {
            api.getJob(jobId).then(setJob).catch(() => {
                /* transient; next tick retries */
            });
        }, 2000);
        return () => clearInterval(timer);
    }, [jobId, running]);

    // Read the finished document straight from the job's artifacts. The generic
    // /result endpoint only knows about test suites, so it 404s for this
    // workflow even when the run succeeded.
    const fetchedFor = useRef(null);
    useEffect(() => {
        if (!jobId || !finished || fetchedFor.current === jobId) return undefined;
        fetchedFor.current = jobId;
        const controller = new AbortController();

        (async () => {
            try {
                const headers = {};
                const token = await currentToken();
                if (token) headers.Authorization = `Bearer ${token}`;

                const response = await fetch(api.artifactUrl(jobId, PRIMARY_ARTIFACT), {
                    signal: controller.signal,
                    headers,
                });
                if (!response.ok) {
                    throw new Error(`The run finished but ${PRIMARY_ARTIFACT} was not written.`);
                }
                const text = await response.text();
                setGenerated(text);
                const parsed = parseGeneratedFiles(text);
                setFiles(parsed);
                setInstall({});
                if (parsed.length === 0) setShowRaw(true);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError(err instanceof Error ? err.message : 'Could not read the generated files');
            }
        })();

        return () => controller.abort();
    }, [jobId, finished]);

    // ------------------------------------------------------------- actions

    const start = async () => {
        if (!brief.trim()) return;
        setStarting(true);
        setError(null);
        setGenerated(null);
        setFiles([]);
        setInstall({});
        fetchedFor.current = null;

        try {
            const saved = getSavedSettings();
            const { job_id: newJobId } = await api.createJob({
                workflow: WORKFLOW_ID,
                requirement: brief,
                engine: saved.generationEngine,
                copilot_model: saved.copilotModel || undefined,
                github_token: getSessionGithubToken() || undefined,
            });
            setJob(await api.getJob(newJobId));
            // So this build survives navigating away and can be linked to.
            setSearchParams({ job: newJobId }, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start the builder');
        } finally {
            setStarting(false);
        }
    };

    const reset = () => {
        setJob(null);
        setGenerated(null);
        setFiles([]);
        setInstall({});
        setError(null);
        fetchedFor.current = null;
        // Drop the deep link too, or a reload reopens the run just cleared.
        setSearchParams({}, { replace: true });
    };

    const editFile = (file, content) => {
        setFiles((current) =>
            current.map((item) => (keyOf(item) === keyOf(file) ? { ...item, content } : item)),
        );
        // Editing after an install means what is on disk no longer matches what
        // is on screen, so the button goes back to offering the write.
        setInstall((state) => ({ ...state, [keyOf(file)]: { phase: 'idle' } }));
    };

    /** Create one file in the Registry. `replace` turns a 409 into an update. */
    const installOne = useCallback(async (file, replace = false) => {
        const key = keyOf(file);
        setInstall((state) => ({ ...state, [key]: { phase: 'busy' } }));

        const create = {
            agent: hubApi.createAgent,
            workflow: hubApi.createWorkflow,
            skill: hubApi.createSkill,
            prompt: hubApi.createPrompt,
        }[file.kind];
        const update = {
            agent: hubApi.updateAgent,
            workflow: hubApi.updateWorkflow,
            skill: hubApi.updateSkill,
            prompt: hubApi.updatePrompt,
        }[file.kind];

        try {
            await (replace ? update : create)(file.id, file.content);
            setInstall((state) => ({ ...state, [key]: { phase: 'done', replaced: replace } }));
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not create it';
            // The API says "already exists" rather than returning a code the
            // client can branch on, so offer the overwrite instead of presenting
            // a collision as a failure.
            const collision = /already exists/i.test(message);
            setInstall((state) => ({
                ...state,
                [key]: collision ? { phase: 'exists' } : { phase: 'error', message },
            }));
            return false;
        }
    }, []);

    /**
     * Install the whole bundle.
     *
     * Sequential and in dependency order on purpose: the registry validates a
     * workflow's `agents:` list on write and refuses one naming an agent that
     * does not exist yet, so firing these off together would fail by luck of
     * timing.
     */
    const installAll = async () => {
        setInstallingAll(true);
        setError(null);
        for (const file of installOrder(files)) {
            const state = install[keyOf(file)];
            if (state?.phase === 'done') continue;
            const ok = await installOne(file);
            if (!ok) break; // a missing agent makes every later workflow write fail too
        }
        setInstallingAll(false);
    };

    const newWorkflowId = bundleWorkflowId(files);
    const installedCount = files.filter((file) => install[keyOf(file)]?.phase === 'done').length;
    const allInstalled = files.length > 0 && installedCount === files.length;
    const unavailable = workflow?.available === false;

    // --------------------------------------------------------------- stages

    const declared = workflow?.agents ?? [];
    const derived = job ? derivePhases(job, workflow) : null;
    const pipeline =
        derived && !derived.unknown
            ? derived.phases
            : declared.map((agent) => ({
                  key: agent.id,
                  label: humanise(agent.stage || agent.id),
                  hint: agent.description,
              }));

    const STAGE_ICON = {
        completed: <Check size={13} />,
        running: <Loader2 size={13} className="animate-ubs-spin" />,
        blocked: <Loader2 size={13} className="animate-ubs-spin" />,
        failed: <X size={13} />,
        skipped: <Circle size={13} />,
        pending: <Circle size={13} />,
    };

    const STAGE_COLOR = {
        completed: tokens.success,
        running: tokens.warning,
        blocked: tokens.warning,
        failed: tokens.error,
        skipped: tokens.text.disabled,
        pending: tokens.text.disabled,
    };

    return (
        <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col overflow-visible px-4 py-4 sm:px-6 md:h-full md:overflow-hidden md:px-8">
            <div className="shrink-0">
                <PageHeader
                    title={workflow?.name ?? 'Workflow Builder'}
                    subtitle={
                        workflow?.description ??
                        'Describe a multi-agent workflow in plain English and have the platform design, write and install it.'
                    }
                    actions={
                        job ? (
                            <Button variant="outlined" onClick={() => navigate(`/jobs/${job.id}`)}>
                                <ScrollText size={16} />
                                Run details
                            </Button>
                        ) : undefined
                    }
                />

                {error && (
                    <Alert
                        severity="error"
                        className="mb-4"
                        action={
                            <IconButton size="small" aria-label="Dismiss" onClick={() => setError(null)}>
                                <X size={15} />
                            </IconButton>
                        }
                    >
                        {error}
                    </Alert>
                )}

                {unavailable && (
                    <Alert severity="warning" icon={<AlertTriangle size={18} />} className="mb-4">
                        {workflow?.unavailable_reason ?? 'This workflow is currently marked unavailable.'}
                    </Alert>
                )}
            </div>

            <div
                className={cx(
                    'flex min-h-0 flex-1 flex-col',
                    generated ? 'md:overflow-auto' : 'md:overflow-hidden',
                )}
            >
                <div
                    className={cx(
                        'grid items-stretch gap-6 md:grid-cols-12',
                        generated ? 'flex-none' : 'flex-1 md:min-h-0',
                    )}
                >
                    {/* ------------------------------------------------- brief */}
                    <Paper flat className="flex min-h-0 flex-col overflow-hidden p-6 md:col-span-7 md:h-full">
                        <p className="ui-subtitle1 mb-1">What should the new workflow do?</p>
                        <p className="ui-body2 mb-4 text-subtle">
                            Describe it the way you would to a colleague: what goes in, what each step is
                            responsible for, and what should come out. The builder decides how many agents that
                            needs and which of them can run at the same time.
                        </p>

                        <div className="mb-4 flex flex-wrap gap-2">
                            <span className="ui-caption mr-1 self-center font-medium text-subtle">
                                Start from:
                            </span>
                            {EXAMPLES.map((example) => (
                                <button
                                    key={example.label}
                                    type="button"
                                    disabled={running || starting}
                                    onClick={() => setBrief(example.text)}
                                    className="ui-chip ui-chip-outlined gap-1 text-[0.74rem] font-medium disabled:opacity-50"
                                >
                                    <Sparkles size={13} />
                                    {example.label}
                                </button>
                            ))}
                        </div>

                        <TextArea
                            className="mb-4 flex flex-1 flex-col"
                            inputClassName="min-h-[160px] flex-1"
                            rows={8}
                            placeholder="A workflow that reads pasted page text, cleans it, then writes a one-page summary…"
                            value={brief}
                            disabled={running || starting}
                            onChange={(event) => setBrief(event.target.value)}
                            helperText={`${brief.trim().length} characters — the platform needs at least 20.`}
                        />

                        {(running || starting) && <LinearProgress color="warning" className="mb-4" />}

                        <div className="flex gap-3">
                            <Button
                                variant="contained"
                                size="large"
                                className="w-full"
                                disabled={running || starting || unavailable || brief.trim().length < 20}
                                onClick={start}
                            >
                                {running || starting ? (
                                    <Spinner size={18} className="text-white" />
                                ) : (
                                    <Play size={18} />
                                )}
                                {starting ? 'Starting…' : running ? 'Building…' : 'Design this workflow'}
                            </Button>
                            {job && !running && (
                                <Button variant="outlined" size="large" className="whitespace-nowrap" onClick={reset}>
                                    <RotateCcw size={16} />
                                    Start over
                                </Button>
                            )}
                        </div>
                    </Paper>

                    {/* ------------------------------------------------ stages */}
                    <Paper
                        flat
                        className="flex min-h-0 flex-col overflow-auto bg-elevated p-6 md:col-span-5 md:h-full"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <p className="ui-subtitle1">The build pipeline</p>
                            {job && (
                                <Chip
                                    color={finished ? 'success' : failed ? 'error' : 'warning'}
                                    className="text-[0.68rem] font-medium"
                                >
                                    {job.status}
                                </Chip>
                            )}
                        </div>

                        {!catalogReady && pipeline.length === 0 ? (
                            <div className="flex flex-col gap-3">
                                {[0, 1, 2, 3].map((index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <Skeleton variant="circular" width={24} height={24} />
                                        <Skeleton variant="text" width="70%" height={20} />
                                    </div>
                                ))}
                            </div>
                        ) : pipeline.length === 0 ? (
                            <p className="ui-body2 text-subtle">
                                Register <code>{WORKFLOW_ID}</code> in <code>agent-hub/workflows/</code> and its
                                stages appear here.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {pipeline.map((phase, index) => {
                                    const state = derived?.states[phase.key]?.state ?? 'pending';
                                    const detail = derived?.states[phase.key]?.detail ?? '';
                                    const color = STAGE_COLOR[state];
                                    return (
                                        <div key={phase.key} className="flex items-start gap-3">
                                            <span
                                                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                                                style={{ backgroundColor: alpha(color, 0.14), color }}
                                            >
                                                {STAGE_ICON[state]}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline gap-2">
                                                    <p className="ui-body2 font-medium">
                                                        {index + 1}. {phase.label}
                                                    </p>
                                                    {detail && (
                                                        <span className="ui-caption tabular-nums text-subtle">
                                                            {detail}
                                                        </span>
                                                    )}
                                                </div>
                                                {phase.hint && (
                                                    <p className="ui-caption block leading-snug text-subtle">
                                                        {phase.hint}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {failed && job?.error_message && (
                            <Alert severity="error" className="mt-4 text-[0.8rem]">
                                {job.error_message}
                            </Alert>
                        )}
                    </Paper>
                </div>

                {/* ------------------------------------------------------ output */}
                {generated && (
                    <Paper flat className="mt-6 shrink-0 p-6">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="ui-subtitle1">
                                    {files.length > 0
                                        ? `${files.length} file${files.length === 1 ? '' : 's'} ready to install`
                                        : 'The builder produced a document'}
                                </p>
                                <p className="ui-body2 text-subtle">
                                    {files.length > 0
                                        ? 'Review each one, edit anything you want to change, then create them in the Registry. Agents are written before the workflow that references them.'
                                        : 'No installable files were found in the output. The raw document is below.'}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <a
                                    className="ui-btn ui-btn-outlined ui-btn-sm whitespace-nowrap no-underline"
                                    href={api.artifactUrl(job.id, PRIMARY_ARTIFACT)}
                                    download
                                >
                                    <Download size={15} />
                                    Download
                                </a>
                                <Button variant="text" size="small" onClick={() => setShowRaw((value) => !value)}>
                                    {showRaw ? 'Hide raw document' : 'Show raw document'}
                                </Button>
                                {files.length > 0 && (
                                    <Button
                                        variant="contained"
                                        className="whitespace-nowrap"
                                        disabled={installingAll || allInstalled}
                                        onClick={installAll}
                                    >
                                        {installingAll ? (
                                            <Spinner size={16} className="text-white" />
                                        ) : (
                                            <PackagePlus size={16} />
                                        )}
                                        {allInstalled
                                            ? 'All installed'
                                            : installingAll
                                              ? 'Installing…'
                                              : `Install all ${files.length}`}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {allInstalled && (
                            <Alert
                                severity="success"
                                className="my-4"
                                action={
                                    newWorkflowId && (
                                        <Button
                                            size="small"
                                            className="whitespace-nowrap"
                                            onClick={() =>
                                                navigate(`/chat?workflow=${encodeURIComponent(newWorkflowId)}`)
                                            }
                                        >
                                            Run it
                                            <ExternalLink size={14} />
                                        </Button>
                                    )
                                }
                            >
                                {newWorkflowId ? (
                                    <>
                                        <strong>{newWorkflowId}</strong> is registered. It is already in the Use
                                        Cases menu and the Agent Console — nothing needs redeploying.
                                    </>
                                ) : (
                                    'Everything was created in the Registry.'
                                )}
                            </Alert>
                        )}

                        <div className="mt-4 flex flex-col gap-3">
                            {installOrder(files).map((file) => {
                                const key = keyOf(file);
                                const state = install[key] ?? { phase: 'idle' };
                                const open = expanded === key;

                                return (
                                    <Paper
                                        key={key}
                                        flat
                                        style={{
                                            borderColor:
                                                state.phase === 'done'
                                                    ? tokens.success
                                                    : state.phase === 'error'
                                                      ? tokens.error
                                                      : undefined,
                                        }}
                                    >
                                        <div className="flex flex-wrap items-center gap-3 p-3.5">
                                            <Chip
                                                color={file.kind === 'workflow' ? 'primary' : 'default'}
                                                className="min-w-[72px] justify-center text-[0.68rem] font-medium"
                                            >
                                                {file.kind}
                                            </Chip>
                                            <p className="ui-body2 min-w-[200px] flex-1 font-mono font-medium">
                                                {file.path}
                                            </p>

                                            {state.phase === 'done' && (
                                                <Chip color="success" className="gap-1 text-[0.68rem] font-medium">
                                                    <Check size={13} />
                                                    {state.replaced ? 'Replaced' : 'Created'}
                                                </Chip>
                                            )}
                                            {state.phase === 'exists' && (
                                                <Button
                                                    size="small"
                                                    variant="outlined-warning"
                                                    onClick={() => installOne(file, true)}
                                                >
                                                    Already exists — replace it
                                                </Button>
                                            )}
                                            {(state.phase === 'idle' || state.phase === 'error') && (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    disabled={installingAll}
                                                    onClick={() => installOne(file)}
                                                >
                                                    <PackagePlus size={14} />
                                                    Create
                                                </Button>
                                            )}
                                            {state.phase === 'busy' && <Spinner size={18} />}

                                            <Tooltip title={open ? 'Hide contents' : 'Show and edit contents'}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={open ? 'Hide contents' : 'Show contents'}
                                                    onClick={() => setExpanded(open ? null : key)}
                                                >
                                                    <ChevronDown
                                                        size={16}
                                                        className={cx('transition-transform', open && 'rotate-180')}
                                                    />
                                                </IconButton>
                                            </Tooltip>
                                        </div>

                                        {state.phase === 'error' && (
                                            <Alert severity="error" className="mx-3.5 mb-3.5 text-[0.8rem]">
                                                {state.message}
                                            </Alert>
                                        )}

                                        {open && (
                                            <div className="px-3.5 pb-3.5">
                                                <TextArea
                                                    rows={12}
                                                    value={file.content}
                                                    onChange={(event) => editFile(file, event.target.value)}
                                                    inputClassName="font-mono text-[0.8rem]"
                                                    helperText={
                                                        file.kind === 'workflow'
                                                            ? 'The `id` must match the filename, and every agent listed must exist before this is created.'
                                                            : 'Edited here, this is exactly what gets written to disk.'
                                                    }
                                                />
                                            </div>
                                        )}
                                    </Paper>
                                );
                            })}
                        </div>

                        {showRaw && (
                            <div className="mt-6 border-t border-hairline pt-6">
                                <p className="ui-caption mb-2 block font-medium text-subtle">{PRIMARY_ARTIFACT}</p>
                                <MarkdownRenderer content={generated} />
                            </div>
                        )}

                        {files.length > 0 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                <Button size="small" onClick={() => navigate('/registry?tab=workflows')}>
                                    <Layers size={14} />
                                    Open the Registry
                                </Button>
                                <Button size="small" onClick={() => navigate('/use-cases')}>
                                    <ExternalLink size={14} />
                                    See all use cases
                                </Button>
                            </div>
                        )}
                    </Paper>
                )}
            </div>
        </div>
    );
}
