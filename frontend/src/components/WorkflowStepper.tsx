'use client';

import React from 'react';
import { Box, Paper, Typography, alpha, useTheme } from '@mui/material';
import { Check, Loader2, AlertTriangle, UserCheck, Circle } from 'lucide-react';

import type { Job, JobStatus } from '@/lib/api';

export type StageState = 'pending' | 'active' | 'complete' | 'blocked' | 'failed';

interface Stage {
    key: string;
    label: string;
    /** Statuses during which this stage is the one in progress. */
    activeOn: JobStatus[];
    /** Statuses by which this stage is finished. */
    completeOn: JobStatus[];
}

const STAGES: Stage[] = [
    {
        key: 'upload',
        label: 'Requirement',
        activeOn: ['QUEUED'],
        completeOn: [
            'STARTING', 'ANALYZING', 'AWAITING_APPROVAL', 'RUNNING',
            'VALIDATING', 'EVALUATING', 'COMPLETED', 'REJECTED',
        ],
    },
    {
        key: 'quality',
        label: 'Quality Check',
        activeOn: ['STARTING', 'ANALYZING'],
        completeOn: [
            'AWAITING_APPROVAL', 'RUNNING', 'VALIDATING', 'EVALUATING', 'COMPLETED', 'REJECTED',
        ],
    },
    {
        key: 'approval',
        label: 'Approval',
        activeOn: ['AWAITING_APPROVAL'],
        completeOn: ['RUNNING', 'VALIDATING', 'EVALUATING', 'COMPLETED'],
    },
    {
        key: 'generation',
        label: 'Test Generation',
        activeOn: ['RUNNING', 'VALIDATING'],
        completeOn: ['EVALUATING', 'COMPLETED'],
    },
    {
        key: 'evaluation',
        label: 'Evaluation',
        activeOn: ['EVALUATING'],
        completeOn: ['COMPLETED'],
    },
];

function stageState(stage: Stage, job: Job): StageState {
    if (job.status === 'REJECTED' && stage.key === 'approval') return 'failed';

    // A hard failure marks whichever stage was in flight, and leaves the rest pending.
    const deadStatuses: JobStatus[] = ['FAILED', 'TIMEOUT', 'CANCELLED'];
    if (deadStatuses.includes(job.status)) {
        const reached = stage.completeOn.some((s) => s === 'COMPLETED')
            ? false
            : job.quality_report !== null;
        if (stage.key === 'upload') return 'complete';
        if (stage.key === 'quality') return job.quality_report ? 'complete' : 'failed';
        if (stage.key === 'approval') return job.approved_at ? 'complete' : 'pending';
        if (stage.key === 'generation') return job.summary ? 'complete' : reached ? 'failed' : 'pending';
        if (stage.key === 'evaluation') return job.evaluation ? 'complete' : 'pending';
    }

    if (stage.completeOn.includes(job.status)) return 'complete';
    if (stage.activeOn.includes(job.status)) {
        return stage.key === 'approval' ? 'blocked' : 'active';
    }
    return 'pending';
}

const COLORS: Record<StageState, 'success' | 'info' | 'warning' | 'error'> = {
    complete: 'success',
    active: 'info',
    blocked: 'warning',
    failed: 'error',
    // Pending never reads from the palette map — it uses text.disabled instead.
    pending: 'info',
};

function StageIcon({ state }: { state: StageState }) {
    if (state === 'complete') return <Check size={16} />;
    if (state === 'blocked') return <UserCheck size={16} />;
    if (state === 'failed') return <AlertTriangle size={16} />;
    if (state === 'active') {
        return (
            <Box
                sx={{
                    display: 'flex',
                    animation: 'stageSpin 1.2s linear infinite',
                    '@keyframes stageSpin': {
                        from: { transform: 'rotate(0deg)' },
                        to: { transform: 'rotate(360deg)' },
                    },
                }}
            >
                <Loader2 size={16} />
            </Box>
        );
    }
    return <Circle size={16} />;
}

/**
 * The workflow as a row of stages across the top of a job.
 *
 * Approval renders amber rather than blue: it is not progressing on its own and
 * will sit there until someone acts, which is a materially different state from
 * "working".
 */
export default function WorkflowStepper({ job }: { job: Job }) {
    const theme = useTheme();

    const paletteFor = (state: StageState) =>
        state === 'pending' ? theme.palette.text.disabled : theme.palette[COLORS[state]].main;

    return (
        <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: { xs: 0.5, md: 1 },
                    overflowX: 'auto',
                }}
                className="custom-scrollbar"
            >
                {STAGES.map((stage, index) => {
                    const state = stageState(stage, job);
                    const color = paletteFor(state);
                    const done = state === 'complete';

                    return (
                        <React.Fragment key={stage.key}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 0.75,
                                    minWidth: 96,
                                    flexShrink: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: '50%',
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: done ? '#fff' : color,
                                        bgcolor: done ? color : alpha(color, 0.12),
                                        border: '1px solid',
                                        borderColor: state === 'pending' ? 'divider' : alpha(color, 0.4),
                                    }}
                                >
                                    <StageIcon state={state} />
                                </Box>
                                <Typography
                                    variant="caption"
                                    align="center"
                                    sx={{
                                        fontWeight: state === 'pending' ? 500 : 700,
                                        color: state === 'pending' ? 'text.disabled' : 'text.primary',
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {stage.label}
                                </Typography>
                                {state === 'blocked' && (
                                    <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
                                        action needed
                                    </Typography>
                                )}
                            </Box>

                            {index < STAGES.length - 1 && (
                                <Box
                                    sx={{
                                        flexGrow: 1,
                                        minWidth: 16,
                                        height: 2,
                                        mt: '16px',
                                        borderRadius: 1,
                                        bgcolor: done ? theme.palette.success.main : theme.palette.divider,
                                    }}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </Box>
        </Paper>
    );
}
