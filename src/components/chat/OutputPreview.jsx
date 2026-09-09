import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListItemText,
    Button as MuiButton,
} from '@mui/material';
import { selectMenuProps } from '@/theme/mui-theme';
import {
    ArrowRight, Bot, Check, Clock, Code2, Copy, Database, Download, FileText, Layers,
    Maximize2, Minimize2, Sparkles, Table2 as TableIcon,
} from 'lucide-react';

import { extractJson, forChatPreview } from '@/lib/agent-output';
import { copyToClipboard } from '@/lib/clipboard';
import { downloadBlob } from '@/lib/download';
import { cx } from '../ui/cx';
import { Alert, Chip, Button, IconButton, Paper, Tooltip } from '../ui/primitives';
import { Tabs } from '../ui/tabs';
import { JsonDocumentView } from './JsonDocumentView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingIndicator } from './StreamingIndicator';

export function OutputPreview({
    agentId,
    agentName,
    content,
    isStreaming = false,
    duration_ms: durationMs,
    error,
    onPassOutput,
    availableAgents = [],
    /** Pipeline-suggested successors — shown first and pre-selected when present. */
    suggestedAgentIds = [],
}) {
    const [activeTab, setActiveTab] = useState('preview');
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [selectedTargetAgent, setSelectedTargetAgent] = useState('');

    const parsedJson = useMemo(() => extractJson(content), [content]);
    const hasDocument = parsedJson !== null;
    const previewMarkdown = useMemo(() => forChatPreview(content), [content]);

    // Resolved while rendering, never patched afterwards.
    //
    // Streaming makes an invalid tab the common case rather than the edge one:
    // a partially received JSON payload does not parse, so the two document tabs
    // disappear mid-stream and return when the closing brace arrives. Deriving
    // the shown tab from what is actually renderable means there is no invalid
    // intermediate state to correct. Preview is the default (chatbot-style);
    // Structured / Data are opt-in.
    const shownTab =
        !hasDocument && (activeTab === 'structured' || activeTab === 'json') ? 'preview' : activeTab;

    useEffect(() => {
        if (!expanded) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') setExpanded(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [expanded]);

    useEffect(() => {
        const preferred = suggestedAgentIds.find((id) => id !== agentId) ?? '';
        if (preferred) setSelectedTargetAgent(preferred);
    }, [agentId, suggestedAgentIds, content]);

    const handleCopy = async () => {
        if (!content) return;
        if (await copyToClipboard(content)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        if (!content) return;
        // Both structured views are showing the document, so both export it as one.
        const isJson = parsedJson !== null && (shownTab === 'json' || shownTab === 'structured');
        downloadBlob(
            new Blob([isJson ? JSON.stringify(parsedJson, null, 2) : content], {
                type: isJson ? 'application/json' : 'text/markdown',
            }),
            `${agentId || 'agent'}-output.${isJson ? 'json' : 'md'}`,
        );
    };

    const targetCandidates = useMemo(
        () => availableAgents.filter((agent) => agent.id !== agentId),
        [availableAgents, agentId],
    );

    const defaultTarget =
        (targetCandidates.some((agent) => agent.id === selectedTargetAgent)
            ? selectedTargetAgent
            : suggestedAgentIds.find((id) => targetCandidates.some((agent) => agent.id === id))) ||
        targetCandidates[0]?.id ||
        '';

    const statusTone = isStreaming ? 'warning' : content ? 'success' : 'default';

    return (
        <div
            className={cx(
                'flex h-full min-h-0 flex-col overflow-hidden rounded-ubs border border-hairline bg-surface',
                expanded ? 'fixed inset-4 z-[1300] shadow-[0_1px_4px_rgba(0,0,0,0.12)]' : 'relative z-[1]',
            )}
        >
            {/* Header */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hairline bg-elevated px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-ubs bg-brand-tint text-brand">
                        <Bot size={16} />
                    </span>
                    <div className="flex min-h-[22px] min-w-0 items-center gap-2">
                        <p className="truncate text-[0.88rem] font-medium">
                            {agentName || agentId || 'Agent Output'}
                        </p>
                        <Chip
                            color={statusTone}
                            className={cx(
                                'h-5 min-w-[88px] justify-center text-[0.68rem] font-medium',
                                !isStreaming && !content && 'invisible',
                            )}
                        >
                            {isStreaming ? 'Running' : content ? 'Completed' : 'Waiting'}
                        </Chip>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tabs
                        className="border-b-0"
                        value={shownTab}
                        onChange={setActiveTab}
                        items={[
                            {
                                value: 'structured',
                                label: 'Structured',
                                icon: <TableIcon size={13} />,
                                disabled: !hasDocument,
                            },
                            { value: 'preview', label: 'Preview', icon: <FileText size={13} /> },
                            {
                                value: 'json',
                                label: 'Data',
                                icon: <Database size={13} />,
                                disabled: !hasDocument,
                            },
                            { value: 'raw', label: 'Raw', icon: <Code2 size={13} /> },
                        ]}
                    />

                    <div className="ml-2 flex shrink-0 items-center gap-1">
                        <span
                            className={cx(
                                'mr-1 flex w-11 items-center justify-end gap-1 text-[0.72rem] text-subtle',
                                !durationMs && 'invisible',
                            )}
                        >
                            <Clock size={12} />
                            <span>{durationMs ? `${(durationMs / 1000).toFixed(1)}s` : '0.0s'}</span>
                        </span>

                        <Tooltip title={copied ? 'Copied!' : 'Copy output'}>
                            <IconButton size="small" onClick={handleCopy} disabled={!content} aria-label="Copy output">
                                {copied ? <Check size={14} className="text-moss" /> : <Copy size={14} />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Export output">
                            <IconButton
                                size="small"
                                onClick={handleDownload}
                                disabled={!content}
                                aria-label="Export output"
                            >
                                <Download size={14} />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={expanded ? 'Collapse preview' : 'Expand full screen'}>
                            <IconButton
                                size="small"
                                onClick={() => setExpanded((value) => !value)}
                                aria-label={expanded ? 'Collapse preview' : 'Expand full screen'}
                            >
                                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {error && (
                <Alert severity="error" className="m-3">
                    {error}
                </Alert>
            )}

            {/* Body */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface p-4 sm:p-5">
                {isStreaming && !content ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <StreamingIndicator />
                        <p className="ui-caption text-subtle">Agent is reasoning and generating output…</p>
                    </div>
                ) : !content ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-center text-subtle">
                        <Sparkles size={28} className="text-brand opacity-50" />
                        <p className="ui-body2 font-medium">No output yet</p>
                        <p className="ui-caption max-w-[360px]">
                            Run this agent on the left. Its output appears here, and you can send it to any other
                            agent.
                        </p>
                    </div>
                ) : shownTab === 'structured' && parsedJson !== null ? (
                    <div className="w-full min-w-0 max-w-full">
                        <JsonDocumentView value={parsedJson} />
                    </div>
                ) : shownTab === 'preview' ? (
                    <div className="w-full min-w-0 max-w-full overflow-x-hidden break-words">
                        <MarkdownRenderer content={previewMarkdown} />
                    </div>
                ) : shownTab === 'json' && parsedJson !== null ? (
                    <Paper flat className="max-w-full overflow-x-auto bg-elevated p-4 font-mono text-[0.82rem]">
                        <pre className="m-0">{JSON.stringify(parsedJson, null, 2)}</pre>
                    </Paper>
                ) : (
                    <Paper
                        flat
                        className="whitespace-pre-wrap break-words bg-elevated p-4 font-mono text-[0.82rem]"
                    >
                        {content}
                    </Paper>
                )}
            </div>

            {/* Chaining bar */}
            {content && !isStreaming && onPassOutput && targetCandidates.length > 0 && (
                <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-t border-hairline bg-elevated px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <Layers size={16} className="text-brand" />
                        <p className="text-[0.82rem] font-medium">Pass to next agent</p>
                    </div>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                        <FormControl
                            size="small"
                            sx={{
                                width: { xs: '100%', sm: 220 },
                                maxWidth: '100%',
                                flex: { xs: '1 1 100%', sm: '0 0 220px' },
                            }}
                        >
                            <InputLabel id="pass-target-label">Next agent</InputLabel>
                            <Select
                                labelId="pass-target-label"
                                label="Next agent"
                                value={defaultTarget}
                                onChange={(e) => setSelectedTargetAgent(String(e.target.value))}
                                MenuProps={selectMenuProps}
                                renderValue={(id) => {
                                    const agent = targetCandidates.find((a) => a.id === id);
                                    return agent?.name || String(id);
                                }}
                                sx={{
                                    fontSize: '0.82rem',
                                    bgcolor: (theme) => (theme.palette.mode === 'light' ? '#fff' : '#2e2e2e'),
                                    '& .MuiSelect-select': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    },
                                }}
                            >
                                {targetCandidates.map((agent) => (
                                    <MenuItem key={agent.id} value={agent.id} sx={{ alignItems: 'flex-start' }}>
                                        <ListItemText
                                            primary={agent.name}
                                            secondary={agent.reason}
                                            primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
                                            secondaryTypographyProps={{
                                                fontSize: '0.7rem',
                                                sx: {
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'normal',
                                                },
                                            }}
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <MuiButton
                            variant="contained"
                            size="small"
                            color="primary"
                            endIcon={<ArrowRight size={14} />}
                            onClick={() => {
                                if (defaultTarget) onPassOutput(defaultTarget);
                            }}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 500,
                                fontSize: '0.8rem',
                                py: 0.6,
                                px: 2,
                                borderRadius: 2,
                            }}
                        >
                            Pass output
                        </MuiButton>
                    </Box>
                </div>
            )}
        </div>
    );
}
