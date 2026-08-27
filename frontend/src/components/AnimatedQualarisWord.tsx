'use client';

import React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface AnimatedBrandWordProps {
    word?: string;
    withDots?: boolean;
    sx?: SxProps<Theme>;
}

export default function AnimatedBrandWord({ word = 'Agent HUB Platform', withDots = false, sx }: AnimatedBrandWordProps) {
    const letters = word.split('');

    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: 800,
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                letterSpacing: '-0.01em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                textTransform: 'none',
                ...sx,
            }}
        >
            {letters.map((char, idx) => {
                if (char === ' ') {
                    return (
                        <Box key={`space-${idx}`} component="span" sx={{ width: '0.35em' }}>
                            &nbsp;
                        </Box>
                    );
                }

                // 'Agent HUB' -> primary.main, 'Platform' -> text.primary
                const isThirdWord = idx >= word.lastIndexOf(' ') && word.lastIndexOf(' ') !== -1;

                return (
                    <React.Fragment key={`${char}-${idx}`}>
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-block',
                                color: isThirdWord ? 'text.primary' : 'primary.main',
                                '@keyframes agentHubWave': {
                                    '0%, 100%': { transform: 'translateY(0px)', opacity: 0.95 },
                                    '50%': { transform: 'translateY(-1.5px)', opacity: 1 },
                                },
                                animation: 'agentHubWave 2s ease-in-out infinite',
                                animationDelay: `${idx * 0.06}s`,
                            }}
                        >
                            {char}
                        </Box>
                        {withDots && idx < letters.length - 1 && letters[idx + 1] !== ' ' && (
                            <Box
                                component="span"
                                sx={{
                                    display: 'inline-block',
                                    mx: 0.15,
                                    color: 'text.secondary',
                                    opacity: 0.6,
                                    fontWeight: 700,
                                }}
                            >
                                &middot;
                            </Box>
                        )}
                    </React.Fragment>
                );
            })}
        </Box>
    );
}
