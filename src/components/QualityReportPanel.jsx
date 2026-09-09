import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

import { RATING_COLOR, RATING_LABEL } from '@/lib/api';
import { useThemeMode } from '@/contexts/ThemeContext';
import { alpha, toneColor } from '@/theme';
import { Alert, Button, Chip, LinearProgress, Paper, Spinner } from './ui/primitives';
import { TextArea } from './ui/inputs';
import { Dialog, DialogActions, DialogContent, DialogTitle } from './ui/overlays';

function getRatingFromScore4(score) {
    if (score >= 3.5) return 'very_good';
    if (score >= 2.8) return 'good';
    if (score >= 2.0) return 'average';
    return 'bad';
}

export default function QualityReportPanel({ job, report, onApprove, onReject }) {
    const { mode } = useThemeMode();
    const [busy, setBusy] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState('');

    const awaiting = job.status === 'AWAITING_APPROVAL';

    // The analyst scores out of 4, but some runs report a percentage. Normalise
    // before deriving a rating, or a 78/100 reads as "very good".
    const rawScore = report.overall.score;
    const score4 = rawScore <= 4 ? rawScore : (rawScore / 100) * 4;
    const scorePct = Math.round((score4 / 4) * 100);
    const rating = report.overall.rating || getRatingFromScore4(score4);
    const color = toneColor(RATING_COLOR[rating], mode);

    const act = async (action) => {
        setBusy(true);
        try {
            await action();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">
            {/* 1. Headline score */}
            <Paper flat className="min-w-0 p-5" style={{ borderColor: alpha(color, 0.4) }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                        <span className="text-[0.82rem] font-medium uppercase tracking-[0.04em] text-subtle">
                            Requirement quality (INVEST)
                        </span>
                        <span
                            className="whitespace-nowrap text-2xl font-medium leading-none"
                            style={{ color }}
                        >
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

            {/* 2. Human approval gate */}
            {awaiting ? (
                <Paper
                    flat
                    className="border-2 border-warning bg-[color-mix(in_srgb,var(--col-warning)_6%,transparent)] p-4 shadow-none"
                >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={20} className="text-warning" />
                            <p className="text-[0.94rem] font-medium">
                                Approve this requirement for test generation?
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="contained"
                                className="px-5"
                                disabled={busy}
                                onClick={() => act(onApprove)}
                            >
                                {busy ? <Spinner size={16} className="text-white" /> : <CheckCircle2 size={16} />}
                                Approve &amp; Generate
                            </Button>
                            <Button
                                variant="outlined-danger"
                                className="px-4"
                                disabled={busy}
                                onClick={() => setRejectOpen(true)}
                            >
                                <XCircle size={16} />
                                Reject
                            </Button>
                        </div>
                    </div>
                </Paper>
            ) : job.approved_by ? (
                <Alert severity="success">
                    Approved by {job.approved_by}. Test generation was released.
                </Alert>
            ) : job.status === 'REJECTED' ? (
                <Alert severity="error">Requirement rejected. {job.error_message}</Alert>
            ) : null}

            {/* 3. Blocking issues */}
            {report.blocking_issues && report.blocking_issues.length > 0 && (
                <Alert severity="warning" icon={<AlertTriangle size={18} />}>
                    <p className="ui-body2 mb-1 font-medium">
                        Blocking issues ({report.blocking_issues.length})
                    </p>
                    <ul className="ui-body2 list-disc pl-6">
                        {report.blocking_issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                        ))}
                    </ul>
                </Alert>
            )}

            {/* 4. Criteria breakdown */}
            <Paper flat className="w-full overflow-x-auto">
                <table className="ui-table ui-table-dense w-full min-w-[640px] table-fixed">
                    <thead>
                        <tr>
                            <th className="w-[180px]">Criterion</th>
                            <th className="w-[140px]">Rating</th>
                            <th>Assessment</th>
                            <th>How to improve</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.criteria.map((criterion) => (
                            <tr key={criterion.id}>
                                <td className="whitespace-nowrap font-medium">
                                    {criterion.name ?? criterion.id}
                                </td>
                                <td>
                                    <Chip
                                        color={RATING_COLOR[criterion.rating]}
                                        variant={criterion.rating === 'very_good' ? 'filled' : 'outlined'}
                                        className="h-[22px] text-[0.72rem] font-medium"
                                    >
                                        {RATING_LABEL[criterion.rating]}
                                    </Chip>
                                </td>
                                <td className="text-[0.82rem] leading-relaxed text-subtle">
                                    {criterion.rationale}
                                </td>
                                <td className="text-[0.82rem] leading-relaxed text-faint">
                                    {criterion.improvement ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Paper>

            <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm">
                <DialogTitle onClose={() => setRejectOpen(false)}>Reject this requirement</DialogTitle>
                <DialogContent>
                    <p className="ui-body2 mb-4 text-subtle">
                        The job stops here. Record why, so the requirement can be improved and resubmitted.
                    </p>
                    <TextArea
                        autoFocus
                        rows={3}
                        label="Reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. No acceptance criteria; expiry behaviour is unspecified."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
                    <Button
                        variant="danger"
                        disabled={busy || !reason.trim()}
                        onClick={async () => {
                            await act(() => onReject(reason.trim()));
                            setRejectOpen(false);
                        }}
                    >
                        Reject requirement
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
