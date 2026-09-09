import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle, CheckCircle2, Columns, Cpu, Edit3, Eye, ScanText, Settings as SettingsIcon,
    ShieldCheck, Sparkles, Trash2, X, ZoomIn,
} from 'lucide-react';

import { cx } from '@/components/ui/cx';
import { Alert, Button, Chip, IconButton, Paper, Spinner } from '@/components/ui/primitives';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { getSavedSettings, getSessionGithubToken } from '@/lib/settings';
import { alpha } from '@/theme';

const BRAND = '#E60000';
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

function renderBoldText(text) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={index} className="font-medium">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return part;
    });
}

/** Lightweight and resilient Markdown parser for formatted spec previews. */
function FormattedSpecPreview({ content }) {
    if (!content.trim()) {
        return (
            <div className="flex h-full items-center justify-center text-subtle">
                <p className="ui-body2">No requirement content to preview.</p>
            </div>
        );
    }

    const lines = content.split('\n');
    const elements = [];

    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    let tableKey = 0;

    const flushTable = () => {
        if (tableHeaders.length > 0 || tableRows.length > 0) {
            const headers = tableHeaders;
            const rows = tableRows;
            elements.push(
                <div key={`table-${tableKey++}`} className="my-4 overflow-x-auto">
                    <table className="ui-table ui-table-dense border border-hairline">
                        {headers.length > 0 && (
                            <thead>
                                <tr>
                                    {headers.map((header, index) => (
                                        <th key={index} className="text-[0.8rem]">
                                            {header.trim()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="even:bg-elevated">
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="text-[0.8rem]">
                                            {cell.trim()}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>,
            );
            tableHeaders = [];
            tableRows = [];
        }
        inTable = false;
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.slice(1, -1).split('|');
            // Require the GFM-conventional 3+ dashes so an all-placeholder data
            // row (`| -- | -- |` for "no value", common in OCR'd tables) isn't
            // mistaken for a header separator and silently dropped.
            const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));

            if (isSeparator) {
                if (tableRows.length > 0) {
                    // A separator this far in means a second table started with
                    // no blank line between them. The row just above it is that
                    // table's header, not a data row of the one before it.
                    const nextHeaders = tableRows.pop();
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

        if (inTable) flushTable();

        if (!trimmed) {
            elements.push(<div key={index} className="h-3" />);
            return;
        }

        if (trimmed.startsWith('# ')) {
            elements.push(
                <p key={index} className="ui-h6 mb-2 mt-4" style={{ color: BRAND }}>
                    {trimmed.replace('# ', '')}
                </p>,
            );
        } else if (trimmed.startsWith('## ')) {
            elements.push(
                <p key={index} className="ui-subtitle1 mb-1.5 mt-4 border-b border-hairline pb-1 text-ink">
                    {trimmed.replace('## ', '')}
                </p>,
            );
        } else if (trimmed.startsWith('### ')) {
            elements.push(
                <p key={index} className="ui-subtitle2 mb-1 mt-3 text-subtle">
                    {trimmed.replace('### ', '')}
                </p>,
            );
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            elements.push(
                <div key={index} className="my-1 flex items-start gap-2 pl-2">
                    <span
                        className="mt-2 size-[5px] shrink-0 rounded-full"
                        style={{ backgroundColor: BRAND }}
                    />
                    <p className="text-[0.86rem] leading-relaxed">{renderBoldText(trimmed.slice(2))}</p>
                </div>,
            );
        } else if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+)\.\s(.*)$/);
            elements.push(
                <div key={index} className="my-1 flex items-start gap-3 pl-2">
                    <span className="ui-caption min-w-4 font-medium" style={{ color: BRAND }}>
                        {match ? match[1] : '1'}.
                    </span>
                    <p className="text-[0.86rem] leading-relaxed">
                        {renderBoldText(match ? match[2] : trimmed)}
                    </p>
                </div>,
            );
        } else {
            elements.push(
                <p key={index} className="my-1 text-[0.86rem] leading-relaxed text-ink">
                    {renderBoldText(trimmed)}
                </p>,
            );
        }
    });

    if (inTable) flushTable();

    return <div className="h-full overflow-y-auto p-4">{elements}</div>;
}

export default function GeneratePage() {
    const navigate = useNavigate();

    const [models, setModels] = useState([]);
    const [copilotModel, setCopilotModel] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [requirement, setRequirement] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [extractingOcr, setExtractingOcr] = useState(false);
    const [error, setError] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // OCR preview state & view toggle
    const [ocrMeta, setOcrMeta] = useState(null);
    const [viewMode, setViewMode] = useState('editor');
    const [imageModalOpen, setImageModalOpen] = useState(false);

    const [generationEngine, setGenerationEngine] = useState('mock');

    useEffect(() => {
        const saved = getSavedSettings();
        setCopilotModel(saved.copilotModel);
        // Held in memory only — a PAT must not survive in localStorage.
        setGithubToken(getSessionGithubToken());
        if (saved.generationEngine) setGenerationEngine(saved.generationEngine);

        const benchmarkReq = sessionStorage.getItem('benchmark_req');
        if (benchmarkReq) {
            setRequirement(benchmarkReq);
            sessionStorage.removeItem('benchmark_req');
        }

        api.models().then(setModels).catch(() => setModels([]));
    }, []);

    const processUploadedFile = useCallback(
        async (file) => {
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
                        : `Unsupported file type "${file.name}". Upload a PNG, JPG, or WEBP image, or a .md, .txt, or .json file.`,
                );
                return;
            }

            if (isImage) {
                setExtractingOcr(true);
                setError(null);
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const dataUrl = String(reader.result ?? '');
                        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                        const result = await api.extractDocumentOcr({
                            image_base64: base64Data,
                            mime_type: file.type || 'image/png',
                            filename: file.name,
                            copilot_model: copilotModel || undefined,
                            github_token: githubToken.trim() || undefined,
                        });

                        setRequirement(result.markdown);
                        setOcrMeta({
                            filename: file.name,
                            dataUrl,
                            charCount: result.char_count,
                            engine: result.engine,
                            isFallback: result.engine === 'ghcp-vision-fallback',
                        });
                        // Show the source beside the transcription as soon as it lands.
                        setViewMode('split');
                    } catch (err) {
                        setError(
                            err instanceof Error
                                ? err.message
                                : 'Failed to extract text via document-ocr skill',
                        );
                    } finally {
                        setExtractingOcr(false);
                    }
                };
                // FileReader failures surface via onerror, not a thrown exception —
                // without this, a read failure leaves extractingOcr stuck true and
                // the upload control disabled.
                reader.onerror = () => {
                    setError('Failed to read the uploaded file');
                    setExtractingOcr(false);
                };
                reader.readAsDataURL(file);
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    setRequirement(String(reader.result ?? ''));
                    setOcrMeta(null);
                    setViewMode('editor');
                };
                reader.onerror = () => setError('Failed to read uploaded file');
                reader.readAsText(file);
            }
        },
        [copilotModel, githubToken],
    );

    const handleUpload = useCallback(
        (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            processUploadedFile(file);
            event.target.value = '';
        },
        [processUploadedFile],
    );

    const handleDrop = useCallback(
        (event) => {
            event.preventDefault();
            setIsDragOver(false);
            // The Upload button is disabled during extraction; the drop target
            // needs the same guard, or a second drop races the first and the
            // slower response silently overwrites the newer one.
            if (extractingOcr) return;
            const file = event.dataTransfer.files?.[0];
            if (!file) return;
            processUploadedFile(file);
        },
        [processUploadedFile, extractingOcr],
    );

    const submit = async () => {
        if (requirement.trim().length < 20) return;
        setSubmitting(true);
        setError(null);
        try {
            const { job_id: jobId } = await api.createJob({
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
            navigate(`/jobs/${jobId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create job');
            setSubmitting(false);
        }
    };

    const handleKeyDown = (event) => {
        if (
            (event.metaKey || event.ctrlKey) &&
            event.key === 'Enter' &&
            !submitting &&
            requirement.trim().length >= 20
        ) {
            submit();
        }
    };

    const charCount = requirement.trim().length;
    const wordCount = requirement.trim() ? requirement.trim().split(/\s+/).length : 0;
    const isValid = charCount >= 20;

    const activeModelName =
        models.find((model) => model.id === copilotModel)?.name || copilotModel || 'Default Copilot Engine';

    const modeButton = (value, icon, label) => (
        <button
            type="button"
            onClick={() => setViewMode(value)}
            className={cx(
                'flex h-[26px] items-center gap-1.5 border px-2 text-[0.72rem] font-medium',
                viewMode === value ? 'border-brand text-brand' : 'border-hairline text-subtle',
            )}
            style={viewMode === value ? { backgroundColor: alpha(BRAND, 0.1) } : undefined}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    const bannerColor = ocrMeta?.isFallback ? AMBER : GREEN;

    return (
        <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-visible px-4 py-4 sm:px-6 md:h-full md:overflow-hidden md:px-8">
            {/* Header */}
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex rounded-ubs p-2 text-white" style={{ backgroundColor: BRAND }}>
                        <Sparkles size={18} />
                    </span>
                    <div>
                        <h1 className="text-[1.25rem] font-medium leading-tight">Generate Test Cases</h1>
                        <p className="block text-[0.76rem] text-subtle">
                            Paste business specifications or upload document images to synthesize an autonomous,
                            schema-validated test suite.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.04em] text-subtle">
                        Prefill:
                    </span>
                    {SAMPLES.map((sample) => (
                        <button
                            key={sample.id}
                            type="button"
                            onClick={() => {
                                setRequirement(sample.content);
                                setOcrMeta(null);
                                setViewMode('editor');
                            }}
                            className="h-[26px] rounded-ubs border border-hairline bg-surface px-2.5 text-[0.72rem] font-medium hover:border-brand hover:text-brand"
                        >
                            {sample.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* OCR banner */}
            {ocrMeta && (
                <Paper
                    flat
                    className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                    style={{
                        backgroundColor: alpha(bannerColor, 0.1),
                        borderColor: alpha(bannerColor, 0.3),
                    }}
                >
                    <div className="flex items-center gap-3">
                        <span
                            className="flex rounded-ubs p-1.5 text-white"
                            style={{ backgroundColor: bannerColor }}
                        >
                            {ocrMeta.isFallback ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[0.82rem] font-medium" style={{ color: bannerColor }}>
                                {ocrMeta.isFallback
                                    ? 'OCR Extraction Unavailable — Placeholder Shown'
                                    : 'Document OCR Extracted'}
                            </p>
                            <Chip
                                className="h-5 text-[0.7rem] font-medium"
                                style={{ backgroundColor: alpha(bannerColor, 0.12), color: bannerColor }}
                            >
                                {ocrMeta.filename}
                            </Chip>
                            <span className="text-[0.74rem] text-subtle">
                                {ocrMeta.isFallback ? (
                                    'The Vision API call did not succeed, so this is placeholder text — please replace it with the real requirement before generating tests.'
                                ) : (
                                    <>
                                        {ocrMeta.charCount} characters transcribed via{' '}
                                        <strong style={{ color: bannerColor }}>document-ocr</strong> skill
                                    </>
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {ocrMeta.dataUrl && (
                            <Button
                                size="small"
                                variant="outlined"
                                className="h-[26px] text-[0.72rem]"
                                style={{ borderColor: alpha(bannerColor, 0.4), color: bannerColor }}
                                onClick={() => setImageModalOpen(true)}
                            >
                                <ZoomIn size={13} />
                                View Original Document
                            </Button>
                        )}
                        <IconButton
                            size="small"
                            title="Dismiss OCR Info"
                            aria-label="Dismiss OCR info"
                            className="text-subtle"
                            onClick={() => {
                                setOcrMeta(null);
                                setViewMode('editor');
                            }}
                        >
                            <X size={14} />
                        </IconButton>
                    </div>
                </Paper>
            )}

            {/* Editor workspace */}
            <Paper
                flat
                className={cx(
                    'flex min-h-[380px] grow flex-col overflow-hidden transition-colors md:min-h-0',
                    isDragOver && 'border-brand',
                )}
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                {/* Toolbar */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-elevated px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="ui-caption font-medium uppercase tracking-[0.04em] text-subtle">
                            Business Requirements &amp; Acceptance Criteria
                        </span>

                        <div className="flex">
                            {modeButton('editor', <Edit3 size={12} />, 'Raw Spec')}
                            {modeButton('preview', <Eye size={12} />, 'Formatted Preview')}
                            {ocrMeta?.dataUrl && modeButton('split', <Columns size={12} />, 'Image & Spec Split')}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {extractingOcr && (
                            <span
                                className="flex h-7 items-center gap-1.5 rounded-ubs border px-2 text-[0.72rem] font-medium"
                                style={{
                                    backgroundColor: alpha(AMBER, 0.08),
                                    color: AMBER,
                                    borderColor: alpha(AMBER, 0.2),
                                }}
                            >
                                <Spinner size={12} className="text-[color:inherit]" />
                                Running document-ocr skill…
                            </span>
                        )}

                        <label
                            className={cx(
                                'ui-btn ui-btn-outlined ui-btn-sm h-7 border-hairline text-[0.75rem] text-subtle hover:border-firm hover:text-ink',
                                extractingOcr && 'pointer-events-none opacity-60',
                            )}
                        >
                            <ScanText size={13} />
                            {extractingOcr ? 'Extracting…' : 'Upload Spec / Document Image'}
                            <input
                                hidden
                                type="file"
                                accept=".md,.txt,.json,.png,.jpg,.jpeg,.webp"
                                onChange={handleUpload}
                                disabled={extractingOcr}
                            />
                        </label>

                        {requirement && (
                            <Button
                                variant="text"
                                size="small"
                                className="h-7 px-2 text-[0.75rem] text-subtle hover:text-brand"
                                onClick={() => {
                                    setRequirement('');
                                    setOcrMeta(null);
                                    setViewMode('editor');
                                }}
                            >
                                <Trash2 size={13} />
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex grow overflow-hidden">
                    {viewMode === 'editor' && (
                        <div className="flex grow flex-col overflow-hidden p-5">
                            <textarea
                                className="custom-scrollbar h-full w-full resize-none border-0 bg-transparent font-mono text-[0.9rem] leading-relaxed text-ink outline-none"
                                placeholder={`Paste requirement text, user story, or acceptance criteria here...\n\nExample:\nREQ-001 High-Value Wire Transfer Authorization\n\nWhen a customer initiates an international wire transfer exceeding $50,000 USD, require dual-factor biometric confirmation and hold for compliance screening...`}
                                value={requirement}
                                onChange={(event) => setRequirement(event.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    )}

                    {viewMode === 'preview' && (
                        <div className="h-full grow overflow-y-auto p-2">
                            <FormattedSpecPreview content={requirement} />
                        </div>
                    )}

                    {viewMode === 'split' && ocrMeta?.dataUrl && (
                        <div className="flex h-full w-full overflow-hidden">
                            <div className="flex w-full flex-col items-center overflow-y-auto border-r border-hairline bg-elevated p-4 md:w-[45%]">
                                <div className="mb-3 flex w-full items-center justify-between">
                                    <span className="ui-caption font-medium uppercase tracking-[0.04em] text-subtle">
                                        Source Document Image
                                    </span>
                                    <Button
                                        variant="text"
                                        size="small"
                                        className="text-[0.72rem] text-subtle"
                                        onClick={() => setImageModalOpen(true)}
                                    >
                                        <ZoomIn size={12} />
                                        Enlarge
                                    </Button>
                                </div>
                                <img
                                    src={ocrMeta.dataUrl}
                                    alt={ocrMeta.filename}
                                    onClick={() => setImageModalOpen(true)}
                                    className="max-h-[480px] max-w-full cursor-zoom-in rounded-ubs border border-hairline object-contain hover:opacity-95"
                                />
                            </div>

                            <div className="h-full w-full overflow-y-auto p-2 md:w-[55%]">
                                <FormattedSpecPreview content={requirement} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Status bar */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline bg-elevated px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <Chip
                            className="h-[26px] gap-1.5 border text-[0.74rem] font-medium"
                            style={{
                                backgroundColor: alpha(BRAND, 0.08),
                                color: BRAND,
                                borderColor: alpha(BRAND, 0.2),
                            }}
                        >
                            <Cpu size={13} />
                            {activeModelName}
                        </Chip>

                        {githubToken.trim() && (
                            <Chip
                                className="h-[26px] gap-1.5 text-[0.74rem] font-medium"
                                style={{ backgroundColor: alpha(GREEN, 0.08), color: GREEN }}
                            >
                                <ShieldCheck size={13} />
                                Custom PAT Active
                            </Chip>
                        )}

                        <Link
                            to="/settings"
                            className="flex items-center gap-1.5 text-[0.74rem] text-subtle no-underline hover:text-ink"
                        >
                            <SettingsIcon size={12} />
                            Change in Settings
                        </Link>
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                        <span
                            className={cx('text-[0.75rem] font-medium', isValid ? 'text-subtle' : 'text-faint')}
                        >
                            {charCount} chars ({wordCount} words) • min 20 (Press Cmd+Enter)
                        </span>

                        <Button
                            variant="contained"
                            size="small"
                            className="h-[38px] px-6 text-[0.88rem]"
                            disabled={submitting || !isValid}
                            onClick={submit}
                        >
                            {submitting ? <Spinner size={16} className="text-white" /> : <Sparkles size={16} />}
                            {submitting ? 'Generating…' : 'Generate Test Cases'}
                        </Button>
                    </div>
                </div>
            </Paper>

            {/* Enlarged document image */}
            {ocrMeta?.dataUrl && (
                <Dialog open={imageModalOpen} onClose={() => setImageModalOpen(false)} maxWidth="lg">
                    <DialogTitle onClose={() => setImageModalOpen(false)}>
                        {ocrMeta.filename} — Source Document
                    </DialogTitle>
                    <DialogContent className="flex justify-center bg-[#1c1c1c] p-4">
                        <img
                            src={ocrMeta.dataUrl}
                            alt={ocrMeta.filename}
                            className="max-h-[75vh] max-w-full rounded-ubs object-contain"
                        />
                    </DialogContent>
                    <DialogActions>
                        <span className="ui-caption mr-auto text-subtle">
                            {ocrMeta.charCount} characters transcribed via document-ocr skill
                        </span>
                        <Button variant="outlined" size="small" onClick={() => setImageModalOpen(false)}>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {error && (
                <Alert severity="error" className="mt-3 shrink-0">
                    {error}
                </Alert>
            )}
        </div>
    );
}
