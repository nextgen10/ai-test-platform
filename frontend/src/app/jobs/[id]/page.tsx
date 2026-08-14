'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, Chip, CircularProgress, Table, TableBody,
    TableCell, TableHead, TableRow, Tabs, Tab, Alert, Collapse, IconButton,
    Divider, alpha, useTheme, Tooltip, LinearProgress, Stack,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import {
    ChevronLeft, ChevronDown, ChevronRight, Download, RefreshCw, XCircle,
    CheckCircle2, Loader2, Circle, Activity, Cpu, ShieldCheck, Clock,
    Layers, Terminal, FileCode, Check, Eye, ExternalLink, FileSpreadsheet,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import WorkflowStepper from '@/components/WorkflowStepper';
import QualityReportPanel from '@/components/QualityReportPanel';
import EvaluationPanel from '@/components/EvaluationPanel';
import {
    api, ACTIVE_STATUSES, CATEGORY_LABEL, formatDuration, formatTimestamp,
    STATUS_COLOR, type Job, type TestSuite, type ValidationReport,
} from '@/lib/api';

const PHASES = [
    { key: 'test-designer', label: 'Requirement analysis & scenario design' },
    { key: 'test-generator', label: 'Test case generation' },
    { key: 'test-reviewer', label: 'Review & validation' },
];

const PRIORITY_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
    critical: 'error',
    high: 'warning',
    medium: 'info',
    low: 'default',
};

type PhaseState = 'pending' | 'running' | 'completed' | 'failed';

function derivePhases(job: Job): Record<string, { state: PhaseState; detail: string }> {
    const result: Record<string, { state: PhaseState; detail: string }> = {};
    for (const phase of PHASES) result[phase.key] = { state: 'pending', detail: '' };

    for (const event of job.events ?? []) {
        const name = (event.event_metadata?.phase as string) ?? '';
        if (!(name in result)) continue;
        if (event.event_type === 'phase.started') {
            result[name] = { state: 'running', detail: '' };
        } else if (event.event_type === 'phase.completed') {
            let detail = (event.event_metadata?.detail as string) ?? '';
            if (detail.includes('categories=')) {
                const match = detail.match(/^(\d+\s+test\s+cases)/i);
                detail = match ? match[1] : 'Passed';
            }
            result[name] = {
                state: 'completed',
                detail,
            };
        }
    }

    for (const record of job.provenance?.phases ?? []) {
        if (!(record.name in result)) continue;
        let detail = record.detail || '';
        if (detail.includes('categories=')) {
            const match = detail.match(/^(\d+\s+test\s+cases)/i);
            detail = match ? match[1] : 'Passed';
        }
        const durationStr = record.duration_ms ? formatDuration(record.duration_ms) : '';
        result[record.name] = {
            state: record.status === 'failed' ? 'failed' : 'completed',
            detail: durationStr ? (detail ? `${detail} · ${durationStr}` : durationStr) : detail,
        };
    }

    if (!ACTIVE_STATUSES.includes(job.status) && job.status !== 'COMPLETED') {
        for (const phase of PHASES) {
            if (result[phase.key].state === 'running') result[phase.key].state = 'failed';
        }
    }

    return result;
}

