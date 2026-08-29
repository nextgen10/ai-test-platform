'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

const AMBER = '#af8626';
const GREEN = '#469a6c';
const RED = '#e60000';
const TEAL = '#00759e';
const PLUM = '#804c95';

const NODES = [
  { id: 'registry', step: '01', kicker: 'Onboard', label: 'Registry', detail: 'agents · workflows · skills', accent: AMBER },
  { id: 'console', step: '02A', kicker: 'Run', label: 'Agent Console', detail: 'SSE · any model', accent: TEAL },
  { id: 'custom', step: '02B', kicker: 'Run', label: 'Custom UI', detail: 'Test Design · Workflow Builder', accent: PLUM },
  { id: 'jobs', step: '03', kicker: 'Trace', label: 'Jobs', detail: 'artifacts · audit trail', accent: GREEN },
];

/**
 * Control-plane stage: four nodes around Agent HUB, with a live pulse.
 * Same diagram in both themes — only ink and plate invert.
 */
export default function HubPlatformFlow({ inverse = false }: { inverse?: boolean }) {
  const theme = useTheme();
  const isDark = inverse || theme.palette.mode === 'dark';
  const text = isDark ? '#f9f9f7' : '#1c1c1c';
  const muted = isDark ? '#b8b3a2' : '#5A5D5C';
  const line = isDark ? 'rgba(204, 202, 188, 0.28)' : 'rgba(230, 0, 0, 0.28)';
  const cardBg = isDark ? 'rgba(249, 249, 247, 0.04)' : 'rgba(230, 0, 0, 0.05)';
  const cardHover = isDark ? 'rgba(249, 249, 247, 0.08)' : 'rgba(230, 0, 0, 0.08)';

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: { xs: 2.5, md: 3 },
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: isDark ? '#b8b3a2' : '#5A5D5C', letterSpacing: '0.08em' }}
        >
          How Agent HUB Platform runs
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: RED,
              boxShadow: `0 0 0 0 ${RED}`,
              animation: 'hubLive 1.8s cubic-bezier(0.38, 0.19, 0.32, 0.95) infinite',
              '@keyframes hubLive': {
                '0%': { boxShadow: `0 0 0 0 rgba(230, 0, 0, 0.55)` },
                '70%': { boxShadow: `0 0 0 8px rgba(230, 0, 0, 0)` },
                '100%': { boxShadow: `0 0 0 0 rgba(230, 0, 0, 0)` },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
          <Typography variant="overline" sx={{ color: isDark ? '#b8b3a2' : '#5A5D5C', lineHeight: 1 }}>
            Live
          </Typography>
        </Box>
      </Box>

      {/* Narrow: stacked nodes */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.25 }}>
        {NODES.map((node) => (
          <NodeCard key={node.id} node={node} text={text} muted={muted} cardBg={cardBg} cardHover={cardHover} />
        ))}
      </Box>

      {/* Wide: diamond around the hub */}
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: '1fr auto 1fr',
          gridTemplateRows: 'auto auto auto',
          alignItems: 'center',
          columnGap: 2,
          rowGap: 2,
        }}
      >
        <Box />
        <NodeCard node={NODES[1]} text={text} muted={muted} cardBg={cardBg} cardHover={cardHover} align="center" />
        <Box />

        <NodeCard node={NODES[0]} text={text} muted={muted} cardBg={cardBg} cardHover={cardHover} />
        <HubMark text={text} line={line} />
        <NodeCard node={NODES[3]} text={text} muted={muted} cardBg={cardBg} cardHover={cardHover} align="right" />

        <Box />
        <NodeCard node={NODES[2]} text={text} muted={muted} cardBg={cardBg} cardHover={cardHover} align="center" />
        <Box />
      </Box>
    </Box>
  );
}

function HubMark({ text, line }: { text: string; line: string }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: { md: 200, lg: 228 },
        height: { md: 168, lg: 196 },
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid',
        borderColor: line,
        borderRadius: 2,
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          width: 1,
          height: 18,
          bgcolor: line,
        },
        '&::before': { top: -19 },
        '&::after': { bottom: -19 },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: RED, letterSpacing: '0.16em', mb: 0.75, lineHeight: 1 }}
      >
        Control plane
      </Typography>
      <Typography sx={{ fontWeight: 300, fontSize: { md: '0.9375rem', lg: '1.0625rem' }, letterSpacing: '-0.02em', lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ color: RED }}>Agent HUB</Box>
        <Box component="span" sx={{ color: text }}> Platform</Box>
      </Typography>
    </Box>
  );
}

function NodeCard({
  node,
  text,
  muted,
  cardBg,
  cardHover,
  align = 'left',
}: {
  node: (typeof NODES)[number];
  text: string;
  muted: string;
  cardBg: string;
  cardHover: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 2,
        bgcolor: cardBg,
        border: '1px solid',
        borderColor: 'transparent',
        borderTop: `2px solid ${node.accent}`,
        borderRadius: 2,
        textAlign: align,
        transition: 'background-color 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95), transform 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
        '&:hover': {
          bgcolor: cardHover,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: node.accent, display: 'block', lineHeight: 1, mb: 0.75, letterSpacing: '0.08em' }}
      >
        {node.step}  {node.kicker}
      </Typography>
      <Typography sx={{ color: text, fontWeight: 300, fontSize: '1.0625rem', lineHeight: 1.25, mb: 0.35 }}>
        {node.label}
      </Typography>
      <Typography variant="caption" sx={{ color: muted, display: 'block', lineHeight: 1.4 }}>
        {node.detail}
      </Typography>
    </Box>
  );
}
