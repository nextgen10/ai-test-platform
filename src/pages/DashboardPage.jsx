import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Sparkles, UserCheck } from 'lucide-react';

import AgentInsightsPanel from '@/components/AgentInsightsPanel';
import PageHeader from '@/components/PageHeader';
import { Button, Chip, LoadingBlock, Paper } from '@/components/ui/primitives';
import {
    ACTIVE_STATUSES, api, formatDuration, formatTimestamp, STATUS_COLOR,
} from '@/lib/api';

function StatTile({ label, value, hint }) {
    // Must stay block flow, not flex-col. MUI Paper is `display: block` with
    // body line-height (~24.8px); caption is an inline span, so each caption
    // sits in a line box sized by that strut. Flex blockifies children and
    // collapses that to the caption's own 17.4px line-height — ~15px too short.
    return (
        <Paper className="min-w-[160px] flex-[1_1_180px] p-4 text-base leading-[1.55]">
            <span className="ui-caption uppercase tracking-[0.04em] text-subtle">{label}</span>
            <span className="ui-h4 mt-1 block leading-[1.2]">{value}</span>
            {hint && <span className="ui-caption text-faint">{hint}</span>}
        </Paper>
    );
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            const [statsData, jobsData] = await Promise.all([api.stats(), api.listJobs(10)]);
            setStats(statsData);
            setJobs(jobsData);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reach the orchestrator');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Poll only while something is actually in flight.
    useEffect(() => {
        if (!jobs.some((job) => ACTIVE_STATUSES.includes(job.status))) return undefined;
        const timer = setInterval(load, 3000);
        return () => clearInterval(timer);
    }, [jobs, load]);

    if (loading) return <LoadingBlock />;

    return (
        <div>
            <PageHeader
                title="Dashboard"
                subtitle="Real-time execution metrics, active agent runs, and quality benchmarks."
                actions={
                    <>
                        <Button variant="outlined" onClick={load}>
                            <RefreshCw size={16} />
                            Refresh
                        </Button>
                        <Button variant="contained" onClick={() => navigate('/use-cases')}>
                            <Sparkles size={16} />
                            Run a Workflow
                        </Button>
                    </>
                }
            />

            {error && (
                <Paper className="mb-4 flex items-center gap-3 border-danger bg-[color-mix(in_srgb,var(--col-error)_6%,transparent)] p-4">
                    <AlertTriangle size={18} className="shrink-0 text-danger" />
                    <div>
                        <p className="ui-body2 font-medium">Cannot reach the orchestrator</p>
                        <p className="ui-caption text-subtle">
                            {error} — is the backend running on port 8100?
                        </p>
                    </div>
                </Paper>
            )}

            {stats && stats.awaiting_approval > 0 && (
                <Paper
                    as="button"
                    className="mb-4 flex w-full cursor-pointer items-center gap-3 border-warning bg-[color-mix(in_srgb,var(--col-warning)_6%,transparent)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--col-warning)_10%,transparent)]"
                    onClick={() => navigate('/jobs')}
                >
                    <UserCheck size={18} className="shrink-0 text-warning" />
                    <div className="grow">
                        <p className="ui-body2 font-medium">
                            {stats.awaiting_approval} job{stats.awaiting_approval > 1 ? 's' : ''} awaiting
                            approval
                        </p>
                        <p className="ui-caption text-subtle">
                            Generation is blocked until you approve the requirement quality.
                        </p>
                    </div>
                    <span className="ui-btn ui-btn-outlined-warning ui-btn-sm">Review</span>
                </Paper>
            )}

            {stats && (
                <>
                    <div className="mb-4 flex flex-wrap gap-4">
                        <StatTile label="Total jobs" value={String(stats.total_jobs)} />
                        <StatTile label="Active" value={String(stats.active_jobs)} />
                        <StatTile
                            label="Awaiting approval"
                            value={String(stats.awaiting_approval)}
                            hint={stats.awaiting_approval > 0 ? 'action needed' : undefined}
                        />
                        <StatTile
                            label="Success rate"
                            value={
                                stats.success_rate === null ? '—' : `${Math.round(stats.success_rate * 100)}%`
                            }
                        />
                        <StatTile label="Avg duration" value={formatDuration(stats.mean_duration_ms)} />
                        <StatTile
                            label="Items Generated"
                            value={String(stats.total_test_cases)}
                            hint={stats.mean_test_cases ? `${stats.mean_test_cases} avg/job` : undefined}
                        />
                    </div>

                    <div className="mb-6 flex flex-wrap items-center gap-2">
                        <Chip variant="outlined">{`executor: ${stats.executor}`}</Chip>
                        <Chip variant="outlined" color={stats.engine === 'mock' ? 'warning' : 'default'}>
                            {`engine: ${stats.engine}`}
                        </Chip>
                        {stats.engine === 'mock' && (
                            <span className="ui-caption self-center text-warning">
                                Mock engine — output is a deterministic stand-in, not real Copilot generation.
                            </span>
                        )}
                    </div>
                </>
            )}

            <h2 className="ui-h6 mb-3">Recent jobs</h2>

            <Paper className="overflow-x-auto">
                {jobs.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="ui-body2 text-subtle">
                            No jobs yet. Run your first workflow to get started.
                        </p>
                    </div>
                ) : (
                    <table className="ui-table ui-table-dense">
                        <thead>
                            <tr>
                                <th>Job</th>
                                <th>Workflow</th>
                                <th>Status</th>
                                <th className="text-right">Cases</th>
                                <th className="text-right">Duration</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <tr
                                    key={job.id}
                                    className="cursor-pointer"
                                    onClick={() => navigate(`/jobs/${job.id}`)}
                                >
                                    <td className="font-mono text-[0.8rem]">{job.id}</td>
                                    <td>{job.workflow}</td>
                                    <td>
                                        <Chip color={STATUS_COLOR[job.status]}>{job.status}</Chip>
                                    </td>
                                    <td className="text-right">{job.summary?.total ?? '—'}</td>
                                    <td className="text-right">{formatDuration(job.duration_ms)}</td>
                                    <td className="whitespace-nowrap">{formatTimestamp(job.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Paper>

            {/* Where the time and money actually go, per agent. */}
            <div className="mt-6">
                <AgentInsightsPanel />
            </div>
        </div>
    );
}
