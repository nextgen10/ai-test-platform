'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    inlineSubtitle?: boolean;
}

export default function PageHeader({ title, subtitle, actions, inlineSubtitle }: PageHeaderProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                mb: 2.5,
            }}
        >
            {inlineSubtitle ? (
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="h5" fontWeight={700}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            &bull; {subtitle}
                        </Typography>
                    )}
                </Box>
            ) : (
                <Box>
                    <Typography variant="h5" fontWeight={700}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            )}
            {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>{actions}</Box>}
        </Box>
    );
}
