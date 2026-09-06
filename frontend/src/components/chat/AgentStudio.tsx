'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ListItemText,
  TextField,
  Chip,
  Paper,
  Tooltip,
  useTheme,
  alpha,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Bot,
  Play,
  Square,
  Sparkles,
  ArrowRight,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { displayAgentName } from '@/lib/agent-name';
import { nextAgents } from '@/lib/agent-flow';
import { OutputPreview } from './OutputPreview';
import { selectMenuProps } from '@/theme';

interface Handoff {
  fromAgentId: string;
  fromAgentName: string;
  content: string;
}

const SAMPLE_PROMPTS: Record<string, string> = {
  'requirement-analyst':
    'Analyze the following business requirement and provide INVEST assessment, edge cases, and acceptance criteria:\n\n"As an institutional wealth client, I need to schedule multi-currency recurring wire transfers with automated rate locks so that my portfolio rebalancing occurs without manual dealer intervention."',
  'test-generator':
    'Generate comprehensive BDD test scenarios with positive, negative, boundary, and performance test cases for this requirement:\n\n"Users must be able to export test execution runs into multi-sheet formatted Excel workbooks with custom summary metrics, severity distribution, and defect links."',
  'test-evaluator':
    'Evaluate the completeness, edge-case coverage, and quality score for these generated test cases:\n\n```json\n{\n  "test_cases": [\n    {"id": "TC-01", "title": "Successful multi-currency wire execution", "type": "positive"},\n    {"id": "TC-02", "title": "Insufficient funds rejection", "type": "negative"}\n  ]\n}\n```',
  'gap-closer':
    'Identify any gaps or missing assertions in this test scenario:\n\n"Concurrent users accessing the session token refresh endpoint simultaneously under load."',
  'jira-sync':
    'Prepare Jira ticket creation payloads and issue links for the following identified defects and test cases:\n\n"Defect: Rate lock expires before execution confirmation on EUR/USD transfers during weekend rollover."',
};

function buildTurnContent(input: string, handoff: Handoff | null): string {
  const extra = input.trim();
  if (!handoff) return extra;
  if (!extra) return handoff.content;
  return `${extra}\n\n---\nOutput from ${handoff.fromAgentName}:\n\n${handoff.content}`;
}

