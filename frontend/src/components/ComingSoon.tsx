'use client';

import React from 'react';
import { Box, Paper, Typography, Chip, alpha, useTheme } from '@mui/material';
import { Construction } from 'lucide-react';

interface ComingSoonProps {
    /** Section name, e.g. "Skills". */
    title: string;
    /** One line on what this section will do once implemented. */
    description: string;
    /** Concrete capabilities planned here — shown so the placeholder is informative. */
    planned?: string[];
    /** Where the work is defined, e.g. a blueprint section. */
    reference?: string;
}

/**
 * Placeholder for a navigation section that is scaffolded but not yet built.
 *
 * Deliberately explicit that nothing here is live — a placeholder that looks
 * like a working empty state is worse than no page at all.
 */
export default function ComingSoon({
    title,
    description,
    planned = [],
    reference,
}: ComingSoonProps) {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h5" fontWeight={700}>
                    {title}
                </Typography>
                <Chip label="Not implemented" size="small" color="default" variant="outlined" />
            </Box>

            <Paper
                sx={{
                    p: { xs: 3, md: 5 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 2,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    bgcolor: alpha(theme.palette.text.primary, 0.015),
                }}
            >
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'text.disabled',
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                    }}
                >
                    <Construction size={26} />
                </Box>

                <Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                        This section isn&apos;t built yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
                        {description}
                    </Typography>
                </Box>

                {planned.length > 0 && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            justifyContent: 'center',
                            maxWidth: 640,
                        }}
                    >
                        {planned.map((item) => (
                            <Chip
                                key={item}
                                label={item}
                                size="small"
                                variant="outlined"
                                sx={{ color: 'text.secondary' }}
                            />
                        ))}
                    </Box>
                )}

                {reference && (
                    <Typography variant="caption" color="text.disabled">
                        {reference}
                    </Typography>
                )}
            </Paper>
        </Box>
    );
}
