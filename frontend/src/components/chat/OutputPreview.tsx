'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  useTheme,
  alpha,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItemText,
} from '@mui/material';
import {
  Copy,
  Check,
  Download,
  Code2,
  FileText,
  Database,
  ArrowRight,
  Clock,
  Sparkles,
  Bot,
  Layers,
  Maximize2,
  Minimize2,
  Table2 as TableIcon,
} from 'lucide-react';
import { extractJson, forChatPreview } from '@/lib/agent-output';
import { copyToClipboard } from '@/lib/clipboard';
import { JsonDocumentView } from './JsonDocumentView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingIndicator } from './StreamingIndicator';
import { selectMenuProps } from '@/theme';

/** The views the panel can offer. Two of them exist only for a JSON document. */
type TabId = 'structured' | 'preview' | 'json' | 'raw';

interface OutputPreviewProps {
  agentId?: string | null;
  agentName?: string | null;
  content: string;
  isStreaming?: boolean;
  duration_ms?: number | null;
  model?: string | null;
  error?: string | null;
  onPassOutput?: (targetAgentId: string) => void;
  availableAgents?: { id: string; name: string; description?: string; reason?: string }[];
  /** Pipeline-suggested successors — shown first and pre-selected when present. */
  suggestedAgentIds?: string[];
}

