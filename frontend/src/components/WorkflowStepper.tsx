'use client';

import React from 'react';
import { Box, Paper, Typography, alpha, useTheme } from '@mui/material';
import { Check, Loader2, AlertTriangle, UserCheck, Circle, SkipForward, XCircle } from 'lucide-react';

import type { Job, JobStatus, Workflow } from '@/lib/api';

export type StageState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'blocked';

function humanise(value: string): string {
    const spaced = value.replace(/[-_]/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const BESPOKE_PHASES = [
    { key: 'ocr-extractor', label: 'Document OCR & visual extraction' },
    { key: 'test-designer', label: 'Requirement analysis & scenario design' },
    { key: 'test-generator', label: 'Test case generation' },
    { key: 'test-reviewer', label: 'Review & validation' },
];

function derivePhasesForStepper(job: Job, workflow?: Workflow | null) {
    const bespoke = !workflow || workflow.runner === 'bespoke';
    const recorded = (job.provenance?.stages ?? []) as { agent_id?: string; stage?: string }[];
    let phases: { key: string; label: string }[];

    if (recorded.length > 0) {
        phases = recorded.map((s) => ({
            key: String(s.agent_id ?? s.stage ?? ''),
            label: humanise(String(s.stage ?? s.agent_id ?? '')),
        }));
    } else if (workflow && workflow.agents?.length && !bespoke) {
        phases = workflow.agents.map((a) => ({
            key: a.id,
            label: a.description || humanise(a.stage || a.id),
        }));
    } else {
        phases = BESPOKE_PHASES;
    }

    const result: Record<string, { state: StageState; detail: string }> = {};
    for (const phase of phases) result[phase.key] = { state: 'pending', detail: '' };

    if (bespoke && 'ocr-extractor' in result) {
        const usedOcr =
            (job.events ?? []).some((e) => (e.event_metadata?.phase as string) === 'ocr-extractor') ||
            (job.provenance?.phases ?? []).some((p) => p.name === 'ocr-extractor');
        if (!usedOcr) {
            result['ocr-extractor'] = { state: 'skipped', detail: 'skipped' };
        }
    }

    for (const event of job.events ?? []) {
        const name = (event.event_metadata?.phase as string) ?? '';
        if (!(name in result)) continue;
        if (event.event_type === 'phase.started') {
            result[name] = { state: 'running', detail: '' };
        } else if (event.event_type === 'phase.completed') {
            result[name] = { state: 'completed', detail: '' };
        }
    }

    for (const record of job.provenance?.phases ?? []) {
        if (!(record.name in result)) continue;
        result[record.name] = {
            state: record.status === 'failed' ? 'failed' : 'completed',
            detail: '',
        };
    }

    for (const record of recorded as { agent_id?: string; stage?: string; status?: string; resumed?: boolean }) {
        const key = String(record.agent_id ?? record.stage ?? '');
        if (!(key in result)) continue;
        const state: StageState = record.status === 'failed' ? 'failed' : record.status === 'skipped' ? 'skipped' : 'completed';
        result[key] = { state, detail: record.resumed ? 'resumed' : '' };
    }

    const ACTIVE_STATUSES = ['QUEUED', 'STARTING', 'ANALYZING', 'RUNNING', 'VALIDATING', 'EVALUATING'];
    if (!ACTIVE_STATUSES.includes(job.status) && job.status !== 'COMPLETED' && job.status !== 'AWAITING_APPROVAL') {
        for (const phase of phases) {
            if (result[phase.key].state === 'running') result[phase.key].state = 'failed';
        }
    }

    if (job.status === 'AWAITING_APPROVAL') {
        const lastActive = phases.slice().reverse().find(p => result[p.key].state === 'completed' || result[p.key].state === 'running');
        if (lastActive) {
            result[lastActive.key].state = 'blocked';
        } else if (phases.length > 0) {
            result[phases[0].key].state = 'blocked';
        }
    }

    return { phases, states: result };
}

const COLORS: Record<StageState, 'success' | 'info' | 'warning' | 'error'> = {
    completed: 'success',
    skipped: 'info',
    running: 'info',
    blocked: 'warning',
    failed: 'error',
    pending: 'info',
};

function StageIcon({ state }: { state: StageState }) {
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

export default function WorkflowStepper({ job, workflow }: { job: Job, workflow?: Workflow | null }) {
    const theme = useTheme();

    const { phases, states } = React.useMemo(() => derivePhasesForStepper(job, workflow), [job, workflow]);

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
                {phases.map((stage, index) => {
                    const state = states[stage.key].state;
                    const color = paletteFor(state);
                    const done = state === 'completed' || state === 'skipped';

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
