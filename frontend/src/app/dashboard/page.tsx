'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, Chip, CircularProgress, Table, TableBody,
    TableCell, TableHead, TableRow, alpha, useTheme,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { Sparkles, RefreshCw, AlertTriangle, UserCheck } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import AgentInsightsPanel from '@/components/AgentInsightsPanel';
import {
    api, ACTIVE_STATUSES, formatDuration, formatTimestamp, STATUS_COLOR,
    type Job, type PlatformStats,
} from '@/lib/api';

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <Paper sx={{ p: 2, flex: '1 1 180px', minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {value}
            </Typography>
            {hint && (
                <Typography variant="caption" color="text.disabled">
                    {hint}
                </Typography>
            )}
        </Paper>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const theme = useTheme();
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => { load(); }, [load]);

    // Poll only while something is actually in flight.
    useEffect(() => {
        if (!jobs.some((job) => ACTIVE_STATUSES.includes(job.status))) return;
        const timer = setInterval(load, 3000);
        return () => clearInterval(timer);
    }, [jobs, load]);

    if (loading) {
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', flexGrow: 1, py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <PageHeader
                title="Agent HUB Platform — Dashboard"
                subtitle="Real-time execution metrics, active agent runs, and quality benchmarks."
                actions={
                    <>
                        <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={load}>
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Sparkles size={16} />}
                            onClick={() => router.push('/use-cases')}
                        >
                            Run a Workflow
                        </Button>
                    </>
                }
            />

            {error && (
                <Paper
                    sx={{
                        p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                        borderColor: 'error.main',
                        bgcolor: alpha(theme.palette.error.main, 0.06),
                    }}
                >
                    <AlertTriangle size={18} color={theme.palette.error.main} />
                    <Box>
                        <Typography variant="body2" fontWeight={600}>
                            Cannot reach the orchestrator
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {error} — is the backend running on port 8100?
                        </Typography>
                    </Box>
                </Paper>
            )}

            {stats && stats.awaiting_approval > 0 && (
                <Paper
                    sx={{
                        p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                        borderColor: 'warning.main',
                        bgcolor: alpha(theme.palette.warning.main, 0.06),
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.1) },
                    }}
                    onClick={() => router.push('/jobs')}
                >
                    <UserCheck size={18} color={theme.palette.warning.main} />
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                            {stats.awaiting_approval} job{stats.awaiting_approval > 1 ? 's' : ''} awaiting approval
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Generation is blocked until you approve the requirement quality.
                        </Typography>
                    </Box>
                    <Button size="small" variant="outlined" color="warning">
                        Review
                    </Button>
                </Paper>
            )}

            {stats && (
                <>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                        <StatTile label="Total jobs" value={String(stats.total_jobs)} />
                        <StatTile label="Active" value={String(stats.active_jobs)} />
                        <StatTile
                            label="Awaiting approval"
                            value={String(stats.awaiting_approval)}
                            hint={stats.awaiting_approval > 0 ? 'action needed' : undefined}
                        />
                        <StatTile
                            label="Success rate"
                            value={stats.success_rate === null ? '—' : `${Math.round(stats.success_rate * 100)}%`}
                        />
                        <StatTile label="Avg duration" value={formatDuration(stats.mean_duration_ms)} />
                        <StatTile
                            label="Items Generated"
                            value={String(stats.total_test_cases)}
                            hint={stats.mean_test_cases ? `${stats.mean_test_cases} avg/job` : undefined}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                        <Chip size="small" variant="outlined" label={`executor: ${stats.executor}`} />
                        <Chip
                            size="small"
                            variant="outlined"
                            color={stats.engine === 'mock' ? 'warning' : 'default'}
                            label={`engine: ${stats.engine}`}
                        />
                        {stats.engine === 'mock' && (
                            <Typography variant="caption" color="warning.main" sx={{ alignSelf: 'center' }}>
                                Mock engine — output is a deterministic stand-in, not real Copilot generation.
                            </Typography>
                        )}
                    </Box>
                </>
            )}

            <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
                Recent jobs
            </Typography>

            <Paper sx={{ overflowX: 'auto' }}>
                {jobs.length === 0 ? (
                    <Box sx={{ p: 5, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            No jobs yet. Run your first workflow to get started.
                        </Typography>
                    </Box>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Job</TableCell>
                                <TableCell>Workflow</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Cases</TableCell>
                                <TableCell align="right">Duration</TableCell>
                                <TableCell>Created</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {jobs.map((job) => (
                                <TableRow
                                    key={job.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => router.push(`/jobs/${job.id}`)}
                                >
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                        {job.id}
                                    </TableCell>
                                    <TableCell>{job.workflow}</TableCell>
                                    <TableCell>
                                        <Chip size="small" label={job.status} color={STATUS_COLOR[job.status]} />
                                    </TableCell>
                                    <TableCell align="right">{job.summary?.total ?? '—'}</TableCell>
                                    <TableCell align="right">{formatDuration(job.duration_ms)}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {formatTimestamp(job.created_at)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>

            {/* Where the time and money actually go, per agent. */}
            <Box sx={{ mt: 3 }}>
                <AgentInsightsPanel />
            </Box>
        </Box>
    );
}
