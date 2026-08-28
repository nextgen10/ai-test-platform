'use client';

import React from 'react';
import { Box, Paper, Skeleton, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { Check, Loader2, AlertTriangle, UserCheck, Circle, SkipForward } from 'lucide-react';

import type { Job, Workflow } from '@/lib/api';
import { derivePhases, type PhaseState } from '@/lib/phases';

const COLORS: Record<PhaseState, 'success' | 'info' | 'warning' | 'error'> = {
    completed: 'success',
    skipped: 'info',
    running: 'info',
    blocked: 'warning',
    failed: 'error',
    // Pending never reads from the palette map — it uses text.disabled instead.
    pending: 'info',
};

function StageIcon({ state }: { state: PhaseState }) {
    if (state === 'completed') return <Check size={16} />;
    if (state === 'skipped') return <SkipForward size={16} />;
    if (state === 'blocked') return <UserCheck size={16} />;
    if (state === 'failed') return <AlertTriangle size={16} />;
    if (state === 'running') {
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
 * The workflow this job ran, as a row of stages across the top.
 *
 * The stages come from the workflow definition and the run's own provenance —
 * see `@/lib/phases`. Until one of those is available the row renders as a
 * skeleton, because drawing some other workflow's pipeline is worse than
 * drawing none.
 *
 * Approval renders amber rather than blue: it is not progressing on its own and
 * will sit there until someone acts, which is a materially different state from
 * "working".
 */
export default function WorkflowStepper({
    job,
    workflow,
}: {
    job: Job;
    workflow?: Workflow | null;
}) {
    const theme = useTheme();

    const { phases, states, unknown } = React.useMemo(
        () => derivePhases(job, workflow),
        [job, workflow],
    );

    const paletteFor = (state: PhaseState) =>
        state === 'pending' ? theme.palette.text.disabled : theme.palette[COLORS[state]].main;

    if (unknown) {
        return (
            <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="circular" width={34} height={34} />
                    <Skeleton variant="text" width={220} height={20} />
                </Box>
            </Paper>
        );
    }

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
                {phases.map((stage, index) => {
                    const { state } = states[stage.key];
                    const color = paletteFor(state);
                    const done = state === 'completed' || state === 'skipped';

                    return (
                        <React.Fragment key={stage.key}>
                            <Tooltip title={stage.hint ?? ''} placement="top">
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        minWidth: 96,
                                        flexShrink: 0,
                                        opacity: state === 'skipped' ? 0.6 : 1,
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
                            </Tooltip>

                            {index < phases.length - 1 && (
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
