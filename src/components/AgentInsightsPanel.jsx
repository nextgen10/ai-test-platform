import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, FileSpreadsheet, RotateCcw } from 'lucide-react';

import { formatCost, formatDuration, formatTokens, platformApi } from '@/lib/api';
import { exportAgentUsage } from '@/lib/export-xlsx';
import { Button, Chip, Paper, Skeleton, Tooltip } from './ui/primitives';
import { Select } from './ui/inputs';

/**
 * Per-agent totals over a window — the answer to "which agent is the slow one".
 *
 * The bar under each id is that agent's share of the slowest agent's total
 * time, so the shape of the column says where the run went without anyone
 * having to read the numbers.
 */
export default function AgentInsightsPanel() {
    const [days, setDays] = useState(30);
    const [agents, setAgents] = useState([]);
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
        <Paper flat className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline bg-elevated px-5 py-3.5">
                <div className="flex items-center gap-2">
                    <Activity size={17} className="text-brand" />
                    <div>
                        <p className="text-[0.98rem] font-medium">Agent usage</p>
                        <p className="ui-caption text-subtle">Where time and money go, per agent</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {agents.length > 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => exportAgentUsage(agents, days)}
                        >
                            <FileSpreadsheet size={14} />
                            Excel
                        </Button>
                    )}
                    <Select
                        className="w-[148px] shrink-0"
                        value={days}
                        onChange={(event) => setDays(Number(event.target.value))}
                        aria-label="Reporting window"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3 p-6">
                    <Skeleton variant="rect" height={40} />
                    <Skeleton variant="rect" height={40} />
                    <Skeleton variant="rect" height={40} />
                </div>
            ) : agents.length === 0 ? (
                <div className="p-10 text-center">
                    <p className="ui-body2 text-subtle">
                        No runs recorded in this window. Once jobs complete, each agent&apos;s share of the
                        time and cost appears here.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="ui-table ui-table-dense [&_td]:text-[0.78rem] [&_th]:text-[0.78rem]">
                        <thead>
                            <tr>
                                <th>Agent</th>
                                <th className="text-right">Runs</th>
                                <th className="text-right">Mean</th>
                                <th className="text-right">Total time</th>
                                <th className="text-right">Tokens</th>
                                <th className="text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => (
                                <tr key={agent.agent_id}>
                                    <td className="max-w-[220px]">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-mono text-[0.78rem] font-medium">
                                                {agent.agent_id}
                                            </span>
                                            {agent.failures > 0 && (
                                                <Tooltip title={`${agent.failures} of ${agent.runs} runs failed`}>
                                                    <Chip color="error" className="h-[17px] gap-1 text-[0.62rem]">
                                                        <AlertTriangle size={10} />
                                                        {`${Math.round(agent.failure_rate * 100)}%`}
                                                    </Chip>
                                                </Tooltip>
                                            )}
                                            {agent.retries > 0 && (
                                                <Tooltip title={`Corrected its own output ${agent.retries} time(s)`}>
                                                    <Chip className="h-[17px] gap-1 text-[0.62rem]">
                                                        <RotateCcw size={10} />
                                                        {agent.retries}
                                                    </Chip>
                                                </Tooltip>
                                            )}
                                        </div>
                                        <div className="mt-1 h-[3px] w-full bg-[color-mix(in_srgb,var(--col-text-primary)_6%,transparent)]">
                                            <div
                                                className="h-full bg-[color-mix(in_srgb,var(--col-background-brand)_55%,transparent)]"
                                                style={{ width: `${(agent.total_duration_ms / slowest) * 100}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className="text-right tabular-nums">{agent.runs}</td>
                                    <td className="text-right tabular-nums">{formatDuration(agent.mean_duration_ms)}</td>
                                    <td className="text-right tabular-nums">{formatDuration(agent.total_duration_ms)}</td>
                                    <td className="text-right tabular-nums">{formatTokens(agent.total_tokens)}</td>
                                    <td className="text-right tabular-nums">{formatCost(agent.cost_usd)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pricingVersion && agents.length > 0 && (
                <div className="border-t border-hairline px-5 py-2">
                    <p className="text-[0.68rem] text-faint">
                        Costs estimated from list prices as of {pricingVersion}. An agent whose model is not
                        in the table shows no cost rather than zero.
                    </p>
                </div>
            )}
        </Paper>
    );
}
