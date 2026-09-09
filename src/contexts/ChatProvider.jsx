import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api, MIN_JOB_BRIEF_CHARS } from '@/lib/api';
import { chatApi } from '@/lib/chat-api';
import { hubApi } from '@/lib/hub-api';
import { getSessionGithubToken } from '@/lib/settings';
import { ChatContext, EMPTY_CONFIG, exclusiveConfig } from './ChatContext';

/** Matches the server's marker exactly, so a reload does not reword the turn. */
const STOPPED_MARKER = '\n\n_[stopped by the user]_';

/** How many sessions the sidebar asks for at a time. */
const SESSION_PAGE = 50;

/** How many older messages one "load earlier" step pulls in. */
const EARLIER_PAGE = 100;

/**
 * One past the last message's sequence.
 *
 * Deriving this from `messages.length` breaks as soon as a session is opened
 * with only the tail of a long transcript, because the window starts partway in.
 */
function nextSequence(list) {
    const last = list[list.length - 1];
    return last ? last.sequence + 1 : 1;
}

function summarize(session) {
    return {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        last_activity: session.last_activity,
        agent_id: session.agent_id,
        model: session.model,
    };
}

export default function ChatProvider({ children }) {
    const navigate = useNavigate();
    const [, setSearchParams] = useSearchParams();

    const [sessions, setSessions] = useState([]);
    const [hasMoreSessions, setHasMoreSessions] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageTotal, setMessageTotal] = useState(0);
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [error, setError] = useState(null);
    const [config, setConfig] = useState(EMPTY_CONFIG);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [catalog, setCatalog] = useState(null);

    const abortRef = useRef(null);
    const streamedRef = useRef('');
    /** Prevents a second Run from starting before React has painted isStreaming. */
    const runLockRef = useRef(false);
    const landingConsumed = useRef(false);
    const restoredSession = useRef(false);
    // `setSearchParams` is not referentially stable, and the restore effect must
    // run once — reading it through a ref keeps it out of the dependency list.
    const setSearchParamsRef = useRef(setSearchParams);
    setSearchParamsRef.current = setSearchParams;

    useEffect(() => () => abortRef.current?.(), []);

    useEffect(() => {
        hubApi.catalog().then(setCatalog).catch(() => setCatalog(null));
    }, []);

    const syncSessionUrl = useCallback((sessionId) => {
        // From here the console owns the URL. Without this flag the restore
        // effect below would treat a session we just created or opened as a
        // cold load, refetch it, and wipe an in-flight stream.
        if (sessionId) restoredSession.current = true;
        // A replace on the same route re-renders without remounting, so an
        // in-flight stream survives the URL change.
        setSearchParamsRef.current(sessionId ? { session: sessionId } : {}, { replace: true });
    }, []);

    const applyOpenedSession = useCallback((session) => {
        setActiveSessionId(session.id);
        setMessages(session.messages);
        setMessageTotal(session.message_total);
        setStreamingContent('');
        streamedRef.current = '';
        // A stored workflow_id is leftover config, not a job in progress.
        // Restoring it would flip Send back to "Run job" on a real transcript.
        setConfig((previous) =>
            exclusiveConfig(
                {
                    ...previous,
                    skillId: session.skill_id,
                    promptId: session.prompt_id,
                    model: session.model,
                },
                { agentId: session.agent_id, workflowId: null },
            ),
        );
    }, []);

    // Restore ?session= once. Landing ?agent= / ?workflow= apply once, then the
    // URL is owned by the open session so ConfigBar changes stick.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session');

        if (sessionId && !restoredSession.current) {
            restoredSession.current = true;
            landingConsumed.current = true;
            setSessionLoading(true);
            chatApi
                .getSession(sessionId)
                .then(applyOpenedSession)
                .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Could not open that session');
                    syncSessionUrl(null);
                })
                .finally(() => setSessionLoading(false));
            return;
        }

        if (landingConsumed.current || restoredSession.current) return;
        landingConsumed.current = true;

        const fromUrl = {};
        const agent = params.get('agent');
        const workflow = params.get('workflow');
        const skill = params.get('skill');
        const prompt = params.get('prompt');
        const model = params.get('model');

        if (workflow) fromUrl.workflowId = workflow;
        else if (agent) fromUrl.agentId = agent;
        if (skill) fromUrl.skillId = skill;
        if (prompt) fromUrl.promptId = prompt;
        if (model) fromUrl.model = model;

        if (Object.keys(fromUrl).length > 0) {
            setConfig((previous) => exclusiveConfig(previous, fromUrl));
        }
    }, [applyOpenedSession, syncSessionUrl]);

    const loadSessions = useCallback(async () => {
        try {
            const page = await chatApi.listSessions(SESSION_PAGE);
            setSessions(page);
            setHasMoreSessions(page.length === SESSION_PAGE);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load your sessions');
        }
    }, []);

    const loadMoreSessions = useCallback(async () => {
        try {
            const page = await chatApi.listSessions(SESSION_PAGE, sessions.length);
            const known = new Set(sessions.map((session) => session.id));
            setSessions((previous) => [...previous, ...page.filter((session) => !known.has(session.id))]);
            setHasMoreSessions(page.length === SESSION_PAGE);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load older sessions');
        }
    }, [sessions]);

    const openSession = useCallback(
        async (title, from) => {
            const session = await chatApi.createSession({
                title,
                agent_id: from.agentId,
                skill_id: from.skillId,
                prompt_id: from.promptId,
                model: from.model,
            });
            setActiveSessionId(session.id);
            setSessions((previous) => [
                summarize(session),
                ...previous.filter((item) => item.id !== session.id),
            ]);
            syncSessionUrl(session.id);
            return session;
        },
        [syncSessionUrl],
    );

    /**
     * Start a fresh chat locally.
     *
     * Nothing is created server-side until the first message: clicking "New
     * chat" and walking away used to leave a permanent empty session behind.
     */
    const newChat = useCallback(() => {
        abortRef.current?.();
        setConfig((previous) => ({ ...previous, workflowId: null }));
        setActiveSessionId(null);
        setMessages([]);
        setMessageTotal(0);
        setStreamingContent('');
        streamedRef.current = '';
        setError(null);
        syncSessionUrl(null);
    }, [syncSessionUrl]);

    const selectSession = useCallback(
        async (id) => {
            abortRef.current?.();
            setSessionLoading(true);
            try {
                const session = await chatApi.getSession(id);
                applyOpenedSession(session);
                syncSessionUrl(session.id);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not open that session');
            } finally {
                setSessionLoading(false);
            }
        },
        [applyOpenedSession, syncSessionUrl],
    );

    const deleteSession = useCallback(
        async (id) => {
            try {
                await chatApi.deleteSession(id);
                setSessions((previous) => previous.filter((session) => session.id !== id));
                if (activeSessionId === id) {
                    abortRef.current?.();
                    setActiveSessionId(null);
                    setMessages([]);
                    setMessageTotal(0);
                    setStreamingContent('');
                    syncSessionUrl(null);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete that session');
            }
        },
        [activeSessionId, syncSessionUrl],
    );

    /** Prepend the window of messages immediately before the ones on screen. */
    const loadEarlierMessages = useCallback(async () => {
        const oldest = messages[0]?.sequence;
        if (!activeSessionId || !oldest || loadingEarlier) return;
        setLoadingEarlier(true);
        try {
            const older = await chatApi.getSession(activeSessionId, {
                messageLimit: EARLIER_PAGE,
                beforeSequence: oldest,
            });
            setMessageTotal(older.message_total);
            setMessages((previous) => [...older.messages, ...previous]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load earlier messages');
        } finally {
            setLoadingEarlier(false);
        }
    }, [activeSessionId, messages, loadingEarlier]);

    /**
     * Submit a multi-agent workflow as a job rather than a chat turn.
     *
     * A workflow is a pipeline with stages, artifacts and (sometimes) a human
     * approval gate. Expressing that as one CLI call was never going to work,
     * so the console hands it to the orchestrator and points at the job.
     */
    const runWorkflow = useCallback(
        async (workflowId, requirement) => {
            if (requirement.trim().length < MIN_JOB_BRIEF_CHARS) {
                throw new Error(
                    `A job brief needs at least ${MIN_JOB_BRIEF_CHARS} characters. ` +
                        'Describe what the workflow should work from.',
                );
            }

            const { job_id: jobId } = await api.createJob({
                workflow: workflowId,
                requirement,
                engine: config.engine ?? undefined,
                copilot_model: config.model ?? undefined,
                github_token: getSessionGithubToken() || undefined,
            });
            // The job page is the confirmation; anything set here would unmount
            // with this provider before it could be read.
            navigate(`/jobs/${jobId}`);
        },
        [config.engine, config.model, navigate],
    );

    /**
     * Run one onboarded agent as itself, in the open session.
     *
     * The console is a workbench: pick an agent, give it input, read the
     * output, then optionally pass that output to a different agent. Each of
     * those is one turn of the same session — not a new chat, and not a job.
     */
    const runAgentTurn = useCallback(
        async (content, options = {}) => {
            const blank = {
                content: '',
                stopped: false,
                duration_ms: null,
                agent_id: null,
                model: null,
            };
            if (runLockRef.current || isStreaming) {
                return { ...blank, error: 'An agent is already running' };
            }
            runLockRef.current = true;

            const agentId = options.agentId !== undefined ? options.agentId : config.agentId;
            const from = { ...config, agentId, workflowId: null };

            setError(null);
            setIsStreaming(true);
            setStreamingContent('');
            streamedRef.current = '';

            let sessionId = activeSessionId;
            if (!sessionId) {
                try {
                    sessionId = (await openSession(content.slice(0, 80), from)).id;
                } catch (err) {
                    runLockRef.current = false;
                    setIsStreaming(false);
                    const message = err instanceof Error ? err.message : 'Could not start a new session';
                    setError(message);
                    return { ...blank, error: message };
                }
            }

            setMessages((previous) => [
                ...previous,
                {
                    id: -Date.now(),
                    session_id: sessionId,
                    sequence: nextSequence(previous),
                    role: 'user',
                    content,
                    created_at: new Date().toISOString(),
                    agent_id: agentId,
                    model: config.model,
                    duration_ms: null,
                },
            ]);
            setMessageTotal((previous) => previous + 1);

            let streamFrame = 0;
            const paintStream = () => {
                if (streamFrame) return;
                streamFrame = requestAnimationFrame(() => {
                    streamFrame = 0;
                    const text = streamedRef.current;
                    setStreamingContent(text);
                    options.onChunk?.(text);
                });
            };
            const cancelStreamPaint = () => {
                if (!streamFrame) return;
                cancelAnimationFrame(streamFrame);
                streamFrame = 0;
            };

            let finished = { ...blank, agent_id: agentId, model: config.model };

            const commit = (stopped, extra) => {
                cancelStreamPaint();
                const text = streamedRef.current;
                // Empty buffer: record stop/error metadata only. Never wipe a
                // finished turn that already committed on `done` — the trailing
                // commit after the stream loop used to clear `finished.content`
                // and the console reported "produced no output" falsely.
                if (!text) {
                    if (stopped) finished = { ...finished, stopped: true };
                    if (extra?.duration_ms != null) finished = { ...finished, duration_ms: extra.duration_ms };
                    if (extra?.agent_id) finished = { ...finished, agent_id: extra.agent_id };
                    if (extra?.model) finished = { ...finished, model: extra.model };
                    setStreamingContent('');
                    return;
                }
                finished = {
                    content: text,
                    stopped,
                    duration_ms: extra?.duration_ms ?? finished.duration_ms,
                    agent_id: extra?.agent_id ?? finished.agent_id ?? agentId,
                    model: extra?.model ?? finished.model ?? config.model,
                    error: finished.error,
                };
                setMessages((previous) => [
                    ...previous,
                    {
                        id: -Date.now() - 1,
                        session_id: sessionId,
                        sequence: nextSequence(previous),
                        role: 'assistant',
                        content: stopped ? `${text}${STOPPED_MARKER}` : text,
                        created_at: new Date().toISOString(),
                        agent_id: finished.agent_id,
                        model: finished.model,
                        duration_ms: finished.duration_ms,
                    },
                ]);
                setMessageTotal((previous) => previous + 1);
                streamedRef.current = '';
                setStreamingContent('');
            };

            try {
                const payload = {
                    content,
                    agent_id: agentId,
                    skill_id: config.skillId,
                    prompt_id: config.promptId,
                    model: config.model,
                    engine: config.engine,
                    github_token: getSessionGithubToken() || null,
                };

                const { stream, abort } = chatApi.sendMessage(sessionId, payload);
                abortRef.current = abort;

                for await (const event of stream) {
                    if (event.type === 'chunk' && event.content) {
                        streamedRef.current += event.content;
                        paintStream();
                    } else if (event.type === 'done') {
                        commit(false, {
                            duration_ms: event.duration_ms,
                            agent_id: event.agent_id,
                            model: event.model,
                        });
                    } else if (event.type === 'error') {
                        const message = event.message || 'The agent reported an error';
                        setError(message);
                        finished = { ...finished, error: message };
                        commit(false);
                    }
                }

                commit(false);
            } catch (err) {
                const aborted = err instanceof Error && err.name === 'AbortError';
                commit(aborted);
                if (!aborted) {
                    const message = err instanceof Error ? err.message : 'The request failed';
                    setError(message);
                    finished = { ...finished, error: message };
                }
            } finally {
                cancelStreamPaint();
                setIsStreaming(false);
                abortRef.current = null;
                runLockRef.current = false;
                loadSessions();
            }

            // Empty + not aborted + no error = a silent failure. Say so.
            if (!finished.content && !finished.error && !finished.stopped) {
                const message =
                    'The agent produced no output. Check the engine and model in the ' +
                    'config bar, and that a GitHub token is set for Copilot runs.';
                setError(message);
                finished = { ...finished, error: message };
            }

            return finished;
        },
        [activeSessionId, config, isStreaming, openSession, loadSessions],
    );

    const sendMessage = useCallback(
        async (content) => {
            if (config.workflowId) {
                try {
                    await runWorkflow(config.workflowId, content);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not start that workflow');
                }
                return;
            }
            await runAgentTurn(content);
        },
        [config.workflowId, runWorkflow, runAgentTurn],
    );

    const stopStreaming = useCallback(() => abortRef.current?.(), []);

    const updateConfig = useCallback((update) => {
        setConfig((previous) => exclusiveConfig(previous, update));
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const value = {
        sessions,
        hasMoreSessions,
        activeSessionId,
        messages,
        messageTotal,
        loadingEarlier,
        isStreaming,
        streamingContent,
        config,
        error,
        sessionLoading,
        catalog,
        newChat,
        loadSessions,
        loadMoreSessions,
        selectSession,
        deleteSession,
        loadEarlierMessages,
        sendMessage,
        runAgentTurn,
        stopStreaming,
        updateConfig,
        clearError,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
