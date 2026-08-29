'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Chip, Alert,
    CircularProgress, alpha, useTheme, ToggleButtonGroup, ToggleButton,
    Table, TableBody, TableCell, TableHead, TableRow, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Sparkles, Cpu, Settings as SettingsIcon,
    ShieldCheck, Trash2, ScanText,
    Eye, Edit3, Columns, CheckCircle2,
    ZoomIn, X, 
    AlertTriangle,
} from 'lucide-react';

import { api, type ModelOption } from '@/lib/api';
import { getSavedSettings, getSessionGithubToken } from '@/lib/settings';

const RED = '#e60000';
const GREEN = '#469a6c';
/** Banner colour for an OCR result the backend could not really extract. */
const AMBER = '#af8626';

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

interface OcrMeta {
    filename: string;
    dataUrl: string;
    charCount: number;
    engine: string;
    /** True when the backend could not reach GHCP Vision and returned canned placeholder text instead of a real extraction. */
    isFallback: boolean;
}

/** Lightweight and resilient Markdown parser for formatted spec previews */
function FormattedSpecPreview({ content }: { content: string }) {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    if (!content.trim()) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                <Typography variant="body2">No requirement content to preview.</Typography>
            </Box>
        );
    }

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let tableKey = 0;

    const flushTable = () => {
        if (tableHeaders.length > 0 || tableRows.length > 0) {
            elements.push(
                <Box key={`table-${tableKey++}`} sx={{ my: 2, overflowX: 'auto' }}>
                    <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        {tableHeaders.length > 0 && (
                            <TableHead sx={{ bgcolor: isLight ? '#f4f3ee' : '#1c1c1c' }}>
                                <TableRow>
                                    {tableHeaders.map((h, i) => (
                                        <TableCell key={i} sx={{ fontWeight: 500, fontSize: '0.8rem', py: 1 }}>
                                            {h.trim()}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                        )}
                        <TableBody>
                            {tableRows.map((row, rIdx) => (
                                <TableRow key={rIdx} sx={{ '&:nth-of-type(even)': { bgcolor: isLight ? '#f9f9f7' : 'rgba(255,255,255,0.02)' } }}>
                                    {row.map((cell, cIdx) => (
                                        <TableCell key={cIdx} sx={{ fontSize: '0.8rem', py: 0.8 }}>
                                            {cell.trim()}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            );
            tableHeaders = [];
            tableRows = [];
        }
        inTable = false;
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        // Table row detection
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.slice(1, -1).split('|');
            // Require the GFM-conventional 3+ dashes so an all-placeholder data
            // row (`| -- | -- |` for "no value", common in OCR'd tables) isn't
            // mistaken for a header separator and silently dropped.
            const isSeparator = cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));

            if (isSeparator) {
                if (tableRows.length > 0) {
                    // A separator this far in means a second table started with
                    // no blank line between them. The row just above it is that
                    // table's header, not a data row of the one before it.
                    const nextHeaders = tableRows.pop() as string[];
                    flushTable();
                    tableHeaders = nextHeaders;
                }
                inTable = true;
                return;
            }

            if (!inTable && tableHeaders.length === 0) {
                tableHeaders = cells;
                inTable = true;
            } else {
                tableRows.push(cells);
            }
            return;
        }

        if (inTable) {
            flushTable();
        }

        if (!trimmed) {
            elements.push(<Box key={idx} sx={{ height: 12 }} />);
            return;
        }

        // Headings
        if (trimmed.startsWith('# ')) {
            elements.push(
                <Typography key={idx} variant="h6" fontWeight={500} sx={{ color: RED, mt: 2, mb: 1, letterSpacing: 0 }}>
                    {trimmed.replace('# ', '')}
                </Typography>
            );
        } else if (trimmed.startsWith('## ')) {
            elements.push(
                <Typography key={idx} variant="subtitle1" fontWeight={500} sx={{ color: isLight ? '#1c1c1c' : '#f4f3ee', mt: 2, mb: 0.75, borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>
                    {trimmed.replace('## ', '')}
                </Typography>
            );
        } else if (trimmed.startsWith('### ')) {
            elements.push(
                <Typography key={idx} variant="subtitle2" fontWeight={500} sx={{ color: 'text.secondary', mt: 1.5, mb: 0.5 }}>
                    {trimmed.replace('### ', '')}
                </Typography>
            );
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            // Bullet list item with bold support
            const itemText = trimmed.slice(2);
            elements.push(
                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, my: 0.5, pl: 1 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: RED, mt: 1, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
                        {renderBoldText(itemText)}
                    </Typography>
                </Box>
            );
        } else if (/^\d+\.\s/.test(trimmed)) {
            // Numbered list
            const match = trimmed.match(/^(\d+)\.\s(.*)$/);
            const num = match ? match[1] : '1';
            const itemText = match ? match[2] : trimmed;
            elements.push(
                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, my: 0.5, pl: 1 }}>
                    <Typography variant="caption" fontWeight={500} sx={{ color: RED, minWidth: 16 }}>
                        {num}.
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
                        {renderBoldText(itemText)}
                    </Typography>
                </Box>
            );
        } else {
            // Regular paragraph
            elements.push(
                <Typography key={idx} variant="body2" sx={{ fontSize: '0.86rem', lineHeight: 1.65, color: 'text.primary', my: 0.5 }}>
                    {renderBoldText(trimmed)}
                </Typography>
            );
        }
    });

    if (inTable) {
        flushTable();
    }

    return (
        <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            {elements}
        </Box>
    );
}

function renderBoldText(text: string): React.ReactNode {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={idx} style={{ fontWeight: 500 }}>
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return part;
    });
}

export default function GeneratePage() {
    const router = useRouter();
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    const [models, setModels] = useState<ModelOption[]>([]);
    const [copilotModel, setCopilotModel] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [requirement, setRequirement] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [extractingOcr, setExtractingOcr] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // OCR preview state & view toggle
    const [ocrMeta, setOcrMeta] = useState<OcrMeta | null>(null);
    const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'split'>('editor');
    const [imageModalOpen, setImageModalOpen] = useState(false);

    const [generationEngine, setGenerationEngine] = useState<'mock' | 'copilot'>('copilot');

    useEffect(() => {
        const saved = getSavedSettings();
        setCopilotModel(saved.copilotModel);
        // Held in memory only — a PAT must not survive in localStorage.
        setGithubToken(getSessionGithubToken());
        if (saved.generationEngine) {
            setGenerationEngine(saved.generationEngine);
        }

        const benchmarkReq = sessionStorage.getItem('benchmark_req');
        if (benchmarkReq) {
            setRequirement(benchmarkReq);
            sessionStorage.removeItem('benchmark_req');
        }

        api.models().then(setModels).catch(() => setModels([]));
    }, []);

    const processUploadedFile = useCallback(
        async (file: File) => {
            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
            const isText =
                /\.(md|txt|json)$/i.test(file.name) ||
                file.type.startsWith('text/') ||
                file.type === 'application/json';

            // Drag-and-drop bypasses the file input's `accept` filter, so an
            // unsupported binary would otherwise reach readAsText() below and
            // fill the editor with mojibake instead of reporting a problem.
            if (!isImage && !isText) {
                setError(
                    /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
                        ? 'PDF upload is not supported yet — export the page as PNG, JPG, or WEBP and upload that.'
                        : `Unsupported file type "${file.name}". Upload a PNG, JPG, or WEBP image, or a .md, .txt, or .json file.`
                );
                return;
            }

            if (isImage) {
                setExtractingOcr(true);
                setError(null);
                try {
                    const reader = new FileReader();
                    reader.onload = async () => {
                        try {
                            const dataUrl = String(reader.result ?? '');
                            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                            const res = await api.extractDocumentOcr({
                                image_base64: base64Data,
                                mime_type: file.type || 'image/png',
                                filename: file.name,
                                copilot_model: copilotModel || undefined,
                                github_token: githubToken.trim() || undefined,
                            });

                            setRequirement(res.markdown);
                            setOcrMeta({
                                filename: file.name,
                                dataUrl,
                                charCount: res.char_count,
                                engine: res.engine,
                                isFallback: res.engine === 'ghcp-vision-fallback',
                            });
                            setViewMode('split'); // Automatically show side-by-side preview on OCR completion
                        } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to extract text via document-ocr skill');
                        } finally {
                            setExtractingOcr(false);
                        }
                    };
                    // FileReader failures surface via onerror, not a thrown
                    // exception — without this, a read failure leaves
                    // extractingOcr stuck true and the upload control disabled.
                    reader.onerror = () => {
                        setError('Failed to read the uploaded file');
                        setExtractingOcr(false);
                    };
                    reader.readAsDataURL(file);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to read uploaded file');
                    setExtractingOcr(false);
                }
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    setRequirement(String(reader.result ?? ''));
                    setOcrMeta(null);
                    setViewMode('editor');
                };
                reader.onerror = () => {
                    setError('Failed to read uploaded file');
                };
                reader.readAsText(file);
            }
        },
        [copilotModel, githubToken]
    );

    const handleUpload = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;
            processUploadedFile(file);
            event.target.value = '';
        },
        [processUploadedFile]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            // The Upload button is disabled during extraction; the drop target
            // needs the same guard, or a second drop races the first and the
            // slower response silently overwrites the newer one.
            if (extractingOcr) return;
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            processUploadedFile(file);
        },
        [processUploadedFile, extractingOcr]
    );

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
                engine: generationEngine,
                // Only a genuine extraction counts: fallback text never came
                // from the document, so recording it as a completed OCR phase
                // would put a false claim in the job's provenance trail.
                used_ocr: Boolean(ocrMeta && !ocrMeta.isFallback),
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
                maxWidth: 1400,
                mx: 'auto',
            }}
        >
            {/* Studio Compact Header */}
            <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box sx={{ p: 0.8, borderRadius: 2, bgcolor: RED, color: '#FFFFFF', display: 'flex' }}>
                        <Sparkles size={18} />
                    </Box>
                    <Box>
                        <Typography variant="h5" fontWeight={500} sx={{ letterSpacing: 0, fontSize: '1.25rem', lineHeight: 1.2 }}>
                            Generate Test Cases
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.76rem' }}>
                            Paste business specifications or upload document images to synthesize an autonomous, schema-validated test suite.
                        </Typography>
                    </Box>
                </Box>

                {/* Sample Template Buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.25, fontSize: '0.7rem' }}>
                        Prefill:
                    </Typography>
                    {SAMPLES.map((s) => (
                        <Chip
                            key={s.id}
                            label={s.name}
                            size="small"
                            clickable
                            onClick={() => { setRequirement(s.content); setOcrMeta(null); setViewMode('editor'); }}
                            sx={{
                                fontWeight: 500,
                                fontSize: '0.72rem',
                                height: 26,
                                borderRadius: 2,
                                bgcolor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                                border: '1px solid',
                                borderColor: 'divider',
                                '&:hover': { borderColor: RED, color: RED, bgcolor: alpha(RED, 0.05) },
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* OCR Extracted Notification Banner (When document image is active) */}
            {ocrMeta && (() => {
                const bannerColor = ocrMeta.isFallback ? AMBER : GREEN;
                return (
                <Paper
                    elevation={0}
                    sx={{
                        p: 1.25,
                        px: 2,
                        mb: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(bannerColor, isLight ? 0.08 : 0.15),
                        border: '1px solid',
                        borderColor: alpha(bannerColor, 0.3),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ p: 0.6, borderRadius: 2, bgcolor: bannerColor, color: '#FFFFFF', display: 'flex' }}>
                            {ocrMeta.isFallback ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                        </Box>
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" fontWeight={500} sx={{ fontSize: '0.82rem', color: bannerColor }}>
                                    {ocrMeta.isFallback ? 'OCR Extraction Unavailable — Placeholder Shown' : 'Document OCR Extracted'}
                                </Typography>
                                <Chip
                                    size="small"
                                    label={ocrMeta.filename}
                                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 500, bgcolor: alpha(bannerColor, 0.12), color: bannerColor }}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                                    {ocrMeta.isFallback
                                        ? 'The Vision API call did not succeed, so this is placeholder text — please replace it with the real requirement before generating tests.'
                                        : <>{ocrMeta.charCount} characters transcribed via <strong style={{ color: bannerColor }}>document-ocr</strong> skill</>}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {ocrMeta.dataUrl && (
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ZoomIn size={13} />}
                                onClick={() => setImageModalOpen(true)}
                                sx={{
                                    height: 26,
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    borderRadius: 2,
                                    borderColor: alpha(bannerColor, 0.4),
                                    color: bannerColor,
                                    textTransform: 'none',
                                    '&:hover': { borderColor: bannerColor, bgcolor: alpha(bannerColor, 0.08) },
                                }}
                            >
                                View Original Document
                            </Button>
                        )}
                        <IconButton
                            size="small"
                            onClick={() => { setOcrMeta(null); setViewMode('editor'); }}
                            sx={{ p: 0.5, color: 'text.secondary' }}
                            title="Dismiss OCR Info"
                        >
                            <X size={14} />
                        </IconButton>
                    </Box>
                </Paper>
                );
            })()}

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
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: isDragOver ? RED : 'divider',
                    bgcolor: isLight ? '#FFFFFF' : '#1c1c1c',
                    boxShadow: 'none',
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
                        bgcolor: isLight ? '#f9f9f7' : '#1c1c1c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Business Requirements & Acceptance Criteria
                        </Typography>

                        {/* View Mode Toggle: Edit vs Formatted Preview vs Split View */}
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(_, newMode) => { if (newMode) setViewMode(newMode); }}
                            size="small"
                            sx={{
                                height: 26,
                                '& .MuiToggleButton-root': {
                                    px: 1.2,
                                    py: 0.2,
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    '&.Mui-selected': {
                                        bgcolor: alpha(RED, 0.1),
                                        color: RED,
                                        borderColor: RED,
                                    },
                                },
                            }}
                        >
                            <ToggleButton value="editor">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Edit3 size={12} />
                                    <span>Raw Spec</span>
                                </Box>
                            </ToggleButton>
                            <ToggleButton value="preview">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Eye size={12} />
                                    <span>Formatted Preview</span>
                                </Box>
                            </ToggleButton>
                            {ocrMeta?.dataUrl && (
                                <ToggleButton value="split">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Columns size={12} />
                                        <span>Image & Spec Split</span>
                                    </Box>
                                </ToggleButton>
                            )}
                        </ToggleButtonGroup>
                    </Box>

                    {/* Upload & Clear Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {extractingOcr && (
                            <Chip
                                size="small"
                                icon={<CircularProgress size={12} sx={{ color: RED }} />}
                                label="Running document-ocr skill..."
                                sx={{
                                    height: 28,
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    bgcolor: alpha(RED, 0.08),
                                    color: RED,
                                    border: `1px solid ${alpha(RED, 0.2)}`,
                                }}
                            />
                        )}

                        <Button
                            component="label"
                            variant="outlined"
                            size="small"
                            disabled={extractingOcr}
                            startIcon={<ScanText size={13} />}
                            sx={{
                                height: 28,
                                borderRadius: 2,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'none',
                                borderColor: 'divider',
                                color: 'text.secondary',
                                px: 1.5,
                                '&:hover': { borderColor: 'text.primary', color: 'text.primary' },
                            }}
                        >
                            {extractingOcr ? 'Extracting...' : 'Upload Spec / Document Image'}
                            <input
                                hidden
                                type="file"
                                accept=".md,.txt,.json,.png,.jpg,.jpeg,.webp"
                                onChange={handleUpload}
                            />
                        </Button>

                        {requirement && (
                            <Button
                                variant="text"
                                color="inherit"
                                size="small"
                                onClick={() => { setRequirement(''); setOcrMeta(null); setViewMode('editor'); }}
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

                {/* Editor Body - Dynamic based on viewMode */}
                <Box
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        overflow: 'hidden',
                    }}
                >
                    {/* Mode 1: Pure Editor View */}
                    {viewMode === 'editor' && (
                        <Box sx={{ flexGrow: 1, p: 2.5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                    )}

                    {/* Mode 2: Formatted Markdown Preview */}
                    {viewMode === 'preview' && (
                        <Box sx={{ flexGrow: 1, height: '100%', overflowY: 'auto', p: 1 }}>
                            <FormattedSpecPreview content={requirement} />
                        </Box>
                    )}

                    {/* Mode 3: Split View (Image on Left, Formatted Spec on Right) */}
                    {viewMode === 'split' && ocrMeta?.dataUrl && (
                        <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                            {/* Left: Original Uploaded Document Image */}
                            <Box
                                sx={{
                                    width: { xs: '100%', md: '45%' },
                                    borderRight: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: isLight ? '#f9f9f7' : '#1c1c1c',
                                    p: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    overflowY: 'auto',
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 1.5 }}>
                                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Source Document Image
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="text"
                                        startIcon={<ZoomIn size={12} />}
                                        onClick={() => setImageModalOpen(true)}
                                        sx={{ fontSize: '0.72rem', textTransform: 'none', color: 'text.secondary' }}
                                    >
                                        Enlarge
                                    </Button>
                                </Box>
                                <Box
                                    component="img"
                                    src={ocrMeta.dataUrl}
                                    alt={ocrMeta.filename}
                                    onClick={() => setImageModalOpen(true)}
                                    sx={{
                                        maxWidth: '100%',
                                        maxHeight: 480,
                                        objectFit: 'contain',
                                        borderRadius: 2,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        cursor: 'zoom-in',
                                        boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                                        '&:hover': { opacity: 0.95 },
                                    }}
                                />
                            </Box>

                            {/* Right: Extracted Formatted Spec */}
                            <Box sx={{ width: { xs: '100%', md: '55%' }, height: '100%', overflowY: 'auto', p: 1 }}>
                                <FormattedSpecPreview content={requirement} />
                            </Box>
                        </Box>
                    )}
                </Box>

                {/* Editor Bottom Status & Action Bar */}
                <Box
                    sx={{
                        p: 1.5,
                        px: 2.5,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isLight ? '#f9f9f7' : '#1c1c1c',
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
                                fontWeight: 500,
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
                                    fontWeight: 500,
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
                                fontWeight: 500,
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
                            }}
                        >
                            {submitting ? 'Generating…' : 'Generate Test Cases'}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* Enlarge Document Image Modal */}
            {ocrMeta?.dataUrl && (
                <Dialog
                    open={imageModalOpen}
                    onClose={() => setImageModalOpen(false)}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                        <Typography component="span" variant="subtitle1" fontWeight={500}>
                            {ocrMeta.filename} — Source Document
                        </Typography>
                        <IconButton size="small" onClick={() => setImageModalOpen(false)}>
                            <X size={16} />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#1c1c1c' }}>
                        <Box
                            component="img"
                            src={ocrMeta.dataUrl}
                            alt={ocrMeta.filename}
                            sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 2 }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 2.5, py: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
                            {ocrMeta.charCount} characters transcribed via document-ocr skill
                        </Typography>
                        <Button variant="outlined" size="small" onClick={() => setImageModalOpen(false)}>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {error && (
                <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2, flexShrink: 0 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );
}
