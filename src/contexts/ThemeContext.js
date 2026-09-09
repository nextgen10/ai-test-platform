import { createContext, useContext } from 'react';

export const THEME_STORAGE_KEY = 'themeMode';

export const ThemeContext = createContext({
    mode: 'light',
    toggleColorMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

/**
 * The mode already on `<html>`.
 *
 * `index.html` stamps this before first paint, so reading it back is what keeps
 * React's first render in step with what the user is already looking at.
 */
export function initialMode() {
    if (typeof document === 'undefined') return 'light';
    const stamped = document.documentElement.getAttribute('data-theme');
    if (stamped === 'light' || stamped === 'dark') return stamped;
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        /* private mode */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
