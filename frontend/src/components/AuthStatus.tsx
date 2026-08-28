'use client';

import React, { useEffect, useState } from 'react';
import { Button, Chip, Stack } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';

type Session = {
    mode: 'session' | 'shared';
    user: { name: string; role: string } | null;
};

export default function AuthStatus() {
    const pathname = usePathname();
    const router = useRouter();
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((body: Session) => {
                setSession(body);
                if (body.mode === 'session' && !body.user && pathname !== '/login' && pathname !== '/') {
                    const next = encodeURIComponent(pathname || '/dashboard');
                    router.replace(`/login?next=${next}`);
                }
            })
            .catch(() => setSession({ mode: 'shared', user: null }));
    }, [pathname, router]);

    if (!session?.user) {
        if (session?.mode === 'session' && pathname !== '/login') {
            return (
                <Button size="small" onClick={() => router.push('/login')} sx={{ textTransform: 'none' }}>
                    Sign in
                </Button>
            );
        }
        return null;
    }

    const logout = async () => {
        await fetch('/api/auth/login', { method: 'DELETE' });
        router.push(session.mode === 'session' ? '/login' : '/');
        router.refresh();
    };

    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={`${session.user.name} · ${session.user.role}`} />
            <Button size="small" onClick={logout} sx={{ textTransform: 'none' }}>
                Sign out
            </Button>
        </Stack>
    );
}
