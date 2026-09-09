import React, { Suspense, lazy } from 'react';

import { AuthContext } from './AuthContext';
import { AUTH_ENABLED } from './config';

/**
 * The identity shown when the platform runs open.
 *
 * Matches the Next app's hardcoded AdminPlaceholder — not wired to auth, but
 * a console that shows "Local User" instead of the familiar mark reads as
 * broken rather than open.
 */
const LOCAL_IDENTITY = {
    enabled: false,
    ready: true,
    account: null,
    name: 'Aniket Marwadi',
    email: '',
    initials: 'AM',
    signIn: () => {},
    signOut: () => {},
};

/**
 * Loaded only when sign-in is switched on.
 *
 * MSAL is ~270 kB, and most deployments run the platform open against an
 * orchestrator with `AUTH_MODE=disabled`. A static import would make every one
 * of them pay for a library they never call, so the module is behind a dynamic
 * import that a disabled build never evaluates.
 */
const MsalAuthProvider = lazy(() => import('./MsalAuthProvider'));

export default function AuthProvider({ children }) {
    if (!AUTH_ENABLED) {
        return <AuthContext.Provider value={LOCAL_IDENTITY}>{children}</AuthContext.Provider>;
    }

    return (
        <Suspense fallback={null}>
            <MsalAuthProvider>{children}</MsalAuthProvider>
        </Suspense>
    );
}
