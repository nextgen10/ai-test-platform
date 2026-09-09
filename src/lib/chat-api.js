/**
 * Chat API client — session management and SSE streaming.
 *
 * Sessions go through axios like everything else. The message stream does not:
 * XHR buffers the whole body before it resolves, so a streamed reply would
 * arrive in one lump at the end. That path uses `fetch` and reads the body as
 * it comes.
 */

import { del, get, post } from './http';
import { apiUrl, currentToken } from './http';
import { errorFromResponse } from './api-errors';

/**
 * Parse an SSE body into events.
 *
 * The server sends one `data: <json>\n\n` frame per event, and `json.dumps`
 * escapes newlines, so a frame is always exactly one line.
 */
async function* parseSseEvents(response) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    yield JSON.parse(line.slice(6));
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

export const chatApi = {
    // Sessions
    createSession: (payload = {}) => post('/chat/sessions', payload),

    listSessions: (limit = 50, offset = 0) =>
        get(`/chat/sessions?limit=${limit}&offset=${offset}`),

    /**
     * Open a session, returning the newest `messageLimit` messages.
     *
     * Pass `beforeSequence` to page backwards through an older window.
     */
    getSession: (id, opts = {}) => {
        const params = new URLSearchParams();
        if (opts.messageLimit) params.set('message_limit', String(opts.messageLimit));
        if (opts.beforeSequence) params.set('before_sequence', String(opts.beforeSequence));
        const qs = params.toString();
        return get(`/chat/sessions/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`);
    },

    deleteSession: (id) => del(`/chat/sessions/${encodeURIComponent(id)}`),

    /**
     * Send a message and stream the response via SSE.
     *
     * Returns `{ stream, abort }` — an async iterator of events, and a way to
     * cancel it.
     */
    sendMessage: (sessionId, payload) => {
        const controller = new AbortController();

        const stream = async function* () {
            const headers = { 'Content-Type': 'application/json' };
            const token = await currentToken();
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(
                apiUrl(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`),
                {
                    method: 'POST',
                    headers,
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
