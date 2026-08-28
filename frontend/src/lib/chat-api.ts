/**
 * Chat API client — session management and SSE streaming.
 */

import { API_BASE } from './api';

// ------------------------------------------------------------------ types

export interface ChatMessage {
    id: number;
    session_id: string;
    sequence: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
    agent_id: string | null;
    model: string | null;
    duration_ms: number | null;
}

export interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    last_activity: string;
    agent_id: string | null;
    skill_id: string | null;
    workflow_id: string | null;
    prompt_id: string | null;
    model: string | null;
    messages: ChatMessage[];
}

export interface ChatSessionSummary {
    id: string;
    title: string;
    created_at: string;
    last_activity: string;
    agent_id: string | null;
    model: string | null;
}

export interface ChatStreamEvent {
    type: 'chunk' | 'done' | 'error';
    content?: string;
    duration_ms?: number;
    agent_id?: string;
    model?: string;
    message?: string;
}

export interface SendMessagePayload {
    content: string;
    agent_id?: string | null;
    workflow_id?: string | null;
    skill_id?: string | null;
    prompt_id?: string | null;
    model?: string | null;
    /** Per-request engine choice. The server holds no mutable engine state. */
    engine?: 'mock' | 'copilot' | null;
    github_token?: string | null;
}

// ------------------------------------------------------------------- helpers

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: 'same-origin',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : detail;
        } catch { /* non-JSON error body */ }
        throw new Error(detail);
    }
    return response.json() as Promise<T>;
}

// ------------------------------------------------------------------- API

export const chatApi = {
    // Sessions
    createSession: (payload: {
        title?: string;
        agent_id?: string | null;
        skill_id?: string | null;
        workflow_id?: string | null;
        prompt_id?: string | null;
        model?: string | null;
    } = {}) =>
        request<ChatSession>('/chat/sessions', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    listSessions: (limit = 50) =>
        request<ChatSessionSummary[]>(`/chat/sessions?limit=${limit}`),

    getSession: (id: string) =>
        request<ChatSession>(`/chat/sessions/${id}`),

    deleteSession: (id: string) =>
        request<{ deleted: string }>(`/chat/sessions/${id}`, { method: 'DELETE' }),

    /**
     * Send a message and stream the response via SSE.
     *
     * Returns an object with:
     *   - `stream`: an async iterator of ChatStreamEvents
     *   - `abort`: a function to cancel the stream
     */
    sendMessage: (sessionId: string, payload: SendMessagePayload) => {
        const controller = new AbortController();

        const stream = async function* (): AsyncGenerator<ChatStreamEvent> {
            const response = await fetch(
                `${API_BASE}/chat/sessions/${sessionId}/messages`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                },
            );

            if (!response.ok) {
                throw new Error(`Chat request failed (${response.status})`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6)) as ChatStreamEvent;
                            yield event;
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
        };

        return { stream: stream(), abort: () => controller.abort() };
    },

    /**
     * One-shot execution — no session, SSE stream.
     */
    executeOneShot: (payload: {
        content: string;
        agent_id?: string | null;
        skill_id?: string | null;
        prompt_id?: string | null;
        model?: string | null;
        engine?: 'mock' | 'copilot' | null;
        github_token?: string | null;
    }) => {
        const controller = new AbortController();

        const stream = async function* (): AsyncGenerator<ChatStreamEvent> {
            const response = await fetch(`${API_BASE}/chat/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Execution failed (${response.status})`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            yield JSON.parse(line.slice(6)) as ChatStreamEvent;
                        } catch { /* skip */ }
                    }
                }
            }
        };

        return { stream: stream(), abort: () => controller.abort() };
    },
};
