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
  Chip,
  alpha,
  useTheme,
  Grid,
  Stack,
} from '@mui/material';
import { Check, X, ShieldAlert, Sparkles, AlertTriangle, Flame, ShieldCheck } from 'lucide-react';

const RED = '#D00000';
const GREEN = '#1F8A70';
const AMBER = '#D9822B';

const COMPARISON_ROWS = [
  {
    category: 'PRE-FLIGHT',
    feature: 'Requirement Validation & Defect Detection',
    generic: 'Zero pre-flight checks. Runs on vague, ambiguous, or defective requirements without warning.',
    genericPass: false,
    agentHub: '8-Dimension INVEST Quality Gatekeeper + Mandatory human approval checkpoint before generation starts.',
    agentHubPass: true,
  },
  {
    category: 'TEST DESIGN',
    feature: 'Test Coverage Completeness',
    generic: 'Skewed toward simple happy paths; consistently misses complex boundary, negative, and data conditions.',
    genericPass: false,
    agentHub: 'Guaranteed 5-Category Coverage Matrix (Functional, Boundary, Negative, Validation, Data States).',
    agentHubPass: true,
  },
  {
    category: 'FORMAT & CI/CD',
    feature: 'Output Schema & Type Adherence',
    generic: 'Unstable free-form text or invalid markdown JSON blocks that break downstream CI/CD automation.',
    genericPass: false,
    agentHub: 'Strict Draft-07 JSON Schema conformance with automatic Layer 1-3 syntactic and semantic validation.',
    agentHubPass: true,
  },
  {
    category: 'QUALITY CRITIC',
    feature: 'Independent Critic & Verification',
    generic: 'Single-pass generation that blindly validates its own hallucinated assertions and invented parameters.',
    genericPass: false,
    agentHub: 'Dedicated Independent Reviewer Agent with up to 2 bounded self-correction retries for defect rejection.',
    agentHubPass: true,
  },
  {
    category: 'HEALING',
    feature: 'Gap Healing & Iterative Reprocessing',
    generic: 'Total regeneration wipes previously verified passing test cases and introduces unexpected regressions.',
    genericPass: false,
    agentHub: 'In-Place Gap Closer snapshots state, preserves passing tests, and amends the suite non-destructively.',
    agentHubPass: true,
  },
  {
    category: 'AUDIT',
    feature: 'Requirement Traceability & Audit Trail',
    generic: 'Opaque chat conversations with zero structured bidirectional mapping between requirements and tests.',
    genericPass: false,
    agentHub: '100% bidirectional requirement ID mapping with versioned intermediate JSON audit artifacts.',
    agentHubPass: true,
  },
  {
    category: 'SECURITY',
    feature: 'Sandbox & Execution Isolation',
    generic: 'Untrusted input could trigger prompt injection or unsafe tool execution in open LLM frameworks.',
    genericPass: false,
    agentHub: 'Strictly sandboxed execution workspace with blocked shell access and validated JSON inputs.',
    agentHubPass: true,
  },
];

