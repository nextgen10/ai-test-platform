'use client';

import React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface AnimatedQualarisWordProps {
    word?: string;
    withDots?: boolean;
    sx?: SxProps<Theme>;
}

export default function AnimatedQualarisWord({ word = 'Analytic Genie', withDots = false, sx }: AnimatedQualarisWordProps) {
    const letters = word.split('');

    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: 700,
                fontSize: '1.05rem',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                textTransform: 'none',
                ...sx,
            }}
        >
            {letters.map((char, idx) => {
                if (char === ' ') {
                    return (
                        <Box key={`space-${idx}`} component="span" sx={{ width: '0.4em' }}>
                            &nbsp;
                        </Box>
                    );
                }

                // First word: primary.main (Analytic), Second word: text.primary (Genie) or alternating
                const isSecondWord = idx > word.indexOf(' ') && word.indexOf(' ') !== -1;

                return (
                    <React.Fragment key={`${char}-${idx}`}>
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-block',
                                color: isSecondWord ? 'text.primary' : 'primary.main',
                                '@keyframes qualarisWave': {
                                    '0%, 100%': { transform: 'translateY(0px)', opacity: 0.95 },
                                    '50%': { transform: 'translateY(-1.5px)', opacity: 1 },
                                },
                                animation: 'qualarisWave 2s ease-in-out infinite',
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
