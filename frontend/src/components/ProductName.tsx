'use client';

import React from 'react';
import { Box, useTheme } from '@mui/material';

type ProductNameVariant = 'nav' | 'hero' | 'inline';

/**
 * Canonical product name: Agent HUB in brand red, Platform in black.
 * Hero stacks on two lines so the lockup can occupy more of the stage.
 */
export default function ProductName({
    variant = 'inline',
    inverse = false,
}: {
    variant?: ProductNameVariant;
    inverse?: boolean;
}) {
    const theme = useTheme();
    const platformColor = inverse
        ? '#F9F9F7'
        : theme.palette.mode === 'dark'
            ? theme.palette.text.primary
            : '#1C1C1C';

    if (variant === 'hero') {
        return (
            <Box
                component="span"
                sx={{
                    display: 'block',
                    fontWeight: 300,
                    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.75rem', lg: '5.5rem' },
                    lineHeight: 0.95,
                    letterSpacing: '-0.03em',
                }}
            >
                <Box component="span" sx={{ display: 'block', color: 'primary.main' }}>
                    Agent HUB
                </Box>
                <Box component="span" sx={{ display: 'block', color: platformColor }}>
                    Platform
                </Box>
            </Box>
        );
    }

    return (
        <Box
            component="span"
            sx={{
                display: 'inline',
                fontSize: variant === 'nav' ? { xs: '0.8125rem', md: '0.9375rem' } : 'inherit',
                lineHeight: 1.15,
                letterSpacing: 0,
                whiteSpace: 'nowrap',
            }}
        >
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }}>
                Agent HUB
            </Box>
            <Box component="span" sx={{ color: platformColor, fontWeight: 500 }}>
                {' '}Platform
            </Box>
        </Box>
    );
}
