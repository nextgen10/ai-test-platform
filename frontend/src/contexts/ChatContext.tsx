'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChatSession, ChatSessionSummary, ChatMessage, SendMessagePayload } from '@/lib/chat-api';
import { chatApi } from '@/lib/chat-api';
import { api, MIN_JOB_BRIEF_CHARS } from '@/lib/api';
import { hubApi, type HubCatalog } from '@/lib/hub-api';
import { getSessionGithubToken } from '@/lib/settings';

/** Matches the server's marker exactly, so a reload does not reword the turn. */
const STOPPED_MARKER = '\n\n_[stopped by the user]_';

/** How many sessions the sidebar asks for at a time. */
const SESSION_PAGE = 50;

/** How many older messages one "load earlier" step pulls in. */
const EARLIER_PAGE = 100;

interface ChatConfig {
    agentId: string | null;
    skillId: string | null;
    workflowId: string | null;
    promptId: string | null;
    model: string | null;
    engine: 'mock' | 'copilot' | null;
}

interface ChatState {
    sessions: ChatSessionSummary[];
    hasMoreSessions: boolean;
    activeSessionId: string | null;
    messages: ChatMessage[];
    /** Total messages in the open session; `messages` may hold only its tail. */
    messageTotal: number;
    loadingEarlier: boolean;
    isStreaming: boolean;
    streamingContent: string;
    config: ChatConfig;
    error: string | null;
    sessionLoading: boolean;
    /** The hub catalog, fetched once here rather than by each child. */
    catalog: HubCatalog | null;
}

interface ChatActions {
    newChat: () => void;
    loadSessions: () => Promise<void>;
    loadMoreSessions: () => Promise<void>;
    selectSession: (id: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    loadEarlierMessages: () => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    stopStreaming: () => void;
    updateConfig: (update: Partial<ChatConfig>) => void;
    clearError: () => void;
}

type ChatContextType = ChatState & ChatActions;

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext(): ChatContextType {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
    return ctx;
}

const EMPTY_CONFIG: ChatConfig = {
    agentId: null,
    skillId: null,
    workflowId: null,
    promptId: null,
    model: null,
    engine: null,
};

function exclusiveConfig(prev: ChatConfig, update: Partial<ChatConfig>): ChatConfig {
    const next = { ...prev, ...update };
    // A workflow is a job. An agent is a chat. They cannot both be "the thing Send does".
    if (update.workflowId) next.agentId = null;
    if (update.agentId) next.workflowId = null;
    return next;
}

/**
 * One past the last message's sequence.
 *
 * Deriving this from `messages.length` breaks as soon as a session is opened
 * with only the tail of a long transcript, because the window starts partway in.
 */
function nextSequence(list: ChatMessage[]): number {
    const last = list[list.length - 1];
    return last ? last.sequence + 1 : 1;
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
    const [hasMoreSessions, setHasMoreSessions] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageTotal, setMessageTotal] = useState(0);
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<ChatConfig>(EMPTY_CONFIG);
    const [sessionLoading, setSessionLoading] = useState(Boolean(searchParams.get('session')));
    const [catalog, setCatalog] = useState<HubCatalog | null>(null);

    const abortRef = useRef<(() => void) | null>(null);
    const streamedRef = useRef('');
    const landingConsumed = useRef(false);
    const restoredSession = useRef(false);

    useEffect(() => () => { abortRef.current?.(); }, []);

    useEffect(() => {
        hubApi.catalog().then(setCatalog).catch(() => setCatalog(null));
    }, []);

    const syncSessionUrl = useCallback((sessionId: string | null) => {
        // From here the console owns the URL. Without this flag the restore
        // effect below would treat a session we just created or opened as a
        // cold load, refetch it, and wipe an in-flight stream.
        if (sessionId) restoredSession.current = true;

        const params = new URLSearchParams();
        if (sessionId) params.set('session', sessionId);
        const qs = params.toString();
        const next = qs ? `/chat?${qs}` : '/chat';
        // replaceState, not router.replace: a Next navigation remounts the
        // useSearchParams Suspense boundary, which unmounts the console
        // (spinner) and kills the in-flight stream on first send.
        if (typeof window !== 'undefined') {
            const current = window.location.pathname + window.location.search;
            if (current !== next) {
                window.history.replaceState(window.history.state, '', next);
            }
        }
    }, []);

