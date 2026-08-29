'use client';

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import SectionHeader from './SectionHeader';

const COMPARISON_ROWS = [
  {
    feature: 'Onboarding a workflow',
    generic: 'Hardcoded into the application. A new use case is a release.',
    agentHub: 'A file in the registry. Drop a .workflow.yaml — it is live, with no redeploy.',
  },
  {
    feature: 'How work is run',
    generic: 'One chat window, or one purpose-built screen that is the product.',
    agentHub: 'Agent Console for anything onboarded. A Custom UI only when the workflow declares one.',
  },
  {
    feature: 'Adding a new use case',
    generic: 'Rewrite agents, prompts, and UI in the platform codebase.',
    agentHub: 'Describe it in English. Workflow Builder designs, writes, and installs it into the registry.',
  },
  {
    feature: 'Record of a run',
    generic: 'An ephemeral transcript. Nothing to audit, replay, or export.',
    agentHub: 'One job per run: versioned artifacts, status history, and a complete event trail.',
  },
  {
    feature: 'Human control',
    generic: 'Hope the model asked the right question. No structured gate.',
    agentHub: 'Workflows can pause for approval. Decisions are recorded on the job.',
  },
  {
    feature: 'Isolation',
    generic: 'A long-lived shared process. A crash or injection lands on everyone.',
    agentHub: '1 request = 1 job. Sandboxed workspace, no shell, bounded filesystem.',
  },
];

export default function ComparisonSection({ index = '03' }: { index?: string }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box sx={{ width: '100%' }}>
      <SectionHeader
        index={index}
        eyebrow="The architectural difference"
        title="A control plane, not a chatbot"
        lede="Prompting a model in a window is not an enterprise execution platform. Agent HUB onboards files, runs jobs, and keeps evidence — Custom UIs are optional surfaces on that plane."
      />

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflowX: 'auto',
          boxShadow: 'none',
        }}
      >
        <Table sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 500, fontSize: '0.85rem', py: 2, width: '22%' }}>
                Capability
              </TableCell>
              <TableCell sx={{ fontWeight: 500, fontSize: '0.85rem', py: 2, width: '38%', color: 'text.secondary' }}>
                A prompt, or a hardcoded app
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  py: 2,
                  width: '40%',
                  color: 'primary.main',
                  bgcolor: isLight ? '#fbeaea' : 'rgba(230, 0, 0, 0.12)',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }}
              >
                Agent HUB Platform
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {COMPARISON_ROWS.map((row) => (
              <TableRow
                key={row.feature}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  '&:hover': { bgcolor: isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.015)' },
                }}
              >
                <TableCell component="th" scope="row" sx={{ verticalAlign: 'top', py: 2.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.86rem' }}>
                    {row.feature}
                  </Typography>
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top', py: 2.25 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.55 }}>
                    {row.generic}
                  </Typography>
                </TableCell>
                <TableCell
                  sx={{
                    verticalAlign: 'top',
                    py: 2.25,
                    bgcolor: isLight ? 'rgba(230, 0, 0, 0.015)' : 'rgba(230, 0, 0, 0.03)',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: '0.86rem', color: 'text.primary', lineHeight: 1.55 }}>
                    {row.agentHub}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
