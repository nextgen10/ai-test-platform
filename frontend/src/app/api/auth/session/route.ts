import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8100';
const API_TOKEN = process.env.API_TOKEN ?? '';
const UI_AUTH_MODE = (process.env.UI_AUTH_MODE ?? 'shared').toLowerCase();

export async function GET() {
    const cookieStore = await cookies();
    const session = cookieStore.get('hub_session')?.value ?? '';
    const token = session || (UI_AUTH_MODE === 'shared' ? API_TOKEN : '');
    const mode = UI_AUTH_MODE === 'session' ? 'session' : 'shared';

    if (!token) {
        return NextResponse.json({ mode, user: null });
    }

    try {
        const upstream = await fetch(`${API_TARGET}/api/v1/me`, {
            headers: { authorization: `Bearer ${token}` },
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