export const AgentStudio: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const {
    catalog,
    config,
    updateConfig,
    isStreaming,
    streamingContent,
    runAgentTurn,
    stopStreaming,
    activeSessionId,
    messages,
    sessionLoading,
  } = useChatContext();

  const agents = useMemo(
    () => (catalog?.agents ?? []).filter((a) => a.id !== 'ocr-extractor'),
    [catalog],
  );

  const [selectedId, setSelectedId] = useState('');
  const [input, setInput] = useState('');
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [lastOutput, setLastOutput] = useState('');
  const [outputSourceId, setOutputSourceId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [outputModel, setOutputModel] = useState<string | null>(null);
  const [chainIds, setChainIds] = useState<string[]>([]);

  const createdThisRun = useRef(false);
  const seededSession = useRef<string | null | undefined>(undefined);
  const runSessionRef = useRef<string | null>(null);
  const activeSessionRef = useRef(activeSessionId);
  activeSessionRef.current = activeSessionId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const labelFor = useCallback(
    (id: string) => {
      const found = agents.find((a) => a.id === id);
      return displayAgentName(id, found?.name);
    },
    [agents],
  );

  const selected = agents.find((a) => a.id === selectedId);
  const selectedName = selectedId ? labelFor(selectedId) : 'an agent';

  const suggestions = useMemo(
    () => nextAgents(outputSourceId || selectedId, catalog, 4),
    [outputSourceId, selectedId, catalog],
  );

  useEffect(() => {
    if (agents.length === 0) return;
    setSelectedId((current) => {
      if (current && agents.some((a) => a.id === current)) return current;
      const preferred = agents.find((a) => a.id === config.agentId) ?? agents[0];
      return preferred.id;
    });
  }, [agents, config.agentId]);

  // Opening a different session (or New chat) resets the workbench.
  // Creating a session on the first Run must not wipe the output we just got.
  useEffect(() => {
    if (createdThisRun.current && activeSessionId) {
      createdThisRun.current = false;
      seededSession.current = activeSessionId;
      return;
    }
    if (seededSession.current === activeSessionId) return;
    if (activeSessionId && sessionLoading) return;

    seededSession.current = activeSessionId;
    setHandoff(null);
    setInput('');
    setRunError(null);

    const lastAsst = [...messagesRef.current].reverse().find((m) => m.role === 'assistant' && m.content);
    setLastOutput(lastAsst?.content ?? '');
    setDurationMs(lastAsst?.duration_ms ?? null);
    setOutputModel(lastAsst?.model ?? null);
    setOutputSourceId(lastAsst?.agent_id ?? null);
    if (lastAsst?.agent_id) {
      setSelectedId(lastAsst.agent_id);
    }

    const seen: string[] = [];
    for (const m of messagesRef.current) {
      if (m.role === 'assistant' && m.agent_id && !seen.includes(m.agent_id)) {
        seen.push(m.agent_id);
      }
    }
    setChainIds(seen);
  }, [activeSessionId, sessionLoading]);

  const passToAgent = useCallback(
    (targetAgentId: string) => {
      if (!targetAgentId || isStreaming) return;
      const output = lastOutput.trim();
      if (!output) {
        setSelectedId(targetAgentId);
        updateConfig({ agentId: targetAgentId, workflowId: null });
        return;
      }
      const fromId = outputSourceId || selectedId;
      setHandoff({
        fromAgentId: fromId,
        fromAgentName: labelFor(fromId),
        content: output,
      });
      setInput('');
      setSelectedId(targetAgentId);
      updateConfig({ agentId: targetAgentId, workflowId: null });
    },
    [isStreaming, lastOutput, outputSourceId, selectedId, labelFor, updateConfig],
  );

  /** Switch agent without handing off — Pass is explicit. */
  const selectAgent = (id: string) => {
    if (!id || id === selectedId || isStreaming) return;
    setSelectedId(id);
    updateConfig({ agentId: id, workflowId: null });
  };

  const handleRun = async () => {
    if (isStreaming || !selectedId) return;
    const payload = buildTurnContent(input, handoff);
    if (!payload.trim()) return;

    setRunError(null);
    createdThisRun.current = !activeSessionId;
    runSessionRef.current = activeSessionId;
    const runningAgent = selectedId;

    updateConfig({ agentId: selectedId, workflowId: null });
    const result = await runAgentTurn(payload, { agentId: selectedId });

    // Ignore results if the user opened another session mid-run.
    // After first-run session creation, runSessionRef was null — that is fine.
    const nowSession = activeSessionRef.current;
    if (
      runSessionRef.current !== null &&
      nowSession !== null &&
      runSessionRef.current !== nowSession
    ) {
      return;
    }

    if (result.content) {
      setLastOutput(result.content);
      setOutputSourceId(result.agent_id || runningAgent);
      setDurationMs(result.duration_ms);
      setOutputModel(result.model);
      setChainIds((prev) => (prev.includes(runningAgent) ? prev : [...prev, runningAgent]));
    }
    setRunError(
      result.error ?? (result.stopped && !result.content ? 'Stopped before any output.' : null),
    );
    // Keep the handoff on failure so the user can retry without re-passing.
    if (!result.error && !result.stopped) {
      setHandoff(null);
      setInput('');
    }
  };

  const loadSample = () => {
    const sample =
      SAMPLE_PROMPTS[selectedId] ||
      `Describe the task for ${selectedName}. Include the specifications, scenarios, and constraints.`;
    setInput(sample);
  };

  const canRun = Boolean(buildTurnContent(input, handoff).trim()) && !isStreaming && Boolean(selectedId);
  const previewContent = isStreaming ? streamingContent : lastOutput;

  const passTargets = useMemo(() => {
    const suggestedIds = new Set(suggestions.map((s) => s.id));
    const reasonById = new Map(suggestions.map((s) => [s.id, s.reason]));
    const rest = agents
      .filter((a) => a.id !== (outputSourceId || selectedId) && !suggestedIds.has(a.id))
      .map((a) => ({
        id: a.id,
        name: displayAgentName(a.id, a.name),
        description: a.description,
        reason: undefined as string | undefined,
      }));
    const preferred = suggestions
      .filter((s) => s.id !== (outputSourceId || selectedId))
      .map((s) => {
        const ag = agents.find((a) => a.id === s.id);
        return {
          id: s.id,
          name: displayAgentName(s.id, ag?.name ?? s.name),
          description: ag?.description,
          reason: reasonById.get(s.id),
        };
      });
    return [...preferred, ...rest];
  }, [agents, suggestions, outputSourceId, selectedId]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        maxWidth: '100%',
        bgcolor: isLight ? '#f9f9f7' : '#171717',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 1.5, sm: 2 },
          py: 1,
          borderBottom: '1px solid',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
          bgcolor: isLight ? '#ffffff' : '#1f1f1f',
          flexShrink: 0,
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0, fontSize: '0.78rem' }}>
          Pick an agent, run it, then pass its output to the next.
        </Typography>
        {chainIds.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {chainIds.map((id, idx) => (
              <React.Fragment key={`${id}-${idx}`}>
                {idx > 0 && <ArrowRight size={12} style={{ opacity: 0.4, flexShrink: 0 }} />}
                <Chip
                  size="small"
                  icon={<CheckCircle2 size={12} />}
                  label={labelFor(id)}
                  onClick={() => !isStreaming && selectAgent(id)}
                  sx={{
                    height: 24,
                    fontSize: '0.72rem',
                    bgcolor:
                      id === selectedId ? alpha(theme.palette.primary.main, 0.12) : undefined,
                  }}
                />
              </React.Fragment>
            ))}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: { xs: '100%', md: '44%' },
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
              p: { xs: 1.5, sm: 2 },
              gap: 1.5,
              overflowY: 'auto',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                bgcolor: isLight ? '#ffffff' : '#222222',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 240,
              }}
            >
              {/* One picker at every width. The 240px rail this replaced put
                  eleven agents, each with a clamped two-line description, in a
                  column beside the brief and the output — three panels
                  competing for the same viewport, and the descriptions were
                  truncated exactly where they became useful. A dropdown costs
                  one click and gives the description its full width. */}
              <Box sx={{ mb: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="console-agent-label">Agent</InputLabel>
                  <Select
                    labelId="console-agent-label"
                    value={agents.some((a) => a.id === selectedId) ? selectedId : ''}
                    label="Agent"
                    onChange={(e) => {
                      if (e.target.value) selectAgent(e.target.value);
                    }}
                    // Closed, the control shows the name alone: rendering the
                    // description here would grow the field every time the
                    // selection changed.
                    renderValue={(value) =>
                      value
                        ? displayAgentName(
                            String(value),
                            agents.find((a) => a.id === value)?.name,
                          )
                        : ''
                    }
                    MenuProps={{
                      ...selectMenuProps,
                      slotProps: {
                        paper: {
                          sx: {
                            ...selectMenuProps.slotProps.paper.sx,
                            maxHeight: 420,
                            // Open, each option wraps to as many lines as its
                            // description needs. This is the same treatment the
                            // workflow picker in ConfigBar already uses.
                            '& .MuiMenuItem-root': {
                              whiteSpace: 'normal',
                              alignItems: 'flex-start',
                              py: 1,
                            },
                          },
                        },
                      },
                    }}
                    disabled={agents.length === 0 || isStreaming}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>{agents.length === 0 ? 'Loading agents…' : 'Select an agent'}</em>
                    </MenuItem>
                    {agents.map((ag) => (
                      <MenuItem key={ag.id} value={ag.id}>
                        <ListItemText
                          primary={displayAgentName(ag.id, ag.name)}
                          secondary={ag.description || undefined}
                          primaryTypographyProps={{
                            fontSize: '0.85rem',
                            fontWeight: 500,
                          }}
                          secondaryTypographyProps={{
                            fontSize: '0.75rem',
                            sx: { whiteSpace: 'normal', mt: 0.25 },
                          }}
                          sx={{ my: 0 }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={16} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.92rem' }}>
                    {selectedName}
                  </Typography>
                  {selected?.description && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {selected.description}
                    </Typography>
                  )}
                </Box>
              </Box>

              {handoff && (
                <Alert
                  severity="info"
                  sx={{
                    mb: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                    alignItems: 'center',
                    bgcolor: isLight ? '#f4f3ee' : '#2a2a2a',
                    color: 'text.primary',
                    '& .MuiAlert-icon': { color: theme.palette.primary.main },
                  }}
                  action={
                    <Tooltip title="Run this agent from a fresh brief instead">
                      <IconButton
                        size="small"
                        onClick={() => setHandoff(null)}
                        aria-label="Clear handed-off output"
                      >
                        <X size={14} />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  Output from <strong>{handoff.fromAgentName}</strong> will be sent with this run.
                  Add extra instructions below, or leave it blank.
                </Alert>
              )}

              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.82rem' }}>
                  {handoff ? 'Extra instructions (optional)' : 'What should this agent do?'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {!handoff && (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<Sparkles size={13} />}
                      onClick={loadSample}
                      sx={{ fontSize: '0.75rem', textTransform: 'none', py: 0.2 }}
                    >
                      Sample
                    </Button>
                  )}
                  {input && (
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      onClick={() => setInput('')}
                      sx={{
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        py: 0.2,
                        color: 'text.secondary',
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </Box>
              </Box>

              <TextField
                multiline
                fullWidth
                minRows={8}
                placeholder={
                  handoff
                    ? `Optional: tell ${selectedName} how to use the previous output…`
                    : `Brief ${selectedName}…`
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRun) {
                    e.preventDefault();
                    void handleRun();
                  }
                }}
                disabled={isStreaming}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isLight ? '#f9f9f7' : '#1a1a1a',
                    fontSize: '0.86rem',
                    lineHeight: 1.5,
                    borderRadius: 2,
                  },
                }}
              />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 1.5,
                  pt: 1,
                  borderTop: '1px solid',
                  borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {handoff
                    ? '⌘/Ctrl + Enter runs this agent on the previous output'
                    : `${input.length} characters · ⌘/Ctrl + Enter to run`}
                </Typography>

                {isStreaming ? (
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    startIcon={<Square size={13} fill="currentColor" />}
                    onClick={() => stopStreaming()}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.82rem',
                    }}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<Play size={14} fill="currentColor" />}
                    disabled={!canRun}
                    onClick={() => void handleRun()}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.84rem',
                      px: 2.5,
                    }}
                  >
                    Run {selectedName}
                  </Button>
                )}
              </Box>
            </Paper>
          </Box>

          <Box
            sx={{
              width: { xs: '100%', md: '56%' },
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              p: { xs: 1.5, sm: 2 },
              pl: { md: 0 },
              overflow: 'hidden',
            }}
          >
            <OutputPreview
              agentId={isStreaming ? selectedId : outputSourceId || selectedId}
              agentName={
                isStreaming
                  ? selectedName
                  : outputSourceId
                    ? labelFor(outputSourceId)
                    : selectedName
              }
              content={previewContent}
              isStreaming={isStreaming}
              duration_ms={durationMs}
              model={outputModel}
              error={runError}
              onPassOutput={passToAgent}
              availableAgents={passTargets}
              suggestedAgentIds={suggestions.map((s) => s.id)}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
