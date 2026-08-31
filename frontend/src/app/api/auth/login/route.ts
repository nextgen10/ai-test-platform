/**
 * UI session: an httpOnly cookie holding the caller's orchestrator token.
 *
 * Kubernetes runs UI_AUTH_MODE=session, so the BFF will not impersonate a
 * shared role. Local start.sh uses UI_AUTH_MODE=shared and still attaches
 * API_TOKEN when no cookie is present.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8100';
const COOKIE = 'hub_session';
const MAX_AGE = 60 * 60 * 8;

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: MAX_AGE,
    };
}

export async function POST(request: NextRequest) {
    let token = '';
    try {
        const body = (await request.json()) as { token?: string };
        token = (body.token ?? '').trim();
    } catch {
        return NextResponse.json({ detail: 'Expected JSON { token }' }, { status: 400 });
    }
    if (token.length < 16) {
        return NextResponse.json({ detail: 'Token is too short.' }, { status: 400 });
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${API_TARGET}/api/v1/me`, {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json(
            { detail: 'Cannot reach the orchestrator.' },
            { status: 502 },
        );
    }

    // Demo: do not surface a token-invalid toast from this route.
    // if (upstream.status === 401) {
    //     return NextResponse.json({ detail: 'That token is not valid.' }, { status: 401 });
    // }
    if (!upstream.ok) {
        return NextResponse.json({ detail: 'Login failed.' }, { status: 502 });
    }

    const me = (await upstream.json()) as { name: string; role: string };
    const response = NextResponse.json({ name: me.name, role: me.role });
    response.cookies.set(COOKIE, token, cookieOptions());
    return response;
}

export async function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, '', { ...cookieOptions(), maxAge: 0 });
    return response;
}
