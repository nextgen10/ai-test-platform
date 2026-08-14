'use client';

import { Box } from '@mui/material';

/**
 * Vertical pipe separator between UBS logo and app title.
 */
export const BrandPipe = () => (
    <Box
        component="span"
        sx={{
            width: '1.5px',
            minWidth: '1.5px',
            height: 28,
            bgcolor: '#8C96A5',
            flexShrink: 0,
        }}
    />
);
