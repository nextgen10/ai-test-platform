'use client';

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';

export type ColorMode = 'light' | 'dark';

const THEME_COOKIE = 'themeMode';
const THEME_STORAGE_KEY = 'themeMode';

export const ThemeContext = createContext({
    toggleColorMode: () => {},
    mode: 'light' as ColorMode,
});

export const useThemeMode = () => useContext(ThemeContext);

function persistMode(mode: ColorMode) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
        /* private mode */
    }
    try {
        // Readable on the next SSR pass so MUI class names match hydration.
        document.cookie = `${THEME_COOKIE}=${mode};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
        /* ignore */
    }
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
}

/**
 * Theme must match between the server HTML and the first client render.
 * We take `initialMode` from a cookie (set by the blocking layout script /
 * toggle). Never read localStorage during render — that is what used to paint
 * light Emotion classes on the server and dark ones on the client, which React
 * reports as a hydration mismatch on every nav button.
 */
export const ThemeModeProvider = ({
    children,
    initialMode = 'light',
}: {
    children: React.ReactNode;
    initialMode?: ColorMode;
}) => {
    const [mode, setMode] = useState<ColorMode>(initialMode);

    // After hydrate only: adopt a stored preference that the first SSR couldn't
    // see (no cookie yet). Never do this during render — that caused the
    // Emotion className mismatch on every nav button.
    useEffect(() => {
        try {
            const stored = localStorage.getItem(THEME_STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') {
                if (stored !== initialMode) {
                    setMode(stored);
                    persistMode(stored);
                }
                return;
            }
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const next: ColorMode = prefersDark ? 'dark' : 'light';
            if (next !== initialMode) {
                setMode(next);
                persistMode(next);
            }
        } catch {
            /* ignore */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only sync
    }, []);

    const toggleColorMode = useCallback(() => {
        setMode((prev) => {
            const next: ColorMode = prev === 'light' ? 'dark' : 'light';
            persistMode(next);
            return next;
        });
    }, []);

    const colorMode = useMemo(
        () => ({
            toggleColorMode,
            mode,
        }),
        [toggleColorMode, mode],
    );

    return <ThemeContext.Provider value={colorMode}>{children}</ThemeContext.Provider>;
};
