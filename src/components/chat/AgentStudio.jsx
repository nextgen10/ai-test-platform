import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListItemText,
} from '@mui/material';
import { selectMenuProps } from '@/theme/mui-theme';
import { ArrowRight, Bot, CheckCircle2, Play, Sparkles, Square, X } from 'lucide-react';

import { useChatContext } from '@/contexts/ChatContext';
import { nextAgents } from '@/lib/agent-flow';
import { displayAgentName } from '@/lib/agent-name';
import { cx } from '../ui/cx';
import { Alert, Button, Chip, IconButton, Paper, Tooltip } from '../ui/primitives';
import { OutputPreview } from './OutputPreview';

const SAMPLE_PROMPTS = {
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

/**
 * How a handed-off turn announces itself, in the transcript and to the agent.
 *
 * Always present when there is a handoff — a pass with no extra instructions
 * used to send the previous output bare, which left the agent unable to tell a
 * colleague's output from a human's brief, and left the transcript with no
 * record that the two runs were one chain.
 */
const HANDOFF_MARKER = 'Output from ';

function buildTurnContent(input, handoff) {
    const extra = input.trim();
    if (!handoff) return extra;
    const passed = `---\n${HANDOFF_MARKER}${handoff.fromAgentName}:\n\n${handoff.content}`;
    return extra ? `${extra}\n\n${passed}` : passed;
}

/**
 * The chain as it stands, read back from a restored session.
 *
 * A run continues the chain only when it consumed a handoff, which the marker
 * above records. Anything else starts a new one — so reopening a session shows
 * the sequence that actually happened rather than every agent it ever ran.
 */
function chainFromMessages(messages) {
    let chain = [];
    let handedOff = false;

    for (const message of messages) {
        if (message.role === 'user') {
            handedOff = message.content.includes(HANDOFF_MARKER);
            continue;
        }
        if (message.role !== 'assistant' || !message.agent_id) continue;
        chain = handedOff && chain.length ? [...chain, message.agent_id] : [message.agent_id];
        handedOff = false;
    }
    return chain;
}

export function AgentStudio() {
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
        () => (catalog?.agents ?? []).filter((agent) => agent.id !== 'ocr-extractor'),
        [catalog],
    );

    const [selectedId, setSelectedId] = useState('');
    const [input, setInput] = useState('');
    const [handoff, setHandoff] = useState(null);
    const [lastOutput, setLastOutput] = useState('');
    const [outputSourceId, setOutputSourceId] = useState(null);
    const [runError, setRunError] = useState(null);
    const [durationMs, setDurationMs] = useState(null);
    const [outputModel, setOutputModel] = useState(null);
    const [chainIds, setChainIds] = useState([]);

    const createdThisRun = useRef(false);
    const seededSession = useRef(undefined);
    const runSessionRef = useRef(null);
    const activeSessionRef = useRef(activeSessionId);
    activeSessionRef.current = activeSessionId;
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const labelFor = useCallback(
        (id) => displayAgentName(id, agents.find((agent) => agent.id === id)?.name),
        [agents],
    );

    const selected = agents.find((agent) => agent.id === selectedId);
    const selectedName = selectedId ? labelFor(selectedId) : 'an agent';

    const suggestions = useMemo(
        () => nextAgents(outputSourceId || selectedId, catalog, 4),
        [outputSourceId, selectedId, catalog],
    );

    useEffect(() => {
        if (agents.length === 0) return;
        setSelectedId((current) => {
            if (current && agents.some((agent) => agent.id === current)) return current;
            const preferred = agents.find((agent) => agent.id === config.agentId) ?? agents[0];
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

        const lastAssistant = [...messagesRef.current]
            .reverse()
            .find((message) => message.role === 'assistant' && message.content);
        setLastOutput(lastAssistant?.content ?? '');
        setDurationMs(lastAssistant?.duration_ms ?? null);
        setOutputModel(lastAssistant?.model ?? null);
        setOutputSourceId(lastAssistant?.agent_id ?? null);
        if (lastAssistant?.agent_id) setSelectedId(lastAssistant.agent_id);

        setChainIds(chainFromMessages(messagesRef.current));
    }, [activeSessionId, sessionLoading]);

    const passToAgent = useCallback(
        (targetAgentId) => {
            if (!targetAgentId || isStreaming) return;
            const output = lastOutput.trim();
            if (!output) {
                // Nothing to pass, so this is a plain switch — same as picking from
                // the dropdown, and it starts a new sequence rather than implying a
                // handoff that carried nothing.
                setSelectedId(targetAgentId);
                updateConfig({ agentId: targetAgentId, workflowId: null });
                setChainIds([]);
                setHandoff(null);
                return;
            }
            const fromId = outputSourceId || selectedId;
            setHandoff({ fromAgentId: fromId, fromAgentName: labelFor(fromId), content: output });
            setInput('');
            setSelectedId(targetAgentId);
            updateConfig({ agentId: targetAgentId, workflowId: null });
        },
        [isStreaming, lastOutput, outputSourceId, selectedId, labelFor, updateConfig],
    );

    /**
     * Switch agent without handing off — Pass is explicit.
     *
     * Picking from the dropdown starts a new sequence. The bar is a record of
     * what fed what, so carrying it across an unrelated pick would draw a chain
     * between two runs that never exchanged anything. Clicking a chip in the bar
     * is navigation within the existing chain, so it keeps it.
     */
    const selectAgent = (id, { startNewChain = true } = {}) => {
        if (!id || id === selectedId || isStreaming) return;
        setSelectedId(id);
        updateConfig({ agentId: id, workflowId: null });
        if (startNewChain) {
            setChainIds([]);
            setHandoff(null);
        }
    };

    const handleRun = async () => {
        if (isStreaming || !selectedId) return;
        const payload = buildTurnContent(input, handoff);
        if (!payload.trim()) return;

        setRunError(null);
        createdThisRun.current = !activeSessionId;
        runSessionRef.current = activeSessionId;
        const runningAgent = selectedId;
        // Captured before the run: `handoff` is cleared on success, and this is
        // what decides whether the sequence bar extends or starts over.
        const continuedFrom = handoff?.fromAgentId ?? null;

        updateConfig({ agentId: selectedId, workflowId: null });
        const result = await runAgentTurn(payload, { agentId: selectedId });

        // Ignore results if the user opened another session mid-run. After
        // first-run session creation, runSessionRef was null — that is fine.
        const nowSession = activeSessionRef.current;
        if (runSessionRef.current !== null && nowSession !== null && runSessionRef.current !== nowSession) {
            return;
        }

        if (result.content) {
            setLastOutput(result.content);
            setOutputSourceId(result.agent_id || runningAgent);
            setDurationMs(result.duration_ms);
            setOutputModel(result.model);
            setChainIds((previous) => {
                // A run that consumed no handoff is the start of a sequence,
                // whatever ran before it.
                if (!continuedFrom) return [runningAgent];
                // Extend the existing chain when it ends where this run began;
                // otherwise root a new one at the agent whose output was passed.
                const base = previous[previous.length - 1] === continuedFrom ? previous : [continuedFrom];
                return [...base, runningAgent];
            });
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
        setInput(
            SAMPLE_PROMPTS[selectedId] ||
                `Describe the task for ${selectedName}. Include the specifications, scenarios, and constraints.`,
        );
    };

    const canRun = Boolean(buildTurnContent(input, handoff).trim()) && !isStreaming && Boolean(selectedId);
    const previewContent = isStreaming ? streamingContent : lastOutput;

    const passTargets = useMemo(() => {
        const suggestedIds = new Set(suggestions.map((suggestion) => suggestion.id));
        const reasonById = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion.reason]));
        const rest = agents
            .filter((agent) => agent.id !== (outputSourceId || selectedId) && !suggestedIds.has(agent.id))
            .map((agent) => ({
                id: agent.id,
                name: displayAgentName(agent.id, agent.name),
                description: agent.description,
                reason: undefined,
            }));
        const preferred = suggestions
            .filter((suggestion) => suggestion.id !== (outputSourceId || selectedId))
            .map((suggestion) => {
                const agent = agents.find((item) => item.id === suggestion.id);
                return {
                    id: suggestion.id,
                    name: displayAgentName(suggestion.id, agent?.name ?? suggestion.name),
                    description: agent?.description,
                    reason: reasonById.get(suggestion.id),
                };
            });
        return [...preferred, ...rest];
    }, [agents, suggestions, outputSourceId, selectedId]);

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden bg-elevated">
            {/* Sequence bar */}
            <div className="custom-scrollbar flex min-w-0 shrink-0 items-center gap-3 overflow-x-auto border-b border-hairline bg-surface px-3 py-2 sm:px-4">
                <p className="shrink-0 text-[0.78rem] text-subtle">
                    Pick an agent, run it, then pass its output to the next.
                </p>
                {chainIds.length > 0 && (
                    <div className="flex min-w-0 items-center gap-1.5">
                        {chainIds.map((id, index) => (
                            <Fragment key={`${id}-${index}`}>
                                {index > 0 && <ArrowRight size={12} className="shrink-0 opacity-40" />}
                                <button
                                    type="button"
                                    // Navigating within the sequence, not starting a new one:
                                    // clicking your own history must not erase it.
                                    onClick={() => !isStreaming && selectAgent(id, { startNewChain: false })}
                                    className={cx(
                                        'ui-chip h-6 gap-1 text-[0.72rem]',
                                        id === selectedId && 'bg-brand-tint',
                                    )}
                                >
                                    <CheckCircle2 size={12} />
                                    {labelFor(id)}
                                </button>
                            </Fragment>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                {/* Brief */}
                <div className="custom-scrollbar flex w-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto p-3 sm:p-4 md:w-[44%]">
                    <Paper flat className="flex min-h-[240px] flex-1 flex-col p-4">
                        {/*
                          One picker at every width. The 240px rail this replaced put
                          eleven agents, each with a clamped two-line description, in a
                          column beside the brief and the output — three panels competing
                          for the same viewport, and the descriptions were truncated
                          exactly where they became useful.
                        */}
                        <Box sx={{ mb: 1.5, flexShrink: 0 }}>
                            <FormControl fullWidth size="small" sx={{ minHeight: 40 }}>
                                <InputLabel id="console-agent-label">Agent</InputLabel>
                                <Select
                                    labelId="console-agent-label"
                                    value={agents.some((a) => a.id === selectedId) ? selectedId : ''}
                                    label="Agent"
                                    onChange={(e) => {
                                        if (e.target.value) selectAgent(e.target.value);
                                    }}
                                    renderValue={(value) =>
                                        value
                                            ? displayAgentName(
                                                  String(value),
                                                  agents.find((a) => a.id === value)?.name,
                                              )
                                            : ''
                                    }
                                    sx={{
                                        '& .MuiSelect-select': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        },
                                    }}
                                    MenuProps={{
                                        ...selectMenuProps,
                                        slotProps: {
                                            paper: {
                                                sx: {
                                                    ...selectMenuProps.slotProps.paper.sx,
                                                    maxHeight: 420,
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

                        <div className="mb-2 flex items-start gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-ubs bg-brand-tint text-brand">
                                <Bot size={16} />
                            </span>
                            <div className="min-h-[52px] min-w-0 flex-1">
                                <p className="truncate text-[0.92rem] font-medium">{selectedName}</p>
                                <p className="line-clamp-2-box min-h-[2.4em] text-[0.75rem] text-subtle">
                                    {selected?.description || ' '}
                                </p>
                            </div>
                        </div>

                        {handoff && (
                            <Alert
                                severity="info"
                                className="mb-3 items-center bg-sunken py-1"
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

                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-[0.82rem] font-medium">
                                {handoff ? 'Extra instructions (optional)' : 'What should this agent do?'}
                            </p>
                            <div className="flex gap-1">
                                {!handoff && (
                                    <Button
                                        variant="text"
                                        size="small"
                                        className="py-0.5 text-[0.75rem]"
                                        onClick={loadSample}
                                    >
                                        <Sparkles size={13} />
                                        Sample
                                    </Button>
                                )}
                                {input && (
                                    <Button
                                        variant="text"
                                        size="small"
                                        className="py-0.5 text-[0.75rem] text-subtle"
                                        onClick={() => setInput('')}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </div>

                        <textarea
                            className="ui-textarea min-h-[180px] flex-1 bg-elevated text-[0.86rem] leading-relaxed"
                            placeholder={
                                handoff
                                    ? `Optional: tell ${selectedName} how to use the previous output…`
                                    : `Brief ${selectedName}…`
                            }
                            value={input}
                            disabled={isStreaming}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canRun) {
                                    event.preventDefault();
                                    handleRun();
                                }
                            }}
                        />

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2">
                            <p className="ui-caption text-subtle">
                                {handoff
                                    ? '⌘/Ctrl + Enter runs this agent on the previous output'
                                    : `${input.length} characters · ⌘/Ctrl + Enter to run`}
                            </p>

                            {isStreaming ? (
                                <Button variant="danger" size="small" className="text-[0.82rem]" onClick={stopStreaming}>
                                    <Square size={13} fill="currentColor" />
                                    Stop
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    size="small"
                                    className="px-5 text-[0.84rem]"
                                    disabled={!canRun}
                                    onClick={handleRun}
                                >
                                    <Play size={14} fill="currentColor" />
                                    Run {selectedName}
                                </Button>
                            )}
                        </div>
                    </Paper>
                </div>

                {/* Output */}
                <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden p-3 sm:p-4 md:w-[56%] md:pl-0">
                    <OutputPreview
                        agentId={isStreaming ? selectedId : outputSourceId || selectedId}
                        agentName={
                            isStreaming ? selectedName : outputSourceId ? labelFor(outputSourceId) : selectedName
                        }
                        content={previewContent}
                        isStreaming={isStreaming}
                        duration_ms={durationMs}
                        model={outputModel}
                        error={runError}
                        onPassOutput={passToAgent}
                        availableAgents={passTargets}
                        suggestedAgentIds={suggestions.map((suggestion) => suggestion.id)}
                    />
                </div>
            </div>
        </div>
    );
}
