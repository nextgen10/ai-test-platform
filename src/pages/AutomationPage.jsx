import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlarmClock, CheckCircle2, Clock, Layers, Pencil, Play, Plus, RefreshCw, RotateCcw, Trash2,
    Webhook, X, XCircle,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { cx } from '@/components/ui/cx';
import { Alert, Button, Chip, IconButton, Paper, Skeleton, Spinner, Tooltip } from '@/components/ui/primitives';
import { Select, Switch, TextArea, TextField } from '@/components/ui/inputs';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { Tabs } from '@/components/ui/tabs';
import { api, formatTimestamp, platformApi } from '@/lib/api';

const BLANK = {
    name: '',
    workflow: '',
    cron: '0 6 * * 1',
    requirement: '',
    enabled: true,
    engine: null,
};

export default function AutomationPage() {
    const navigate = useNavigate();

    const [tab, setTab] = useState('schedules');
    const [schedules, setSchedules] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [queue, setQueue] = useState(null);
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Editor state — one dialog serves create and edit.
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(BLANK);
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editorError, setEditorError] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [scheduleList, deliveryList, queueState, workflowList] = await Promise.all([
                platformApi.listSchedules(),
                platformApi.listDeliveries(),
                platformApi.queue(),
                api.workflows().catch(() => []),
            ]);
            setSchedules(scheduleList);
            setDeliveries(deliveryList);
            setQueue(queueState);
            setWorkflows(workflowList);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load automation state');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // The queue is the one thing here that changes on its own.
    useEffect(() => {
        if (tab !== 'queue') return undefined;
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
            return undefined;
        }
        const timer = setTimeout(() => {
            platformApi
                .previewCron(draft.cron)
                .then((result) => setPreview({ description: result.description, next_runs: result.next_runs }))
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

    const openEdit = (schedule) => {
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
        } catch (err) {
            setEditorError(err instanceof Error ? err.message : 'Could not save the schedule');
        } finally {
            setSaving(false);
        }
    };

    const runNow = async (schedule) => {
        try {
            const { job_id: jobId } = await platformApi.runSchedule(schedule.id);
            setNotice(`Started "${schedule.name}" — opening the job.`);
            navigate(`/jobs/${jobId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not run that schedule');
        }
    };

    const remove = async () => {
        if (!deleteTarget) return;
        try {
            await platformApi.deleteSchedule(deleteTarget.id);
            setDeleteTarget(null);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete that schedule');
            setDeleteTarget(null);
        }
    };

    const retry = async (delivery) => {
        try {
            await platformApi.retryDelivery(delivery.id);
            setDeliveries(await platformApi.listDeliveries());
            setNotice('Queued for another delivery attempt.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not retry that delivery');
        }
    };

    const statusChip = (status) => {
        if (status === 'delivered') {
            return (
                <Chip color="success" className="gap-1">
                    <CheckCircle2 size={12} />
                    delivered
                </Chip>
            );
        }
        if (status === 'failed') {
            return (
                <Chip color="error" className="gap-1">
                    <XCircle size={12} />
                    failed
                </Chip>
            );
        }
        return (
            <Chip className="gap-1">
                <Clock size={12} />
                pending
            </Chip>
        );
    };

    const dismiss = (clear) => (
        <IconButton size="small" aria-label="Dismiss" onClick={clear}>
            <X size={15} />
        </IconButton>
    );

    return (
        <div className="mx-auto w-full max-w-[1200px] py-2">
            <PageHeader
                title="Automation"
                subtitle="Scheduled runs, webhook deliveries, and what the work queue is doing."
                actions={
                    <div className="flex gap-2">
                        <Tooltip title="Reload">
                            <IconButton
                                className="border border-hairline"
                                aria-label="Reload"
                                onClick={load}
                                disabled={loading}
                            >
                                <RefreshCw size={16} />
                            </IconButton>
                        </Tooltip>
                        <Button variant="contained" onClick={openCreate}>
                            <Plus size={16} />
                            New schedule
                        </Button>
                    </div>
                }
            />

            {error && (
                <Alert severity="error" className="mt-4" action={dismiss(() => setError(null))}>
                    {error}
                </Alert>
            )}
            {notice && (
                <Alert severity="info" className="mt-4" action={dismiss(() => setNotice(null))}>
                    {notice}
                </Alert>
            )}

            {/* Queue summary, always visible: it is the thing most likely to be wrong. */}
            <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    { label: 'Waiting', value: queue?.waiting, icon: <Layers size={16} /> },
                    { label: 'In flight', value: queue?.in_flight, icon: <Play size={16} /> },
                    { label: 'Active workers', value: queue?.active_workers, icon: <AlarmClock size={16} /> },
                    {
                        label: 'Schedules',
                        value: schedules.filter((schedule) => schedule.enabled).length,
                        icon: <Clock size={16} />,
                    },
                ].map((tile) => (
                    <Paper key={tile.label} flat className="p-4">
                        <div className="mb-1 flex items-center gap-1.5 text-subtle">
                            {tile.icon}
                            <span className="ui-caption font-medium uppercase tracking-[0.05em]">{tile.label}</span>
                        </div>
                        <p className="text-xl font-medium tabular-nums">
                            {loading && tile.value === undefined ? <Skeleton width={40} /> : (tile.value ?? '—')}
                        </p>
                    </Paper>
                ))}
            </div>

            <Paper flat className="mt-6 overflow-hidden">
                <Tabs
                    className="px-2"
                    value={tab}
                    onChange={setTab}
                    items={[
                        { value: 'schedules', label: `Schedules (${schedules.length})`, icon: <Clock size={15} /> },
                        { value: 'webhooks', label: `Webhooks (${deliveries.length})`, icon: <Webhook size={15} /> },
                        { value: 'queue', label: 'Queue', icon: <Layers size={15} /> },
                    ]}
                />

                {/* ---------------------------------------------------- schedules */}
                {tab === 'schedules' && (
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-6">
                                <Skeleton variant="rect" height={120} />
                            </div>
                        ) : schedules.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="ui-subtitle1 mb-1">No schedules yet</p>
                                <p className="ui-body2 mb-4 text-subtle">
                                    A schedule runs a workflow on a cron expression, without anyone opening the app.
                                </p>
                                <Button variant="contained" onClick={openCreate}>
                                    <Plus size={15} />
                                    Create one
                                </Button>
                            </div>
                        ) : (
                            <table className="ui-table ui-table-dense">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Workflow</th>
                                        <th>When</th>
                                        <th>Next run</th>
                                        <th className="text-right">Runs</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedules.map((schedule) => (
                                        <tr key={schedule.id} className={cx(!schedule.enabled && 'opacity-55')}>
                                            <td>
                                                <p className="ui-body2 font-medium">{schedule.name}</p>
                                                <div className="mt-0.5 flex flex-wrap gap-1">
                                                    {!schedule.enabled && (
                                                        <Chip className="h-4 text-[0.62rem]">paused</Chip>
                                                    )}
                                                    {schedule.last_error && (
                                                        <Tooltip title={schedule.last_error}>
                                                            <Chip color="error" className="h-4 text-[0.62rem]">
                                                                last run errored
                                                            </Chip>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <Chip variant="outlined" className="font-mono text-[0.7rem]">
                                                    {schedule.workflow}
                                                </Chip>
                                            </td>
                                            <td>
                                                <p className="text-[0.8rem]">{schedule.cron_description}</p>
                                                <p className="ui-caption font-mono text-faint">{schedule.cron}</p>
                                            </td>
                                            <td className="text-[0.78rem]">
                                                {schedule.enabled ? formatTimestamp(schedule.next_run_at) : '—'}
                                            </td>
                                            <td className="text-right tabular-nums">
                                                {schedule.last_job_id ? (
                                                    <button
                                                        type="button"
                                                        className="text-brand underline-offset-2 hover:underline"
                                                        onClick={() => navigate(`/jobs/${schedule.last_job_id}`)}
                                                    >
                                                        {schedule.run_count}
                                                    </button>
                                                ) : (
                                                    schedule.run_count
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end">
                                                    <Tooltip title="Run now">
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Run ${schedule.name}`}
                                                            onClick={() => runNow(schedule)}
                                                        >
                                                            <Play size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Edit">
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Edit ${schedule.name}`}
                                                            onClick={() => openEdit(schedule)}
                                                        >
                                                            <Pencil size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Delete ${schedule.name}`}
                                                            onClick={() => setDeleteTarget(schedule)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ----------------------------------------------------- webhooks */}
                {tab === 'webhooks' && (
                    <div className="overflow-x-auto">
                        {deliveries.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="ui-subtitle1 mb-1">No deliveries yet</p>
                                <p className="ui-body2 mx-auto max-w-[60ch] text-subtle">
                                    Submit a job with a <code>webhook_url</code> and its outcome is POSTed there when
                                    the job finishes. Every attempt is recorded here, so a failing endpoint is visible
                                    rather than silent.
                                </p>
                            </div>
                        ) : (
                            <table className="ui-table ui-table-dense">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Job</th>
                                        <th>Endpoint</th>
                                        <th className="text-right">Attempts</th>
                                        <th>Last result</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deliveries.map((delivery) => (
                                        <tr key={delivery.id}>
                                            <td>{statusChip(delivery.status)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="font-mono text-[0.75rem] text-brand underline-offset-2 hover:underline"
                                                    onClick={() => navigate(`/jobs/${delivery.job_id}`)}
                                                >
                                                    {delivery.job_id}
                                                </button>
                                            </td>
                                            <td className="max-w-[280px]">
                                                <p className="ui-caption truncate font-mono">{delivery.url}</p>
                                            </td>
                                            <td className="text-right tabular-nums">{delivery.attempts}</td>
                                            <td className="max-w-[240px]">
                                                <p className="ui-caption truncate text-subtle">
                                                    {delivery.error ??
                                                        (delivery.response_status ? `HTTP ${delivery.response_status}` : '—')}
                                                </p>
                                            </td>
                                            <td className="text-right">
                                                {delivery.status === 'failed' && (
                                                    <Tooltip title="Try again — after fixing the receiving end">
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Retry delivery"
                                                            onClick={() => retry(delivery)}
                                                        >
                                                            <RotateCcw size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* -------------------------------------------------------- queue */}
                {tab === 'queue' && queue && (
                    <div className="p-6">
                        <p className="ui-body2 mb-5 max-w-[68ch] text-subtle">
                            Jobs are rows that any worker may claim. A claim is exclusive and expires, so a worker
                            that stops responding returns its job to the queue rather than losing it — which is what
                            lets more than one replica run.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {[
                                ['This worker', queue.worker_id],
                                ['Lease', `${queue.lease_seconds}s`],
                                ['Concurrency', `${queue.concurrency} job(s) at once`],
                                ['Retry budget', `${queue.max_attempts} attempt(s)`],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-ubs bg-elevated p-4">
                                    <p className="ui-caption font-medium text-subtle">{label}</p>
                                    <p className="ui-body2 mt-0.5 font-mono">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Paper>

            {/* ------------------------------------------------------- editor */}
            <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md">
                <DialogTitle onClose={() => setEditorOpen(false)}>
                    {editingId ? 'Edit schedule' : 'New schedule'}
                </DialogTitle>
                <DialogContent>
                    {editorError && (
                        <Alert severity="error" className="mb-4">
                            {editorError}
                        </Alert>
                    )}

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 sm:col-span-7">
                            <TextField
                                label="Name"
                                value={draft.name}
                                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                            />
                        </div>
                        <div className="col-span-12 sm:col-span-5">
                            <Select
                                label="Workflow"
                                value={draft.workflow}
                                onChange={(event) => setDraft({ ...draft, workflow: event.target.value })}
                            >
                                {workflows.map((workflow) => (
                                    <option key={workflow.id} value={workflow.id} disabled={workflow.available === false}>
                                        {workflow.name}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="col-span-12 sm:col-span-5">
                            <TextField
                                label="Cron (UTC)"
                                value={draft.cron}
                                onChange={(event) => setDraft({ ...draft, cron: event.target.value })}
                                inputClassName="font-mono"
                                helperText="minute hour day month weekday — or @daily, @weekly"
                            />
                        </div>
                        <div className="col-span-12 sm:col-span-7">
                            <div className="h-full rounded-ubs bg-elevated p-3">
                                {preview ? (
                                    <>
                                        <p className="ui-body2 font-medium">{preview.description}</p>
                                        <p className="ui-caption mt-1 block text-subtle">
                                            Next:{' '}
                                            {preview.next_runs
                                                .slice(0, 3)
                                                .map((run) => formatTimestamp(run))
                                                .join(' · ')}
                                        </p>
                                    </>
                                ) : (
                                    <p className="ui-caption text-faint">
                                        {draft.cron.trim()
                                            ? 'Not a valid cron expression.'
                                            : 'Enter a cron expression.'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="col-span-12">
                            <TextArea
                                rows={8}
                                label="Input for every run"
                                value={draft.requirement}
                                onChange={(event) => setDraft({ ...draft, requirement: event.target.value })}
                                inputClassName="font-mono text-[0.82rem]"
                            />
                        </div>

                        <div className="col-span-12 sm:col-span-6">
                            <TextField
                                label="Webhook URL (optional)"
                                value={draft.webhook_url ?? ''}
                                onChange={(event) =>
                                    setDraft({ ...draft, webhook_url: event.target.value || null })
                                }
                                helperText="POSTed a summary when each run finishes"
                            />
                        </div>
                        <div className="col-span-12 sm:col-span-3">
                            <Select
                                label="Engine"
                                value={draft.engine ?? ''}
                                onChange={(event) => setDraft({ ...draft, engine: event.target.value || null })}
                            >
                                <option value="">Platform default</option>
                                <option value="copilot">Copilot</option>
                                <option value="mock">Mock</option>
                            </Select>
                        </div>
                        <div className="col-span-12 flex items-end sm:col-span-3">
                            <Switch
                                className="pb-2"
                                label="Enabled"
                                checked={draft.enabled ?? true}
                                onChange={(checked) => setDraft({ ...draft, enabled: checked })}
                            />
                        </div>
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={save} disabled={saving || !preview}>
                        {saving && <Spinner size={15} className="text-white" />}
                        {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs">
                <DialogTitle onClose={() => setDeleteTarget(null)}>Delete this schedule?</DialogTitle>
                <DialogContent>
                    <p className="text-[0.9rem] text-subtle">
                        <strong>{deleteTarget?.name}</strong> will stop running. Jobs it already created are not
                        affected.
                    </p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button variant="danger" onClick={remove}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
