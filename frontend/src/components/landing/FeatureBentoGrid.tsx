'use client';

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  alpha,
  useTheme,
  Chip,
  Stack,
} from '@mui/material';
import {
  ShieldCheck,
  Layers,
  Scale,
  Sparkles,
  RotateCcw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Code2,
  FileSpreadsheet,
  Cpu,
  Fingerprint,
} from 'lucide-react';

const RED = '#D00000';
const GREEN = '#1F8A70';
const AMBER = '#D9822B';
const BLUE = '#2D6CDF';
const PURPLE = '#8E44AD';

export default function FeatureBentoGrid() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box sx={{ width: '100%' }}>
      {/* Section title */}
      <Box sx={{ textAlign: 'center', mb: 6, maxWidth: 760, mx: 'auto' }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em' }}>
          ENTERPRISE TEST ARCHITECTURE
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.5, mb: 1.5, fontSize: { xs: '1.85rem', md: '2.35rem' } }}>
          Six Pillars of Deterministic Quality
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          Generic LLM prompts produce inconsistent, untraceable test cases. Qualaris applies multi-agent segregation, mathematical quality scoring, and strict schema validation.
        </Typography>
      </Box>

      {/* Bento Grid */}
      <Grid container spacing={3}>
        {/* Card 1 (Large 8-col): INVEST Gatekeeper */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s ease',
              '&:hover': { borderColor: AMBER, transform: 'translateY(-2px)' }
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(AMBER, isLight ? 0.12 : 0.2),
                  color: AMBER
                }}>
                  <Scale size={24} />
                </Box>
                <Chip
                  label="PILLAR 1: PRE-FLIGHT GATE"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(AMBER, 0.12), color: AMBER }}
                />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
                INVEST Requirement Quality Gatekeeper
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
                Before spending LLM tokens on test synthesis, the Requirement Analyst agent evaluates 8 rigorous INVEST dimensions. Low-quality or ambiguous specifications are stopped before the generation pipeline starts.
              </Typography>

              {/* 8 Criteria Pill Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 1 }}>
                {[
                  { name: 'Independent', tag: 'No side dependencies' },
                  { name: 'Negotiable', tag: 'Flexible boundaries' },
                  { name: 'Valuable', tag: 'Delivers user outcome' },
                  { name: 'Estimable', tag: 'Sizable workload' },
                  { name: 'Small', tag: 'Single sprint scope' },
                  { name: 'Testable', tag: 'Unambiguous assertions' },
                  { name: 'Acceptance Criteria', tag: 'Explicit pass/fail' },
                  { name: 'Unambiguous', tag: 'Deterministic specs' },
                ].map((c) => (
                  <Box
                    key={c.name}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      bgcolor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.primary' }}>
                      {c.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
                      {c.tag}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle2 size={16} color={GREEN} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Includes Human Approval checkpoint: operators can accept, adjust, or reject with reason audit.
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Card 2 (5-col): 5-Category Matrix */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.25s ease',
              '&:hover': { borderColor: RED, transform: 'translateY(-2px)' }
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(RED, isLight ? 0.12 : 0.2),
                  color: RED
                }}>
                  <Layers size={24} />
                </Box>
                <Chip
                  label="PILLAR 2: FULL DEPTH"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(RED, 0.12), color: RED }}
                />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
                5-Dimensional Coverage Matrix
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
                The Test Designer enforces mandatory coverage across all 5 architectural test categories—preventing shallow "happy-path only" test suites.
              </Typography>

              <Stack spacing={1.25}>
                {[
                  { name: 'Functional', desc: 'Core happy paths, business rules & user journeys', color: GREEN },
                  { name: 'Negative', desc: 'Unauthorized access, malicious inputs & rate-limits', color: RED },
                  { name: 'Boundary', desc: 'Max/min limits, integer overflow & expiration timestamps', color: AMBER },
                  { name: 'Validation', desc: 'Regex schemas, checksum digits & field constraints', color: BLUE },
                  { name: 'Data', desc: 'State matrix, multi-currency & localized variations', color: PURPLE },
                ].map((item) => (
                  <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.82rem', minWidth: 80 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem' }}>
                      {item.desc}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Card 3 (4-col): 3-Layer Guardrails */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 3.5 },
              borderRadius: 3.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.25s ease',
              '&:hover': { borderColor: GREEN, transform: 'translateY(-2px)' }
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(GREEN, isLight ? 0.12 : 0.2),
                  color: GREEN
                }}>
                  <ShieldCheck size={24} />
                </Box>
                <Chip
                  label="PILLAR 3: GUARDRAILS"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(GREEN, 0.12), color: GREEN }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25 }}>
                3-Layer Zero-Hallucination Shield
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65 }}>
                Every synthesized test case passes through strict syntactic, schema, and semantic verification filters.
              </Typography>

              <Stack spacing={1.5}>
                <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: isLight ? '#F5F7FA' : 'rgba(255,255,255,0.03)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                    Layer 1 — Strict JSON Sanitization
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Strips markdown code fences, sanitizes unicode & repairs escape characters.
                  </Typography>
                </Box>
                <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: isLight ? '#F5F7FA' : 'rgba(255,255,255,0.03)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                    Layer 2 — Draft-07 JSON Schema
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Validates required fields, enum categories & regex patterns. No unknown keys.
                  </Typography>
                </Box>
                <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: isLight ? '#F5F7FA' : 'rgba(255,255,255,0.03)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                    Layer 3 — Semantic Business Rules
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enforces ≥ 5 test cases, ≥ 3 categories, and &lt; 10% duplicate rate.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Card 4 (4-col): Automated DeepEval RQS */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 3.5 },
              borderRadius: 3.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.25s ease',
              '&:hover': { borderColor: BLUE, transform: 'translateY(-2px)' }
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(BLUE, isLight ? 0.12 : 0.2),
                  color: BLUE
                }}>
                  <Cpu size={24} />
                </Box>
                <Chip
                  label="PILLAR 4: EVALUATION"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(BLUE, 0.12), color: BLUE }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25 }}>
                Automated 5-Dimension RQS Scoring
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65 }}>
                The Test Evaluator objectively computes a weighted quality score (RQS) and uncovers subtle gap recommendations.
              </Typography>

              <Stack spacing={1.25}>
                {[
                  { name: 'Requirements Coverage', weight: '30%', score: 98 },
                  { name: 'Step Completeness', weight: '25%', score: 95 },
                  { name: 'Traceability Matrix', weight: '20%', score: 100 },
                  { name: 'Assertion Precision', weight: '15%', score: 92 },
                  { name: 'Test Uniqueness', weight: '10%', score: 96 },
                ].map((s) => (
                  <Box key={s.name}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.74rem' }}>
                        {s.name} ({s.weight})
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: BLUE, fontSize: '0.74rem' }}>
                        {s.score}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.08), overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${s.score}%`, bgcolor: BLUE, borderRadius: 2 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Card 5 (4-col): In-place Gap Closer & Sandboxing */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 3.5 },
              borderRadius: 3.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.25s ease',
              '&:hover': { borderColor: PURPLE, transform: 'translateY(-2px)' }
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(PURPLE, isLight ? 0.12 : 0.2),
                  color: PURPLE
                }}>
                  <RotateCcw size={24} />
                </Box>
                <Chip
                  label="PILLAR 5 & 6: HEALING & ISOLATION"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(PURPLE, 0.12), color: PURPLE }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25 }}>
                In-Place Gap Closer & Sandboxing
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65 }}>
                Reprocessing patches specific gaps non-destructively while preserving all passing test cases.
              </Typography>

              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <CheckCircle2 size={16} color={PURPLE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    <strong>Non-Destructive Delta Reprocessing:</strong> Only the Gap Closer runs against existing evaluation gaps.
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <CheckCircle2 size={16} color={PURPLE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    <strong>Automated Snapshot & Rollback:</strong> The original suite is archived before mutation and auto-restored if tests fail.
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <Lock size={16} color={PURPLE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    <strong>Air-Gapped Workspace Sandbox:</strong> Untrusted requirement markdown has zero shell access and strictly isolated filesystem bounds.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
