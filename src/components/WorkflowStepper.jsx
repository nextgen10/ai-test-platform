import React, { Fragment, useMemo } from 'react';
import { AlertTriangle, Check, Circle, Loader2, SkipForward, UserCheck } from 'lucide-react';

import { derivePhases } from '@/lib/phases';
import { alpha, getTokens, toneColor } from '@/theme';
import { useThemeMode } from '@/contexts/ThemeContext';
import { cx } from './ui/cx';
import { Paper, Skeleton, Tooltip } from './ui/primitives';

const TONES = {
    completed: 'success',
    skipped: 'info',
    running: 'warning',
    blocked: 'warning',
    failed: 'error',
    // Pending never reads from the palette map — it uses the disabled ink.
    pending: 'info',
};

function StageIcon({ state }) {
    if (state === 'completed') return <Check size={16} />;
    if (state === 'skipped') return <SkipForward size={16} />;
    if (state === 'blocked') return <UserCheck size={16} />;
    if (state === 'failed') return <AlertTriangle size={16} />;
    if (state === 'running') {
        return (
            <span className="flex animate-ubs-spin">
                <Loader2 size={16} />
            </span>
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
export default function WorkflowStepper({ job, workflow }) {
    const { mode } = useThemeMode();
    const tokens = getTokens(mode);

    const { phases, states, unknown } = useMemo(() => derivePhases(job, workflow), [job, workflow]);

    const colorFor = (state) => (state === 'pending' ? tokens.text.disabled : toneColor(TONES[state], mode));

    if (unknown) {
        return (
            <Paper className="mb-5 p-4 md:p-5">
                <div className="flex items-center gap-4">
                    <Skeleton variant="circular" width={34} height={34} />
                    <Skeleton variant="text" width={220} height={20} />
                </div>
            </Paper>
        );
    }

    return (
        <Paper className="mb-5 p-4 md:p-5">
            <div className="custom-scrollbar flex items-start gap-1 overflow-x-auto md:gap-2">
                {phases.map((stage, index) => {
                    const { state } = states[stage.key];
                    const color = colorFor(state);
                    const done = state === 'completed' || state === 'skipped';

                    return (
                        <Fragment key={stage.key}>
                            <Tooltip title={stage.hint ?? ''}>
                                <div
                                    className={cx(
                                        'flex min-w-[96px] shrink-0 flex-col items-center gap-1.5',
                                        state === 'skipped' && 'opacity-60',
                                    )}
                                >
                                    <span
                                        className="grid size-[34px] place-items-center rounded-full border"
                                        style={{
                                            color: done ? '#fff' : color,
                                            backgroundColor: done ? color : alpha(color, 0.12),
                                            borderColor: state === 'pending' ? tokens.border.subtle : alpha(color, 0.4),
                                        }}
                                    >
                                        <StageIcon state={state} />
                                    </span>
                                    <span
                                        className={cx(
                                            'ui-caption text-center leading-tight',
                                            state === 'pending' ? 'text-faint' : 'font-medium text-ink',
                                        )}
                                    >
                                        {stage.label}
                                    </span>
                                    {state === 'blocked' && (
                                        <span className="ui-caption font-medium text-warning">action needed</span>
                                    )}
                                </div>
                            </Tooltip>

                            {index < phases.length - 1 && (
                                <span
                                    className="mt-4 h-0.5 min-w-4 grow"
                                    style={{ backgroundColor: done ? tokens.success : tokens.border.subtle }}
                                />
                            )}
                        </Fragment>
                    );
                })}
            </div>
        </Paper>
    );
}
