'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Horizontal agent chain — a visual instead of a numbered list.
 * 2px nodes, hairline connectors, UBS chart accents.
 */
export default function PipelineStrip({
  agents,
  accent,
}: {
  agents: string[];
  accent: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        overflowX: 'auto',
        pb: 0.5,
      }}
    >
      {agents.map((name, i) => (
        <Box
          key={name}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            flex: '1 1 0',
            minWidth: 72,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: i === 0 ? accent : 'transparent',
                border: '1.5px solid',
                borderColor: accent,
                mb: 1,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                fontSize: '0.6875rem',
                lineHeight: 1.35,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: '0.75rem', lineHeight: 1.35, fontWeight: 500, mt: 0.25 }}
            >
              {name}
            </Typography>
          </Box>
          {i < agents.length - 1 && (
            <Box
              sx={{
                height: 1.5,
                flex: '0 0 10px',
                mt: '3.25px',
                bgcolor: accent,
                opacity: 0.35,
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}
