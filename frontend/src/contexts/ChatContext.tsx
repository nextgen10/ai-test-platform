'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChatSession, ChatSessionSummary, ChatMessage, SendMessagePayload } from '@/lib/chat-api';
import { chatApi } from '@/lib/chat-api';
import { api } from '@/lib/api';
import { getSessionGithubToken } from '@/lib/settings';

interface ChatConfig {
    agentId: string | null;
    skillId: string | null;
    workflowId: string | null;
    promptId: string | null;
    model: string | null;
    engine: 'mock' | 'copilot' | null;
    githubToken: string | null;
}

interface ChatState {
    sessions: ChatSessionSummary[];
    activeSessionId: string | null;
    messages: ChatMessage[];
    isStreaming: boolean;
    streamingContent: string;
    config: ChatConfig;
    error: string | null;
    notice: string | null;
    sessionLoading: boolean;
}

interface ChatActions {
    createSession: (title?: string) => Promise<ChatSession>;
    loadSessions: () => Promise<void>;
    selectSession: (id: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    stopStreaming: () => void;
    updateConfig: (update: Partial<ChatConfig>) => void;
    clearError: () => void;
    clearNotice: () => void;
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
    githubToken: null,
};

function exclusiveConfig(prev: ChatConfig, update: Partial<ChatConfig>): ChatConfig {
    const next = { ...prev, ...update };
    // A workflow is a job. An agent is a chat. They cannot both be "the thing Send does".
    if (update.workflowId) next.agentId = null;
    if (update.agentId) next.workflowId = null;
    return next;
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [config, setConfig] = useState<ChatConfig>(EMPTY_CONFIG);
    const [sessionLoading, setSessionLoading] = useState(Boolean(searchParams.get('session')));

    const abortRef = useRef<(() => void) | null>(null);
    const streamedRef = useRef('');
    const landingConsumed = useRef(false);
    const restoredSession = useRef(false);

    useEffect(() => () => { abortRef.current?.(); }, []);

    const syncSessionUrl = useCallback(
        (sessionId: string | null) => {
            const params = new URLSearchParams();
            if (sessionId) params.set('session', sessionId);
            const qs = params.toString();
            const next = qs ? `/chat?${qs}` : '/chat';
            router.replace(next, { scroll: false });
        },
        [router],
    );

    const applyOpenedSession = useCallback((session: ChatSession) => {
        setActiveSessionId(session.id);
        setMessages(session.messages);
        setStreamingContent('');
        streamedRef.current = '';
        setConfig((prev) => ({
            ...prev,
            agentId: session.agent_id,
            skillId: session.skill_id,
            workflowId: session.workflow_id,
            promptId: session.prompt_id,
            model: session.model,
        }));
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
            setSessions(await chatApi.listSessions());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load your sessions');
        }
    }, []);

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
                workflow_id: from.workflowId,
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

    const createSession = useCallback(
        async (title?: string): Promise<ChatSession> => {
            abortRef.current?.();
            try {
                const session = await openSession(title, config);
                setMessages([]);
                setStreamingContent('');
                return session;
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not start a new session');
                throw e;
            }
        },
        [config, openSession],
    );

    const selectSession = useCallback(
        async (id: string) => {
            abortRef.current?.();
            try {
                const session = await chatApi.getSession(id);
                applyOpenedSession(session);
                syncSessionUrl(session.id);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not open that session');
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
                    setStreamingContent('');
                    syncSessionUrl(null);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not delete that session');
            }
        },
        [activeSessionId, syncSessionUrl],
    );

    /**
     * Submit a multi-agent workflow as a job rather than a chat turn.
     *
     * A workflow is a pipeline with stages, artifacts and (sometimes) a human
     * approval gate. Expressing that as one CLI call was never going to work,
     * so the console hands it to the orchestrator and points at the job.
     */
    const runWorkflow = useCallback(
        async (workflowId: string, requirement: string) => {
            const { job_id } = await api.createJob({
                workflow: workflowId,
                requirement,
                engine: config.engine ?? undefined,
                copilot_model: config.model ?? undefined,
                github_token: getSessionGithubToken() || undefined,
            });
            setNotice(`Started workflow "${workflowId}". Opening the job…`);
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

            let sessionId = activeSessionId;
            if (!sessionId) {
                try {
                    sessionId = (await openSession(content.slice(0, 80), config)).id;
                } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not start a new session');
                    return;
                }
            }

            const userMsg: ChatMessage = {
                id: -Date.now(),
                session_id: sessionId,
                sequence: messages.length + 1,
                role: 'user',
                content,
                created_at: new Date().toISOString(),
                agent_id: config.agentId,
                model: config.model,
                duration_ms: null,
            };
            setMessages((prev) => [...prev, userMsg]);
            setIsStreaming(true);
            setStreamingContent('');
            streamedRef.current = '';

            const commit = (stopped: boolean, extra?: { duration_ms?: number; agent_id?: string; model?: string }) => {
                const text = streamedRef.current;
                if (!text) return;
                setMessages((prev) => [
                    ...prev,
                    {
                        id: -Date.now() - 1,
                        session_id: sessionId!,
                        sequence: prev.length + 1,
                        role: 'assistant',
                        content: stopped ? `${text}\n\n_[stopped]_` : text,
                        created_at: new Date().toISOString(),
                        agent_id: extra?.agent_id ?? config.agentId,
                        model: extra?.model ?? config.model,
                        duration_ms: extra?.duration_ms ?? null,
                    },
                ]);
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
        [activeSessionId, config, isStreaming, messages.length, openSession, runWorkflow, loadSessions],
    );

    const stopStreaming = useCallback(() => {
        abortRef.current?.();
    }, []);

    const updateConfig = useCallback((update: Partial<ChatConfig>) => {
        setConfig((prev) => exclusiveConfig(prev, update));
    }, []);

    const clearError = useCallback(() => setError(null), []);
    const clearNotice = useCallback(() => setNotice(null), []);

    const value: ChatContextType = {
        sessions,
        activeSessionId,
        messages,
        isStreaming,
        streamingContent,
        config,
        error,
        notice,
        sessionLoading,
        createSession,
        loadSessions,
        selectSession,
        deleteSession,
        sendMessage,
        stopStreaming,
        updateConfig,
        clearError,
        clearNotice,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
