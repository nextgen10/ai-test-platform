'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    Grid,
    IconButton,
    LinearProgress,
    Paper,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import {
    AlertTriangle,
    Bot,
    Check,
    ChevronDown,
    Circle,
    Download,
    ExternalLink,
    Layers,
    Loader2,
    PackagePlus,
    Play,
    RotateCcw,
    ScrollText,
    Sparkles,
    X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import PageHeader from '@/components/PageHeader';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import {
    ACTIVE_STATUSES,
    api,
    formatDuration,
    type Job,
    type StageRecord,
    type Workflow,
} from '@/lib/api';
import { hubApi } from '@/lib/hub-api';
import { getSavedSettings, getSessionGithubToken } from '@/lib/settings';
import {
    bundleWorkflowId,
    installOrder,
    parseGeneratedFiles,
    type GeneratedFile,
} from '@/lib/workflow-code';

const WORKFLOW_ID = 'workflow-builder';

/** Where the workflow declares it writes its finished document. */
const PRIMARY_ARTIFACT = 'output/workflow-code.md';

const EXAMPLES = [
    {
        label: 'Scrape and summarise',
        text: 'A workflow that takes a URL, has one agent fetch and clean the page text, and a second agent write a one-page summary with key points and open questions.',
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

/** What each install attempt did, keyed by `kind:id`. */
type InstallState =
    | { phase: 'idle' }
    | { phase: 'busy' }
    | { phase: 'done'; replaced: boolean }
    | { phase: 'exists' }
    | { phase: 'error'; message: string };

export default function WorkflowBuilderPage() {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';
    const router = useRouter();

    const [workflow, setWorkflow] = useState<Workflow | null>(null);
    const [brief, setBrief] = useState('');
    const [job, setJob] = useState<Job | null>(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [generated, setGenerated] = useState<string | null>(null);
    const [files, setFiles] = useState<GeneratedFile[]>([]);
    const [install, setInstall] = useState<Record<string, InstallState>>({});
    const [installingAll, setInstallingAll] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    // Describe the page from the registry rather than restating the workflow's
    // name and stages in a second place.
    useEffect(() => {
        api.workflows()
            .then((all) => setWorkflow(all.find((w) => w.id === WORKFLOW_ID) ?? null))
            .catch(() => setWorkflow(null));
    }, []);

    const running = Boolean(job && ACTIVE_STATUSES.includes(job.status));
    const finished = job?.status === 'COMPLETED';
    const failed = Boolean(job && !running && !finished);

    // ------------------------------------------------------------- polling

    const jobId = job?.id;
    useEffect(() => {
        if (!jobId || !running) return;
        const timer = setInterval(() => {
            api.getJob(jobId).then(setJob).catch(() => { /* transient; next tick retries */ });
        }, 2000);
        return () => clearInterval(timer);
    }, [jobId, running]);

    // Read the finished document straight from the job's artifacts. The generic
    // /result endpoint only knows about test suites, so it 404s for this
    // workflow even when the run succeeded.
    const fetchedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!jobId || !finished || fetchedFor.current === jobId) return;
        fetchedFor.current = jobId;

        fetch(api.artifactUrl(jobId, PRIMARY_ARTIFACT))
            .then((r) => {
                if (!r.ok) throw new Error(`The run finished but ${PRIMARY_ARTIFACT} was not written.`);
                return r.text();
            })
            .then((text) => {
                setGenerated(text);
                const parsed = parseGeneratedFiles(text);
                setFiles(parsed);
                setInstall({});
                if (parsed.length === 0) setShowRaw(true);
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not read the generated files'));
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
            const { job_id } = await api.createJob({
                workflow: WORKFLOW_ID,
                requirement: brief,
                engine: saved.generationEngine,
                copilot_model: saved.copilotModel || undefined,
                github_token: getSessionGithubToken() || undefined,
            });
            setJob(await api.getJob(job_id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not start the builder');
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
    };

    const keyOf = (file: GeneratedFile) => `${file.kind}:${file.id}`;

    const editFile = (file: GeneratedFile, content: string) => {
        setFiles((current) =>
            current.map((f) => (keyOf(f) === keyOf(file) ? { ...f, content } : f)),
        );
        // Editing after an install means what is on disk no longer matches what
        // is on screen, so the button goes back to offering the write.
        setInstall((s) => ({ ...s, [keyOf(file)]: { phase: 'idle' } }));
    };

    /** Create one file in the Registry. `replace` turns a 409 into an update. */
    const installOne = useCallback(
        async (file: GeneratedFile, replace = false): Promise<boolean> => {
            const key = keyOf(file);
            setInstall((s) => ({ ...s, [key]: { phase: 'busy' } }));

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
                setInstall((s) => ({ ...s, [key]: { phase: 'done', replaced: replace } }));
                return true;
            } catch (e) {
                const message = e instanceof Error ? e.message : 'Could not create it';
                // The API says "already exists" rather than returning a code the
                // client can branch on, so offer the overwrite instead of
                // presenting a collision as a failure.
                const collision = /already exists/i.test(message);
                setInstall((s) => ({
                    ...s,
                    [key]: collision ? { phase: 'exists' } : { phase: 'error', message },
                }));
                return false;
            }
        },
        [],
    );

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
    const installedCount = files.filter((f) => install[keyOf(f)]?.phase === 'done').length;
    const allInstalled = files.length > 0 && installedCount === files.length;
    const unavailable = workflow?.available === false;

    // --------------------------------------------------------------- stages

    const declared = workflow?.agents ?? [];
    const recorded: StageRecord[] = job?.provenance?.stages ?? [];

    const stageState = (stage: string): 'pending' | 'active' | 'completed' | 'failed' | 'skipped' => {
        const record = recorded.find((r) => r.stage === stage);
        if (record?.status === 'completed') return 'completed';
        if (record?.status === 'failed') return 'failed';
        if (record?.status === 'skipped') return 'skipped';
        if (!running) return failed ? 'failed' : 'pending';
        // The runner only writes its record at the end, so mid-run the active
        // stage is the first one with nothing recorded against it.
        const firstUnrecorded = declared.find((a) => !recorded.some((r) => r.stage === a.stage));
        return firstUnrecorded?.stage === stage ? 'active' : 'pending';
    };

    const STAGE_ICON = {
        completed: <Check size={13} />,
        active: <Loader2 size={13} className="spin" />,
        failed: <X size={13} />,
        skipped: <Circle size={13} />,
        pending: <Circle size={13} />,
    } as const;

    const STAGE_COLOR = {
        completed: theme.palette.success.main,
        active: theme.palette.primary.main,
        failed: theme.palette.error.main,
        skipped: theme.palette.text.disabled,
        pending: theme.palette.text.disabled,
    } as const;

    // ----------------------------------------------------------------- view

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
            <style>{`
                @keyframes wb-spin { to { transform: rotate(360deg); } }
                .spin { animation: wb-spin 1s linear infinite; }
                @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
            `}</style>

            <PageHeader
                title={workflow?.name ?? 'Workflow Builder'}
                subtitle={
                    workflow?.description ??
                    'Describe a multi-agent workflow in plain English and have the platform design, write and install it.'
                }
                actions={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {job && (
                            <Button
                                variant="outlined"
                                startIcon={<ScrollText size={16} />}
                                onClick={() => router.push(`/jobs/${job.id}`)}
                            >
                                Run details
                            </Button>
                        )}
                        <Button
                            variant="outlined"
                            startIcon={<Bot size={16} />}
                            onClick={() => router.push(`/chat?workflow=${encodeURIComponent(WORKFLOW_ID)}`)}
                        >
                            Open in Agent Console
                        </Button>
                    </Box>
                }
            />

            {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {unavailable && (
                <Alert severity="warning" icon={<AlertTriangle size={18} />} sx={{ mb: 2, borderRadius: 2 }}>
                    {workflow?.unavailable_reason ?? 'This workflow is currently marked unavailable.'}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* ------------------------------------------------- brief */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper
                        elevation={0}
                        sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                            What should the new workflow do?
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Describe it the way you would to a colleague: what goes in, what each step
                            is responsible for, and what should come out. The builder decides how many
                            agents that needs and which of them can run at the same time.
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', alignSelf: 'center', mr: 0.5 }}>
                                Start from:
                            </Typography>
                            {EXAMPLES.map((example) => (
                                <Chip
                                    key={example.label}
                                    label={example.label}
                                    size="small"
                                    variant="outlined"
                                    clickable
                                    disabled={running || starting}
                                    onClick={() => setBrief(example.text)}
                                    icon={<Sparkles size={13} />}
                                    sx={{ fontWeight: 600, fontSize: '0.74rem' }}
                                />
                            ))}
                        </Box>

                        <TextField
                            multiline
                            minRows={9}
                            maxRows={20}
                            fullWidth
                            placeholder="A workflow that takes a URL, has one agent fetch and clean the page text, and a second agent write a one-page summary…"
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            disabled={running || starting}
                            helperText={`${brief.trim().length} characters — the platform needs at least 20.`}
                            sx={{ mb: 2 }}
                        />

                        {(running || starting) && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={
                                    running || starting
                                        ? <CircularProgress size={18} color="inherit" />
                                        : <Play size={18} />
                                }
                                disabled={
                                    running || starting || unavailable || brief.trim().length < 20
                                }
                                onClick={start}
                                sx={{ fontWeight: 800, py: 1.25, borderRadius: 2 }}
                            >
                                {starting ? 'Starting…' : running ? 'Building…' : 'Design this workflow'}
                            </Button>
                            {job && !running && (
                                <Button
                                    variant="outlined"
                                    size="large"
                                    startIcon={<RotateCcw size={16} />}
                                    onClick={reset}
                                    sx={{ fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
                                >
                                    Start over
                                </Button>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* ------------------------------------------------ stages */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%',
                            bgcolor: isLight ? '#f8fafc' : '#11161d',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                The build pipeline
                            </Typography>
                            {job && (
                                <Chip
                                    size="small"
                                    label={job.status}
                                    color={finished ? 'success' : failed ? 'error' : 'primary'}
                                    sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                                />
                            )}
                        </Box>

                        {declared.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                Register <code>{WORKFLOW_ID}</code> in <code>agent-hub/workflows/</code>{' '}
                                and its stages appear here.
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                                {declared.map((agent, index) => {
                                    const state = stageState(agent.stage);
                                    const record = recorded.find((r) => r.stage === agent.stage);
                                    const color = STAGE_COLOR[state];
                                    return (
                                        <Box key={agent.stage} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                            <Box
                                                sx={{
                                                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                                    display: 'grid', placeItems: 'center', mt: 0.25,
                                                    bgcolor: alpha(color, 0.14), color,
                                                }}
                                            >
                                                {STAGE_ICON[state]}
                                            </Box>
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                        {index + 1}. {agent.stage}
                                                    </Typography>
                                                    {record?.duration_ms != null && (
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                                                            {formatDuration(record.duration_ms)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}>
                                                    {agent.description ?? agent.id}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}

                        {failed && job?.error_message && (
                            <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: '0.8rem' }}>
                                {job.error_message}
                            </Alert>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* ------------------------------------------------------ output */}
            {generated && (
                <Paper
                    elevation={0}
                    sx={{ mt: 3, p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {files.length > 0
                                    ? `${files.length} file${files.length === 1 ? '' : 's'} ready to install`
                                    : 'The builder produced a document'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {files.length > 0
                                    ? 'Review each one, edit anything you want to change, then create them in the Registry. Agents are written before the workflow that references them.'
                                    : 'No installable files were found in the output. The raw document is below.'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Download size={15} />}
                                href={api.artifactUrl(job!.id, PRIMARY_ARTIFACT)}
                                sx={{ fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
                            >
                                Download
                            </Button>
                            <Button
                                size="small"
                                variant="text"
                                onClick={() => setShowRaw((v) => !v)}
                                sx={{ fontWeight: 700, textTransform: 'none' }}
                            >
                                {showRaw ? 'Hide raw document' : 'Show raw document'}
                            </Button>
                            {files.length > 0 && (
                                <Button
                                    variant="contained"
                                    startIcon={
                                        installingAll
                                            ? <CircularProgress size={16} color="inherit" />
                                            : <PackagePlus size={16} />
                                    }
                                    disabled={installingAll || allInstalled}
                                    onClick={installAll}
                                    sx={{ fontWeight: 800, borderRadius: 2, whiteSpace: 'nowrap' }}
                                >
                                    {allInstalled
                                        ? 'All installed'
                                        : installingAll
                                            ? 'Installing…'
                                            : `Install all ${files.length}`}
                                </Button>
                            )}
                        </Box>
                    </Box>

                    {allInstalled && (
                        <Alert
                            severity="success"
                            sx={{ my: 2, borderRadius: 2 }}
                            action={
                                newWorkflowId && (
                                    <Button
                                        size="small"
                                        endIcon={<ExternalLink size={14} />}
                                        onClick={() => router.push(`/chat?workflow=${encodeURIComponent(newWorkflowId)}`)}
                                        sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                                    >
                                        Run it
                                    </Button>
                                )
                            }
                        >
                            {newWorkflowId ? (
                                <>
                                    <strong>{newWorkflowId}</strong> is registered. It is already in the
                                    Use Cases menu and the Agent Console — nothing needs redeploying.
                                </>
                            ) : (
                                'Everything was created in the Registry.'
                            )}
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 2 }}>
                        {installOrder(files).map((file) => {
                            const key = `${file.kind}:${file.id}`;
                            const state = install[key] ?? { phase: 'idle' as const };
                            const open = expanded === key;

                            return (
                                <Paper
                                    key={key}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 2,
                                        borderColor: state.phase === 'done'
                                            ? theme.palette.success.main
                                            : state.phase === 'error'
                                                ? theme.palette.error.main
                                                : 'divider',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, flexWrap: 'wrap' }}>
                                        <Chip
                                            label={file.kind}
                                            size="small"
                                            color={file.kind === 'workflow' ? 'primary' : 'default'}
                                            sx={{ fontWeight: 700, fontSize: '0.68rem', minWidth: 72 }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{ fontFamily: 'monospace', fontWeight: 600, flex: 1, minWidth: 200 }}
                                        >
                                            {file.path}
                                        </Typography>

                                        {state.phase === 'done' && (
                                            <Chip
                                                size="small" color="success" icon={<Check size={13} />}
                                                label={state.replaced ? 'Replaced' : 'Created'}
                                                sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                                            />
                                        )}
                                        {state.phase === 'exists' && (
                                            <Button
                                                size="small" variant="outlined" color="warning"
                                                onClick={() => installOne(file, true)}
                                                sx={{ fontWeight: 700, textTransform: 'none' }}
                                            >
                                                Already exists — replace it
                                            </Button>
                                        )}
                                        {(state.phase === 'idle' || state.phase === 'error') && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<PackagePlus size={14} />}
                                                disabled={installingAll}
                                                onClick={() => installOne(file)}
                                                sx={{ fontWeight: 700, textTransform: 'none' }}
                                            >
                                                Create
                                            </Button>
                                        )}
                                        {state.phase === 'busy' && <CircularProgress size={18} />}

                                        <Tooltip title={open ? 'Hide contents' : 'Show and edit contents'}>
                                            <IconButton size="small" onClick={() => setExpanded(open ? null : key)}>
                                                <ChevronDown
                                                    size={16}
                                                    style={{
                                                        transform: open ? 'rotate(180deg)' : 'none',
                                                        transition: 'transform .2s',
                                                    }}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>

                                    {state.phase === 'error' && (
                                        <Alert severity="error" sx={{ mx: 1.75, mb: 1.75, borderRadius: 1.5, fontSize: '0.8rem' }}>
                                            {state.message}
                                        </Alert>
                                    )}

                                    <Collapse in={open} unmountOnExit>
                                        <Box sx={{ px: 1.75, pb: 1.75 }}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                minRows={8}
                                                maxRows={28}
                                                value={file.content}
                                                onChange={(e) => editFile(file, e.target.value)}
                                                InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                                                helperText={
                                                    file.kind === 'workflow'
                                                        ? 'The `id` must match the filename, and every agent listed must exist before this is created.'
                                                        : 'Edited here, this is exactly what gets written to disk.'
                                                }
                                            />
                                        </Box>
                                    </Collapse>
                                </Paper>
                            );
                        })}
                    </Box>

                    <Collapse in={showRaw} unmountOnExit>
                        <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                                {PRIMARY_ARTIFACT}
                            </Typography>
                            <MarkdownRenderer content={generated} />
                        </Box>
                    </Collapse>

                    {files.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 2.5, flexWrap: 'wrap' }}>
                            <Button
                                size="small"
                                startIcon={<Layers size={14} />}
                                onClick={() => router.push('/registry?tab=workflows')}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                                Open the Registry
                            </Button>
                            <Button
                                size="small"
                                startIcon={<ExternalLink size={14} />}
                                onClick={() => router.push('/use-cases')}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                                See all use cases
                            </Button>
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    );
}
