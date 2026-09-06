'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getUnifiedTheme } from '@/theme';
import { ThemeModeProvider, useThemeMode, type ColorMode } from '@/contexts/ThemeContext';

function ThemeRegistryContent({ children }: { children: React.ReactNode }) {
    const { mode } = useThemeMode();
    const theme = React.useMemo(() => getUnifiedTheme(mode), [mode]);

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.style.colorScheme = mode;
    }, [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}

export default function ThemeRegistry({
    children,
    initialMode = 'light',
}: {
    children: React.ReactNode;
    initialMode?: ColorMode;
}) {
    return (
        <AppRouterCacheProvider>
            <ThemeModeProvider initialMode={initialMode}>
                <ThemeRegistryContent>{children}</ThemeRegistryContent>
            </ThemeModeProvider>
        </AppRouterCacheProvider>
    );
}
