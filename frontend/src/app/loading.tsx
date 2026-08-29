'use client';

// MUI components are client components, and this file is pulled into the
// prerender of every route. Without this directive the whole @mui/material
// barrel is evaluated in the server graph, which reaches useMediaQuery's
// module-scope call into a 'use client' export and fails `next build`.

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function GlobalLoading() {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexGrow: 1,
                minHeight: '40vh',
                gap: 2,
            }}
        >
            <CircularProgress size={40} thickness={4} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Loading Agent HUB Platform...
            </Typography>
        </Box>
    );
}
