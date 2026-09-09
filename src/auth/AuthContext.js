import { createContext, useContext } from 'react';

/**
 * Who is signed in, and how to change that.
 *
 * `enabled: false` is a first-class state, not an error: the platform runs open
 * in most deployments, and every consumer here has to render sensibly for a
 * person the app knows nothing about.
 */
export const AuthContext = createContext({
    enabled: false,
    ready: true,
    account: null,
    name: 'Aniket Marwadi',
    email: '',
    initials: 'AM',
    signIn: () => {},
    signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

/** `Aniket Marwadi` → `AM`. */
export function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
