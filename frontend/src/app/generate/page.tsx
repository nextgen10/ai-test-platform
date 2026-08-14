'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Chip, Alert,
    CircularProgress, alpha, useTheme,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Sparkles, Cpu, Settings as SettingsIcon,
    ShieldCheck, Trash2, FileUp,
} from 'lucide-react';

import { api, type ModelOption } from '@/lib/api';
import { getSavedSettings } from '@/lib/settings';

const RED = '#D00000';
const GREEN = '#1F8A70';

const SAMPLES = [
    {
        id: 'pwd-reset',
        name: 'Password Reset',
        tag: 'Auth',
        content: `REQ-042 Password Reset

A registered user should be able to reset their password using a registered email address.

- The system sends a reset link to the email address if it is registered.
- The reset link expires after 30 minutes.
- The new password must be at least 12 characters.
- The new password must not match the previous password.
- After three failed reset attempts within an hour, further attempts are blocked.`,
    },
    {
        id: 'trade-settlement',
        name: 'Trade Settlement',
        tag: 'Securities',
        content: `REQ-108 Instant Trade Settlement & Clearing

As an institutional broker, execute real-time cross-currency trade settlements with bilateral counterparty risk verification.

- Orders above $1,000,000 USD require dual-authorization before routing.
- The clearing engine must validate sufficient margin balance in the trading account before lock-in.
- Settlements must complete within 250ms under normal market conditions.
- If market volatility exceeds Tier-2 thresholds (circuit breaker), automatically transition order to queued settlement state.
- Emits ISO 20022 compliant confirmation messages (pacs.008) to both parties upon completion.`,
    },
    {
        id: 'payment-refund',
        name: 'Payment Refund',
        tag: 'Merchant',
        content: `REQ-089 Automated Merchant Refund Processing

Provide a multi-tier refund processing API for global ecommerce merchants.

- Partial refunds are permitted up to the total original transaction amount.
- Refunds requested within 14 days must route to original payment method without interchange penalties.
- High-risk accounts flagged with chargeback ratio > 1.5% require automated fraud screening step.
- Deny refund requests on settled chargeback disputes.
- All refund transactions must generate immutable audit logs with idempotency keys.`,
    },
];

