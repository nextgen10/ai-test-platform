'use client';

import React, { Suspense, useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get('next') || '/dashboard';
    const [token, setToken] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(typeof body.detail === 'string' ? body.detail : 'Sign-in failed');
                return;
            }
            router.replace(next.startsWith('/') ? next : '/dashboard');
            router.refresh();
        } catch {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 480, mx: 'auto', py: 6 }}>
            <PageHeader
                title="Sign in"
                subtitle="Paste an API token issued for this deployment. The token is stored in an httpOnly cookie, not in local storage."
            />
            <Paper component="form" onSubmit={submit} sx={{ p: 3, borderRadius: 2 }}>
                <TextField
                    label="API token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    fullWidth
                    autoComplete="off"
                    required
                    sx={{ mb: 2 }}
                />
                {error && (
                    <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}
                <Button type="submit" variant="contained" disabled={busy || token.trim().length < 16}>
                    {busy ? 'Signing in…' : 'Sign in'}
                </Button>
            </Paper>
        </Box>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
