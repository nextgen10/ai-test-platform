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
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Loading Agent HUB...
            </Typography>
        </Box>
    );
}