export const OutputPreview: React.FC<OutputPreviewProps> = ({
  agentId,
  agentName,
  content,
  isStreaming = false,
  duration_ms,
  model,
  error,
  onPassOutput,
  availableAgents = [],
  suggestedAgentIds = [],
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [activeTab, setActiveTab] = useState<TabId>('preview');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedTargetAgent, setSelectedTargetAgent] = useState<string>('');

  const parsedJson = useMemo(() => extractJson(content), [content]);
  const hasDocument = parsedJson !== null;
  const previewMarkdown = useMemo(() => forChatPreview(content), [content]);

  // Resolved while rendering, never patched afterwards.
  //
  // Correcting an invalid tab in an effect still lets one render reach MUI with
  // a `value` matching no child, which is precisely what it warns about — and
  // streaming makes that the common case rather than the edge one: a partially
  // received JSON payload does not parse, so the two document tabs disappear
  // mid-stream and return when the closing brace arrives. Deriving the tab from
  // what is actually renderable means there is no invalid intermediate state to
  // correct. Preview is the default (chatbot-style); Structured / Data are opt-in.
  const shownTab: TabId =
    !hasDocument && (activeTab === 'structured' || activeTab === 'json')
      ? 'preview'
      : activeTab;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
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
    const isJson =
      parsedJson !== null && (shownTab === 'json' || shownTab === 'structured');
    const blob = new Blob([isJson ? JSON.stringify(parsedJson, null, 2) : content], {
      type: isJson ? 'application/json' : 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agentId || 'agent'}-output.${isJson ? 'json' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const targetCandidates = useMemo(() => {
    return availableAgents.filter((a) => a.id !== agentId);
  }, [availableAgents, agentId]);

  const defaultTarget =
    (targetCandidates.some((a) => a.id === selectedTargetAgent)
      ? selectedTargetAgent
      : suggestedAgentIds.find((id) => targetCandidates.some((a) => a.id === id))) ||
    targetCandidates[0]?.id ||
    '';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: isLight ? '#ffffff' : '#1c1c1c',
        borderRadius: 2,
        border: '1px solid',
        borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        position: expanded ? 'fixed' : 'relative',
        top: expanded ? 16 : undefined,
        left: expanded ? 16 : undefined,
        right: expanded ? 16 : undefined,
        bottom: expanded ? 16 : undefined,
        zIndex: expanded ? 1300 : 1,
        boxShadow: expanded ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
          bgcolor: isLight ? '#f9f9f7' : '#232323',
          flexWrap: 'wrap',
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
            }}
          >
            <Bot size={16} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 22 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.88rem' }} noWrap>
                {agentName || agentId || 'Agent Output'}
              </Typography>
              <Chip
                label={isStreaming ? 'Running' : content ? 'Completed' : 'Waiting'}
                size="small"
                color={isStreaming ? 'warning' : content ? 'success' : 'default'}
                variant="filled"
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 500,
                  minWidth: 88,
                  visibility: isStreaming || content ? 'visible' : 'hidden',
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Action Controls & Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tabs
            value={shownTab}
            onChange={(_, val) => {
              setActiveTab(val);
            }}
            sx={{
              minHeight: 32,
              '& .MuiTab-root': {
                minHeight: 32,
                py: 0.5,
                px: 1.5,
                fontSize: '0.78rem',
                textTransform: 'none',
                fontWeight: 500,
                minWidth: 'auto',
              },
            }}
          >
            <Tab
              value="structured"
              disabled={!hasDocument}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TableIcon size={13} />
                  <span>Structured</span>
                </Box>
              }
            />
            <Tab
              value="preview"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FileText size={13} />
                  <span>Preview</span>
                </Box>
              }
            />
            <Tab
              value="json"
              disabled={!hasDocument}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Database size={13} />
                  <span>Data</span>
                </Box>
              }
            />
            <Tab
              value="raw"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Code2 size={13} />
                  <span>Raw</span>
                </Box>
              }
            />
          </Tabs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.4,
                fontSize: '0.72rem',
                color: 'text.secondary',
                mr: 0.5,
                width: 44,
                justifyContent: 'flex-end',
                visibility: duration_ms ? 'visible' : 'hidden',
              }}
            >
              <Clock size={12} />
              <span>{duration_ms ? `${(duration_ms / 1000).toFixed(1)}s` : '0.0s'}</span>
            </Box>

            <Tooltip title={copied ? 'Copied!' : 'Copy output'}>
              <IconButton size="small" onClick={handleCopy} disabled={!content} sx={{ p: 0.75 }}>
                {copied ? <Check size={14} color="#469a6c" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Export output">
              <IconButton size="small" onClick={handleDownload} disabled={!content} sx={{ p: 0.75 }}>
                <Download size={14} />
              </IconButton>
            </Tooltip>

            <Tooltip title={expanded ? 'Collapse preview' : 'Expand full screen'}>
              <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.75 }}>
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Error alert if any */}
      {error && (
        <Alert severity="error" sx={{ m: 1.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          p: { xs: 2, sm: 2.5 },
          bgcolor: isLight ? '#ffffff' : '#1c1c1c',
        }}
      >
        {isStreaming && !content ? (
          <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <StreamingIndicator />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Agent is reasoning and generating output…
            </Typography>
          </Box>
        ) : !content ? (
          <Box
            sx={{
              py: 8,
              textAlign: 'center',
              color: 'text.secondary',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Sparkles size={28} color={theme.palette.primary.main} style={{ opacity: 0.5 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              No output yet
            </Typography>
            <Typography variant="caption" sx={{ maxWidth: 360 }}>
              Run this agent on the left. Its output appears here, and you can send it to any other agent.
            </Typography>
          </Box>
        ) : shownTab === 'structured' && parsedJson !== null ? (
          <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
            <JsonDocumentView value={parsedJson} />
          </Box>
        ) : shownTab === 'preview' ? (
          <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden', wordBreak: 'break-word' }}>
            <MarkdownRenderer content={previewMarkdown} />
          </Box>
        ) : shownTab === 'json' && parsedJson !== null ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
              bgcolor: isLight ? '#f9f9f7' : '#141414',
              fontFamily: 'SFMono-Regular, Consolas, monospace',
              fontSize: '0.82rem',
              overflowX: 'auto',
              maxWidth: '100%',
            }}
          >
            <pre style={{ margin: 0 }}>{JSON.stringify(parsedJson, null, 2)}</pre>
          </Paper>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
              bgcolor: isLight ? '#f9f9f7' : '#141414',
              fontFamily: 'SFMono-Regular, Consolas, monospace',
              fontSize: '0.82rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </Paper>
        )}
      </Box>

      {/* Step Chaining Bar (Pass Output to Next Agent) */}
      {content && !isStreaming && onPassOutput && targetCandidates.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            borderTop: '1px solid',
            borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
            bgcolor: isLight ? '#f9f9f7' : '#232323',
            flexWrap: 'wrap',
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Layers size={16} color={theme.palette.primary.main} />
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.82rem' }}>
              Pass to next agent
            </Typography>
          </Box>

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
                  bgcolor: isLight ? '#fff' : '#2e2e2e',
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
                      primaryTypographyProps={{
                        fontSize: '0.85rem',
                        noWrap: true,
                      }}
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

            <Button
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
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
