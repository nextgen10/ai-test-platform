"use client";

import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  useTheme,
  Chip,
  Card,
  alpha,
} from '@mui/material';
import {
  ArrowRight,
  BookOpen,
  Users,
  HelpCircle,
  FlaskConical,
  FileSearch,
  Layers,
  Terminal,
  Sparkles,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import ThemeToggle from '@/components/ThemeToggle';
import { UnifiedNavBar, UnifiedBrand } from '@/components/UnifiedNavBar';
import RealtimeFlowDiagram from '@/components/landing/RealtimeFlowDiagram';
import ComparisonSection from '@/components/landing/ComparisonSection';
import FeatureBentoGrid from '@/components/landing/FeatureBentoGrid';
import PipelineExplorer from '@/components/landing/PipelineExplorer';
import DomainSkillsSection from '@/components/landing/DomainSkillsSection';
import InteractiveSimulator from '@/components/landing/InteractiveSimulator';
import TechnicalFAQ from '@/components/landing/TechnicalFAQ';
import { mapWorkflowsToUseCases, type UseCaseItem } from '@/config/nav';
import { hubApi } from '@/lib/hub-api';
import { colors } from '@/theme';

const RED = colors.primary.main;
const GREEN = colors.success;

const TEAM_MEMBERS = [
  {
    name: 'Surendran Madhavan',
    role: 'Executive Sponsor / Program Dir.',
    department: 'Executive Leadership & Strategy',
    image: 'https://ui-avatars.com/api/?name=Surendran+Madhavan&background=0D8ABC&color=fff&size=256',
    specialty: 'Strategic Vision & Business Alignment',
    bio: 'Provides the strategic vision, executive oversight, and secures the budget for the initiative to ensure alignment with broader organizational goals at Cognizant.',
  },
  {
    name: 'Inderpalsingh Gill',
    role: 'Principal Engineering Manager',
    department: 'Technical Leadership & Delivery',
    image: 'https://ui-avatars.com/api/?name=Inderpalsingh+Gill&background=1F8A70&color=fff&size=256',
    specialty: 'Delivery Lifecycle & Enterprise Compliance',
    bio: 'Oversees the delivery lifecycle, removes blockers, and ensures the platform meets enterprise compliance and delivery standards.',
  },
  {
    name: 'Karthik Kolli',
    role: 'Lead AI Product Owner',
    department: 'Product & Quality Strategy',
    image: 'https://ui-avatars.com/api/?name=Karthik+Kolli&background=F59E0B&color=fff&size=256',
    specialty: 'Testing Standards & Agentic Workflows',
    bio: 'Drives the functional requirements, sets testing standards, and prioritizes the roadmap for new Agentic workflows to ensure generated tests meet QA benchmarks.',
  },
  {
    name: 'Aniket Kalyan Marwadi',
    role: 'Lead AI Architect & Principal Creator',
    department: 'Core Architecture & System Design',
    image: 'https://ui-avatars.com/api/?name=Aniket+Marwadi&background=D00000&color=fff&size=256',
    specialty: 'Multi-Agent Orchestration & Frontend Systems',
    bio: 'The mastermind, architect, and sole developer of the entire solution. Responsible for the end-to-end technical execution and design of the platform.',
  },
];

export default function AgentHubLanding() {
  const router = useRouter();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // The nav's use-case menu mirrors the registry rather than a hardcoded list.
  const [useCases, setUseCases] = useState<UseCaseItem[]>([]);
  useEffect(() => {
    hubApi
      .listWorkflows()
      .then((workflows) => setUseCases(mapWorkflowsToUseCases(workflows)))
      .catch(() => setUseCases([]));
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'use-cases', label: 'Use Cases', icon: <Layers size={15} />, onClick: () => scrollToSection('use-cases') },
    { id: 'simulator', label: 'Playground', icon: <Sparkles size={15} />, onClick: () => scrollToSection('simulator') },
    { id: 'pipeline', label: 'Architecture', icon: <GitBranch size={15} />, onClick: () => scrollToSection('pipeline') },
    { id: 'team', label: 'Our Team', icon: <Users size={15} />, onClick: () => scrollToSection('team') },
    { id: 'docs', label: 'Docs', icon: <BookOpen size={15} />, onClick: () => router.push('/docs') },
    { id: 'faq', label: 'FAQs', icon: <HelpCircle size={15} />, onClick: () => scrollToSection('faq') },
  ];

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
      overflowX: 'hidden',
    }}>
      {/* Top Navigation Ribbon with Use Cases Menu */}
      <UnifiedNavBar
        items={navLinks}
        useCases={useCases}
        alignLinks="right"
        onLogoClick={() => router.push('/')}
        actions={<ThemeToggle />}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  HERO SECTION — Agent HUB Platform Overview                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        pt: { xs: 7, md: 10 },
        pb: { xs: 6, md: 9 },
        position: 'relative',
        bgcolor: isLight ? colors.background.secondary : 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
        textAlign: 'center',
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 }, position: 'relative', zIndex: 1 }}>
          <Box sx={{ maxWidth: 960, mx: 'auto' }}>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.25,
              px: 2,
              py: 0.65,
              mb: 3,
              borderRadius: '2px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}>
              <Box sx={{
                width: 6, height: 18, bgcolor: 'primary.main', flexShrink: 0,
              }} />
              <Typography variant="caption" sx={{
                fontWeight: 500, color: 'text.secondary',
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
              }}>
                Enterprise multi-agent platform
              </Typography>
            </Box>

            <Typography variant="h1" sx={{
              mb: 2.5,
              fontWeight: 300,
              letterSpacing: 0,
              color: 'text.primary',
              fontSize: { xs: '2rem', sm: '2.5rem', md: '2.75rem' },
              lineHeight: 1.2,
            }}>
              <Box component="span" sx={{ color: 'text.primary' }}>
                Agent HUB
              </Box>
              {' '}Platform
            </Typography>

            <Typography variant="body1" sx={{
              color: 'text.secondary',
              fontSize: { xs: '1rem', sm: '1.125rem' },
              fontWeight: 300,
              lineHeight: 1.5,
              maxWidth: 820,
              mx: 'auto',
              mb: 4.5,
            }}>
              The unified enterprise control plane for onboarding, orchestrating, and running autonomous multi-agent workflows. Trigger agents and skills through a universal <strong>Agent Console</strong>, or launch specialized <strong>Custom UIs</strong> for mission-critical use cases like Test Design & Evaluation.
            </Typography>

            <Box sx={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
              gap: 2, mb: 5,
            }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => router.push('/chat')}
                startIcon={<Terminal size={18} />}
              >
                Open Agent Console
                <ArrowRight size={16} style={{ marginLeft: 6 }} />
              </Button>

              <Button
                variant="outlined"
                color="inherit"
                size="large"
                onClick={() => router.push('/generate')}
                startIcon={<FlaskConical size={18} color={RED} />}
                sx={{
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'text.primary',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                Test Design & Evaluation UI
              </Button>

              <Button
                variant="text"
                color="inherit"
                size="large"
                onClick={() => scrollToSection('use-cases')}
                startIcon={<Layers size={18} />}
                sx={{
                  height: 52, px: 2.5, fontSize: '0.92rem', fontWeight: 500,
                  borderRadius: 2.5, color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                Explore Use Cases
              </Button>
            </Box>

            {/* Architecture Metrics Strip */}
            <Grid container spacing={2} sx={{ maxWidth: 900, mx: 'auto', mb: 3 }}>
              {[
                { title: 'Agent Console', subtitle: 'Universal Interface', tag: 'Streaming SSE' },
                { title: 'Custom UI Option', subtitle: 'Test Design & Eval', tag: 'INVEST & 5-D Gate' },
                { title: 'Agent Registry', subtitle: 'Declarative Files', tag: 'Zero-DB Migrations' },
                { title: 'Model Freedom', subtitle: 'Claude · GPT · o1', tag: 'Model-Agnostic' },
              ].map((metric) => (
                <Grid key={metric.subtitle} size={{ xs: 6, sm: 3 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.75, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
                      bgcolor: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(8px)', textAlign: 'center',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 500, color: 'text.primary', fontSize: '1.05rem', lineHeight: 1.1 }}>
                      {metric.title}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', mt: 0.25, fontSize: '0.74rem' }}>
                      {metric.subtitle}
                    </Typography>
                    <Chip
                      label={metric.tag}
                      size="small"
                      sx={{
                        mt: 0.75, height: 16, fontSize: '0.62rem', fontWeight: 500,
                        bgcolor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                        color: 'text.secondary',
                      }}
                    />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Centerpiece Interactive Flow Graphic */}
          <RealtimeFlowDiagram />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  FEATURED USE CASES & CONTROL PLANES SECTION                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box id="use-cases" sx={{
        py: { xs: 8, md: 11 },
        bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        scrollMarginTop: '70px',
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ textAlign: 'center', maxWidth: 840, mx: 'auto', mb: 6 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              px: 1.75, py: 0.5, mb: 1.5, borderRadius: 3,
              bgcolor: isLight ? 'rgba(230,0,0,0.06)' : 'rgba(230,0,0,0.12)',
              color: 'primary.main',
            }}>
              <Layers size={14} />
              <Typography variant="caption" sx={{ fontWeight: 500, letterSpacing: '0.04em' }}>
                ENTERPRISE USE CASES & CONTROL PLANES
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 500, mb: 1.5, fontSize: { xs: '1.9rem', md: '2.5rem' }, letterSpacing: '-0.02em' }}>
              One Platform. Flexible Interaction Modes.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
              Onboard any multi-agent workflow. Trigger flows directly through the interactive Agent Console, or launch dedicated Custom UIs built specifically for complex use cases.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Card 1: Test Design & Evaluation (Flagship Custom UI) */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  borderRadius: 3.5, bgcolor: 'background.paper', p: { xs: 2.5, sm: 3.5 },
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 0.25s ease',
                  border: '2px solid', borderColor: isLight ? 'rgba(230,0,0,0.2)' : 'rgba(230,0,0,0.3)',
                  boxShadow: isLight ? '0 12px 32px -10px rgba(230,0,0,0.1)' : '0 12px 32px -10px rgba(230,0,0,0.25)',
                  '&:hover': {
                    borderColor: 'primary.main', transform: 'translateY(-4px)',
                    boxShadow: isLight ? '0 20px 40px -12px rgba(230,0,0,0.2)' : '0 20px 40px -12px rgba(230,0,0,0.4)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      p: 1.25, borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main',
                    }}>
                      <FlaskConical size={24} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 500, fontSize: '1.25rem' }}>
                        Test Design & Evaluation
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Dedicated Custom UI Use Case
                      </Typography>
                    </Box>
                  </Box>
                  <Chip label="Custom UI" size="small" color="primary" sx={{ fontWeight: 500, fontSize: '0.72rem', height: 24 }} />
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.92rem', lineHeight: 1.6, mb: 2.5, flex: 1 }}>
                  Transform unstructured business requirements into fully verified, requirement-traced test suites. Features an 8-dimension INVEST quality gate, human approval checkpoint, 5-D test suite evaluation (85% standard), in-place delta healing, and one-click Excel (.csv) export.
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Multi-Agent Pipeline:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {['Requirement Analyst', 'Test Designer', 'Test Generator', 'Test Reviewer', 'Test Evaluator'].map((ag, idx) => (
                      <Chip key={idx} label={`${idx + 1}. ${ag}`} size="small" variant="outlined" sx={{ fontSize: '0.72rem', fontWeight: 500, height: 22 }} />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="contained" color="primary"
                    startIcon={<ExternalLink size={16} />}
                    onClick={() => router.push('/generate')}
                    sx={{ borderRadius: 2, fontWeight: 500, textTransform: 'none', px: 2.5, py: 1 }}
                  >
                    Launch Custom UI
                  </Button>
                  <Button
                    variant="outlined" color="inherit"
                    startIcon={<Terminal size={14} />}
                    onClick={() => router.push('/chat?workflow=test-case-generation')}
                    sx={{ borderRadius: 2, fontWeight: 500, textTransform: 'none', px: 2 }}
                  >
                    Run via Agent Console
                  </Button>
                </Box>
              </Card>
            </Grid>

            {/* Card 2: Universal Agent Console */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  borderRadius: 3.5, bgcolor: 'background.paper', p: { xs: 2.5, sm: 3.5 },
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 0.25s ease',
                  border: '1px solid', borderColor: 'divider',
                  boxShadow: isLight ? '0 10px 28px -10px rgba(0,0,0,0.06)' : '0 10px 28px -10px rgba(0,0,0,0.4)',
                  '&:hover': {
                    borderColor: '#3b82f6', transform: 'translateY(-4px)',
                    boxShadow: '0 20px 40px -12px rgba(59, 130, 246, 0.2)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      p: 1.25, borderRadius: 2,
                      bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                    }}>
                      <Terminal size={24} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 500, fontSize: '1.25rem' }}>
                        Universal Agent Console
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Interactive Execution Plane
                      </Typography>
                    </Box>
                  </Box>
                  <Chip label="Core Platform" size="small" sx={{ fontWeight: 500, fontSize: '0.72rem', height: 24, bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }} />
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.92rem', lineHeight: 1.6, mb: 2.5, flex: 1 }}>
                  An interactive conversational interface. Choose any onboarded agent, workflow, domain skill, prompt template, and model (Claude 3.5 Sonnet, GPT-4o, o1, etc.) on the fly. Streams responses in real time with session persistence and rich code blocks.
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Capabilities:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {['Agent Switcher', 'Model Choice', 'SSE Stream', 'Prompt Hydration', 'Session History'].map((cap, idx) => (
                      <Chip key={idx} label={cap} size="small" variant="outlined" sx={{ fontSize: '0.72rem', fontWeight: 500, height: 22 }} />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="contained"
                    sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' }, borderRadius: 2, fontWeight: 500, textTransform: 'none', px: 2.5, py: 1 }}
                    startIcon={<Terminal size={16} />}
                    onClick={() => router.push('/chat')}
                  >
                    Open Agent Console
                  </Button>
                  <Button
                    variant="outlined" color="inherit"
                    onClick={() => router.push('/registry')}
                    sx={{ borderRadius: 2, fontWeight: 500, textTransform: 'none', px: 2 }}
                  >
                    Browse Registry
                  </Button>
                </Box>
              </Card>
            </Grid>

            {/* Card 3: Workflow Builder (Meta Custom UI) */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  borderRadius: 3.5, bgcolor: 'background.paper', p: { xs: 2.5, sm: 3 },
                  border: '1px solid', borderColor: 'divider', transition: 'all 0.25s ease',
                  '&:hover': {
                    borderColor: '#8b5cf6', transform: 'translateY(-3px)',
                    boxShadow: '0 16px 36px -10px rgba(139, 92, 246, 0.2)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                    <Layers size={22} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
                        Workflow Builder
                      </Typography>
                      <Chip
                        label="Custom UI"
                        size="small"
                        sx={{ height: 19, fontSize: '0.65rem', fontWeight: 500, bgcolor: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Agents That Build Agents
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.86rem', lineHeight: 1.55, mb: 2, flex: 1 }}>
                  Describe a multi-agent workflow in plain English. Four agents design the
                  architecture, critique it, write the agent prompts and review the generated code &mdash;
                  then you install the result into the Registry from the page. The new workflow is
                  live in the Agent Console immediately, with nothing redeployed.
                </Typography>

                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                  {['architect', 'review architecture', 'write agents', 'review code'].map((stage, i) => (
                    <Chip
                      key={stage}
                      label={`${i + 1}. ${stage}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.68rem', height: 21, fontWeight: 500 }}
                    />
                  ))}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    size="small" variant="outlined" color="inherit"
                    startIcon={<Sparkles size={13} />}
                    onClick={() => router.push('/use-cases/workflow-builder')}
                    sx={{ borderRadius: 1.5, fontWeight: 500, textTransform: 'none', fontSize: '0.8rem' }}
                  >
                    Build a Workflow
                  </Button>
                </Box>
              </Card>
            </Grid>

            {/* Card 4: Document OCR & Vision Extraction */}
            <Grid size={{ xs: 12, sm: 6, md: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  borderRadius: 3.5, bgcolor: 'background.paper', p: { xs: 2.5, sm: 3 },
                  border: '1px solid', borderColor: 'divider', transition: 'all 0.25s ease',
                  '&:hover': {
                    borderColor: '#10b981', transform: 'translateY(-3px)',
                    boxShadow: '0 16px 36px -10px rgba(16, 185, 129, 0.2)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <FileSearch size={22} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
                      Document OCR & Vision
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Visual Requirements Analysis
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.86rem', lineHeight: 1.55, mb: 2, flex: 1 }}>
                  Visually extract and normalize structured business requirements from document images, UI mockups, flowchart branches, and scanned specs using multimodal vision agents.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    size="small" variant="outlined" color="inherit"
                    startIcon={<Terminal size={13} />}
                    onClick={() => router.push('/generate')}
                    sx={{ borderRadius: 1.5, fontWeight: 500, textTransform: 'none', fontSize: '0.8rem' }}
                  >
                    Open OCR workspace
                  </Button>
                </Box>
              </Card>
            </Grid>

            {/* Card 5: Agent & Workflow Registry */}
            <Grid size={{ xs: 12, sm: 6, md: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  borderRadius: 3.5, bgcolor: 'background.paper', p: { xs: 2.5, sm: 3 },
                  border: '1px solid', borderColor: 'divider', transition: 'all 0.25s ease',
                  '&:hover': {
                    borderColor: '#f59e0b', transform: 'translateY(-3px)',
                    boxShadow: '0 16px 36px -10px rgba(245, 158, 11, 0.2)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <Layers size={22} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
                      Agent Hub Registry & Onboarding
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Declarative File-Based Catalog
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.86rem', lineHeight: 1.55, mb: 2, flex: 1 }}>
                  Onboard new custom `.agent.md` profiles, `.workflow.yaml` multi-agent chains, `SKILL.md` bundles, and `.prompt.md` templates with zero database migrations or backend redeployments.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    size="small" variant="outlined" color="inherit"
                    startIcon={<Layers size={13} />}
                    onClick={() => router.push('/registry')}
                    sx={{ borderRadius: 1.5, fontWeight: 500, textTransform: 'none', fontSize: '0.8rem' }}
                  >
                    Open Registry
                  </Button>
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  WHY NOT JUST PROMPT AN LLM DIRECTLY (Comparison Section)        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 11 } }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <ComparisonSection />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  SIX PILLARS OF DETERMINISTIC QUALITY (Feature Bento Grid)       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 8, md: 11 },
        bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <FeatureBentoGrid />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  INTERACTIVE PIPELINE EXPLORER                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box id="pipeline" sx={{ py: { xs: 8, md: 11 }, scrollMarginTop: '70px' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <PipelineExplorer />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  DOMAIN SKILLS REPOSITORY                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 8, md: 11 },
        bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <DomainSkillsSection />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  LIVE INTERACTIVE PLAYGROUND (Simulator)                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box id="simulator" sx={{ py: { xs: 8, md: 11 }, scrollMarginTop: '70px' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <InteractiveSimulator />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  OUR ENGINEERING & ARCHITECTURE TEAM                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box id="team" sx={{
        py: { xs: 8, md: 11 },
        bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
        scrollMarginTop: '70px',
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ textAlign: 'center', maxWidth: 780, mx: 'auto', mb: 6 }}>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.75,
              py: 0.5,
              mb: 1.5,
              borderRadius: 3,
              bgcolor: isLight ? 'rgba(230,0,0,0.06)' : 'rgba(230,0,0,0.12)',
              color: 'primary.main',
            }}>
              <Users size={14} />
              <Typography variant="caption" sx={{ fontWeight: 500, letterSpacing: '0.04em' }}>
                ARCHITECTURE & ENGINEERING
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 500, mb: 1.5, fontSize: { xs: '1.9rem', md: '2.45rem' }, letterSpacing: '-0.02em' }}>
              Meet the Engineering & Architecture Team
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
              The multi-disciplinary team uniting autonomous AI systems engineering, financial regulatory compliance, and enterprise test automation.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {TEAM_MEMBERS.map((member) => (
              <Grid key={member.name} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
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
                    boxShadow: isLight
                      ? '0 10px 28px -10px rgba(0,0,0,0.06)'
                      : '0 10px 28px -10px rgba(0,0,0,0.5)',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-5px)',
                      boxShadow: isLight
                        ? '0 16px 36px -10px rgba(230,0,0,0.15)'
                        : '0 16px 36px -10px rgba(230,0,0,0.3)',
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={member.image}
                    alt={member.name}
                    sx={{
                      width: 110,
                      height: 110,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      mb: 2.5,
                      border: '3px solid',
                      borderColor: isLight ? '#F1F5F9' : '#1E293B',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                    }}
                  />
                  <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.08rem', mb: 0.5 }}>
                    {member.name}
                  </Typography>
                  <Chip
                    label={member.role}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 500, fontSize: '0.72rem', mb: 1.25 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block', mb: 1.75, fontSize: '0.76rem' }}>
                    {member.department}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem', lineHeight: 1.55, mt: 'auto' }}>
                    {member.bio}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TECHNICAL FAQ SECTION                                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box id="faq" sx={{ py: { xs: 8, md: 11 }, scrollMarginTop: '70px' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <TechnicalFAQ />
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  STICKY BOTTOM CALL TO ACTION STRIP                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: 6,
        bgcolor: isLight ? '#12161D' : '#0B0D11',
        color: '#FFFFFF',
        borderTop: '1px solid',
        borderColor: isLight ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
        textAlign: 'center',
      }}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={{ fontWeight: 500, mb: 1.5, letterSpacing: '-0.02em' }}>
            Ready to Orchestrate Multi-Agent Workflows?
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3.5, fontSize: '1.05rem' }}>
            Launch the universal Agent Console or run specialized workflows on the Agent HUB Platform.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={() => router.push('/chat')}
              startIcon={<Terminal size={18} />}
              sx={{
                height: 48,
                px: 3.5,
                fontWeight: 500,
                borderRadius: 2,
                boxShadow: '0 4px 16px rgba(230,0,0,0.4)',
              }}
            >
              Open Agent Console
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              onClick={() => router.push('/generate')}
              startIcon={<FlaskConical size={18} />}
              sx={{
                height: 48,
                px: 3.5,
                fontWeight: 500,
                borderRadius: 2,
                borderColor: 'rgba(255,255,255,0.3)',
                '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              Test Design & Evaluation UI
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  FOOTER                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: 4,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <UnifiedBrand />
            <Typography variant="caption" color="text.secondary">
              &copy; 2026 Agent HUB Platform. Enterprise Multi-Agent Orchestration.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
