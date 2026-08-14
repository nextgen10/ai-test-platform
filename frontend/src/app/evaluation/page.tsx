'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';

export default function EvaluationRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/docs?tab=evaluation');
    }, [router]);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
        </Box>
    );
}
