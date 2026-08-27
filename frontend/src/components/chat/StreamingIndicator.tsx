'use client';

import React from 'react';
import { Box, Typography, useTheme, keyframes } from '@mui/material';
import { Bot } from 'lucide-react';

const pulse = keyframes`
  0%, 100% { opacity: 0.3; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

export const StreamingIndicator: React.FC<{ statusText?: string }> = ({
  statusText = 'Generating with GitHub Copilot...',
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.75,
        py: 0.75,
        borderRadius: 2,
        bgcolor: isLight ? 'rgba(208, 0, 0, 0.05)' : 'rgba(208, 0, 0, 0.12)',
        border: '1px solid',
        borderColor: isLight ? 'rgba(208, 0, 0, 0.15)' : 'rgba(208, 0, 0, 0.25)',
        mt: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: 'primary.main',
        }}
      >
        <Bot size={15} />
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            animation: `${pulse} 1.2s infinite ease-in-out`,
          }}
        />
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            animation: `${pulse} 1.2s infinite ease-in-out 0.2s`,
          }}
        />
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            animation: `${pulse} 1.2s infinite ease-in-out 0.4s`,
          }}
        />
      </Box>

      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: '0.78rem',
          color: isLight ? '#475569' : '#94a3b8',
        }}
      >
        {statusText}
      </Typography>
    </Box>
  );
};

export const StreamingCursor: React.FC = () => {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: '6px',
        height: '14px',
        bgcolor: 'primary.main',
        ml: '3px',
        verticalAlign: 'middle',
        borderRadius: '1px',
        animation: `${blink} 0.8s infinite`,
      }}
    />
  );
};
