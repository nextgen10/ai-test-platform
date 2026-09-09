'use client';

import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';

const BRAND = '#0769A6';

/** Light / dark pairs picked to stay distinct from brand blue on both plates. */
type Tone = readonly [light: string, dark: string];

const TONE = {
  gold: ['#A67C12', '#E8C15A'] as Tone,
  aqua: ['#0D7F8C', '#5ED4DC'] as Tone,
  orchid: ['#8B47B8', '#D4A8F0'] as Tone,
  green: ['#2F8F58', '#7ED9A0'] as Tone,
};

const NODES = [
  { id: 'registry', step: '01', kicker: 'Onboard', label: 'Registry', detail: 'agents · workflows · skills', tone: TONE.gold },
  { id: 'console', step: '02A', kicker: 'Run', label: 'Agent Console', detail: 'SSE · any model', tone: TONE.aqua },
  { id: 'custom', step: '02B', kicker: 'Run', label: 'Custom UI', detail: 'Test Design · Workflow Builder', tone: TONE.orchid },
  { id: 'jobs', step: '03', kicker: 'Trace', label: 'Jobs', detail: 'artifacts · audit trail', tone: TONE.green },
];

/**
 * Control-plane stage: four nodes around Agent HUB, with a live pulse.
 * Accents swap luminance in dark mode so gold / aqua / orchid / green still read.
 */
export default function HubPlatformFlow({ inverse = false }: { inverse?: boolean }) {
  const theme = useTheme();
  const isDark = inverse || theme.palette.mode === 'dark';
  const pick = (tone: Tone) => (isDark ? tone[1] : tone[0]);
  const text = isDark ? '#f9f9f7' : '#1c1c1c';
  const muted = isDark ? '#cccabc' : '#5A5D5C';
  const line = isDark ? 'rgba(204, 202, 188, 0.36)' : 'rgba(7, 105, 166, 0.22)';
  const live = isDark ? '#E8696F' : '#DA0000';

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
          sx={{ color: muted, letterSpacing: '0.08em' }}
        >
          How Agent HUB Platform runs
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: live,
              animation: 'hubLive 1.8s cubic-bezier(0.38, 0.19, 0.32, 0.95) infinite',
              '@keyframes hubLive': {
                '0%': { boxShadow: `0 0 0 0 ${alpha(live, 0.7)}` },
                '70%': { boxShadow: `0 0 0 12px ${alpha(live, 0)}` },
                '100%': { boxShadow: `0 0 0 0 ${alpha(live, 0)}` },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
          <Typography
            variant="overline"
            sx={{ color: muted, lineHeight: 1, fontSize: '0.6875rem', letterSpacing: '0.1em', fontWeight: 500 }}
          >
            Live
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.25 }}>
        {NODES.map((node) => (
          <NodeCard key={node.id} node={node} accent={pick(node.tone)} text={text} muted={muted} isDark={isDark} />
        ))}
      </Box>

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
        <NodeCard node={NODES[1]} accent={pick(NODES[1].tone)} text={text} muted={muted} isDark={isDark} align="center" />
        <Box />

        <NodeCard node={NODES[0]} accent={pick(NODES[0].tone)} text={text} muted={muted} isDark={isDark} />
        <HubMark text={text} line={line} />
        <NodeCard node={NODES[3]} accent={pick(NODES[3].tone)} text={text} muted={muted} isDark={isDark} align="right" />

        <Box />
        <NodeCard node={NODES[2]} accent={pick(NODES[2].tone)} text={text} muted={muted} isDark={isDark} align="center" />
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
        bgcolor: alpha(BRAND, 0.06),
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
        sx={{ color: BRAND, letterSpacing: '0.16em', mb: 0.75, lineHeight: 1 }}
      >
        Control plane
      </Typography>
      <Typography sx={{ fontWeight: 300, fontSize: { md: '0.9375rem', lg: '1.0625rem' }, letterSpacing: '-0.02em', lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ color: BRAND }}>Agent HUB</Box>
        <Box component="span" sx={{ color: text }}> Platform</Box>
      </Typography>
    </Box>
  );
}

function NodeCard({
  node,
  accent,
  text,
  muted,
  isDark,
  align = 'left',
}: {
  node: (typeof NODES)[number];
  accent: string;
  text: string;
  muted: string;
  isDark: boolean;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 2,
        bgcolor: alpha(accent, isDark ? 0.12 : 0.08),
        border: '1px solid',
        borderColor: alpha(accent, isDark ? 0.45 : 0.35),
        borderTop: `3px solid ${accent}`,
        borderRadius: 2,
        textAlign: align,
        transition: 'background-color 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95), transform 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
        '&:hover': {
          bgcolor: alpha(accent, isDark ? 0.18 : 0.12),
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: accent, display: 'block', lineHeight: 1, mb: 0.75, letterSpacing: '0.08em' }}
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
