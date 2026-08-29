'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * UBS carries category through a hairline, not a fill.
 *
 * The earlier landing page tinted every badge with its own colour at 12%
 * opacity, which put five pastel fills on screen at once and read as a generic
 * template rather than a UBS surface. `AccentTag` keeps the same colour coding
 * but spends it on a 2px rule, leaving the type in the neutral ramp.
 */
export function AccentTag({
    accent,
    children,
    size = 'md',
}: {
    accent: string;
    children: React.ReactNode;
    size?: 'sm' | 'md';
}) {
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: size === 'sm' ? 0.875 : 1,
                flexShrink: 0,
            }}
        >
            <Box
                sx={{
                    width: 2,
                    height: size === 'sm' ? 10 : 12,
                    bgcolor: accent,
                    flexShrink: 0,
                }}
            />
            <Typography
                variant="overline"
                sx={{
                    color: 'text.secondary',
                    lineHeight: 1,
                    fontSize: size === 'sm' ? '0.625rem' : '0.6875rem',
                    whiteSpace: 'nowrap',
                }}
            >
                {children}
            </Typography>
        </Box>
    );
}

/**
 * A neutral, hairline-bordered token for factual labels — standards, protocols,
 * file names. No fill, so a dozen of them in a row stay quiet.
 */
export function MetaTag({ children }: { children: React.ReactNode }) {
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 0.875,
                py: 0.375,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                fontSize: '0.6875rem',
                lineHeight: 1.4,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
            }}
        >
            {children}
        </Box>
    );
}

/**
 * Card opener: a plain accent-coloured icon and an `AccentTag`, split to the
 * card's edges. Replaces the 48px tinted icon tile — UBS does not put a
 * coloured plate behind an icon.
 */
export function CardHead({
    accent,
    icon,
    tag,
}: {
    accent: string;
    icon: React.ReactNode;
    tag?: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 2.5,
            }}
        >
            <Box sx={{ color: accent, display: 'inline-flex', flexShrink: 0 }}>{icon}</Box>
            {tag && <AccentTag accent={accent}>{tag}</AccentTag>}
        </Box>
    );
}
