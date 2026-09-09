import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, RefreshCw, Sparkles } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { Button, Chip, LoadingBlock, Paper } from '@/components/ui/primitives';
import {
    ACTIVE_STATUSES, api, formatDuration, formatTimestamp, STATUS_COLOR,
} from '@/lib/api';
import { exportJobs } from '@/lib/export-xlsx';

export default function JobsPage() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!jobs.some((job) => ACTIVE_STATUSES.includes(job.status))) return undefined;
        const timer = setInterval(load, 3000);
        return () => clearInterval(timer);
    }, [jobs, load]);

    return (
        <div>
            <PageHeader
                title="Jobs"
                subtitle="Every generation run, with its status, result size, and duration."
                actions={
                    <>
                        <Button
                            variant="outlined"
                            onClick={() => exportJobs(jobs)}
                            disabled={jobs.length === 0}
                        >
                            <FileSpreadsheet size={16} />
                            Export
                        </Button>
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

            {loading ? (
                <LoadingBlock />
            ) : (
                <Paper className="overflow-x-auto">
                    {error ? (
                        <div className="p-8 text-center">
                            <p className="ui-body2 text-danger">{error}</p>
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="ui-body2 text-subtle">No jobs yet.</p>
                        </div>
                    ) : (
                        <table className="ui-table ui-table-dense">
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Workflow</th>
                                    <th>Engine</th>
                                    <th>Status</th>
                                    <th>Created by</th>
                                    <th className="text-right">Cases</th>
                                    <th className="text-right">Duration</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => (
                                    <tr
                                        key={job.id}
                                        className={
                                            job.status === 'AWAITING_APPROVAL'
                                                ? 'cursor-pointer border-l-[3px] border-l-warning bg-[color-mix(in_srgb,var(--col-warning)_4%,transparent)]'
                                                : 'cursor-pointer'
                                        }
                                        onClick={() => navigate(`/jobs/${job.id}`)}
                                    >
                                        <td className="font-mono text-[0.8rem]">{job.id}</td>
                                        <td>{job.workflow}</td>
                                        <td>
                                            {job.provenance?.engine ? (
                                                <Chip
                                                    variant="outlined"
                                                    color={job.provenance.engine === 'mock' ? 'warning' : 'primary'}
                                                    className="h-5 text-[0.68rem] font-medium"
                                                >
                                                    {job.provenance.engine === 'mock' ? 'Mock' : 'GHCP'}
                                                </Chip>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>
                                            <Chip color={STATUS_COLOR[job.status]}>{job.status}</Chip>
                                        </td>
                                        <td>{job.created_by}</td>
                                        <td className="text-right">{job.summary?.total ?? '—'}</td>
                                        <td className="text-right">{formatDuration(job.duration_ms)}</td>
                                        <td className="whitespace-nowrap">{formatTimestamp(job.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Paper>
            )}
        </div>
    );
}
