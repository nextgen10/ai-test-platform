/**
 * Runtime proxy to the orchestrator.
 *
 * This is a route handler rather than a `rewrites()` entry on purpose: rewrite
 * destinations are compiled into routes-manifest.json during `next build`, so
 * the upstream address would be frozen at image-build time. Reading it here
 * keeps one image deployable against any environment.
 *
 * The browser therefore only ever talks to this origin.
 *
 * There is no authentication anywhere in this path. The orchestrator runs
 * open (AUTH_MODE=disabled), so there is no token to attach, no session cookie
 * to carry and no login to fail. Credentials are stripped on the way through
 * rather than forwarded: a cookie or Authorization header arriving here came
 * from something other than this app, and passing it upstream would be a
 * confused deputy, not a feature.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8100';

const STRIPPED_REQUEST_HEADERS = new Set([
    'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
    'proxy-authorization', 'proxy-authenticate', 'te', 'trailer',
    'content-length', 'accept-encoding', 'authorization', 'cookie',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
    'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-encoding',
    'content-length', 'set-cookie',
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
    } catch {
        return NextResponse.json(
            { detail: 'Cannot reach the orchestrator. Try again in a moment.' },
            { status: 502 },
        );
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
        if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context): Promise<Response> {
    try {
        const path = (await context.params).path ?? [];
        return await proxy(request, path);
    } catch (err) {
        const detail = err instanceof Error ? err.message : 'Proxy failed';
        return NextResponse.json({ detail }, { status: 500 });
    }
}

export async function GET(request: NextRequest, context: Context) {
    return handle(request, context);
}

export async function POST(request: NextRequest, context: Context) {
    return handle(request, context);
}

export async function PUT(request: NextRequest, context: Context) {
    return handle(request, context);
}

export async function PATCH(request: NextRequest, context: Context) {
    return handle(request, context);
}

export async function DELETE(request: NextRequest, context: Context) {
    return handle(request, context);
}
