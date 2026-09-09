import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';

import { useAuth } from '@/auth/AuthContext';
import { AUTH_MISCONFIGURED } from '@/auth/config';
import { UnifiedBrand } from '@/components/brand';
import { Alert, Button, Paper, Spinner } from '@/components/ui/primitives';

/**
 * Sign-in.
 *
 * With auth switched off this is not a page anyone should sit on — the platform
 * runs open, so the route exists only so an old bookmark does not 404, and it
 * sends the visitor straight to the landing page.
 */
export default function LoginPage() {
    const { enabled, ready, account, signIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const destination = location.state?.from ?? '/dashboard';

    useEffect(() => {
        if (!enabled) {
            navigate('/', { replace: true });
            return;
        }
        if (ready && account) navigate(destination, { replace: true });
    }, [enabled, ready, account, destination, navigate]);

    if (!enabled || (ready && account)) return null;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-elevated px-4">
            <UnifiedBrand />

            <Paper className="w-full max-w-md p-8" raised>
                <div className="mb-6 flex items-center gap-3">
                    <ShieldCheck size={22} className="text-brand" />
                    <h1 className="ui-h5">Sign in to continue</h1>
                </div>

                <p className="ui-body2 mb-6 text-subtle">
                    Agent HUB Platform uses your organisation&apos;s Microsoft account. You will be
                    returned here once sign-in completes.
                </p>

                {AUTH_MISCONFIGURED && (
                    <Alert severity="warning" className="mb-6">
                        Sign-in is switched on but no Azure client or tenant id is configured, so it
                        cannot proceed. Set <code>VITE_AZURE_CLIENT_ID</code> and{' '}
                        <code>VITE_AZURE_TENANT_ID</code>, or set{' '}
                        <code>VITE_AUTH_ENABLED=false</code> to run the platform open.
                    </Alert>
                )}

                {!ready ? (
                    <div className="grid place-items-center py-4">
                        <Spinner size={28} />
                    </div>
                ) : (
                    <Button variant="contained" className="w-full" onClick={signIn}>
                        <LogIn size={16} />
                        Sign in with Microsoft
                    </Button>
                )}
            </Paper>
        </div>
    );
}
