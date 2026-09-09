import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { THEME_STORAGE_KEY, ThemeContext, initialMode } from './ThemeContext';

function persistMode(mode) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
        /* private mode */
    }
    // Guard: some headless / early-teardown contexts leave documentElement null.
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) return;
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
}

/**
 * Light/dark for the whole app.
 *
 * The palette itself lives in CSS variables keyed off `[data-theme]`, so a
 * toggle is one attribute write — no re-render of the tree is needed to repaint
 * it. React state is kept only for the components that need the colour as a
 * value (an SVG fill, a computed tint).
 */
export default function ThemeProvider({ children }) {
    const [mode, setMode] = useState(initialMode);

    useEffect(() => {
        persistMode(mode);
    }, [mode]);

    const toggleColorMode = useCallback(() => {
        setMode((previous) => (previous === 'light' ? 'dark' : 'light'));
    }, []);

    const value = useMemo(() => ({ mode, toggleColorMode }), [mode, toggleColorMode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