export default function GeneratePage() {
    const router = useRouter();
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    const [models, setModels] = useState<ModelOption[]>([]);
    const [copilotModel, setCopilotModel] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [requirement, setRequirement] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    useEffect(() => {
        const saved = getSavedSettings();
        setCopilotModel(saved.copilotModel);
        setGithubToken(saved.githubToken);

        const benchmarkReq = sessionStorage.getItem('benchmark_req');
        if (benchmarkReq) {
            setRequirement(benchmarkReq);
            sessionStorage.removeItem('benchmark_req');
        }

        api.models().then(setModels).catch(() => setModels([]));
    }, []);

    const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setRequirement(String(reader.result ?? ''));
        reader.readAsText(file);
        event.target.value = '';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setRequirement(String(reader.result ?? ''));
        reader.readAsText(file);
    }, []);

    const submit = async () => {
        if (requirement.trim().length < 20) return;
        setSubmitting(true);
        setError(null);
        try {
            const { job_id } = await api.createJob({
                requirement: requirement.trim(),
                workflow: 'test-case-generation',
                copilot_model: copilotModel || undefined,
                github_token: githubToken.trim() || undefined,
            });
            router.push(`/jobs/${job_id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create job');
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !submitting && requirement.trim().length >= 20) {
            submit();
        }
    };

    const charCount = requirement.trim().length;
    const wordCount = requirement.trim() ? requirement.trim().split(/\s+/).length : 0;
    const isValid = charCount >= 20;

    const activeModelName = models.find((m) => m.id === copilotModel)?.name || copilotModel || 'Default Copilot Engine';

    return (
        <Box
            sx={{
                height: { xs: 'auto', md: 'calc(100vh - 96px)' },
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                width: '100%',
                maxWidth: 1300,
                mx: 'auto',
            }}
        >
            {/* Studio Compact Header */}
            <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box sx={{ p: 0.8, borderRadius: 1.5, bgcolor: RED, color: '#FFFFFF', display: 'flex' }}>
                        <Sparkles size={18} />
                    </Box>
                    <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em', fontSize: '1.25rem', lineHeight: 1.2 }}>
                            Generate Test Cases
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.76rem' }}>
                            Paste business specifications to synthesize an autonomous, schema-validated test suite.
                        </Typography>
                    </Box>
                </Box>

                {/* Sample Template Buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.25, fontSize: '0.7rem' }}>
                        Prefill:
                    </Typography>
                    {SAMPLES.map((s) => (
                        <Chip
                            key={s.id}
                            label={s.name}
                            size="small"
                            clickable
                            onClick={() => setRequirement(s.content)}
                            sx={{
                                fontWeight: 600,
                                fontSize: '0.72rem',
                                height: 26,
                                borderRadius: 1.5,
                                bgcolor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                                border: '1px solid',
                                borderColor: 'divider',
                                '&:hover': { borderColor: RED, color: RED, bgcolor: alpha(RED, 0.05) },
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* Main Studio Editor Workspace (Fills remaining height) */}
            <Paper
                elevation={0}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    border: '1.5px solid',
                    borderColor: isDragOver ? RED : 'divider',
                    bgcolor: isLight ? '#FFFFFF' : '#141820',
                    boxShadow: isLight
                        ? '0 8px 24px -6px rgba(0,0,0,0.05)'
                        : '0 8px 24px -6px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease',
                    minHeight: { xs: 380, md: 0 },
                }}
            >
                {/* Editor Header Toolbar */}
                <Box
                    sx={{
                        p: 1.25,
                        px: 2.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isLight ? '#FAFBFC' : '#10141B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                    }}
                >
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Business Requirements &amp; Acceptance Criteria
                    </Typography>

                    {/* Upload & Clear Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                            component="label"
                            variant="outlined"
                            size="small"
                            startIcon={<FileUp size={13} />}
                            sx={{
                                height: 28,
                                borderRadius: 1.5,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                borderColor: 'divider',
                                color: 'text.secondary',
                                px: 1.5,
                                '&:hover': { borderColor: 'text.primary', color: 'text.primary' },
                            }}
                        >
                            Upload File (.md, .txt)
                            <input hidden type="file" accept=".md,.txt,.json" onChange={handleUpload} />
                        </Button>

                        {requirement && (
                            <Button
                                variant="text"
                                color="inherit"
                                size="small"
                                onClick={() => setRequirement('')}
                                startIcon={<Trash2 size={13} />}
                                sx={{
                                    height: 28,
                                    fontSize: '0.75rem',
                                    color: 'text.secondary',
                                    textTransform: 'none',
                                    px: 1,
                                    '&:hover': { color: RED },
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Editor Body - Flexible height with internal scroll */}
                <Box
                    sx={{
                        flexGrow: 1,
                        p: 2.5,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    <TextField
                        fullWidth
                        multiline
                        placeholder={`Paste requirement text, user story, or acceptance criteria here...\n\nExample:\nREQ-001 High-Value Wire Transfer Authorization\n\nWhen a customer initiates an international wire transfer exceeding $50,000 USD, require dual-factor biometric confirmation and hold for compliance screening...`}
                        value={requirement}
                        onChange={(e) => setRequirement(e.target.value)}
                        onKeyDown={handleKeyDown}
                        variant="standard"
                        InputProps={{
                            disableUnderline: true,
                            sx: {
                                height: '100%',
                                alignItems: 'flex-start',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: '0.9rem',
                                lineHeight: 1.65,
                                color: 'text.primary',
                                '& textarea': {
                                    height: '100% !important',
                                    overflowY: 'auto !important',
                                },
                            },
                        }}
                        sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            '& .MuiInputBase-root': {
                                flexGrow: 1,
                            },
                        }}
                    />
                </Box>

                {/* Editor Bottom Status & Action Bar */}
                <Box
                    sx={{
                        p: 1.5,
                        px: 2.5,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isLight ? '#FAFBFC' : '#10141B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        flexShrink: 0,
                    }}
                >
                    {/* Active Configuration Pill */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Chip
                            size="small"
                            icon={<Cpu size={13} color={RED} />}
                            label={activeModelName}
                            sx={{
                                fontWeight: 700,
                                fontSize: '0.74rem',
                                height: 26,
                                bgcolor: alpha(RED, 0.08),
                                color: RED,
                                border: '1px solid',
                                borderColor: alpha(RED, 0.2),
                            }}
                        />

                        {githubToken.trim() && (
                            <Chip
                                size="small"
                                icon={<ShieldCheck size={13} color={GREEN} />}
                                label="Custom PAT Active"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '0.74rem',
                                    height: 26,
                                    bgcolor: alpha(GREEN, 0.08),
                                    color: GREEN,
                                }}
                            />
                        )}

                        <Button
                            component={Link}
                            href="/settings"
                            size="small"
                            variant="text"
                            startIcon={<SettingsIcon size={12} />}
                            sx={{
                                fontSize: '0.74rem',
                                color: 'text.secondary',
                                textTransform: 'none',
                                p: 0,
                                minWidth: 0,
                                '&:hover': { color: 'text.primary' },
                            }}
                        >
                            Change in Settings
                        </Button>
                    </Box>

                    {/* Character Validation Counter & Generate CTA Button */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 600,
                                color: isValid ? 'text.secondary' : 'text.disabled',
                                fontSize: '0.75rem',
                            }}
                        >
                            {charCount} chars ({wordCount} words) &bull; min 20 (Press Cmd+Enter)
                        </Typography>

                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            disabled={submitting || !isValid}
                            onClick={submit}
                            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={16} />}
                            sx={{
                                height: 38,
                                px: 3,
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                borderRadius: 2,
                                boxShadow: '0 4px 12px rgba(208,0,0,0.3)',
                                '&:hover': { boxShadow: '0 6px 18px rgba(208,0,0,0.45)' },
                            }}
                        >
                            {submitting ? 'Generating…' : 'Generate Test Cases'}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2, flexShrink: 0 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );
}
