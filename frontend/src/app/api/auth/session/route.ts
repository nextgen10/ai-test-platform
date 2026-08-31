import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8100';
const API_TOKEN = process.env.API_TOKEN ?? '';
const UI_AUTH_MODE = (process.env.UI_AUTH_MODE ?? 'shared').toLowerCase();

export async function GET() {
    const cookieStore = await cookies();
    const session = cookieStore.get('hub_session')?.value ?? '';
    // Demo: ignore leftover hub_session; only attach the shared API_TOKEN.
    const token = UI_AUTH_MODE === 'shared' ? API_TOKEN : session;
    const mode = UI_AUTH_MODE === 'session' ? 'session' : 'shared';

    try {
        const headers: Record<string, string> = {};
        if (token) headers.authorization = `Bearer ${token}`;
        const upstream = await fetch(`${API_TARGET}/api/v1/me`, {
            headers,
            cache: 'no-store',
        });
        if (!upstream.ok) {
            return NextResponse.json({ mode, user: null });
        }
        const me = (await upstream.json()) as { name: string; role: string };
        return NextResponse.json({ mode, user: me });
    } catch {
        return NextResponse.json({ mode, user: null });
    }
}
