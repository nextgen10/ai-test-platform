'use client';

import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    Tooltip,
    LinearProgress,
    alpha,
    useTheme,
} from '@mui/material';
import { Coins, Clock, Info, RotateCcw, ShieldCheck } from 'lucide-react';

import { formatCost, formatDuration, formatTokens, type JobBreakdown } from '@/lib/api';

/**
 * Where a run's time and money went, stage by stage.
 *
 * Two honesty rules run through this: a token count derived from character
 * counts is labelled as an estimate, and a model that is not in the pricing
 * table shows no cost at all rather than zero.
 */
export default function RunCostPanel({ breakdown }: { breakdown: JobBreakdown }) {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    const { stages, totals } = breakdown;
    const slowest = Math.max(1, ...stages.map((s) => s.duration_ms));

    const statusColor = (status: string | null) => {
        if (status === 'failed') return theme.palette.error.main;
        if (status === 'skipped') return theme.palette.text.disabled;
        return theme.palette.success.main;
    };

    return (
        <Paper
            variant="outlined"
            sx={{ mt: 2, borderRadius: 2.5, overflow: 'hidden' }}
        >
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isLight ? '#f8fafc' : '#11161d',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Coins size={16} color={theme.palette.primary.main} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Run cost
                    </Typography>
                </Box>
                {breakdown.model && (
                    <Chip
                        label={breakdown.model}
                        size="small"
                        sx={{ fontSize: '0.68rem', height: 20, fontFamily: 'monospace' }}
                    />
                )}
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& td, & th': { fontSize: '0.78rem' } }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Time</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Tokens</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Cost</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stages.map((stage, index) => (
                            <TableRow key={`${stage.stage}-${index}`} hover>
                                <TableCell sx={{ maxWidth: 200 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Box
                                            sx={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                bgcolor: statusColor(stage.status),
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{ fontSize: '0.78rem', fontWeight: 600 }}
                                            noWrap
                                        >
                                            {stage.stage ?? stage.agent_id}
                                        </Typography>
                                        {stage.attempts > 1 && (
                                            <Tooltip title={`Corrected its own output ${stage.attempts - 1} time(s)`}>
                                                <Chip
                                                    icon={<RotateCcw size={10} />}
                                                    label={stage.attempts}
                                                    size="small"
                                                    sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-icon': { ml: 0.5 } }}
                                                />
                                            </Tooltip>
                                        )}
                                        {stage.resumed && (
                                            <Tooltip title="Skipped — a previous attempt already completed it">
                                                <Chip label="resumed" size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                                            </Tooltip>
                                        )}
                                        {stage.contract && stage.contract.endsWith('.json') && (
                                            <Tooltip title={`Output validated against ${stage.contract}`}>
                                                <ShieldCheck size={12} color={theme.palette.success.main} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                    {/* A bar makes the slow stage obvious without reading numbers. */}
                                    <LinearProgress
                                        variant="determinate"
                                        value={(stage.duration_ms / slowest) * 100}
                                        sx={{
                                            mt: 0.5,
                                            height: 3,
                                            borderRadius: 2,
                                            bgcolor: alpha(theme.palette.text.primary, 0.06),
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: alpha(statusColor(stage.status), 0.6),
                                            },
                                        }}
                                    />
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {stage.duration_ms ? formatDuration(stage.duration_ms) : '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {formatTokens(stage.total_tokens)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {formatCost(stage.cost_usd)}
                                </TableCell>
                            </TableRow>
                        ))}

                        <TableRow>
                            <TableCell sx={{ fontWeight: 800, borderTop: '2px solid', borderColor: 'divider' }}>
                                Total
                            </TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', borderTop: '2px solid', borderColor: 'divider' }}
                            >
                                {formatDuration(totals.stage_duration_ms)}
                            </TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', borderTop: '2px solid', borderColor: 'divider' }}
                            >
                                {formatTokens(totals.total_tokens)}
                            </TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', borderTop: '2px solid', borderColor: 'divider' }}
                            >
                                {formatCost(totals.cost_usd)}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Box>

            {/* Say plainly which numbers are measured and which are not. */}
            {(totals.tokens_estimated || !totals.cost_known) && (
                <Box
                    sx={{
                        px: 2,
                        py: 1.25,
                        display: 'flex',
                        gap: 1,
                        alignItems: 'flex-start',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isLight ? '#fffbeb' : alpha(theme.palette.warning.main, 0.08),
                    }}
                >
                    <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                        {totals.tokens_estimated && (
                            <>
                                Token counts are estimated from text length — the CLI did not report
                                usage for this run.{' '}
                            </>
                        )}
                        {!totals.cost_known && (
                            <>
                                No cost is shown because{' '}
                                {breakdown.model
                                    ? <>the model <code>{breakdown.model}</code> is not in the pricing table</>
                                    : <>this run did not record which model it used</>}
                                .
                            </>
                        )}
                    </Typography>
                </Box>
            )}

            <Box
                sx={{
                    px: 2,
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Clock size={11} color={theme.palette.text.disabled} />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                    Prices as of {breakdown.pricing_version}
                </Typography>
            </Box>
        </Paper>
    );
}
