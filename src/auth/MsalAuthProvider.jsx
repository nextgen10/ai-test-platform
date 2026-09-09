import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';

import { registerTokenProvider } from '@/lib/http';
import { AuthContext, initialsOf } from './AuthContext';
import { loginRequest, msalConfig, tokenRequest } from './config';

/**
 * The MSAL instance, created once for the lifetime of the tab.
 *
 * Built outside the component because MSAL v3 requires `initialize()` to
 * resolve before any other call, and a React StrictMode double-mount would
 * otherwise construct two clients racing over the same cache.
 */
const instance = new PublicClientApplication(msalConfig);

export default function MsalAuthProvider({ children }) {
    const [ready, setReady] = useState(false);
    const [account, setAccount] = useState(null);

    useEffect(() => {
        let cancelled = false;

        instance
            .initialize()
            // A redirect back from Entra carries the response in the URL; this
            // is what consumes it. Skipping it leaves the hash in place and the
            // account list empty even though sign-in succeeded.
            .then(() => instance.handleRedirectPromise())
            .then((result) => {
                if (cancelled) return;
                const signedIn = result?.account ?? instance.getAllAccounts()[0] ?? null;
                if (signedIn) instance.setActiveAccount(signedIn);
                setAccount(signedIn);
                setReady(true);
            })
            .catch(() => {
                // A failed redirect exchange must not leave a blank page: fall
                // through to the login screen so the person can try again.
                if (!cancelled) setReady(true);
            });

        const callbackId = instance.addEventCallback((message) => {
            if (
                message.eventType === EventType.LOGIN_SUCCESS ||
                message.eventType === EventType.ACQUIRE_TOKEN_SUCCESS
            ) {
                const next = message.payload?.account;
                if (next) {
                    instance.setActiveAccount(next);
                    setAccount(next);
                }
            }
            if (message.eventType === EventType.LOGOUT_SUCCESS) setAccount(null);
        });

        return () => {
            cancelled = true;
            if (callbackId) instance.removeEventCallback(callbackId);
        };
    }, []);

    // Give the API client a way to fetch a token. Silent first; an interactive
    // redirect only when the account genuinely needs one, so a background poll
    // can never bounce someone out of the page they are reading.
    useEffect(() => {
        registerTokenProvider(async () => {
            const active = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
            if (!active) return null;
            try {
                const result = await instance.acquireTokenSilent({ ...tokenRequest, account: active });
                return result.accessToken;
            } catch (error) {
                if (error instanceof InteractionRequiredAuthError) {
                    await instance.acquireTokenRedirect({ ...tokenRequest, account: active });
                }
                return null;
            }
        });
        return () => registerTokenProvider(null);
    }, []);

    const signIn = useCallback(() => {
        instance.loginRedirect(loginRequest).catch(() => undefined);
    }, []);

    const signOut = useCallback(() => {
        instance.logoutRedirect({ account: instance.getActiveAccount() }).catch(() => undefined);
    }, []);

    const value = useMemo(() => {
        const name = account?.name || account?.username || '';
        return {
            enabled: true,
            ready,
            account,
            name: name || 'Signed out',
            email: account?.username || '',
            initials: initialsOf(name || account?.username),
            signIn,
            signOut,
        };
    }, [account, ready, signIn, signOut]);

    return (
        <MsalProvider instance={instance}>
            <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
        </MsalProvider>
    );
}
