'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

const LINES = [
  { role: 'you', text: 'Run the payments-settlement workflow on gpt-4.1' },
  { role: 'sys', text: 'workflow · payments-settlement  ·  model · gpt-4.1' },
  { role: 'agent', text: 'Requirement Analyst  ·  INVEST 3.9  ·  gate clear' },
  { role: 'agent', text: 'Streaming designer coverage matrix…' },
];

/**
 * A quiet console mock for the featured Agent Console card.
 * Charcoal panel, Light type, a blinking caret — not a screenshot chrome.
 */
export default function ConsolePreview() {
  return (
    <Box
      aria-hidden
      sx={{
        bgcolor: '#1c1c1c',
        color: '#f9f9f7',
        borderRadius: 0,
        p: { xs: 2.5, md: 3 },
        height: '100%',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        fontFamily: 'inherit',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="overline" sx={{ color: '#b8b3a2', letterSpacing: '0.1em', lineHeight: 1 }}>
          Agent Console
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#e60000',
              animation: 'hubLive 1.8s cubic-bezier(0.38, 0.19, 0.32, 0.95) infinite',
              '@keyframes hubLive': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.35 },
                '100%': { opacity: 1 },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
          <Typography variant="caption" sx={{ color: '#b8b3a2', fontSize: '0.625rem' }}>
            SSE
          </Typography>
        </Box>
      </Box>
      {LINES.map((line, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.25, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: line.role === 'you' ? '#e60000' : '#8e8d83',
              minWidth: 36,
              pt: '1px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {line.role === 'you' ? 'you' : line.role === 'sys' ? 'hub' : 'run'}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: line.role === 'agent' ? '#f9f9f7' : '#cccabc',
              fontWeight: 300,
              fontSize: '0.8125rem',
              lineHeight: 1.45,
            }}
          >
            {line.text}
            {i === LINES.length - 1 && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 7,
                  height: '0.9em',
                  ml: 0.5,
                  bgcolor: '#e60000',
                  verticalAlign: 'text-bottom',
                  animation: 'caret 1s steps(1) infinite',
                  '@keyframes caret': {
                    '0%, 50%': { opacity: 1 },
                    '50.01%, 100%': { opacity: 0 },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
