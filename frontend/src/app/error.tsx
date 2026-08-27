'use client';

import React, { useEffect } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Global Error Boundary caught an error:', error);
    }, [error]);

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    textAlign: 'center',
                    gap: 3,
                }}
            >
                <AlertTriangle size={64} color="#D00000" />
                <Box>
                    <Typography variant="h4" fontWeight={800} gutterBottom>
                        Something went wrong!
                    </Typography>
                    <Typography color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
                        An unexpected error occurred in the application. The technical details have been logged.
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 3, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, fontFamily: 'monospace' }}>
                        {error.message || 'Unknown runtime error'}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<RefreshCw size={18} />}
                    onClick={() => reset()}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 3, py: 1 }}
                >
                    Try Again
                </Button>
            </Box>
        </Container>
    );
}
