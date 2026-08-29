'use client';

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import SectionHeader from './SectionHeader';

const PILLARS = [
  {
    index: '01',
    accent: '#af8626',
    tag: 'Onboard',
    title: 'File-based registry',
    body: 'Agents, workflows, skills, and prompts are files. Drop them in the catalog — no migration, no redeploy.',
  },
  {
    index: '02',
    accent: '#00759e',
    tag: 'Run',
    title: 'Agent Console',
    body: 'The universal execution plane. Any onboarded workflow, any model, live SSE, session history.',
  },
  {
    index: '03',
    accent: '#804c95',
    tag: 'Run',
    title: 'Custom UIs',
    body: 'A dedicated surface when the job needs one. Test Design and Workflow Builder are two of those — declared on the workflow, not hardcoded in nav.',
  },
  {
    index: '04',
    accent: '#469a6c',
    tag: 'Trace',
    title: 'Jobs & evidence',
    body: 'One run is one job: isolated execution, versioned artifacts, and an audit trail. Nothing lives only in a chat.',
  },
];

export default function FeatureBentoGrid({ index = '02' }: { index?: string }) {
  return (
    <Box sx={{ width: '100%' }}>
      <SectionHeader
        index={index}
        eyebrow="The control plane"
        title="Four things the platform actually does"
        lede="Agent HUB onboards, runs, and records multi-agent work. Custom UIs are optional surfaces on top of that — not a second product."
      />

      <Grid container>
        {PILLARS.map((p, i) => (
          <Grid
            key={p.title}
            size={{ xs: 12, sm: 6, md: 3 }}
            sx={{
              px: { xs: 0, md: i === 0 ? 0 : 3 },
              py: { xs: 3, md: 1 },
              borderLeft: {
                xs: 0,
                md: i === 0 ? 0 : '1px solid var(--col-border-illustrative)',
              },
              borderTop: {
                xs: i === 0 ? 0 : '1px solid var(--col-border-illustrative)',
                sm: i < 2 ? 0 : '1px solid var(--col-border-illustrative)',
                md: 0,
              },
              pr: { sm: i % 2 === 0 ? 3 : 0, md: 3 },
              pl: { sm: i % 2 === 1 ? 3 : 0, md: i === 0 ? 0 : 3 },
              transition: 'transform 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
              '&:hover .pillar-index': { color: p.accent },
            }}
          >
            <Typography
              className="pillar-index"
              aria-hidden
              sx={{
                fontWeight: 300,
                fontSize: { xs: '3rem', md: '3.75rem' },
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: 'text.disabled',
                fontVariantNumeric: 'tabular-nums',
                mb: 2,
                transition: 'color 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
              }}
            >
              {p.index}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
              <Box sx={{ width: 16, height: 2, bgcolor: p.accent, flexShrink: 0 }} />
              <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                {p.tag}
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 500, fontSize: '1.125rem', mb: 1 }}>
              {p.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
              {p.body}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
