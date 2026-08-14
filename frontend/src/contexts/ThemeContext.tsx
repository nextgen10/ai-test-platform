'use client';
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

export const ThemeContext = createContext({
    toggleColorMode: () => { },
    mode: 'light' as 'light' | 'dark',
});

export const useThemeMode = () => useContext(ThemeContext);

export const ThemeModeProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (savedMode === 'light' || savedMode === 'dark') {
            setMode(savedMode);
        }
    }, []);

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => {
                    const newMode = prevMode === 'light' ? 'dark' : 'light';
                    localStorage.setItem('themeMode', newMode);
                    return newMode;
                });
            },
            mode,
        }),
        [mode],
    );

    return (
        <ThemeContext.Provider value={colorMode}>
            {children}
        </ThemeContext.Provider>
    );
};
