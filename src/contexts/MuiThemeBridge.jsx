import React, { useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { getUnifiedTheme } from '@/theme/mui-theme';
import { useThemeMode } from './ThemeContext';

/**
 * MUI theme that tracks the same light/dark mode as the CSS-variable ThemeProvider.
 *
 * Dropdowns / Selects in the Agent Console use MUI so layout matches the Next app.
 */
export default function MuiThemeBridge({ children }) {
    const { mode } = useThemeMode();
    const theme = useMemo(() => getUnifiedTheme(mode === 'dark' ? 'dark' : 'light'), [mode]);

    return (
        <MuiThemeProvider theme={theme}>
            <CssBaseline enableColorScheme />
            {children}
        </MuiThemeProvider>
    );
}
