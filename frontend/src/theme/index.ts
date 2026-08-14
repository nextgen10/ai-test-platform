/**
 * UBS-Inspired Design System – Qualaris Unified Theme
 * Centralized theme tokens for a clean, professional financial dashboard aesthetic.
 * Design philosophy: clean layout, spacing, hierarchy, neutrality.
 */

// ============ Color Tokens (Light Mode) ============
export const colors = {
    // Backgrounds & Surfaces
    background: {
        primary: '#FFFFFF',
        secondary: '#F5F7FA',
        tertiary: '#EEF1F5',
    },
    surface: {
        primary: '#FFFFFF',
        elevated: '#FAFBFC',
    },
    // Borders
    border: {
        subtle: '#E3E7ED',
        strong: '#C9D1DC',
    },
    // Typography
    text: {
        primary: '#1C1F24',
        secondary: '#5B6472',
        muted: '#8C96A5',
        inverse: '#FFFFFF',
    },
    // Primary Accent (High-importance actions)
    primary: {
        main: '#D00000',
        hover: '#A60000',
        light: '#FFE5E5',
    },
    // Secondary Accent (Navigation / structure)
    secondary: {
        main: '#2F3A4A',
        hover: '#1F2933',
        light: '#E5E9F0',
    },
    // Semantic
    success: '#1F8A70',
    warning: '#D9822B',
    error: '#C23030',
    info: '#2D6CDF',
    // Chart/metric palette (UBS-aligned, theme-aware)
    chart: {
        rqs: '#2D6CDF',
        accuracy: '#673AB7',
        completeness: '#009688',
        consistency: '#1F8A70',
        safety: '#D00000',
        hallucination: '#C23030',
        primary: '#D00000',
    },
} as const;

// ============ Dark Mode Overrides ============
const darkMode = {
    background: {
        primary: '#0D1117',
        secondary: '#161B22',
        tertiary: '#21262D',
    },
    surface: {
        primary: '#161B22',
        elevated: '#21262D',
    },
    border: {
        subtle: '#30363D',
        strong: '#484F58',
    },
    text: {
        primary: '#E6EDF3',
        secondary: '#8B949E',
        muted: '#6E7681',
        inverse: '#0D1117',
    },
    primary: {
        main: '#E63946',
        hover: '#D00000',
        light: 'rgba(230, 57, 70, 0.15)',
    },
    secondary: {
        main: '#8B949E',
        hover: '#E6EDF3',
        light: '#21262D',
    },
} as const;

// ============ Spacing Scale (8px base) ============
export const spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
} as const;

// ============ Typography Scale (UBS-style: clear, professional) ============
export const ubsBrandFont = 'Audela, -apple-system, BlinkMacSystemFont, sans-serif';

export const typography = {
    fontFamily: '"Audela", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2 },
    h2: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 },
    h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0', lineHeight: 1.4 },
    h4: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '0' },
    h5: { fontSize: '1rem', fontWeight: 600 },
    h6: { fontSize: '0.9375rem', fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    button: { textTransform: 'none' as const, fontWeight: 600 },
} as const;

// ============ Border Radius ============
export const shape = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
} as const;

// ============ MUI Theme Factory ============
import { createTheme, alpha } from '@mui/material/styles';

export const getUnifiedTheme = (mode: 'light' | 'dark') => {
    const c = mode === 'light' ? colors : { ...colors, ...darkMode };

    return createTheme({
        palette: {
            mode,
            primary: {
                main: c.primary.main,
                light: c.primary.light,
                dark: c.primary.hover,
                contrastText: '#FFFFFF',
            },
            secondary: {
                main: c.secondary.main,
                light: c.secondary.light,
                dark: c.secondary.hover,
                contrastText: '#FFFFFF',
            },
            background: {
                default: c.background.primary,
                paper: c.surface.primary,
            },
            text: {
                primary: c.text.primary,
                secondary: c.text.secondary,
                disabled: c.text.muted,
            },
            success: { main: colors.success },
            warning: { main: colors.warning },
            error: { main: colors.error },
            info: { main: colors.info },
            divider: c.border.subtle,
        },
        typography: {
            fontFamily: typography.fontFamily,
            h1: typography.h1,
            h2: typography.h2,
            h3: typography.h3,
            h4: typography.h4,
            h5: typography.h5,
            h6: typography.h6,
            button: typography.button,
        },
        shape: {
            borderRadius: 8,
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: shape.md,
                        boxShadow: 'none',
                        textTransform: 'none',
                        fontWeight: 600,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': { boxShadow: 'none' },
                    },
                    contained: {
                        boxShadow: 'none',
                        '&:hover': { boxShadow: 'none' },
                    },
                    containedPrimary: {
                        backgroundColor: c.primary.main,
                        color: '#fff',
                        '&:hover': {
                            backgroundColor: c.primary.hover,
                            boxShadow: `0 2px 8px ${alpha(c.primary.main, 0.25)}`,
                        },
                        '&.Mui-disabled': {
                            backgroundColor: alpha(c.primary.main, 0.4),
                            color: alpha('#fff', 0.7),
                        },
                    },
                    containedSecondary: {
                        backgroundColor: c.secondary.main,
                        color: '#fff',
                        '&:hover': { backgroundColor: c.secondary.hover },
                    },
                    outlined: {
                        borderWidth: 1,
                        '&:hover': {
                            borderWidth: 1,
                            backgroundColor: alpha(c.primary.main, 0.04),
                            borderColor: c.primary.main,
                        },
                    },
                    outlinedPrimary: {
                        borderColor: c.primary.main,
                        color: c.primary.main,
                        '&:hover': {
                            borderColor: c.primary.hover,
                            backgroundColor: c.primary.light,
                        },
                    },
                    text: {
                        '&:hover': { backgroundColor: alpha(c.primary.main, 0.06) },
                    },
                    sizeSmall: { fontSize: '0.8125rem', padding: '4px 12px' },
                    sizeMedium: { fontSize: '0.875rem', padding: '8px 20px' },
                    sizeLarge: { fontSize: '0.9375rem', padding: '10px 24px' },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: shape.md,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': { backgroundColor: alpha(c.primary.main, 0.08) },
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: c.surface.primary,
                        border: '1px solid',
                        borderColor: c.border.subtle,
                        borderRadius: 8,
                        boxShadow: mode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: c.surface.primary,
                        border: '1px solid',
                        borderColor: c.border.subtle,
                        borderRadius: 8,
                        boxShadow: mode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${c.border.subtle}`,
                        padding: 16,
                    },
                },
            },
        },
    });
};

export const nexusTheme = getUnifiedTheme('light');