function LiveJobSidePanel({
    job,
    validation,
}: {
    job: Job;
    validation: ValidationReport | null;
}) {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';
    const states = derivePhases(job);
    const completed = PHASES.filter((p) => states[p.key].state === 'completed').length;
    const running = ACTIVE_STATUSES.includes(job.status);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 80, minWidth: 0, width: '100%' }}>
            {/* 1. Job Status & Metrics Card */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Activity size={16} color={running ? theme.palette.primary.main : theme.palette.text.secondary} />
                        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.9rem' }}>
                            Job Status &amp; Progress
                        </Typography>
                    </Box>
                    <Chip label={job.status} color={STATUS_COLOR[job.status]} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem' }} />
                </Box>

                <LinearProgress
                    variant={running && completed === 0 ? 'indeterminate' : 'determinate'}
                    value={(completed / PHASES.length) * 100}
                    sx={{ mb: 2, height: 6, borderRadius: 3 }}
                />

                <Stack spacing={1.2} sx={{ mb: 2 }}>
                    {PHASES.map((phase) => {
                        const { state, detail } = states[phase.key];
                        return (
                            <Box key={phase.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                                {state === 'completed' ? (
                                    <CheckCircle2 size={15} color={theme.palette.success.main} style={{ flexShrink: 0 }} />
                                ) : state === 'failed' ? (
                                    <XCircle size={15} color={theme.palette.error.main} style={{ flexShrink: 0 }} />
                                ) : state === 'running' ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            color: 'info.main',
                                            flexShrink: 0,
                                            animation: 'spin-slow 1.2s linear infinite',
                                            '@keyframes spin-slow': {
                                                from: { transform: 'rotate(0deg)' },
                                                to: { transform: 'rotate(360deg)' },
                                            },
                                        }}
                                    >
                                        <Loader2 size={15} />
                                    </Box>
                                ) : (
                                    <Circle size={15} color={theme.palette.text.disabled} style={{ flexShrink: 0 }} />
                                )}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        flexGrow: 1,
                                        minWidth: 0,
                                        fontWeight: state === 'running' ? 700 : 500,
                                        color: state === 'pending' ? 'text.secondary' : 'text.primary',
                                        fontSize: '0.78rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {phase.label}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.disabled"
                                    sx={{
                                        fontSize: '0.7rem',
                                        flexShrink: 0,
                                        maxWidth: 150,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'right',
                                    }}
                                    title={detail}
                                >
                                    {state === 'running' && !detail ? 'running…' : detail}
                                </Typography>
                            </Box>
                        );
                    })}
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                {/* Quick Meta Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                            Duration
                        </Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
                            {formatDuration(job.duration_ms)}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                            Test Cases
                        </Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
                            {job.summary?.total ?? '—'}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                            Started
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.secondary', fontSize: '0.72rem' }}>
                            {formatTimestamp(job.started_at)}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                            Workflow
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.secondary', fontSize: '0.72rem' }}>
                            {job.workflow}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* 2. Validation Gate Card */}
            {validation && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: validation.valid ? 'divider' : 'error.main',
                        minWidth: 0,
                        bgcolor: validation.valid ? 'transparent' : alpha(theme.palette.error.main, 0.03),
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ShieldCheck size={16} color={validation.valid ? theme.palette.success.main : theme.palette.error.main} />
                            <Typography variant="subtitle2" fontWeight={800} fontSize="0.88rem">
                                Validation Gate
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={validation.valid ? 'Passed all gates' : 'Failed'}
                            color={validation.valid ? 'success' : 'error'}
                            sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800 }}
                        />
                    </Box>

                    {/* Errors list */}
                    {validation.errors && validation.errors.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="error" fontWeight={800} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                                FAILED CHECKS ({validation.errors.length})
                            </Typography>
                            {validation.errors.map((item, index) => (
                                <Box key={index} sx={{ p: 1, mb: 0.75, borderRadius: 1.5, bgcolor: alpha(theme.palette.error.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.2) }}>
                                    <Typography variant="caption" color="error" fontWeight={800} sx={{ display: 'block', fontSize: '0.72rem' }}>
                                        [{item.code}]
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.35 }}>
                                        {item.detail}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}

                    {/* Warnings list */}
                    {validation.warnings && validation.warnings.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="warning.main" fontWeight={800} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                                WARNINGS ({validation.warnings.length})
                            </Typography>
                            {validation.warnings.map((item, index) => (
                                <Box key={index} sx={{ p: 1, mb: 0.75, borderRadius: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.warning.main, 0.2) }}>
                                    <Typography variant="caption" color="warning.main" fontWeight={800} sx={{ display: 'block', fontSize: '0.72rem' }}>
                                        [{item.code}]
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.35 }}>
                                        {item.detail}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}

                    {/* Clean Passing State Description */}
                    {validation.valid && (!validation.errors || validation.errors.length === 0) && (!validation.warnings || validation.warnings.length === 0) && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem', display: 'block', lineHeight: 1.4 }}>
                            All JSON schema contracts, category coverage bounds, and traceability IDs verified.
                        </Typography>
                    )}
                </Paper>
            )}

            {/* 3. Reproducibility & Provenance */}
            {(job.provenance || job.copilot_model || job.copilot_token_set) && (
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700} fontSize="0.88rem" gutterBottom>
                        Reproducibility &amp; Provenance
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        {job.provenance?.engine && (
                            <Chip
                                size="small"
                                variant="outlined"
                                color={job.provenance.engine === 'mock' ? 'warning' : 'default'}
                                label={`engine: ${job.provenance.engine}`}
                                sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                        )}
                        {(job.copilot_model || job.provenance?.copilot_model) && (
                            <Chip size="small" color="primary" variant="outlined" label={`model: ${job.copilot_model || job.provenance?.copilot_model}`} sx={{ height: 22, fontSize: '0.7rem' }} />
                        )}
                        {job.provenance?.model_fallback?.used && (
                            <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                label={`⚠️ Model Fallback: ${job.provenance.model_fallback.requested_model} ➔ ${job.provenance.model_fallback.effective_model}`}
                                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, borderColor: 'warning.main' }}
                                title={job.provenance.model_fallback.reason ?? 'Specified model not permitted on Copilot account; fell back to default model.'}
                            />
                        )}
                        {(job.copilot_token_set || job.provenance?.copilot_token_set) && (
                            <Chip size="small" color="info" variant="outlined" label="custom PAT used" sx={{ height: 22, fontSize: '0.7rem' }} />
                        )}
                        {job.provenance?.review_attempts !== undefined && (
                            <Chip size="small" variant="outlined" label={`review attempts: ${job.provenance.review_attempts}`} sx={{ height: 22, fontSize: '0.7rem' }} />
                        )}
                    </Box>
                </Paper>
            )}

            {/* 4. Live Audit Trail Stream (Expanded View) */}
            {job.events && job.events.length > 0 && (
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={800} fontSize="0.92rem">
                            Audit Trail ({job.events.length})
                        </Typography>
                        <Chip size="small" variant="outlined" label="Live Stream" color="info" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
                    </Box>
                    <Box sx={{
                        p: 1.75,
                        borderRadius: 2.5,
                        bgcolor: isLight ? '#FAFBFC' : '#0D1117',
                        border: '1px solid',
                        borderColor: 'divider',
                        maxHeight: 520,
                        overflowY: 'auto',
                    }} className="custom-scrollbar">
                        {job.events.map((event, index) => (
                            <Box key={index} sx={{ py: 1.25, borderBottom: index < (job.events?.length ?? 0) - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.35 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'primary.main' }}>
                                        {event.event_type}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                        {formatTimestamp(event.timestamp)}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.78rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                    {event.message}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}
        </Box>
    );
}

function exportTestCasesToExcel(jobId: string, suite: TestSuite) {
    if (!suite?.test_cases || suite.test_cases.length === 0) return;

    const headers = [
        'Test Case ID',
        'Title',
        'Category',
        'Priority',
        'Requirement Reference',
        'Preconditions',
        'Execution Steps',
        'Expected Observable Result',
    ];

    const escapeCsv = (val: unknown) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = suite.test_cases.map((tc) => {
        const preconditions = (tc.preconditions ?? []).join('\n');
        const steps = (tc.steps ?? []).map((step, i) => `${i + 1}. ${step}`).join('\n');
        return [
            escapeCsv(tc.id),
            escapeCsv(tc.title),
            escapeCsv(CATEGORY_LABEL[tc.category] ?? tc.category),
            escapeCsv(tc.priority?.toUpperCase()),
            escapeCsv(tc.requirement_reference),
            escapeCsv(preconditions),
            escapeCsv(steps),
            escapeCsv(tc.expected_result),
        ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `test_cases_${jobId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function ResultsTab({ suite, jobId }: { suite: TestSuite; jobId: string }) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const cases = suite.test_cases ?? [];

    const byCategory = cases.reduce<Record<string, number>>((acc, testCase) => {
        acc[testCase.category] = (acc[testCase.category] ?? 0) + 1;
        return acc;
    }, {});

    const filteredCases = selectedCategory
        ? cases.filter((c) => c.category === selectedCategory)
        : cases;

    return (
        <Box sx={{ width: '100%', minWidth: 0 }}>
            {/* Structured Category Metrics Grid with Filter Selection */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
                gap: 1.5,
                mb: 2.5,
                width: '100%',
            }}>
                <Paper
                    elevation={0}
                    onClick={() => setSelectedCategory(null)}
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: selectedCategory === null ? 'primary.main' : 'divider',
                        bgcolor: selectedCategory === null ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>TOTAL</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ mt: 0.25 }}>{cases.length}</Typography>
                </Paper>
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <Paper
                        key={key}
                        elevation={0}
                        onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: selectedCategory === key ? 'primary.main' : 'divider',
                            bgcolor: selectedCategory === key ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {label.toUpperCase()}
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color={byCategory[key] ? 'text.primary' : 'text.disabled'} sx={{ mt: 0.25 }}>
                            {byCategory[key] ?? 0}
                        </Typography>
                    </Paper>
                ))}
            </Box>

            {/* Action Bar with Excel Export Button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary">
                    {selectedCategory ? `${CATEGORY_LABEL[selectedCategory]} Cases (${filteredCases.length})` : `All Test Cases (${cases.length})`}
                </Typography>
                <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<FileSpreadsheet size={16} />}
                    onClick={() => exportTestCasesToExcel(jobId, suite)}
                    sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, px: 2, py: 0.75 }}
                >
                    Export to Excel (.csv)
                </Button>
            </Box>

            {/* Test Cases Table with Fixed Layout */}
            <Paper elevation={0} sx={{ overflowX: 'auto', borderRadius: 2.5, border: '1px solid', borderColor: 'divider', width: '100%' }}>
                <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', minWidth: 680 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 44, p: 1 }} />
                            <TableCell sx={{ width: 140, fontWeight: 700 }}>ID</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                            <TableCell sx={{ width: 125, fontWeight: 700 }}>Category</TableCell>
                            <TableCell sx={{ width: 110, fontWeight: 700 }}>Priority</TableCell>
                            <TableCell sx={{ width: 130, fontWeight: 700 }}>Requirement</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredCases.map((testCase) => {
                            const open = expanded === testCase.id;
                            return (
                                <React.Fragment key={testCase.id}>
                                    <TableRow
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => setExpanded(open ? null : testCase.id)}
                                    >
                                        <TableCell sx={{ p: 1, textAlign: 'center' }}>
                                            <IconButton size="small">
                                                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </IconButton>
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>
                                            {testCase.id}
                                        </TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {testCase.title}
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" variant="outlined" label={CATEGORY_LABEL[testCase.category] ?? testCase.category} sx={{ height: 22, fontSize: '0.72rem' }} />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={testCase.priority}
                                                color={PRIORITY_COLOR[testCase.priority] ?? 'default'}
                                                sx={{ height: 22, fontSize: '0.7rem', textTransform: 'uppercase' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'text.secondary' }}>
                                            {testCase.requirement_reference}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
                                            <Collapse in={open} unmountOnExit>
                                                <Box sx={{ py: 2, px: 3, bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                                                    {testCase.preconditions && testCase.preconditions.length > 0 && (
                                                        <Box sx={{ mb: 1.5 }}>
                                                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                                                PRECONDITIONS
                                                            </Typography>
                                                            <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
                                                                {testCase.preconditions.map((item, index) => (
                                                                    <Typography key={index} component="li" variant="body2" sx={{ fontSize: '0.82rem' }}>{item}</Typography>
                                                                ))}
                                                            </Box>
                                                        </Box>
                                                    )}

                                                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                                        EXECUTION STEPS
                                                    </Typography>
                                                    <Box component="ol" sx={{ pl: 2.5, mt: 0.5, mb: 1.5 }}>
                                                        {testCase.steps.map((item, index) => (
                                                            <Typography key={index} component="li" variant="body2" sx={{ fontSize: '0.82rem' }}>{item}</Typography>
                                                        ))}
                                                    </Box>

                                                    <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2) }}>
                                                        <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ display: 'block', mb: 0.25 }}>
                                                            EXPECTED OBSERVABLE RESULT
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                            {testCase.expected_result}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
}

export default function JobDetailPage() {
    const params = useParams();
    const router = useRouter();
    const theme = useTheme();
    const jobId = String(params.id);

    const [job, setJob] = useState<Job | null>(null);
    const [suite, setSuite] = useState<TestSuite | null>(null);
    const [validation, setValidation] = useState<ValidationReport | null>(null);
    const [logs, setLogs] = useState('');
    const [artifacts, setArtifacts] = useState<{ path: string; size_bytes: number }[]>([]);
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const jobData = await api.getJob(jobId);
            setJob(jobData);
            setError(null);

            const [logsResult, artifactsResult] = await Promise.allSettled([
                api.getLogs(jobId),
                api.listArtifacts(jobId),
            ]);
            if (logsResult.status === 'fulfilled') setLogs(logsResult.value.logs);
            if (artifactsResult.status === 'fulfilled') setArtifacts(artifactsResult.value);

            if (jobData.status === 'COMPLETED') {
                try {
                    const resultData = await api.getResult(jobId);
                    setSuite(resultData.result);
                    setValidation(resultData.validation);
                } catch {
                    /* result not readable yet */
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load job');
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!job || !ACTIVE_STATUSES.includes(job.status)) return;
        const timer = setInterval(load, 2000);
        return () => clearInterval(timer);
    }, [job, load]);

    const [autoSwitched, setAutoSwitched] = useState(false);
    useEffect(() => {
        if (autoSwitched || !job) return;
        if (job.status === 'AWAITING_APPROVAL') {
            setTab(0);
            setAutoSwitched(true);
        } else if (suite) {
            setTab(1);
            setAutoSwitched(true);
        }
    }, [job, suite, autoSwitched]);

    if (loading) {
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', flexGrow: 1, py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !job) {
        return (
            <Box>
                <Button startIcon={<ChevronLeft size={16} />} onClick={() => router.push('/jobs')}>
                    Back to jobs
                </Button>
                <Alert severity="error" sx={{ mt: 2 }}>{error ?? 'Job not found'}</Alert>
            </Box>
        );
    }

    const active = ACTIVE_STATUSES.includes(job.status);

    return (
        <Box sx={{ maxWidth: 1560, mx: 'auto', pb: 6, width: '100%', minWidth: 0 }}>
            {/* Unified Single-Line Top Bar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    mb: 2.5,
                }}
            >
                {/* Left: Back button + Divider + Job Title + Subtitle */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap', minWidth: 0 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ChevronLeft size={16} />}
                        onClick={() => router.push('/jobs')}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 1.5, height: 36 }}
                    >
                        Back to jobs
                    </Button>
                    <Box sx={{ height: 20, width: '1px', bgcolor: 'divider', display: { xs: 'none', sm: 'block' } }} />
                    <Typography variant="h5" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
                        Job {job.id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        &bull; {job.workflow} &bull; created by {job.created_by}
                    </Typography>
                </Box>

                {/* Right: Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshCw size={15} />}
                        onClick={load}
                        sx={{ textTransform: 'none', fontWeight: 600, height: 36, borderRadius: 2 }}
                    >
                        Refresh
                    </Button>
                    {active && (
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<XCircle size={15} />}
                            onClick={async () => {
                                try {
                                    await api.cancelJob(job.id);
                                    load();
                                } catch (err) {
                                    setError(err instanceof Error ? err.message : 'Failed to cancel job');
                                }
                            }}
                            sx={{ textTransform: 'none', fontWeight: 600, height: 36, borderRadius: 2 }}
                        >
                            Cancel
                        </Button>
                    )}
                </Box>
            </Box>

            <WorkflowStepper job={job} />

            {job.error_message && (
                <Alert severity={job.status === 'TIMEOUT' ? 'warning' : 'error'} sx={{ mb: 2.5, borderRadius: 2 }}>
                    {job.error_message}
                </Alert>
            )}

            {/* Split Screen Layout with Strict Non-Shifting CSS Grid */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px', xl: 'minmax(0, 1fr) 420px' },
                gap: 3,
                alignItems: 'start',
                width: '100%',
                minWidth: 0,
            }}>
                {/* LEFT MAIN PANELS */}
                <Box sx={{ minWidth: 0, width: '100%' }}>
                    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2.5, overflow: 'hidden' }}>
                        <Tabs
                            value={tab}
                            onChange={(_, value) => setTab(value)}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                px: 2,
                                minHeight: 50,
                                '& .MuiTab-root': { fontWeight: 700, fontSize: '0.88rem', textTransform: 'none', minHeight: 50 },
                            }}
                        >
                            <Tab
                                label="Requirement Quality"
                                disabled={!job.quality_report}
                            />
                            <Tab label="Generated Test Cases" disabled={!suite} />
                            <Tab label="5-D Evaluation (RQS)" disabled={!job.evaluation} />
                            <Tab label="Execution Logs" />
                            <Tab label="Artifacts" />
                        </Tabs>
                    </Paper>

                    {/* Tab 0: Requirement Quality */}
                    {tab === 0 && job.quality_report && (
                        <QualityReportPanel
                            job={job}
                            report={job.quality_report}
                            onApprove={async () => { await api.approveJob(job.id, job.created_by); await load(); }}
                            onReject={async (reason) => { await api.rejectJob(job.id, job.created_by, reason); await load(); }}
                        />
                    )}

                    {/* Tab 1: Test Cases (Results) */}
                    {tab === 1 && suite && <ResultsTab suite={suite} jobId={job.id} />}

                    {/* Tab 2: 5-D Evaluation */}
                    {tab === 2 && job.evaluation && (
                        <EvaluationPanel
                            job={job}
                            evaluation={job.evaluation}
                            onReprocess={async () => { await api.reprocessJob(job.id); await load(); }}
                        />
                    )}

                    {/* Tab 3: Execution Logs */}
                    {tab === 3 && (
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2.5,
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: theme.palette.mode === 'dark' ? '#0D1117' : '#1C1F24',
                                maxHeight: 560,
                                overflow: 'auto',
                                width: '100%',
                                minWidth: 0,
                            }}
                            className="custom-scrollbar"
                        >
                            <Box
                                component="pre"
                                sx={{
                                    m: 0,
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    color: '#E6EDF3',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {logs || 'No logs yet.'}
                            </Box>
                        </Paper>
                    )}

                    {/* Tab 4: Artifacts */}
                    {tab === 4 && (
                        <Paper elevation={0} sx={{ overflowX: 'auto', borderRadius: 3, border: '1px solid', borderColor: 'divider', width: '100%', minWidth: 0 }}>
                            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Artifact Path</TableCell>
                                        <TableCell align="right" sx={{ width: 120, fontWeight: 700 }}>Size</TableCell>
                                        <TableCell align="right" sx={{ width: 100, fontWeight: 700 }}>Download</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {artifacts.map((artifact) => (
                                        <TableRow key={artifact.path} hover>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {artifact.path}
                                            </TableCell>
                                            <TableCell align="right">{artifact.size_bytes} B</TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    href={api.artifactUrl(job.id, artifact.path)}
                                                    download
                                                >
                                                    <Download size={15} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {artifacts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    No artifacts yet.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}
                </Box>

                {/* RIGHT PERSISTENT LIVE STATUS SIDE PANEL */}
                <Box sx={{ minWidth: 0, width: '100%' }}>
                    <LiveJobSidePanel
                        job={job}
                        validation={validation}
                    />
                </Box>
            </Box>
        </Box>
    );
}
