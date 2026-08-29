'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * UBS section kicker: a 2px brand-red rule and an overline in Medium.
 * Used on marketing and product pages in place of pill badges.
 */
export default function UbsEyebrow({
    children,
    align = 'left',
}: {
    children: React.ReactNode;
    align?: 'left' | 'center';
}) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: align === 'center' ? 'center' : 'flex-start',
                gap: 1.5,
                mb: 1.5,
            }}
        >
            <Box
                sx={{
                    width: 24,
                    height: 2,
                    bgcolor: 'primary.main',
                    flexShrink: 0,
                }}
            />
            <Typography
                variant="overline"
                sx={{ color: 'text.secondary', lineHeight: 1, display: 'block' }}
            >
                {children}
            </Typography>
        </Box>
    );
}
