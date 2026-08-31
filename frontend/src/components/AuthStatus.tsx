'use client';

import React, { useEffect, useState } from 'react';
import { Button, Chip, Stack } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/base-path';

type Session = {
    mode: 'session' | 'shared';
    user: { name: string; role: string } | null;
};

export default function AuthStatus() {
    const pathname = usePathname();
    const router = useRouter();
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        fetch(withBasePath('/api/auth/session'))
            .then((r) => r.json())
            .then((body: Session) => {
                setSession(body);
            })
            .catch(() => setSession({ mode: 'shared', user: null }));
    }, [pathname, router]);

    // Demo / local shared auth: no Sign in, Sign out, or session chip.
    if (!session?.user || session.mode !== 'session') {
        return null;
    }

    const logout = async () => {
        await fetch(withBasePath('/api/auth/login'), { method: 'DELETE' });
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
