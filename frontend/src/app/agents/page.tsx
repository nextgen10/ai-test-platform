'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';

export default function AgentsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/registry?tab=agents');
    }, [router]);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
        </Box>
    );
}