    const applyOpenedSession = useCallback((session: ChatSession) => {
        setActiveSessionId(session.id);
        setMessages(session.messages);
        setMessageTotal(session.message_total);
        setStreamingContent('');
        streamedRef.current = '';
        // A stored workflow_id is leftover config, not a job in progress.
        // Restoring it would flip Send back to "Run job" on a real transcript.
        setConfig((prev) =>
            exclusiveConfig(
                {
                    ...prev,
                    skillId: session.skill_id,
                    promptId: session.prompt_id,
                    model: session.model,
                },
                { agentId: session.agent_id, workflowId: null },
            ),
        );
    }, []);

    // Restore ?session= once. Landing ?agent= / ?workflow= apply once, then
    // the URL is owned by the open session so ConfigBar changes stick.
    useEffect(() => {
        const sessionId = searchParams.get('session');
        if (sessionId && !restoredSession.current) {
            restoredSession.current = true;
            landingConsumed.current = true;
            setSessionLoading(true);
            chatApi
                .getSession(sessionId)
                .then(applyOpenedSession)
                .catch((e) => {
                    setError(e instanceof Error ? e.message : 'Could not open that session');
                    syncSessionUrl(null);
                })
                .finally(() => setSessionLoading(false));
            return;
        }

        if (landingConsumed.current || restoredSession.current) return;
        landingConsumed.current = true;

        const fromUrl: Partial<ChatConfig> = {};
        const agent = searchParams.get('agent');
        const workflow = searchParams.get('workflow');
        const skill = searchParams.get('skill');
        const prompt = searchParams.get('prompt');
        const model = searchParams.get('model');

        if (workflow) {
            fromUrl.workflowId = workflow;
        } else if (agent) {
            fromUrl.agentId = agent;
        }
        if (skill) fromUrl.skillId = skill;
        if (prompt) fromUrl.promptId = prompt;
        if (model) fromUrl.model = model;

        if (Object.keys(fromUrl).length > 0) {
            setConfig((prev) => exclusiveConfig(prev, fromUrl));
        }
    }, [searchParams, applyOpenedSession, syncSessionUrl]);

    const loadSessions = useCallback(async () => {
        try {
            const page = await chatApi.listSessions(SESSION_PAGE);
            setSessions(page);
            setHasMoreSessions(page.length === SESSION_PAGE);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load your sessions');
        }
    }, []);

    const loadMoreSessions = useCallback(async () => {
        try {
            const page = await chatApi.listSessions(SESSION_PAGE, sessions.length);
            const known = new Set(sessions.map((s) => s.id));
            setSessions((prev) => [...prev, ...page.filter((s) => !known.has(s.id))]);
            setHasMoreSessions(page.length === SESSION_PAGE);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load older sessions');
        }
    }, [sessions]);

    const summarize = (session: ChatSession): ChatSessionSummary => ({
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        last_activity: session.last_activity,
        agent_id: session.agent_id,
        model: session.model,
    });

    const openSession = useCallback(
        async (title: string | undefined, from: ChatConfig): Promise<ChatSession> => {
            const session = await chatApi.createSession({
                title,
                agent_id: from.agentId,
                skill_id: from.skillId,
                prompt_id: from.promptId,
                model: from.model,
            });
            setActiveSessionId(session.id);
            setSessions((prev) => [summarize(session), ...prev.filter((s) => s.id !== session.id)]);
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
        setConfig((prev) => ({ ...prev, workflowId: null }));
        setActiveSessionId(null);
        setMessages([]);
        setMessageTotal(0);
        setStreamingContent('');
        streamedRef.current = '';
        setError(null);
        syncSessionUrl(null);
    }, [syncSessionUrl]);

    const selectSession = useCallback(
        async (id: string) => {
            abortRef.current?.();
            setSessionLoading(true);
            try {
                const session = await chatApi.getSession(id);
                applyOpenedSession(session);
                syncSessionUrl(session.id);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not open that session');
            } finally {
                setSessionLoading(false);
            }
        },
        [applyOpenedSession, syncSessionUrl],
    );