export default function ComparisonSection() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 800, mx: 'auto' }}>
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.75,
          py: 0.5,
          mb: 1.5,
          borderRadius: 4,
          bgcolor: alpha(RED, isLight ? 0.08 : 0.15),
          border: `1px solid ${alpha(RED, 0.25)}`,
        }}>
          <Sparkles size={14} color={RED} />
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.72rem' }}>
            THE ARCHITECTURAL DIFFERENCE
          </Typography>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: '1.9rem', md: '2.45rem' }, letterSpacing: '-0.02em' }}>
          Why Prompting ChatGPT Isn&apos;t Enough
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          Mission-critical financial systems require deterministic schemas, independent quality gates, and non-destructive healing—not probabilistic raw prompts.
        </Typography>
      </Box>

      {/* Top 3 High-Impact Contrasts */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Flame size={18} color="#EF4444" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Raw Prompting Failure Mode
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                Direct LLM prompts hallucinate test steps and produce unstable markdown that fails automated CI/CD parsers.
              </Typography>
            </Box>
            <Chip
              label="Zero Schema Guarantee"
              size="small"
              sx={{ alignSelf: 'flex-start', mt: 2, bgcolor: alpha('#EF4444', 0.1), color: '#EF4444', fontWeight: 700, fontSize: '0.72rem' }}
            />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(AMBER, 0.3),
              bgcolor: alpha(AMBER, isLight ? 0.03 : 0.06),
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <AlertTriangle size={18} color={AMBER} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Blind Self-Validation
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                A single model cannot objectively evaluate its own blind spots, leaving mission-critical edge cases completely untested.
              </Typography>
            </Box>
            <Chip
              label="No Independent Critic"
              size="small"
              sx={{ alignSelf: 'flex-start', mt: 2, bgcolor: alpha(AMBER, 0.15), color: AMBER, fontWeight: 700, fontSize: '0.72rem' }}
            />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(GREEN, 0.4),
              bgcolor: alpha(GREEN, isLight ? 0.04 : 0.08),
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <ShieldCheck size={18} color={GREEN} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Analytic Genie Determinism
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                Multi-agent segregation with Draft-07 JSON Schema validation, 5-category coverage, and non-destructive delta healing.
              </Typography>
            </Box>
            <Chip
              label="100% Deterministic & Traceable"
              size="small"
              sx={{ alignSelf: 'flex-start', mt: 2, bgcolor: alpha(GREEN, 0.18), color: GREEN, fontWeight: 700, fontSize: '0.72rem' }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Main Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflowX: 'auto',
          boxShadow: isLight
            ? '0 12px 32px -10px rgba(0,0,0,0.06)'
            : '0 12px 32px -10px rgba(0,0,0,0.5)',
        }}
      >
        <Table sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'light' ? '#F8FAFC' : 'rgba(255,255,255,0.03)' }}>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem', py: 2.2, width: '22%' }}>
                Capability Area
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem', py: 2.2, width: '38%', color: 'text.secondary' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldAlert size={16} color="#EF4444" />
                  Generic LLM Prompts / ChatGPT
                </Box>
              </TableCell>
              <TableCell sx={{
                fontWeight: 800,
                fontSize: '0.9rem',
                py: 2.2,
                width: '40%',
                color: 'primary.main',
                bgcolor: (t) => t.palette.mode === 'light' ? '#FFEAEA' : 'rgba(208,0,0,0.12)',
                borderLeft: '1px solid',
                borderColor: (t) => t.palette.mode === 'light' ? 'rgba(208,0,0,0.2)' : 'rgba(208,0,0,0.3)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sparkles size={16} color={RED} />
                  Agent HUB Platform
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {COMPARISON_ROWS.map((row) => (
              <TableRow
                key={row.feature}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  '&:hover': { bgcolor: isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.015)' }
                }}
              >
                <TableCell component="th" scope="row" sx={{ verticalAlign: 'top', py: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.86rem', color: 'text.primary', mb: 0.5 }}>
                    {row.feature}
                  </Typography>
                  <Chip
                    label={row.category}
                    size="small"
                    sx={{
                      fontSize: '0.65rem',
                      height: 18,
                      fontWeight: 800,
                      bgcolor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                      color: 'text.secondary',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.84rem', color: 'text.secondary', verticalAlign: 'top', py: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.15
                    }}>
                      <X size={14} strokeWidth={2.5} />
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.5 }}>
                      {row.generic}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{
                  fontSize: '0.84rem',
                  verticalAlign: 'top',
                  py: 2,
                  bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(208,0,0,0.015)' : 'rgba(208,0,0,0.03)',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: alpha(GREEN, 0.15),
                      color: GREEN,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.15
                    }}>
                      <Check size={14} strokeWidth={3} />
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.86rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.5 }}>
                      {row.agentHub}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
