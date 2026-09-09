import React from 'react';
import { Clock, Coins, Info, RotateCcw, ShieldCheck } from 'lucide-react';

import { formatCost, formatDuration, formatTokens } from '@/lib/api';
import { useThemeMode } from '@/contexts/ThemeContext';
import { alpha, getTokens } from '@/theme';
import { Chip, Paper, Tooltip } from './ui/primitives';

/**
 * Where a run's time and money went, stage by stage.
 *
 * Two honesty rules run through this: a token count derived from character
 * counts is labelled as an estimate, and a model that is not in the pricing
 * table shows no cost at all rather than zero.
 */
export default function RunCostPanel({ breakdown }) {
    const { mode } = useThemeMode();
    const tokens = getTokens(mode);

    const { stages, totals } = breakdown;
    const slowest = Math.max(1, ...stages.map((stage) => stage.duration_ms));

    const statusColor = (status) => {
        if (status === 'failed') return tokens.error;
        if (status === 'skipped') return tokens.text.disabled;
        return tokens.success;
    };

    const totalCellClass = 'border-t-2 border-t-hairline text-right font-medium tabular-nums';

    return (
        <Paper flat className="mt-4 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-hairline bg-elevated px-4 py-3">
                <div className="flex items-center gap-2">
                    <Coins size={16} className="text-brand" />
                    <p className="ui-subtitle2">Run cost</p>
                </div>
                {breakdown.model && (
                    <Chip className="h-5 font-mono text-[0.68rem]">{breakdown.model}</Chip>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="ui-table ui-table-dense [&_td]:text-[0.78rem] [&_th]:text-[0.78rem]">
                    <thead>
                        <tr>
                            <th>Stage</th>
                            <th className="text-right">Time</th>
                            <th className="text-right">Tokens</th>
                            <th className="text-right">Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stages.map((stage, index) => (
                            <tr key={`${stage.stage}-${index}`}>
                                <td className="max-w-[200px]">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="size-1.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: statusColor(stage.status) }}
                                        />
                                        <span className="truncate text-[0.78rem] font-medium">
                                            {stage.stage ?? stage.agent_id}
                                        </span>
                                        {stage.attempts > 1 && (
                                            <Tooltip title={`Corrected its own output ${stage.attempts - 1} time(s)`}>
                                                <Chip className="h-4 gap-1 text-[0.6rem]">
                                                    <RotateCcw size={10} />
                                                    {stage.attempts}
                                                </Chip>
                                            </Tooltip>
                                        )}
                                        {stage.resumed && (
                                            <Tooltip title="Skipped — a previous attempt already completed it">
                                                <Chip className="h-4 text-[0.6rem]">resumed</Chip>
                                            </Tooltip>
                                        )}
                                        {stage.contract && stage.contract.endsWith('.json') && (
                                            <Tooltip title={`Output validated against ${stage.contract}`}>
                                                <ShieldCheck size={12} style={{ color: tokens.success }} />
                                            </Tooltip>
                                        )}
                                    </div>
                                    {/* A bar makes the slow stage obvious without reading numbers. */}
                                    <div className="mt-1 h-[3px] w-full bg-[color-mix(in_srgb,var(--col-text-primary)_6%,transparent)]">
                                        <div
                                            className="h-full"
                                            style={{
                                                width: `${(stage.duration_ms / slowest) * 100}%`,
                                                backgroundColor: alpha(statusColor(stage.status), 0.6),
                                            }}
                                        />
                                    </div>
                                </td>
                                <td className="text-right tabular-nums">
                                    {stage.duration_ms ? formatDuration(stage.duration_ms) : '—'}
                                </td>
                                <td className="text-right tabular-nums">{formatTokens(stage.total_tokens)}</td>
                                <td className="text-right tabular-nums">{formatCost(stage.cost_usd)}</td>
                            </tr>
                        ))}

                        <tr>
                            <td className="border-t-2 border-t-hairline font-medium">Total</td>
                            <td className={totalCellClass}>{formatDuration(totals.stage_duration_ms)}</td>
                            <td className={totalCellClass}>{formatTokens(totals.total_tokens)}</td>
                            <td className={totalCellClass}>{formatCost(totals.cost_usd)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Say plainly which numbers are measured and which are not. */}
            {(totals.tokens_estimated || !totals.cost_known) && (
                <div className="flex items-start gap-2 border-t border-hairline bg-callout px-4 py-2.5">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <p className="ui-caption leading-relaxed text-subtle">
                        {totals.tokens_estimated && (
                            <>Token counts are estimated from text length — the CLI did not report usage for this run. </>
                        )}
                        {!totals.cost_known && (
                            <>
                                No cost is shown because{' '}
                                {breakdown.model ? (
                                    <>
                                        the model <code>{breakdown.model}</code> is not in the pricing table
                                    </>
                                ) : (
                                    <>this run did not record which model it used</>
                                )}
                                .
                            </>
                        )}
                    </p>
                </div>
            )}

            <div className="flex items-center gap-1.5 border-t border-hairline px-4 py-1.5">
                <Clock size={11} className="text-faint" />
                <p className="text-[0.68rem] text-faint">Prices as of {breakdown.pricing_version}</p>
            </div>
        </Paper>
    );
}
