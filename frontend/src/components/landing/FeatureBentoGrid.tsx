'use client';

import React, { useState } from 'react';
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
  Cpu,
} from 'lucide-react';

const RED = '#D00000';
const GREEN = '#1F8A70';
const AMBER = '#D9822B';
const BLUE = '#2D6CDF';
const PURPLE = '#8E44AD';

export default function FeatureBentoGrid() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [selectedCategory, setSelectedCategory] = useState<'functional' | 'negative' | 'boundary' | 'validation' | 'data'>('functional');

  const categoryExamples = {
    functional: { title: 'Authorized SWIFT MT103 Transfer', tag: 'Core Journey', badge: GREEN },
    negative: { title: 'Unauthorized Sanction BIC Rejection', tag: 'Attack Vector', badge: RED },
    boundary: { title: 'Exact $1,000,000.00 Limit Breaching', tag: 'Edge Threshold', badge: AMBER },
    validation: { title: 'ISO 13616 Modulus-97 IBAN Checksum', tag: 'Syntax Rule', badge: BLUE },
    data: { title: 'Multi-Currency Cross-Border Matrix', tag: 'State Space', badge: PURPLE },
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Section title */}
      <Box sx={{ textAlign: 'center', mb: 6, maxWidth: 780, mx: 'auto' }}>
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
            ENTERPRISE TEST ARCHITECTURE
          </Typography>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: '1.9rem', md: '2.45rem' }, letterSpacing: '-0.02em' }}>
          Six Pillars of Deterministic Quality
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          Generic LLM prompts produce inconsistent, untraceable test cases. Agent HUB Platform applies multi-agent segregation, mathematical quality scoring, and strict schema validation.
        </Typography>
      </Box>

      {/* Bento Grid */}
      <Grid container spacing={3}>
        {/* Card 1 (Large 7-col): INVEST Gatekeeper */}
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
              '&:hover': {
                borderColor: AMBER,
                transform: 'translateY(-2px)',
                boxShadow: isLight
                  ? `0 12px 30px ${alpha(AMBER, 0.1)}`
                  : `0 12px 30px ${alpha(AMBER, 0.2)}`,
              },
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
                  color: AMBER,
                }}>
                  <Scale size={24} />
                </Box>
                <Chip
                  label="PILLAR 1: PRE-FLIGHT GATE"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(AMBER, 0.12), color: AMBER, border: `1px solid ${alpha(AMBER, 0.3)}` }}
                />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.25, fontSize: { xs: '1.25rem', md: '1.4rem' } }}>
                INVEST Requirement Quality Gatekeeper
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7, fontSize: '0.88rem' }}>
                Before spending LLM tokens on test synthesis, the Requirement Analyst agent evaluates 8 rigorous INVEST dimensions. Ambiguous or defective specifications are stopped before the generation pipeline starts.
              </Typography>

              {/* 8 Criteria Grid with scores */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 1 }}>
                {[
                  { name: 'Independent', tag: 'No side dependencies', score: '3.9' },
                  { name: 'Negotiable', tag: 'Flexible bounds', score: '3.8' },
                  { name: 'Valuable', tag: 'Business ROI', score: '4.0' },
                  { name: 'Estimable', tag: 'Workload clear', score: '3.7' },
                  { name: 'Small', tag: 'Single sprint', score: '3.9' },
                  { name: 'Testable', tag: 'Explicit asserts', score: '4.0' },
                  { name: 'Criteria', tag: 'Pass/fail rules', score: '3.8' },
                  { name: 'Unambiguous', tag: 'Deterministic', score: '3.9' },
                ].map((c) => (
                  <Box
                    key={c.name}
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      bgcolor: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.primary' }}>
                        {c.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: AMBER, fontSize: '0.7rem' }}>
                        {c.score}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.67rem', mt: 0.25 }}>
                      {c.tag}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle2 size={16} color={GREEN} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>
                Includes Human Approval checkpoint: operators can accept, adjust, or reject with recorded audit reason.
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
              '&:hover': {
                borderColor: RED,
                transform: 'translateY(-2px)',
                boxShadow: isLight
                  ? `0 12px 30px ${alpha(RED, 0.1)}`
                  : `0 12px 30px ${alpha(RED, 0.2)}`,
              },
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
                  color: RED,
                }}>
                  <Layers size={24} />
                </Box>
                <Chip
                  label="PILLAR 2: FULL DEPTH"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(RED, 0.12), color: RED, border: `1px solid ${alpha(RED, 0.3)}` }}
                />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.25, fontSize: { xs: '1.25rem', md: '1.4rem' } }}>
                5-Dimensional Coverage Matrix
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7, fontSize: '0.88rem' }}>
                The Test Designer enforces mandatory coverage across all 5 architectural test categories—preventing shallow &quot;happy-path only&quot; test suites.
              </Typography>

              {/* Interactive Category Selector */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                {(['functional', 'negative', 'boundary', 'validation', 'data'] as const).map((cat) => (
                  <Chip
                    key={cat}
                    label={cat.toUpperCase()}
                    size="small"
                    onClick={() => setSelectedCategory(cat)}
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      bgcolor: selectedCategory === cat
                        ? (isLight ? '#FFE5E5' : alpha(RED, 0.25))
                        : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'),
                      color: selectedCategory === cat ? RED : 'text.secondary',
                      border: '1px solid',
                      borderColor: selectedCategory === cat ? RED : 'transparent',
                    }}
                  />
                ))}
              </Box>

              {/* Active Category Example Card */}
              <Box sx={{
                p: 1.75,
                borderRadius: 2,
                bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                border: '1px solid',
                borderColor: 'divider',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Chip
                    label={categoryExamples[selectedCategory].tag}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      bgcolor: alpha(categoryExamples[selectedCategory].badge, 0.15),
                      color: categoryExamples[selectedCategory].badge,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                    Guaranteed Coverage
                  </Typography>
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                  {categoryExamples[selectedCategory].title}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle2 size={16} color={GREEN} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>
                Guarantees zero blind-spots in high-volume enterprise financial workflows.
              </Typography>
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
              '&:hover': {
                borderColor: GREEN,
                transform: 'translateY(-2px)',
                boxShadow: isLight ? `0 12px 30px ${alpha(GREEN, 0.1)}` : `0 12px 30px ${alpha(GREEN, 0.2)}`,
              },
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
                  color: GREEN,
                }}>
                  <ShieldCheck size={24} />
                </Box>
                <Chip
                  label="PILLAR 3: GUARDRAILS"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(GREEN, 0.12), color: GREEN, border: `1px solid ${alpha(GREEN, 0.3)}` }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.25, fontSize: '1.15rem' }}>
                3-Layer Zero-Hallucination Shield
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65, fontSize: '0.85rem' }}>
                Every synthesized test case passes through syntactic, schema, and semantic verification filters.
              </Typography>

              <Stack spacing={1.25}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: isLight ? '#F5F7FA' : 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.primary' }}>
                    Layer 1 — Strict JSON Sanitization
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Strips markdown code fences, sanitizes unicode & repairs escape characters.
                  </Typography>
                </Box>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: isLight ? '#F5F7FA' : 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.primary' }}>
                    Layer 2 — Draft-07 JSON Schema
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Validates required fields, enum categories & regex patterns. Zero unknown keys.
                  </Typography>
                </Box>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: isLight ? '#F5F7FA' : 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.primary' }}>
                    Layer 3 — Semantic Business Rules
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Enforces ≥ 5 test cases, ≥ 3 categories, and &lt; 10% duplicate rate.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Card 4 (4-col): Automated RQS Scoring */}
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
              '&:hover': {
                borderColor: BLUE,
                transform: 'translateY(-2px)',
                boxShadow: isLight ? `0 12px 30px ${alpha(BLUE, 0.1)}` : `0 12px 30px ${alpha(BLUE, 0.2)}`,
              },
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
                  color: BLUE,
                }}>
                  <Cpu size={24} />
                </Box>
                <Chip
                  label="PILLAR 4: EVALUATION"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(BLUE, 0.12), color: BLUE, border: `1px solid ${alpha(BLUE, 0.3)}` }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.25, fontSize: '1.15rem' }}>
                Automated 5-Dimension RQS Scoring
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65, fontSize: '0.85rem' }}>
                The Test Evaluator objectively computes a weighted quality score (RQS) and uncovers subtle gap recommendations.
              </Typography>

              <Stack spacing={1.1}>
                {[
                  { name: 'Requirements Coverage', weight: '30%', score: 98 },
                  { name: 'Step Completeness', weight: '25%', score: 95 },
                  { name: 'Traceability Matrix', weight: '20%', score: 100 },
                  { name: 'Assertion Precision', weight: '15%', score: 92 },
                  { name: 'Test Uniqueness', weight: '10%', score: 96 },
                ].map((s) => (
                  <Box key={s.name}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem' }}>
                        {s.name} ({s.weight})
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: BLUE, fontSize: '0.72rem' }}>
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

        {/* Card 5 (4-col): In-Place Gap Closer & Sandboxing */}
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
              '&:hover': {
                borderColor: PURPLE,
                transform: 'translateY(-2px)',
                boxShadow: isLight ? `0 12px 30px ${alpha(PURPLE, 0.1)}` : `0 12px 30px ${alpha(PURPLE, 0.2)}`,
              },
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
                  color: PURPLE,
                }}>
                  <RotateCcw size={24} />
                </Box>
                <Chip
                  label="PILLARS 5 & 6: HEALING & TRUST"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.68rem', bgcolor: alpha(PURPLE, 0.12), color: PURPLE, border: `1px solid ${alpha(PURPLE, 0.3)}` }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.25, fontSize: '1.15rem' }}>
                In-Place Gap Closer & Sandboxing
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65, fontSize: '0.85rem' }}>
                Reprocessing patches specific gaps non-destructively while preserving all passing test cases in an isolated workspace.
              </Typography>

              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <CheckCircle2 size={16} color={PURPLE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    <strong>Non-Destructive Delta Reprocessing:</strong> Only the Gap Closer runs against gaps, preserving passing tests.
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <CheckCircle2 size={16} color={PURPLE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    <strong>Automated Snapshot & Rollback:</strong> The original suite is archived before mutation and auto-restored on failure.
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <Lock size={16} color={PURPLE} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    <strong>Air-Gapped Workspace Sandbox:</strong> Untrusted markdown has zero shell access and strictly isolated filesystem bounds.
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
