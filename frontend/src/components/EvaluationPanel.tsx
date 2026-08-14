'use client';

import React, { useState } from 'react';
import type { Theme } from '@mui/material/styles';
import {
    Box, Paper, Typography, Chip, Button, LinearProgress, Alert, Tooltip,
    CircularProgress, alpha, useTheme, Table, TableBody, TableCell, TableHead,
    TableRow, Stack,
} from '@mui/material';
import { RefreshCw, AlertTriangle, Lightbulb, CheckCircle2, RotateCcw } from 'lucide-react';

import {
    RATING_COLOR, RATING_LABEL, type Evaluation, type Job, type Rating, type EvaluationScore,
} from '@/lib/api';

interface Props {
    job: Job;
    evaluation: Evaluation;
    onReprocess: () => Promise<void>;
}

const SEVERITY_COLOR = { high: 'error', medium: 'warning', low: 'info' } as const;

const ACTION_LABEL: Record<string, string> = {
    add_cases: 'Add cases',
    strengthen_expected_results: 'Strengthen expected results',
    remove_duplicates: 'Remove duplicates',
    fix_traceability: 'Fix traceability',
    split_case: 'Split case',
};

function getRatingFromScore4(score: number): Rating {
    if (score >= 3.5) return 'very_good';
    if (score >= 2.8) return 'good';
    if (score >= 2.0) return 'average';
    return 'bad';
}

function getDimensionMetrics(dim: EvaluationScore): { rating: Rating; score4: number } {
    let rating: Rating;
    let score4: number;
    if (dim.score <= 4) {
        score4 = Math.round(dim.score * 10) / 10;
        rating = getRatingFromScore4(score4);
    } else {
        if (dim.score >= 87.5) {
            rating = 'very_good';
            score4 = 4.0;
        } else if (dim.score >= 70) {
            rating = 'good';
            score4 = 3.0;
        } else if (dim.score >= 50) {
            rating = 'average';
            score4 = 2.0;
        } else {
            rating = 'bad';
            score4 = 1.0;
        }
    }
    return { rating, score4 };
}

export default function EvaluationPanel({ job, evaluation, onReprocess }: Props) {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';
    const [busy, setBusy] = useState(false);

    const overall = evaluation.overall;
    const gaps = evaluation.gaps ?? [];
    const recommendations = evaluation.recommendations ?? [];
    
    // Unified 1-4 scale arithmetic mean across 5 dimensions:
    const dimMetrics = (evaluation.scores ?? []).map(getDimensionMetrics);
    const meanScore4 = dimMetrics.length > 0
        ? dimMetrics.reduce((acc, d) => acc + d.score4, 0) / dimMetrics.length
        : (overall.score <= 4 ? overall.score : (overall.score / 100) * 4);
    
    const scorePct = Math.round((meanScore4 / 4) * 100);
    const rating: Rating = getRatingFromScore4(meanScore4);
    const color = theme.palette[RATING_COLOR[rating]].main;

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%', minWidth: 0 }}>
            {/* 1. Headline Score Card */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: alpha(color, 0.4), minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 800, fontSize: '0.82rem' }}>
                            SUITE QUALITY (5-D EVALUATION)
                        </Typography>
                        <Typography
                            variant="h4"
                            sx={{ fontWeight: 800, color, lineHeight: 1, whiteSpace: 'nowrap' }}
                        >
                            {RATING_LABEL[rating]}
                        </Typography>
                        <Chip
                            size="small"
                            label={`${scorePct}%`}
                            color={RATING_COLOR[rating]}
                            sx={{ fontWeight: 800, fontSize: '0.82rem', height: 24 }}
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.74rem' }}>
                        Scale: Bad = 1 &bull; Avg = 2 &bull; Good = 3 &bull; Very Good = 4
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={scorePct}
                    color={RATING_COLOR[rating]}
                    sx={{ height: 7, borderRadius: 3.5 }}
                />
            </Paper>

            {/* 2. Reprocess Action Gate (Single Line) */}
            {canReprocess ? (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '2px solid',
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <RotateCcw size={20} color={theme.palette.primary.main} />
                            <Typography variant="subtitle1" fontWeight={800} sx={{ fontSize: '0.94rem' }}>
                                Reprocess Test Suite with Gap Closer?
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={busy}
                            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <RotateCcw size={16} />}
                            onClick={handleReprocess}
                            sx={{ fontWeight: 800, textTransform: 'none', px: 2.5 }}
                        >
                            {busy ? 'Reprocessing Suite…' : 'Reprocess & Close Gaps'}
                        </Button>
                    </Box>
                </Paper>
            ) : reprocessUsed ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    This suite was amended by a non-destructive reprocess run.
                </Alert>
            ) : null}

            {/* 3. Flagged Gaps Banner */}
            {gaps.length > 0 && (
                <Alert severity="warning" icon={<AlertTriangle size={18} />} sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={700} gutterBottom>
                        Identified Coverage Gaps ({gaps.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
                        {gaps.map((gap, index) => (
                            <Box key={index} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <Chip size="small" label={gap.severity} color={SEVERITY_COLOR[gap.severity]} sx={{ height: 20, fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }} />
                                <Chip size="small" label={gap.area} variant="outlined" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.8rem', lineHeight: 1.4 }}>
                                    {gap.detail}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Alert>
            )}

            {/* 4. Detailed Dimensions Breakdown Table */}
            <Paper elevation={0} sx={{ overflowX: 'auto', borderRadius: 2.5, border: '1px solid', borderColor: 'divider', width: '100%' }}>
                <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', minWidth: 680 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 180, fontWeight: 700 }}>Dimension</TableCell>
                            <TableCell sx={{ width: 140, fontWeight: 700 }}>Rating</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Assessment &amp; Mathematical Rationale</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {evaluation.scores.map((dim) => {
                            const { rating: dimRating } = getDimensionMetrics(dim);

                            return (
                                <TableRow key={dim.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.84rem' }}>
                                            {dim.name ?? dim.id}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            label={RATING_LABEL[dimRating]}
                                            color={RATING_COLOR[dimRating]}
                                            variant={dimRating === 'very_good' ? 'filled' : 'outlined'}
                                            sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                        {dim.rationale ?? 'Evaluated against requirement specification.'}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Paper>

            {/* 5. Actionable Remediation Recommendations */}
            {recommendations.length > 0 && (
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Lightbulb size={16} color={theme.palette.info.main} />
                        <Typography variant="subtitle2" fontWeight={700}>
                            Remediation Recommendations ({recommendations.length})
                        </Typography>
                    </Box>
                    <Stack spacing={1}>
                        {recommendations.map((rec, index) => (
                            <Box key={index} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 1, borderRadius: 1.5, bgcolor: isLight ? '#FAFBFC' : 'rgba(255,255,255,0.02)' }}>
                                <Chip
                                    size="small"
                                    label={ACTION_LABEL[rec.action] ?? rec.action}
                                    variant="outlined"
                                    color="info"
                                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                                />
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                                        {rec.detail}
                                    </Typography>
                                    {rec.target_ids && rec.target_ids.length > 0 && (
                                        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', display: 'block', mt: 0.25 }}>
                                            Target IDs: {rec.target_ids.join(', ')}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                </Paper>
            )}
        </Box>
    );
}
