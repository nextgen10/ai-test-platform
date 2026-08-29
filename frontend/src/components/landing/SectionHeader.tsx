'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * The one section opener used by every landing block.
 *
 * The page stacks nine sections, so they have to share a rhythm or they read as
 * nine unrelated templates glued together. Everything is fixed here: the
 * tabular index in the left rail, the brand hairline, the Light headline, and
 * the measure of the lede. Sections vary only in their words and their action.
 */
export default function SectionHeader({
    index,
    eyebrow,
    title,
    lede,
    action,
    children,
}: {
    index?: string;
    eyebrow: string;
    title: React.ReactNode;
    lede?: string;
    /** Optional control (button, toggle) pinned to the baseline on the right. */
    action?: React.ReactNode;
    /** Body of the section — sits in the title column, not under the index rail. */
    children?: React.ReactNode;
}) {
    return (
        <Box sx={{ mb: children ? 0 : { xs: 4, md: 6 }, display: 'flex', gap: { xs: 2, md: 4 } }}>
            {index && (
                <Typography
                    aria-hidden
                    sx={{
                        fontWeight: 300,
                        fontSize: { xs: '0.875rem', md: '1rem' },
                        color: 'text.disabled',
                        pt: 0.5,
                        minWidth: { xs: 24, md: 40 },
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {index}
                </Typography>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                    sx={{
                        mb: children ? { xs: 4, md: 6 } : 0,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: { xs: 2.5, md: 4 },
                    }}
                >
                    <Box sx={{ maxWidth: 720 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                            <Box sx={{ width: 24, height: 2, bgcolor: 'primary.main', flexShrink: 0 }} />
                            <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                                {eyebrow}
                            </Typography>
                        </Box>
                        <Typography
                            variant="h2"
                            sx={{
                                fontWeight: 300,
                                letterSpacing: 0,
                                mb: lede ? 1.75 : 0,
                                fontSize: { xs: '1.75rem', md: '2.375rem' },
                                lineHeight: 1.15,
                            }}
                        >
                            {title}
                        </Typography>
                        {lede && (
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                sx={{ fontWeight: 300, lineHeight: 1.6, fontSize: { xs: '1rem', md: '1.0625rem' } }}
                            >
                                {lede}
                            </Typography>
                        )}
                    </Box>
                    {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
                </Box>
                {children}
            </Box>
        </Box>
    );
}
