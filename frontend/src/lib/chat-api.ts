/**
 * Chat API client — session management and SSE streaming.
 */

import { API_BASE } from './api';
import { errorFromResponse } from './api-errors';

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
    /** A bounded window, newest last — not necessarily the whole transcript. */
    messages: ChatMessage[];
    /** How many messages the session actually has, however many were returned. */
    message_total: number;
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

/**
 * Note the absence of `workflow_id`: a workflow is submitted as a job, never as
 * a chat turn, so the console has nothing to send here.
 */
export interface SendMessagePayload {
    content: string;
    agent_id?: string | null;
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
        throw await errorFromResponse(response);
    }
    return response.json() as Promise<T>;
}

/**
 * Parse an SSE body into typed events.
 *
 * The server sends one `data: <json>\n\n` frame per event, and `json.dumps`
 * escapes newlines, so a frame is always exactly one line.
 */
async function* parseSseEvents(
    response: Response,
): AsyncGenerator<ChatStreamEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    yield JSON.parse(line.slice(6)) as ChatStreamEvent;
                } catch {
                    /* skip a malformed frame rather than ending the stream */
                }
            }
        }
    } finally {
        // Reached when the consumer breaks out early, which would otherwise
        // leave the body locked and the connection held open.
        await reader.cancel().catch(() => undefined);
    }
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

    listSessions: (limit = 50, offset = 0) =>
        request<ChatSessionSummary[]>(
            `/chat/sessions?limit=${limit}&offset=${offset}`,
        ),

    /**
     * Open a session, returning the newest `messageLimit` messages.
     *
     * Pass `beforeSequence` to page backwards through an older window.
     */
    getSession: (
        id: string,
        opts: { messageLimit?: number; beforeSequence?: number } = {},
    ) => {
        const params = new URLSearchParams();
        if (opts.messageLimit) params.set('message_limit', String(opts.messageLimit));
        if (opts.beforeSequence) params.set('before_sequence', String(opts.beforeSequence));
        const qs = params.toString();
        return request<ChatSession>(
            `/chat/sessions/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
        );
    },

    deleteSession: (id: string) =>
        request<{ deleted: string }>(`/chat/sessions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),

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
                `${API_BASE}/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                },
            );

            if (!response.ok) {
                throw await errorFromResponse(response);
            }

            yield* parseSseEvents(response);
        };

        return { stream: stream(), abort: () => controller.abort() };
    },
};
