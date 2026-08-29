'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, Chip, CircularProgress, Table, TableBody,
    TableCell, TableHead, TableRow, alpha, useTheme,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { RefreshCw, Sparkles } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import {
    api, ACTIVE_STATUSES, formatDuration, formatTimestamp, STATUS_COLOR, type Job,
} from '@/lib/api';

export default function JobsPage() {
    const router = useRouter();
    const theme = useTheme();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setJobs(await api.listJobs(100));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load jobs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!jobs.some((job) => ACTIVE_STATUSES.includes(job.status))) return;
        const timer = setInterval(load, 3000);
        return () => clearInterval(timer);
    }, [jobs, load]);

    return (
        <Box>
            <PageHeader
                title="Jobs"
                subtitle="Every generation run, with its status, result size, and duration."
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

            {loading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Paper sx={{ overflowX: 'auto' }}>
                    {error ? (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="error">{error}</Typography>
                        </Box>
                    ) : jobs.length === 0 ? (
                        <Box sx={{ p: 5, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                No jobs yet.
                            </Typography>
                        </Box>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Job</TableCell>
                                    <TableCell>Workflow</TableCell>
                                    <TableCell>Engine</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Created by</TableCell>
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
                                        sx={{
                                            cursor: 'pointer',
                                            ...(job.status === 'AWAITING_APPROVAL' && {
                                                borderLeft: `3px solid ${theme.palette.warning.main}`,
                                                bgcolor: alpha(theme.palette.warning.main, 0.04),
                                            }),
                                        }}
                                        onClick={() => router.push(`/jobs/${job.id}`)}
                                    >
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {job.id}
                                        </TableCell>
                                        <TableCell>{job.workflow}</TableCell>
                                        <TableCell>
                                            {job.provenance?.engine ? (
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={job.provenance.engine === 'mock' ? 'Mock' : 'GHCP'}
                                                    color={job.provenance.engine === 'mock' ? 'warning' : 'primary'}
                                                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 500 }}
                                                />
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" label={job.status} color={STATUS_COLOR[job.status]} />
                                        </TableCell>
                                        <TableCell>{job.created_by}</TableCell>
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
            )}
        </Box>
    );
}
