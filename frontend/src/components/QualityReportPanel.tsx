'use client';

import React, { useState } from 'react';
import {
    Box, Paper, Typography, Chip, Button, Table, TableBody, TableCell, TableHead,
    TableRow, Alert, LinearProgress, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, CircularProgress, alpha, useTheme,
} from '@mui/material';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

import {
    RATING_COLOR, RATING_LABEL, type Job, type QualityReport, type Rating,
} from '@/lib/api';

interface Props {
    job: Job;
    report: QualityReport;
    onApprove: () => Promise<void>;
    onReject: (reason: string) => Promise<void>;
}

function getRatingFromScore4(score: number): Rating {
    if (score >= 3.5) return 'very_good';
    if (score >= 2.8) return 'good';
    if (score >= 2.0) return 'average';
    return 'bad';
}

export default function QualityReportPanel({ job, report, onApprove, onReject }: Props) {
    const theme = useTheme();
    const [busy, setBusy] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState('');

    const awaiting = job.status === 'AWAITING_APPROVAL';
    
    const rawScore = report.overall.score;
    const score4 = rawScore <= 4 ? rawScore : (rawScore / 100) * 4;
    const scorePct = Math.round((score4 / 4) * 100);
    const rating: Rating = (report.overall.rating as Rating) || getRatingFromScore4(score4);
    const color = theme.palette[RATING_COLOR[rating]].main;

    const act = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
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
                            REQUIREMENT QUALITY (INVEST)
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

            {/* 2. Human Approval Gate (Single Line) */}
            {awaiting ? (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '2px solid',
                        borderColor: 'warning.main',
                        bgcolor: alpha(theme.palette.warning.main, 0.06),
                        boxShadow: `0 4px 20px ${alpha(theme.palette.warning.main, 0.12)}`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <AlertTriangle size={20} color={theme.palette.warning.main} />
                            <Typography variant="subtitle1" fontWeight={800} sx={{ fontSize: '0.94rem' }}>
                                Approve this requirement for test generation?
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                            <Button
                                variant="contained"
                                color="primary"
                                disabled={busy}
                                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CheckCircle2 size={16} />}
                                onClick={() => act(onApprove)}
                                sx={{ fontWeight: 800, textTransform: 'none', px: 2.5 }}
                            >
                                Approve &amp; Generate
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                disabled={busy}
                                startIcon={<XCircle size={16} />}
                                onClick={() => setRejectOpen(true)}
                                sx={{ fontWeight: 800, textTransform: 'none', px: 2 }}
                            >
                                Reject
                            </Button>
                        </Box>
                    </Box>
                </Paper>
            ) : job.approved_by ? (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                    Approved by {job.approved_by}. Test generation was released.
                </Alert>
            ) : job.status === 'REJECTED' ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    Requirement rejected. {job.error_message}
                </Alert>
            ) : null}

            {/* 3. Flagged Blocking Issues */}
            {report.blocking_issues && report.blocking_issues.length > 0 && (
                <Alert severity="warning" icon={<AlertTriangle size={18} />} sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={700} gutterBottom>
                        Blocking issues ({report.blocking_issues.length})
                    </Typography>
                    <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                        {report.blocking_issues.map((issue, i) => (
                            <Typography key={i} component="li" variant="body2">{issue}</Typography>
                        ))}
                    </Box>
                </Alert>
            )}

            {/* 4. Detailed Criteria Breakdown Table */}
            <Paper elevation={0} sx={{ overflowX: 'auto', borderRadius: 2.5, border: '1px solid', borderColor: 'divider', width: '100%' }}>
                <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', minWidth: 640 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 180, fontWeight: 700 }}>Criterion</TableCell>
                            <TableCell sx={{ width: 140, fontWeight: 700 }}>Rating</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Assessment</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>How to improve</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {report.criteria.map((criterion) => (
                            <TableRow key={criterion.id} hover>
                                <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {criterion.name ?? criterion.id}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={RATING_LABEL[criterion.rating]}
                                        color={RATING_COLOR[criterion.rating]}
                                        variant={criterion.rating === 'very_good' ? 'filled' : 'outlined'}
                                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }}
                                    />
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                    {criterion.rationale}
                                </TableCell>
                                <TableCell sx={{ color: 'text.disabled', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                    {criterion.improvement ?? '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 700 }}>Reject this requirement</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        The job stops here. Record why, so the requirement can be improved and resubmitted.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={3}
                        label="Reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. No acceptance criteria; expiry behaviour is unspecified."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
                    <Button
                        color="error"
                        variant="contained"
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
        </Box>
    );
}
