import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

/**
 * Gate a route behind sign-in.
 *
 * Renders nothing while MSAL is still resolving a redirect: showing the login
 * screen for that instant would flash a sign-in prompt at someone who is
 * already signed in.
 */
export default function RequireAuth({ children }) {
    const { enabled, ready, account } = useAuth();
    const location = useLocation();

    if (!enabled) return children;

    if (!ready) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <div className="ui-skeleton h-10 w-10 rounded-full" aria-label="Signing in" />
            </div>
        );
    }

    if (!account) {
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }

    return children;
}
