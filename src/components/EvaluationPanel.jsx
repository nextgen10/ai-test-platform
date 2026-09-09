import React, { useState } from 'react';
import { AlertTriangle, Lightbulb, RotateCcw } from 'lucide-react';

import { RATING_COLOR, RATING_LABEL } from '@/lib/api';
import { useThemeMode } from '@/contexts/ThemeContext';
import { alpha, toneColor } from '@/theme';
import { Alert, Button, Chip, LinearProgress, Paper, Spinner } from './ui/primitives';

const SEVERITY_COLOR = { high: 'error', medium: 'warning', low: 'info' };

const ACTION_LABEL = {
    add_cases: 'Add cases',
    strengthen_expected_results: 'Strengthen expected results',
    remove_duplicates: 'Remove duplicates',
    fix_traceability: 'Fix traceability',
    split_case: 'Split case',
};

function getRatingFromScore4(score) {
    if (score >= 3.5) return 'very_good';
    if (score >= 2.8) return 'good';
    if (score >= 2.0) return 'average';
    return 'bad';
}

/**
 * Evaluation scores are on 0-100 — evaluation.schema.json declares it and the
 * evaluator's profile says so twice. Two things used to go wrong here. A score
 * of 4 or less was read as though it were already on the 1-4 scale, so the
 * worst result the evaluator can give (3 out of 100) displayed as 3.0/4, a good
 * one. And the rest were snapped to whole points, so 88 and 100 both showed as
 * 4.0/100%. The rating thresholds below are the same 87.5/70/50 those buckets
 * were built from, so labels are unchanged; only the number is now linear.
 */
function getDimensionMetrics(dimension) {
    const pct = Math.min(100, Math.max(0, Number(dimension.score) || 0));
    const score4 = Math.round((pct / 25) * 10) / 10;
    return { rating: getRatingFromScore4(score4), score4 };
}

