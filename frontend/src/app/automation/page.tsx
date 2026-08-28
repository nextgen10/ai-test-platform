'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import {
    AlarmClock,
    CheckCircle2,
    Clock,
    Layers,
    Pencil,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Trash2,
    Webhook,
    XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import PageHeader from '@/components/PageHeader';
import {
    api,
    platformApi,
    formatTimestamp,
    type QueueStatus,
    type Schedule,
    type SchedulePayload,
    type WebhookDelivery,
    type Workflow,
} from '@/lib/api';

type TabKey = 'schedules' | 'webhooks' | 'queue';

const BLANK: SchedulePayload = {
    name: '',
    workflow: '',
    cron: '0 6 * * 1',
    requirement: '',
    enabled: true,
    engine: null,
};

export default function AutomationPage() {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';
    const router = useRouter();

    const [tab, setTab] = useState<TabKey>('schedules');
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [queue, setQueue] = useState<QueueStatus | null>(null);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // Editor state — one dialog serves create and edit.
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<SchedulePayload>(BLANK);
    const [preview, setPreview] = useState<{ description: string; next_runs: string[] } | null>(null);
    const [saving, setSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, d, q, w] = await Promise.all([
                platformApi.listSchedules(),
                platformApi.listDeliveries(),
                platformApi.queue(),
                api.workflows().catch(() => [] as Workflow[]),
            ]);
            setSchedules(s);
            setDeliveries(d);
            setQueue(q);
            setWorkflows(w);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load automation state');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // The queue is the one thing here that changes on its own.
    useEffect(() => {
        if (tab !== 'queue') return;
        const timer = setInterval(() => {
            platformApi.queue().then(setQueue).catch(() => undefined);
        }, 3000);
        return () => clearInterval(timer);
    }, [tab]);

    // Explain the cron expression as it is typed, so a wrong one is obvious
    // before it is saved rather than the first time it fails to fire.
    useEffect(() => {
        if (!editorOpen || !draft.cron.trim()) {
            setPreview(null);
            return;
        }
        const timer = setTimeout(() => {
            platformApi
                .previewCron(draft.cron)
                .then((p) => setPreview({ description: p.description, next_runs: p.next_runs }))
                .catch(() => setPreview(null));
        }, 350);
        return () => clearTimeout(timer);
    }, [draft.cron, editorOpen]);

    const openCreate = () => {
        setDraft({ ...BLANK, workflow: workflows[0]?.id ?? BLANK.workflow });
        setEditingId(null);
        setEditorError(null);
        setEditorOpen(true);
    };

    const openEdit = (schedule: Schedule) => {
        setDraft({
            name: schedule.name,
            workflow: schedule.workflow,
            cron: schedule.cron,
            requirement: schedule.requirement,
            enabled: schedule.enabled,
            copilot_model: schedule.copilot_model,
            engine: schedule.engine,
            webhook_url: schedule.webhook_url,
        });
        setEditingId(schedule.id);
        setEditorError(null);
        setEditorOpen(true);
    };

    const save = async () => {
        if (!draft.name.trim() || draft.requirement.trim().length < 20) {
            setEditorError('A name and a requirement of at least 20 characters are needed.');
            return;
        }
        setSaving(true);
        setEditorError(null);
        try {
            if (editingId) await platformApi.updateSchedule(editingId, draft);
            else await platformApi.createSchedule(draft);
            setEditorOpen(false);
            await load();
        } catch (e) {
            setEditorError(e instanceof Error ? e.message : 'Could not save the schedule');
        } finally {
            setSaving(false);
        }
    };

    const runNow = async (schedule: Schedule) => {
        try {
            const { job_id } = await platformApi.runSchedule(schedule.id);
            setNotice(`Started "${schedule.name}" — opening the job.`);
            router.push(`/jobs/${job_id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not run that schedule');
        }
    };

    const remove = async () => {
        if (!deleteTarget) return;
        try {
            await platformApi.deleteSchedule(deleteTarget.id);
            setDeleteTarget(null);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete that schedule');
            setDeleteTarget(null);
        }
    };

    const retry = async (delivery: WebhookDelivery) => {
        try {
            await platformApi.retryDelivery(delivery.id);
            setDeliveries(await platformApi.listDeliveries());
            setNotice('Queued for another delivery attempt.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not retry that delivery');
        }
    };

    const statusChip = (status: WebhookDelivery['status']) => {
        if (status === 'delivered')
            return <Chip size="small" color="success" icon={<CheckCircle2 size={12} />} label="delivered" />;
        if (status === 'failed')
            return <Chip size="small" color="error" icon={<XCircle size={12} />} label="failed" />;
        return <Chip size="small" icon={<Clock size={12} />} label="pending" />;
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
            <PageHeader
                title="Automation"
                subtitle="Scheduled runs, webhook deliveries, and what the work queue is doing."
                actions={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Reload">
                            <span>
                                <IconButton onClick={load} disabled={loading}
                                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                    <RefreshCw size={16} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}
                            sx={{ fontWeight: 700, borderRadius: 2 }}>
                            New schedule
                        </Button>
                    </Box>
                }
            />

            {error && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
            {notice && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setNotice(null)}>
                    {notice}
                </Alert>
            )}

            {/* Queue summary, always visible: it is the thing most likely to be wrong. */}
            <Grid container spacing={2} sx={{ mt: 1 }}>
                {[
                    { label: 'Waiting', value: queue?.waiting, icon: <Layers size={16} /> },
                    { label: 'In flight', value: queue?.in_flight, icon: <Play size={16} /> },
                    { label: 'Active workers', value: queue?.active_workers, icon: <AlarmClock size={16} /> },
                    { label: 'Schedules', value: schedules.filter((s) => s.enabled).length, icon: <Clock size={16} /> },
                ].map((tile) => (
                    <Grid size={{ xs: 6, md: 3 }} key={tile.label}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', mb: 0.5 }}>
                                {tile.icon}
                                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {tile.label}
                                </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                                {loading && tile.value === undefined ? <Skeleton width={40} /> : (tile.value ?? '—')}
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <Paper variant="outlined" sx={{ mt: 3, borderRadius: 2.5, overflow: 'hidden' }}>
                <Tabs
                    value={tab}
                    onChange={(_, v: TabKey) => setTab(v)}
                    sx={{ px: 1, borderBottom: '1px solid', borderColor: 'divider',
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.86rem' } }}
                >
                    <Tab value="schedules" label={`Schedules (${schedules.length})`} icon={<Clock size={15} />} iconPosition="start" />
                    <Tab value="webhooks" label={`Webhooks (${deliveries.length})`} icon={<Webhook size={15} />} iconPosition="start" />
                    <Tab value="queue" label="Queue" icon={<Layers size={15} />} iconPosition="start" />
                </Tabs>

                {/* ---------------------------------------------------- schedules */}
                {tab === 'schedules' && (
                    <Box sx={{ overflowX: 'auto' }}>
                        {loading ? (
                            <Box sx={{ p: 3 }}><Skeleton height={120} /></Box>
                        ) : schedules.length === 0 ? (
                            <Box sx={{ p: 6, textAlign: 'center' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    No schedules yet
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                    A schedule runs a workflow on a cron expression, without anyone opening the app.
                                </Typography>
                                <Button variant="contained" startIcon={<Plus size={15} />} onClick={openCreate}>
                                    Create one
                                </Button>
                            </Box>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Workflow</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Next run</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Runs</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {schedules.map((schedule) => (
                                        <TableRow key={schedule.id} hover sx={{ opacity: schedule.enabled ? 1 : 0.55 }}>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                    {schedule.name}
                                                </Typography>
                                                {!schedule.enabled && (
                                                    <Chip label="paused" size="small" sx={{ height: 16, fontSize: '0.62rem', mt: 0.25 }} />
                                                )}
                                                {schedule.last_error && (
                                                    <Tooltip title={schedule.last_error}>
                                                        <Chip label="last run errored" color="error" size="small"
                                                            sx={{ height: 16, fontSize: '0.62rem', mt: 0.25, ml: 0.5 }} />
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={schedule.workflow} size="small" variant="outlined"
                                                    sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }} />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                                    {schedule.cron_description}
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>
                                                    {schedule.cron}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.78rem' }}>
                                                {schedule.enabled ? formatTimestamp(schedule.next_run_at) : '—'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {schedule.last_job_id ? (
                                                    <Button size="small" sx={{ minWidth: 0, textTransform: 'none' }}
                                                        onClick={() => router.push(`/jobs/${schedule.last_job_id}`)}>
                                                        {schedule.run_count}
                                                    </Button>
                                                ) : (
                                                    schedule.run_count
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Run now">
                                                    <IconButton size="small" onClick={() => runNow(schedule)}>
                                                        <Play size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => openEdit(schedule)}>
                                                        <Pencil size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => setDeleteTarget(schedule)}>
                                                        <Trash2 size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                )}

                {/* ----------------------------------------------------- webhooks */}
                {tab === 'webhooks' && (
                    <Box sx={{ overflowX: 'auto' }}>
                        {deliveries.length === 0 ? (
                            <Box sx={{ p: 6, textAlign: 'center' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    No deliveries yet
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Submit a job with a <code>webhook_url</code> and its outcome is POSTed there
                                    when the job finishes. Every attempt is recorded here, so a failing endpoint
                                    is visible rather than silent.
                                </Typography>
                            </Box>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Job</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Endpoint</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Attempts</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Last result</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {deliveries.map((delivery) => (
                                        <TableRow key={delivery.id} hover>
                                            <TableCell>{statusChip(delivery.status)}</TableCell>
                                            <TableCell>
                                                <Button size="small" sx={{ textTransform: 'none', fontFamily: 'monospace', fontSize: '0.75rem' }}
                                                    onClick={() => router.push(`/jobs/${delivery.job_id}`)}>
                                                    {delivery.job_id}
                                                </Button>
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 280 }}>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }} noWrap component="div">
                                                    {delivery.url}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {delivery.attempts}
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 240 }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
                                                    {delivery.error ?? (delivery.response_status ? `HTTP ${delivery.response_status}` : '—')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                {delivery.status === 'failed' && (
                                                    <Tooltip title="Try again — after fixing the receiving end">
                                                        <IconButton size="small" onClick={() => retry(delivery)}>
                                                            <RotateCcw size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                )}

                {/* -------------------------------------------------------- queue */}
                {tab === 'queue' && queue && (
                    <Box sx={{ p: 3 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, maxWidth: '68ch' }}>
                            Jobs are rows that any worker may claim. A claim is exclusive and expires, so a
                            worker that stops responding returns its job to the queue rather than losing it —
                            which is what lets more than one replica run.
                        </Typography>

                        <Grid container spacing={2}>
                            {[
                                ['This worker', queue.worker_id],
                                ['Lease', `${queue.lease_seconds}s`],
                                ['Concurrency', `${queue.concurrency} job(s) at once`],
                                ['Retry budget', `${queue.max_attempts} attempt(s)`],
                            ].map(([label, value]) => (
                                <Grid size={{ xs: 12, sm: 6 }} key={label}>
                                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: isLight ? '#f8fafc' : alpha(theme.palette.common.white, 0.03) }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                            {label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.25 }}>
                                            {value}
                                        </Typography>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}
            </Paper>

            {/* ------------------------------------------------------- editor */}
            <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md" fullWidth
                PaperProps={{ sx: { borderRadius: 2.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {editingId ? 'Edit schedule' : 'New schedule'}
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {editorError && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{editorError}</Alert>
                    )}

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 7 }}>
                            <TextField fullWidth label="Name" value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                            <FormControl fullWidth>
                                <InputLabel id="wf-label">Workflow</InputLabel>
                                <Select labelId="wf-label" label="Workflow" value={draft.workflow}
                                    onChange={(e) => setDraft({ ...draft, workflow: e.target.value })}>
                                    {workflows.map((w) => (
                                        <MenuItem key={w.id} value={w.id} disabled={w.available === false}>
                                            {w.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 5 }}>
                            <TextField fullWidth label="Cron (UTC)" value={draft.cron}
                                onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
                                InputProps={{ sx: { fontFamily: 'monospace' } }}
                                helperText="minute hour day month weekday — or @daily, @weekly" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 7 }}>
                            <Box sx={{ p: 1.5, borderRadius: 2, height: '100%',
                                bgcolor: isLight ? '#f8fafc' : alpha(theme.palette.common.white, 0.03) }}>
                                {preview ? (
                                    <>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {preview.description}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                            Next: {preview.next_runs.slice(0, 3).map((r) => formatTimestamp(r)).join(' · ')}
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                        {draft.cron.trim() ? 'Not a valid cron expression.' : 'Enter a cron expression.'}
                                    </Typography>
                                )}
                            </Box>
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField fullWidth multiline minRows={6} maxRows={12}
                                label="Input for every run" value={draft.requirement}
                                onChange={(e) => setDraft({ ...draft, requirement: e.target.value })}
                                InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.82rem' } }} />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField fullWidth label="Webhook URL (optional)" value={draft.webhook_url ?? ''}
                                onChange={(e) => setDraft({ ...draft, webhook_url: e.target.value || null })}
                                helperText="POSTed a summary when each run finishes" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <FormControl fullWidth>
                                <InputLabel id="eng-label">Engine</InputLabel>
                                <Select labelId="eng-label" label="Engine" value={draft.engine ?? ''}
                                    onChange={(e) => setDraft({ ...draft, engine: e.target.value || null })}>
                                    <MenuItem value=""><em>Platform default</em></MenuItem>
                                    <MenuItem value="copilot">Copilot</MenuItem>
                                    <MenuItem value="mock">Mock</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <FormControlLabel
                                sx={{ height: '100%' }}
                                control={
                                    <Switch checked={draft.enabled ?? true}
                                        onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                                }
                                label="Enabled"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setEditorOpen(false)} color="inherit">Cancel</Button>
                    <Button variant="contained" onClick={save} disabled={saving || !preview}
                        startIcon={saving ? <CircularProgress size={15} color="inherit" /> : undefined}
                        sx={{ fontWeight: 700 }}>
                        {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Delete this schedule?</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '0.9rem' }}>
                        <strong>{deleteTarget?.name}</strong> will stop running. Jobs it already created are
                        not affected.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteTarget(null)} color="inherit">Cancel</Button>
                    <Button onClick={remove} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
