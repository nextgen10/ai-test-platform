/**
 * Runtime proxy to the orchestrator.
 *
 * This is a route handler rather than a `rewrites()` entry on purpose: rewrite
 * destinations are compiled into routes-manifest.json during `next build`, so
 * the upstream address would be frozen at image-build time. Reading it here
 * keeps one image deployable against any environment.
 *
 * The browser therefore only ever talks to this origin, which keeps CORS and
 * any future auth in a single place.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8100';

/**
 * The orchestrator credential, held server-side only.
 *
 * The browser never sees it: it talks to this route, and this route attaches
 * the token. That keeps a long-lived API credential out of localStorage and out
 * of anything an XSS could read.
 *
 * All browser traffic therefore shares one role. Per-user identity needs an
 * identity provider in front of this route, which is the seam to extend.
 */
const API_TOKEN = process.env.API_TOKEN ?? '';

// Hop-by-hop headers must not be forwarded, and `host` must be recomputed by fetch.
// `authorization` is stripped deliberately: the token is ours to set, and a
// client-supplied one must never reach the orchestrator.
const STRIPPED_REQUEST_HEADERS = new Set([
    'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
    'proxy-authorization', 'proxy-authenticate', 'te', 'trailer',
    'content-length', 'accept-encoding', 'authorization',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
    'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-encoding',
    'content-length',
]);

async function proxy(request: NextRequest, segments: string[]): Promise<Response> {
    const target = `${API_TARGET}/api/v1/${segments.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

    const headers = new Headers();
    request.headers.forEach((value, key) => {
        if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });
    if (API_TOKEN) headers.set('authorization', `Bearer ${API_TOKEN}`);

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const body = hasBody ? await request.arrayBuffer() : undefined;

    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method: request.method,
            headers,
            body: body && body.byteLength > 0 ? body : undefined,
            redirect: 'manual',
            cache: 'no-store',
        });
    } catch (error) {
        // The orchestrator being unreachable is an upstream failure, not a bug in
        // this pod — report it as such so the UI can say something useful.
        return NextResponse.json(
            {
                detail: `Cannot reach the orchestrator at ${API_TARGET}: ${
                    error instanceof Error ? error.message : 'unknown error'
                }`,
            },
            { status: 502 },
        );
    }

    // A 401 here means this server's own credential is wrong, which the user
    // cannot fix by signing in — say so rather than passing on a bare 401.
    if (upstream.status === 401) {
        return NextResponse.json(
            {
                detail: API_TOKEN
                    ? 'This server\'s orchestrator token was rejected. Check that API_TOKEN matches an entry in the orchestrator\'s API_TOKENS.'
                    : 'This server has no orchestrator token configured. Set API_TOKEN to a value listed in the orchestrator\'s API_TOKENS.',
            },
            { status: 502 },
        );
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
        if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });

    // Streamed through, so artifact downloads stay binary-safe.
    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
    return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: Context) {
    return proxy(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: Context) {
    return proxy(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: Context) {
    return proxy(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: Context) {
    return proxy(request, (await context.params).path);
}
