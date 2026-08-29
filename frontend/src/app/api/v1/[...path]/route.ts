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
 * Auth: prefer the httpOnly `hub_session` cookie (the token the user logged
 * in with). In UI_AUTH_MODE=shared (local start.sh) fall back to API_TOKEN so
 * a loopback run still works without a login form.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8100';
const API_TOKEN = process.env.API_TOKEN ?? '';
const UI_AUTH_MODE = (process.env.UI_AUTH_MODE ?? 'shared').toLowerCase();

const STRIPPED_REQUEST_HEADERS = new Set([
    'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
    'proxy-authorization', 'proxy-authenticate', 'te', 'trailer',
    'content-length', 'accept-encoding', 'authorization', 'cookie',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
    'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-encoding',
    'content-length', 'set-cookie',
]);

function bearerFor(request: NextRequest): string {
    const session = request.cookies.get('hub_session')?.value?.trim() ?? '';
    if (session) return session;
    if (UI_AUTH_MODE !== 'session' && API_TOKEN) return API_TOKEN;
    return '';
}

async function proxy(request: NextRequest, segments: string[]): Promise<Response> {
    const target = `${API_TARGET}/api/v1/${segments.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
    const token = bearerFor(request);

    if (token) {
        // We'll set the header below
    }

    const headers = new Headers();
    request.headers.forEach((value, key) => {
        if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });
    if (token) {
        headers.set('authorization', `Bearer ${token}`);
    }

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

    if (upstream.status === 401) {
        return NextResponse.json(
            { detail: 'Your session is not valid. Sign in again.' },
            { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
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
