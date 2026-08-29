'use client';

import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import Link from 'next/link';

export default function NotFound() {
    return (
        <Container maxWidth="sm">
            <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="h4" fontWeight={500} gutterBottom>
                    Page not found
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    That path is not part of Agent HUB Platform.
                </Typography>
                <Button component={Link} href="/" variant="contained">
                    Back to home
                </Button>
            </Box>
        </Container>
    );
}