    const deleteSession = useCallback(
        async (id: string) => {
            try {
                await chatApi.deleteSession(id);
                setSessions((prev) => prev.filter((s) => s.id !== id));
                if (activeSessionId === id) {
                    abortRef.current?.();
                    setActiveSessionId(null);
                    setMessages([]);
                    setMessageTotal(0);
                    setStreamingContent('');
                    syncSessionUrl(null);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not delete that session');
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
            setMessages((prev) => [...older.messages, ...prev]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load earlier messages');
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
        async (workflowId: string, requirement: string) => {
            if (requirement.trim().length < MIN_JOB_BRIEF_CHARS) {
                throw new Error(
                    `A job brief needs at least ${MIN_JOB_BRIEF_CHARS} characters. ` +
                    `Describe what the workflow should work from.`,
                );
            }

            const { job_id } = await api.createJob({
                workflow: workflowId,
                requirement,
                engine: config.engine ?? undefined,
                copilot_model: config.model ?? undefined,
                github_token: getSessionGithubToken() || undefined,
            });
            // The job page is the confirmation; anything set here would unmount
            // with this provider before it could be read.
            router.push(`/jobs/${job_id}`);
        },
        [config.engine, config.model, router],
    );

    const sendMessage = useCallback(
        async (content: string) => {
            if (isStreaming) return;
            setError(null);

            if (config.workflowId) {
                try {
                    await runWorkflow(config.workflowId, content);
                } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not start that workflow');
                }
                return;
            }

            // Leave the empty catalog before the session round-trip so the
            // transcript pane does not collapse and remount on first send.
            setIsStreaming(true);
            setStreamingContent('');
            streamedRef.current = '';

            let sessionId = activeSessionId;
            if (!sessionId) {
                try {
                    sessionId = (await openSession(content.slice(0, 80), config)).id;
                } catch (e) {
                    setIsStreaming(false);
                    setError(e instanceof Error ? e.message : 'Could not start a new session');
                    return;
                }
            }

            setMessages((prev) => {
                const userMsg: ChatMessage = {
                    id: -Date.now(),
                    session_id: sessionId!,
                    sequence: nextSequence(prev),
                    role: 'user',
                    content,
                    created_at: new Date().toISOString(),
                    agent_id: config.agentId,
                    model: config.model,
                    duration_ms: null,
                };
                return [...prev, userMsg];
            });
            setMessageTotal((prev) => prev + 1);

            const commit = (stopped: boolean, extra?: { duration_ms?: number; agent_id?: string; model?: string }) => {
                const text = streamedRef.current;
                if (!text) return;
                setMessages((prev) => [
                    ...prev,
                    {
                        id: -Date.now() - 1,
                        session_id: sessionId!,
                        sequence: nextSequence(prev),
                        role: 'assistant',
                        content: stopped ? `${text}${STOPPED_MARKER}` : text,
                        created_at: new Date().toISOString(),
                        agent_id: extra?.agent_id ?? config.agentId,
                        model: extra?.model ?? config.model,
                        duration_ms: extra?.duration_ms ?? null,
                    },
                ]);
                setMessageTotal((prev) => prev + 1);
                streamedRef.current = '';
                setStreamingContent('');
            };

            try {
                const payload: SendMessagePayload = {
                    content,
                    agent_id: config.agentId,
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
                        setStreamingContent(streamedRef.current);
                    } else if (event.type === 'done') {
                        commit(false, {
                            duration_ms: event.duration_ms,
                            agent_id: event.agent_id,
                            model: event.model,
                        });
                    } else if (event.type === 'error') {
                        setError(event.message || 'The agent reported an error');
                        commit(false);
                    }
                }

                commit(false);
            } catch (e) {
                const aborted = e instanceof Error && e.name === 'AbortError';
                commit(aborted);
                if (!aborted) {
                    setError(e instanceof Error ? e.message : 'The request failed');
                }
            } finally {
                setIsStreaming(false);
                abortRef.current = null;
                void loadSessions();
            }
        },
        [activeSessionId, config, isStreaming, openSession, runWorkflow, loadSessions],
    );

    const stopStreaming = useCallback(() => {
        abortRef.current?.();
    }, []);

    const updateConfig = useCallback((update: Partial<ChatConfig>) => {
        setConfig((prev) => exclusiveConfig(prev, update));
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const value: ChatContextType = {
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
        stopStreaming,
        updateConfig,
        clearError,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
