'use client';

import React, { useEffect, useState } from 'react';
import {
    Box,
    Chip,
    FormControl,
    LinearProgress,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import { Activity, AlertTriangle, RotateCcw } from 'lucide-react';

import {
    platformApi,
    formatCost,
    formatDuration,
    formatTokens,
    type AgentUsage,
} from '@/lib/api';

/**
 * Per-agent totals over a window — the answer to "which agent is the slow one".
 *
 * Sorted by total time rather than by name: the reason to open this is almost
 * always that something got slower or more expensive, and the culprit should be
 * the first row.
 */
export default function AgentInsightsPanel() {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    const [days, setDays] = useState(30);
    const [agents, setAgents] = useState<AgentUsage[]>([]);
    const [pricingVersion, setPricingVersion] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        platformApi
            .agentUsage(days)
            .then((data) => {
                setAgents(data.agents);
                setPricingVersion(data.pricing_version);
            })
            .catch(() => setAgents([]))
            .finally(() => setLoading(false));
    }, [days]);

    const slowest = Math.max(1, ...agents.map((a) => a.total_duration_ms));

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box
                sx={{
                    px: 2.5,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isLight ? '#f9f9f7' : '#1c1c1c',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Activity size={17} color={theme.palette.primary.main} />
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '0.98rem' }}>
                            Agent usage
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Where time and money go, per agent
                        </Typography>
                    </Box>
                </Box>

                <FormControl size="small">
                    <Select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        sx={{ fontSize: '0.8rem', minWidth: 120 }}
                    >
                        <MenuItem value={7}>Last 7 days</MenuItem>
                        <MenuItem value={30}>Last 30 days</MenuItem>
                        <MenuItem value={90}>Last 90 days</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {loading ? (
                <Box sx={{ p: 3 }}>
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                </Box>
            ) : agents.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No runs recorded in this window. Once jobs complete, each agent&apos;s share of
                        the time and cost appears here.
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ '& td, & th': { fontSize: '0.78rem' } }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 500 }}>Agent</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 500 }}>Runs</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 500 }}>Mean</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 500 }}>Total time</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 500 }}>Tokens</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 500 }}>Cost</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {agents.map((agent) => (
                                <TableRow key={agent.agent_id} hover>
                                    <TableCell sx={{ maxWidth: 220 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                            <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 500, fontSize: '0.78rem', fontFamily: 'monospace' }}
                                            >
                                                {agent.agent_id}
                                            </Typography>
                                            {agent.failures > 0 && (
                                                <Tooltip title={`${agent.failures} of ${agent.runs} runs failed`}>
                                                    <Chip
                                                        icon={<AlertTriangle size={10} />}
                                                        label={`${Math.round(agent.failure_rate * 100)}%`}
                                                        size="small"
                                                        color="error"
                                                        sx={{ height: 17, fontSize: '0.62rem', '& .MuiChip-icon': { ml: 0.5 } }}
                                                    />
                                                </Tooltip>
                                            )}
                                            {agent.retries > 0 && (
                                                <Tooltip title={`Corrected its own output ${agent.retries} time(s)`}>
                                                    <Chip
                                                        icon={<RotateCcw size={10} />}
                                                        label={agent.retries}
                                                        size="small"
                                                        sx={{ height: 17, fontSize: '0.62rem', '& .MuiChip-icon': { ml: 0.5 } }}
                                                    />
                                                </Tooltip>
                                            )}
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={(agent.total_duration_ms / slowest) * 100}
                                            sx={{
                                                mt: 0.5,
                                                height: 3,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.text.primary, 0.06),
                                                '& .MuiLinearProgress-bar': {
                                                    bgcolor: alpha(theme.palette.primary.main, 0.55),
                                                },
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {agent.runs}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {formatDuration(agent.mean_duration_ms)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {formatDuration(agent.total_duration_ms)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {formatTokens(agent.total_tokens)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {formatCost(agent.cost_usd)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            )}

            {pricingVersion && agents.length > 0 && (
                <Box sx={{ px: 2.5, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                        Costs estimated from list prices as of {pricingVersion}. An agent whose model
                        is not in the table shows no cost rather than zero.
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}
