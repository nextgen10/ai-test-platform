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

// Hop-by-hop headers must not be forwarded, and `host` must be recomputed by fetch.
const STRIPPED_REQUEST_HEADERS = new Set([
    'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
    'proxy-authorization', 'proxy-authenticate', 'te', 'trailer',
    'content-length', 'accept-encoding',
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
