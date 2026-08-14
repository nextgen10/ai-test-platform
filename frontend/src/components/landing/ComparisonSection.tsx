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
} from '@mui/material';
import { Check, X, ShieldAlert, Sparkles } from 'lucide-react';

const RED = '#D00000';
const GREEN = '#1F8A70';

const COMPARISON_ROWS = [
  {
    feature: 'Requirement Validation',
    generic: 'Zero pre-flight checks. Runs on vague or defective requirements.',
    genericPass: false,
    qualaris: '8-Dimension INVEST Quality Report & Human Approval checkpoint before generation.',
    qualarisPass: true,
  },
  {
    feature: 'Test Coverage Depth',
    generic: 'Skewed toward simple happy paths; misses complex boundary & negative flows.',
    genericPass: false,
    qualaris: 'Guaranteed 5-Category Coverage Matrix (Functional, Boundary, Negative, Validation, Data).',
    qualarisPass: true,
  },
  {
    feature: 'Output Schema Adherence',
    generic: 'Unstable free-form text or invalid markdown JSON fences that break CI/CD pipelines.',
    genericPass: false,
    qualaris: 'Strict Draft-07 JSON Schema conformance with Layer 1-3 syntactic and semantic validation.',
    qualarisPass: true,
  },
  {
    feature: 'Independent Critic & Review',
    generic: 'Self-validating model that ignores its own oversights and hallucinated assertions.',
    genericPass: false,
    qualaris: 'Dedicated Reviewer Agent acts as independent critic with up to 2 bounded self-correction retries.',
    qualarisPass: true,
  },
  {
    feature: 'Gap Healing & Reprocessing',
    generic: 'Total regeneration wipes previously verified passing tests and creates regression bugs.',
    genericPass: false,
    qualaris: 'In-place Gap Closer preserves passing tests, snapshots state, and amends suites non-destructively.',
    qualarisPass: true,
  },
  {
    feature: 'Traceability & Audit Trail',
    generic: 'Opaque chat logs; zero structured traceability between requirements and test cases.',
    genericPass: false,
    qualaris: '100% bi-directional requirement mapping with versioned intermediate JSON artifacts.',
    qualarisPass: true,
  },
  {
    feature: 'Execution Security',
    generic: 'Untrusted input could trigger prompt injection or execution escape in open LLMs.',
    genericPass: false,
    qualaris: 'Strictly sandboxed execution workspace with blocked shell access and validated JSON inputs.',
    qualarisPass: true,
  },
];

export default function ComparisonSection() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 760, mx: 'auto' }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em' }}>
          THE ARCHITECTURAL DIFFERENCE
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.5, mb: 1.5, fontSize: { xs: '1.85rem', md: '2.35rem' } }}>
          Why Prompting ChatGPT Isn’t Enough
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          Mission-critical financial systems require deterministic schemas, independent quality gates, and non-destructive healing—not raw probabilistic prompts.
        </Typography>
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden'
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'light' ? '#F5F7FA' : 'rgba(255,255,255,0.03)' }}>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.88rem', py: 2.2, width: '22%' }}>
                Capability / Standard
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.88rem', py: 2.2, width: '39%', color: 'text.secondary' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldAlert size={16} />
                  Generic LLM Prompts / ChatGPT
                </Box>
              </TableCell>
              <TableCell sx={{
                fontWeight: 800,
                fontSize: '0.92rem',
                py: 2.2,
                width: '39%',
                color: 'primary.main',
                bgcolor: (t) => t.palette.mode === 'light' ? '#FFEAEA' : 'rgba(208,0,0,0.12)',
                borderLeft: '1px solid',
                borderColor: (t) => t.palette.mode === 'light' ? 'rgba(208,0,0,0.2)' : 'rgba(208,0,0,0.3)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sparkles size={16} color={RED} />
                  Qualaris Analytic Genie
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
                <TableCell component="th" scope="row" sx={{ fontWeight: 700, fontSize: '0.84rem' }}>
                  {row.feature}
                </TableCell>
                <TableCell sx={{ fontSize: '0.84rem', color: 'text.secondary', verticalAlign: 'top' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25
                    }}>
                      <X size={13} strokeWidth={2.5} />
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.84rem', color: 'text.secondary' }}>
                      {row.generic}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{
                  fontSize: '0.84rem',
                  verticalAlign: 'top',
                  bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(208,0,0,0.015)' : 'rgba(208,0,0,0.03)',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      bgcolor: alpha(GREEN, 0.15),
                      color: GREEN,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25
                    }}>
                      <Check size={13} strokeWidth={3} />
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.84rem', fontWeight: 600, color: 'text.primary' }}>
                      {row.qualaris}
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
