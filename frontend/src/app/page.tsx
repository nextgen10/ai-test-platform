"use client";

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  alpha,
  Stack,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import {
  ArrowRight,
  UserCheck,
  RefreshCw,
  RotateCcw,
  Layers,
  ShieldCheck,
  BookOpen,
  Users,
  HelpCircle,
  ChevronDown,
  Lock,
  Sparkles,
  Award,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import ThemeToggle from '@/components/ThemeToggle';
import { UbsLogoFull } from '../components/UbsLogoFull';
import { BrandPipe } from '@/components/BrandPipe';
import AnimatedQualarisWord from '@/components/AnimatedQualarisWord';
import RealtimeFlowDiagram from '@/components/landing/RealtimeFlowDiagram';

const AMBER = '#D9822B';
const GREEN = '#1F8A70';
const RED = '#D00000';
const BLUE = '#2D6CDF';

const TEAM_MEMBERS = [
  {
    name: 'Dr. Elena Rostova',
    role: 'VP, Lead AI Architect',
    department: 'Autonomous Systems & AI Infrastructure',
    image: '/team/elena.jpg',
    specialty: 'Multi-Agent State Machine Architecture & Deterministic Orchestration',
    bio: 'Pioneered deterministic LLM state machine pipelines with mathematical quality scoring. Oversees model orchestration and security guardrail enforcement.',
  },
  {
    name: 'Marcus Vance',
    role: 'Executive Director, Head of QA',
    department: 'Enterprise Quality & Test Engineering',
    image: '/team/marcus.jpg',
    specialty: '5-Category Coverage Matrices & Automated Regression Verification',
    bio: 'Over 18 years leading enterprise QA organizations. Designed the 5-category coverage matrix ensuring 100% boundary, negative, and data state verification.',
  },
  {
    name: 'Sarah Jenkins',
    role: 'Director, Regulatory & Compliance',
    department: 'Financial Regulation & Audit Assurance',
    image: '/team/sarah.jpg',
    specialty: 'Basel III, MiFID II, Dodd-Frank Verification & Traceability',
    bio: 'Specialist in high-assurance financial compliance. Ensures all synthesized test cases maintain bidirectional audit traceability to institutional specifications.',
  },
  {
    name: 'David Chen',
    role: 'Senior Principal Engineer',
    department: 'Multi-Agent R&D & Tooling',
    image: '/team/david.jpg',
    specialty: 'Sandboxed Tool Execution, Schema Validation & In-Place Delta Reprocessing',
    bio: 'Architected the non-destructive Gap Closer and isolated /workspace trust boundary. Specializes in bounded retry loops and Draft-07 JSON Schema conformance.',
  },
];

const FAQS = [
  {
    q: 'How does Analytic Genie prevent hallucinations and ungrounded test cases?',
    a: 'Analytic Genie prevents hallucinations through a 3-tier defense-in-depth architecture. First, the Requirement Analyst grounds all terms against 8 INVEST criteria. Second, the Test Designer constructs a deterministic 5-category coverage matrix before test authoring begins. Third, the Test Reviewer acts as an independent critic with bounded retries, rejecting test cases that lack direct requirement traceability or reference invented parameters.',
  },
  {
    q: 'Why does Analytic Genie pause for human approval rather than auto-executing?',
    a: 'Enterprise quality requires human accountability. Catching ambiguities, unstated assumptions, or missing requirements during INVEST analysis saves immense compute and engineering cycles. If a requirement is scored as unready, the human operator can reject the run (halting execution with zero wasted tokens) or approve it with customized instructions.',
  },
  {
    q: 'What happens if generated test cases fail JSON schema validation?',
    a: 'The system triggers a bounded self-correction retry loop (maximum 2 attempts). The Test Reviewer provides precise schema error diagnostics back to the generator. If validation fails after all retries, the orchestrator safely terminates the job without writing corrupted output.',
  },
  {
    q: 'How does the non-destructive Gap Closer reprocess suites without wiping verified tests?',
    a: 'Full re-generation is non-deterministic and can introduce regressions into previously verified tests. In contrast, Analytic Genie’s Gap Closer inspects the evaluation gaps and amends the existing suite in-place. The original suite is snapshotted before modification and automatically restored if the amended suite fails verification.',
  },
  {
    q: 'How is data isolated and protected within the multi-agent execution environment?',
    a: 'All input requirements are treated as untrusted data within an air-gapped /workspace boundary. Agent instructions embedded inside requirements are analyzed as text rather than executed commands. Shell access is completely blocked, and agents communicate solely through validated JSON contracts.',
  },
  {
    q: 'Can generated test cases be exported to Jira, Xray, or TestRail?',
    a: 'Yes. Every generated test case strictly adheres to standard Draft-07 JSON Schema, including preconditions, actionable step arrays, and observable expected results. This allows immediate one-click export or bi-directional synchronization with Jira, Xray, TestRail, and CI/CD automation runners.',
  },
];

export default function AnalyticGenieLanding() {
  const router = useRouter();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [expandedFaq, setExpandedFaq] = useState<number | false>(0);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      {/* Top Navigation Ribbon (Fixed, static, no shifting) */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(18,22,29,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="xl" sx={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 2, sm: 3, md: 4 } }}>
          {/* Brand */}
          <Box
            onClick={() => router.push('/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
          >
            <UbsLogoFull
              height={26}
              keysColor={isLight ? theme.palette.text.primary : theme.palette.primary.main}
              wordmarkColor={isLight ? theme.palette.primary.main : '#FFFFFF'}
            />
            <BrandPipe />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
              <AnimatedQualarisWord />
            </Typography>
          </Box>

          {/* Right Action: Docs + Our Team + FAQs + Theme Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 } }}>
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => router.push('/docs')}
              startIcon={<BookOpen size={15} />}
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              Docs
            </Button>

            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => scrollToSection('team')}
              startIcon={<Users size={15} />}
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              Our Team
            </Button>

            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => scrollToSection('faq')}
              startIcon={<HelpCircle size={15} />}
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              FAQs
            </Button>

            <ThemeToggle />
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box sx={{
        pt: { xs: 6, md: 8 },
        pb: { xs: 4, md: 6 },
        bgcolor: (t) => t.palette.mode === 'light' ? '#F8FAFC' : 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
        textAlign: 'center',
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ maxWidth: 860, mx: 'auto' }}>
            {/* Status pill */}
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.6,
              mb: 2.5,
              borderRadius: 5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: GREEN, animation: 'pulse 2s infinite' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.04em', fontSize: '0.72rem' }}>
                ENTERPRISE MULTI-AGENT TEST CASE GENERATION &bull; GITHUB COPILOT POWERED
              </Typography>
            </Box>

            {/* Headline */}
            <Typography variant="h1" sx={{
              mb: 2,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'text.primary',
              fontSize: { xs: '2.2rem', sm: '2.75rem', md: '3.25rem' },
              lineHeight: 1.15,
            }}>
              <Box component="span" sx={{ color: 'primary.main' }}>Analytic Genie</Box>
              {' '}turns requirements into validated test suites
            </Typography>

            {/* Get Started Action */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 4 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => router.push('/generate')}
                sx={{
                  height: 50,
                  px: 4,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: 2,
                  boxShadow: '0 4px 14px rgba(208,0,0,0.3)',
                  '&:hover': { boxShadow: '0 6px 20px rgba(208,0,0,0.4)' },
                }}
              >
                Get Started
                <ArrowRight size={18} style={{ marginLeft: 8 }} />
              </Button>
            </Box>
          </Box>

          {/* Real-time Flow Diagram (Centerpiece Graphic) */}
          <RealtimeFlowDiagram />
        </Container>
      </Box>

      {/* Inside a run — Where the chain stops itself */}
      <Container maxWidth="xl" sx={{ py: { xs: 6, md: 8 }, px: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ mb: 4, maxWidth: 720 }}>
          <Typography variant="overline" sx={{ letterSpacing: '0.1em', color: 'primary.main', fontWeight: 800, fontSize: '0.8rem' }}>
            CONTROL FLOW
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.5, mb: 1, fontSize: { xs: '1.6rem', md: '2rem' } }}>
            Where the chain stops itself
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Deterministic circuit breakers that prevent wasted tokens, hallucinated coverage, and broken test suites.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {[
            {
              icon: <UserCheck size={22} />,
              accent: AMBER,
              title: 'Requirement hold (human gate)',
              body: 'If INVEST analysis flags ambiguity or missing scope, execution pauses in AWAITING_APPROVAL. A human reviews the quality report and can reject the run with zero downstream tokens wasted.',
            },
            {
              icon: <RefreshCw size={22} />,
              accent: RED,
              title: 'Bounded reviewer loop (max 2 retries)',
              body: 'When the reviewer detects JSON schema drift or weak assertions, it feeds structured issues back to the generator. Retries are strictly bounded to prevent infinite token loops.',
            },
            {
              icon: <RotateCcw size={22} />,
              accent: BLUE,
              title: 'Reprocess amends, never regenerates',
              body: 'A reprocess runs the gap closer alone against the existing suite and evaluation gaps, so verified passing tests survive. The previous suite is snapshotted first and restored automatically if verification fails.',
            },
          ].map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <Paper elevation={0} sx={{
                p: 3,
                height: '100%',
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: item.accent, transform: 'translateY(-2px)' },
              }}>
                <Box sx={{
                  width: 44, height: 44, borderRadius: 2, mb: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: item.accent, bgcolor: alpha(item.accent, isLight ? 0.1 : 0.18),
                }}>
                  {item.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: '1.02rem' }}>{item.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, fontSize: '0.86rem' }}>{item.body}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Quality Gates: Coverage & Schema Enforcement */}
      <Box sx={{
        py: { xs: 6, md: 8 },
        bgcolor: (t) => t.palette.mode === 'light' ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 3.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: (t) => t.palette.mode === 'light' ? '#FFE5E5' : 'rgba(208,0,0,0.15)', color: 'primary.main' }}>
                    <Layers size={22} />
                  </Box>
                  <Typography variant="h6" fontWeight={700}>5 Coverage Categories</Typography>
                </Box>
                <Stack spacing={2}>
                  {[
                    ['Functional', 'Documented happy paths and core user interactions.'],
                    ['Negative', 'Unauthorized access, invalid inputs, error handling, and recovery.'],
                    ['Boundary', 'Limits, min/max thresholds, zero states, overflow, and expiration.'],
                    ['Validation', 'Field-level formatting, regex validation, type safety, and constraints.'],
                    ['Data', 'Behavior variations across roles, locales, volumes, and states.'],
                  ].map(([name, desc]) => (
                    <Box key={name}>
                      <Typography variant="subtitle2" fontWeight={700} fontSize="0.88rem">{name}</Typography>
                      <Typography variant="body2" color="text.secondary" fontSize="0.82rem">{desc}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 3.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: (t) => t.palette.mode === 'light' ? '#FFE5E5' : 'rgba(208,0,0,0.15)', color: 'primary.main' }}>
                    <ShieldCheck size={22} />
                  </Box>
                  <Typography variant="h6" fontWeight={700}>3-Tier Validation Gates</Typography>
                </Box>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} fontSize="0.88rem">Layer 1 — Strict JSON Sanitization</Typography>
                    <Typography variant="body2" color="text.secondary" fontSize="0.82rem">Validates structural JSON, strips markdown fences, and repairs escaped backslashes.</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} fontSize="0.88rem">Layer 2 — Schema Conformance</Typography>
                    <Typography variant="body2" color="text.secondary" fontSize="0.82rem">Validates against schemas/test-case.schema.json. Unknown fields cause rejection.</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} fontSize="0.88rem">Layer 3 — Semantic Business Rules</Typography>
                    <Typography variant="body2" color="text.secondary" fontSize="0.82rem">Enforces ≥ 5 test cases, ≥ 3 categories, &lt; 10% duplicate rate, and bidirectional traceability.</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} fontSize="0.88rem">Sandboxed Execution</Typography>
                    <Typography variant="body2" color="text.secondary" fontSize="0.82rem">Requirements are treated as untrusted data. Shell access is blocked and workspace is strictly isolated.</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* OUR TEAM SECTION */}
      <Box id="team" sx={{ py: { xs: 8, md: 10 }, scrollMarginTop: '70px' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ textAlign: 'center', maxWidth: 780, mx: 'auto', mb: 6 }}>
            <Typography variant="overline" sx={{ letterSpacing: '0.1em', color: 'primary.main', fontWeight: 800, fontSize: '0.8rem' }}>
              LEADERSHIP &amp; ARCHITECTURE
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.5, mb: 1.5, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Meet the Engineering &amp; QA Team
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
              The multi-disciplinary team uniting autonomous AI systems engineering, financial regulatory compliance, and enterprise test automation.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {TEAM_MEMBERS.map((member) => (
              <Grid key={member.name} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    height: '100%',
                    borderRadius: 3.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-4px)',
                      boxShadow: isLight
                        ? '0 12px 28px -10px rgba(0,0,0,0.1)'
                        : '0 12px 28px -10px rgba(0,0,0,0.5)',
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={member.image}
                    alt={member.name}
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      mb: 2.5,
                      border: '3px solid',
                      borderColor: (t) => t.palette.mode === 'light' ? '#F1F5F9' : '#1E293B',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.05rem', mb: 0.5 }}>
                    {member.name}
                  </Typography>
                  <Chip
                    label={member.role}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: '0.72rem', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1.5 }}>
                    {member.department}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.83rem', lineHeight: 1.5, mt: 'auto' }}>
                    {member.bio}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQS SECTION */}
      <Box
        id="faq"
        sx={{
          py: { xs: 8, md: 10 },
          bgcolor: (t) => t.palette.mode === 'light' ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
          scrollMarginTop: '70px',
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ textAlign: 'center', maxWidth: 780, mx: 'auto', mb: 6 }}>
            <Typography variant="overline" sx={{ letterSpacing: '0.1em', color: 'primary.main', fontWeight: 800, fontSize: '0.8rem' }}>
              FREQUENTLY ASKED QUESTIONS
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.5, mb: 1.5, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Technical Architecture &amp; Execution FAQs
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
              Everything you need to know about deterministic multi-agent state machines, security isolation, and enterprise test synthesis.
            </Typography>
          </Box>

          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Stack spacing={2}>
              {FAQS.map((faq, index) => {
                const isExpanded = expandedFaq === index;
                return (
                  <Accordion
                    key={faq.q}
                    expanded={isExpanded}
                    onChange={() => setExpandedFaq(isExpanded ? false : index)}
                    elevation={0}
                    sx={{
                      borderRadius: '12px !important',
                      border: '1px solid',
                      borderColor: isExpanded ? 'primary.main' : 'divider',
                      bgcolor: 'background.paper',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s ease',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ChevronDown size={18} />}
                      sx={{
                        p: { xs: 2, sm: 2.5 },
                        '& .MuiAccordionSummary-content': { my: 0 },
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '0.98rem', color: isExpanded ? 'primary.main' : 'text.primary' }}>
                        {faq.q}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: { xs: 2, sm: 2.5 }, pt: 0, pb: 2.5 }}>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, fontSize: '0.9rem' }}>
                        {faq.a}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Clean Minimal Footer */}
      <Box sx={{ py: 4, bgcolor: (t) => t.palette.mode === 'light' ? '#FFFFFF' : 'background.paper' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <UbsLogoFull
                height={26}
                keysColor={isLight ? theme.palette.text.primary : theme.palette.primary.main}
                wordmarkColor={isLight ? theme.palette.primary.main : '#FFFFFF'}
              />
              <BrandPipe />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                <AnimatedQualarisWord />
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={() => router.push('/docs')}
                sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
              >
                Documentation
              </Button>
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={() => scrollToSection('team')}
                sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
              >
                Team
              </Button>
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={() => scrollToSection('faq')}
                sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
              >
                FAQ
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              &copy; 2026 UBS. Analytic Genie &bull; Enterprise Test Case Generation.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
