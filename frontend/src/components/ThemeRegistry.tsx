'use client';
import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getUnifiedTheme } from '@/theme';
import { ThemeModeProvider, useThemeMode } from '@/contexts/ThemeContext';

function ThemeRegistryContent({ children }: { children: React.ReactNode }) {
    const { mode } = useThemeMode();
    const theme = React.useMemo(() => getUnifiedTheme(mode), [mode]);

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', mode);
    }, [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
    return (
        <AppRouterCacheProvider>
            <ThemeModeProvider>
                <ThemeRegistryContent>{children}</ThemeRegistryContent>
            </ThemeModeProvider>
        </AppRouterCacheProvider>
    );
}
