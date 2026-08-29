'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    inlineSubtitle?: boolean;
}

/** Product page title: Light Frutiger, hierarchy from size — the UBS page voice. */
export default function PageHeader({ title, subtitle, actions, inlineSubtitle }: PageHeaderProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                mb: 3,
                pb: 2.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}
        >
            {inlineSubtitle ? (
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="h3" sx={{ fontWeight: 300, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            ) : (
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 300, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            )}
            {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>{actions}</Box>}
        </Box>
    );
}