export default function EvaluationPanel({ job, evaluation, onReprocess }) {
    const { mode } = useThemeMode();
    const [busy, setBusy] = useState(false);

    const overall = evaluation.overall;
    const gaps = evaluation.gaps ?? [];
    const recommendations = evaluation.recommendations ?? [];

    // Unified 1-4 scale arithmetic mean across the dimensions.
    const dimensionMetrics = (evaluation.scores ?? []).map(getDimensionMetrics);
    const meanScore4 =
        dimensionMetrics.length > 0
            ? dimensionMetrics.reduce((total, d) => total + d.score4, 0) / dimensionMetrics.length
            : Math.min(100, Math.max(0, Number(overall.score) || 0)) / 25;

    const scorePct = Math.round((meanScore4 / 4) * 100);
    const rating = getRatingFromScore4(meanScore4);
    const color = toneColor(RATING_COLOR[rating], mode);

    const reprocessUsed = job.reprocess_count > 0;
    const canReprocess =
        job.status === 'COMPLETED' && !reprocessUsed && (gaps.length > 0 || recommendations.length > 0);

    const handleReprocess = async () => {
        setBusy(true);
        try {
            await onReprocess();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">
            {/* A reprocess that amended the suite without re-scoring it leaves
                this score describing the previous one. The number is still the
                last thing anyone measured, so it is shown — but never as though
                it were current. */}
            {evaluation.stale && (
                <Alert severity="warning">
                    <p className="mb-0.5 font-medium">This score is out of date</p>
                    {evaluation.stale_reason ?? 'The suite was amended after this evaluation ran.'} Reprocess
                    again with scoring enabled to measure the current suite.
                </Alert>
            )}

            {/* 1. Headline score */}
            <Paper flat className="min-w-0 p-5" style={{ borderColor: alpha(color, 0.4) }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                        <span className="text-[0.82rem] font-medium uppercase tracking-[0.04em] text-subtle">
                            Suite quality (5-D evaluation)
                        </span>
                        <span className="whitespace-nowrap text-2xl font-medium leading-none" style={{ color }}>
                            {RATING_LABEL[rating]}
                        </span>
                        <Chip color={RATING_COLOR[rating]} className="h-6 text-[0.82rem] font-medium">
                            {`${scorePct}%`}
                        </Chip>
                    </div>
                    <span className="text-[0.74rem] font-medium text-subtle">
                        Scale: Bad = 1 • Avg = 2 • Good = 3 • Very Good = 4
                    </span>
                </div>
                <LinearProgress value={scorePct} color={RATING_COLOR[rating]} className="h-[7px]" />
            </Paper>

            {/* 2. Reprocess gate */}
            {canReprocess ? (
                <Paper flat className="border-2 border-brand bg-brand-tint p-4 shadow-none">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <RotateCcw size={20} className="text-brand" />
                            <p className="text-[0.94rem] font-medium">Reprocess test suite with gap closer?</p>
                        </div>
                        <Button variant="contained" className="px-5" disabled={busy} onClick={handleReprocess}>
                            {busy ? <Spinner size={16} className="text-white" /> : <RotateCcw size={16} />}
                            {busy ? 'Reprocessing suite…' : 'Reprocess & close gaps'}
                        </Button>
                    </div>
                </Paper>
            ) : reprocessUsed ? (
                <Alert severity="info">This suite was amended by a non-destructive reprocess run.</Alert>
            ) : null}

            {/* 3. Coverage gaps */}
            {gaps.length > 0 && (
                <Alert severity="warning" icon={<AlertTriangle size={18} />}>
                    <p className="ui-body2 mb-2 font-medium">Identified coverage gaps ({gaps.length})</p>
                    <div className="flex flex-col gap-2">
                        {gaps.map((gap, index) => (
                            <div key={index} className="flex flex-wrap items-start gap-3">
                                <Chip
                                    color={SEVERITY_COLOR[gap.severity]}
                                    className="h-5 text-[0.68rem] font-medium uppercase"
                                >
                                    {gap.severity}
                                </Chip>
                                <Chip variant="outlined" className="h-5 text-[0.68rem] font-medium">
                                    {gap.area}
                                </Chip>
                                <span className="grow text-[0.8rem] leading-snug text-subtle">{gap.detail}</span>
                            </div>
                        ))}
                    </div>
                </Alert>
            )}

            {/* 4. Dimensions */}
            <Paper flat className="w-full overflow-x-auto">
                <table className="ui-table ui-table-dense w-full min-w-[680px] table-fixed">
                    <thead>
                        <tr>
                            <th className="w-[180px]">Dimension</th>
                            <th className="w-[140px]">Rating</th>
                            <th>Assessment &amp; mathematical rationale</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(evaluation.scores ?? []).map((dimension) => {
                            const { rating: dimensionRating } = getDimensionMetrics(dimension);
                            return (
                                <tr key={dimension.id}>
                                    <td className="text-[0.84rem] font-medium">
                                        {dimension.name ?? dimension.id}
                                    </td>
                                    <td>
                                        <Chip
                                            color={RATING_COLOR[dimensionRating]}
                                            variant={dimensionRating === 'very_good' ? 'filled' : 'outlined'}
                                            className="h-[22px] text-[0.72rem] font-medium"
                                        >
                                            {RATING_LABEL[dimensionRating]}
                                        </Chip>
                                    </td>
                                    <td className="text-[0.82rem] leading-relaxed text-subtle">
                                        {dimension.rationale ?? 'Evaluated against requirement specification.'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Paper>

            {/* 5. Recommendations */}
            {recommendations.length > 0 && (
                <Paper flat className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Lightbulb size={16} className="text-teal" />
                        <p className="ui-subtitle2">Remediation recommendations ({recommendations.length})</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        {recommendations.map((rec, index) => (
                            <div key={index} className="flex items-start gap-3 rounded-ubs bg-elevated p-2">
                                <Chip variant="outlined" color="info" className="h-[22px] text-[0.7rem] font-medium">
                                    {ACTION_LABEL[rec.action] ?? rec.action}
                                </Chip>
                                <div className="grow">
                                    <p className="text-[0.82rem] text-subtle">{rec.detail}</p>
                                    {rec.target_ids && rec.target_ids.length > 0 && (
                                        <p className="mt-0.5 font-mono text-[0.72rem] text-faint">
                                            Target IDs: {rec.target_ids.join(', ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Paper>
            )}
        </div>
    );
}
