"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Button,
  useTheme,
} from '@mui/material';
import {
  ArrowRight,
  Layers,
  Terminal,
  BookOpen,
  Users,
  HelpCircle,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import ThemeToggle from '@/components/ThemeToggle';
import { UnifiedNavBar, UnifiedBrand } from '@/components/UnifiedNavBar';
import ProductName from '@/components/ProductName';
import HubPlatformFlow from '@/components/landing/HubPlatformFlow';
import ConsolePreview from '@/components/landing/ConsolePreview';
import PipelineStrip from '@/components/landing/PipelineStrip';
import RealtimeFlowDiagram from '@/components/landing/RealtimeFlowDiagram';
import ComparisonSection from '@/components/landing/ComparisonSection';
import FeatureBentoGrid from '@/components/landing/FeatureBentoGrid';
import PipelineExplorer from '@/components/landing/PipelineExplorer';
import DomainSkillsSection from '@/components/landing/DomainSkillsSection';
import InteractiveSimulator from '@/components/landing/InteractiveSimulator';
import TechnicalFAQ from '@/components/landing/TechnicalFAQ';
import { mapWorkflowsToUseCases, type UseCaseItem } from '@/config/nav';
import { hubApi } from '@/lib/hub-api';
import { getAccents } from '@/theme';
import AnimatedSection from '@/components/landing/AnimatedSection';
import SectionHeader from '@/components/landing/SectionHeader';

const TEAM_MEMBERS = [
  {
    name: 'Surendran Madhavan',
    role: 'Executive Sponsor / Program Dir.',
    department: 'Executive Leadership & Strategy',
    tone: '#1C1C1C',
    bio: 'Provides the strategic vision, executive oversight, and secures the budget for the initiative to ensure alignment with broader organizational goals.',
  },
  {
    name: 'Inderpalsingh Gill',
    role: 'Principal Engineering Manager',
    department: 'Technical Leadership & Delivery',
    tone: '#5A5D5C',
    bio: 'Oversees the delivery lifecycle, removes blockers, and ensures the platform meets enterprise compliance and delivery standards.',
  },
  {
    name: 'Karthik Kolli',
    role: 'Lead AI Product Owner',
    department: 'Product & Quality Strategy',
    tone: '#AF8626',
    bio: 'Drives the functional requirements, sets testing standards, and prioritizes the roadmap for new agentic workflows to ensure generated tests meet QA benchmarks.',
  },
  {
    name: 'Aniket Kalyan Marwadi',
    role: 'Lead AI Architect & Principal Creator',
    department: 'Core Architecture & System Design',
    tone: '#E60000',
    bio: 'Architect and principal creator of the platform. Responsible for end-to-end technical execution, multi-agent orchestration, and the product UI.',
  },
];

/**
 * Platform figures. UBS renders numerals large and Light, with a quiet label
 * underneath -- the number carries the page, not a bold weight.
 */
const FIGURES = [
  { value: '4', label: 'Registry artifact types', note: 'Agents, workflows, skills, and prompts — as files' },
  { value: '2', label: 'Ways to run', note: 'Agent Console, or a dedicated Custom UI' },
  { value: '0', label: 'Migrations to onboard', note: 'Drop a file. It is live.' },
  { value: '1', label: 'Job per run', note: 'Isolated execution, artifacts, and an audit trail' },
];

/** Shown if the registry has not answered yet, so the two Custom UIs stay peers. */
const FALLBACK_CUSTOM_UIS: UseCaseItem[] = [
  {
    id: 'test-case-generation',
    label: 'Test Design & Evaluation',
    path: '/generate',
    description:
      'Transform unstructured requirements into verified, requirement-traced test suites. INVEST gate, coverage matrix, 5-D evaluation, in-place healing.',
    badge: 'Custom UI',
    icon: 'flask-conical',
    hasCustomUi: true,
    available: true,
  },
  {
    id: 'workflow-builder',
    label: 'Workflow Builder',
    path: '/use-cases/workflow-builder',
    description:
      'Describe a workflow in English. Four agents design, critique, write, and review — then you install it live, with nothing redeployed.',
    badge: 'Custom UI',
    icon: 'layers',
    hasCustomUi: true,
    available: true,
  },
];

const CUSTOM_UI_AGENTS: Record<string, string[]> = {
  'test-case-generation': [
    'Requirement Analyst',
    'Test Designer',
    'Test Generator',
    'Test Reviewer',
    'Test Evaluator',
  ],
  'workflow-builder': [
    'Workflow Architect',
    'Architecture Reviewer',
    'Agent Writer',
    'Agent Code Reviewer',
  ],
};

/** First letter of the first and last name -- "Aniket Kalyan Marwadi" -> "AM". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const sectionPad = {
  py: { xs: 7, md: 10 },
} as const;

const stoneBand = {
  ...sectionPad,
  bgcolor: 'var(--col-background-ui-30)',
  borderTop: '1px solid',
  borderBottom: '1px solid',
  borderColor: 'divider',
} as const;

const gutter = { px: { xs: 2, sm: 3, md: 4 } } as const;

/** An editorial panel: accent hairline on top, no icon chrome. */
function Panel({
  accent,
  children,
  sx,
}: {
  accent: string;
  children: React.ReactNode;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderTop: `2px solid ${accent}`,
        borderRadius: 2,
        p: { xs: 3, md: 4 },
        transition: 'background-color 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95), transform 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95), box-shadow 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
        '&:hover': {
          bgcolor: 'var(--col-background-ui-10-hovered)',
          transform: 'translateY(-3px)',
          boxShadow: '0 10px 28px rgba(28, 28, 28, 0.1)',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export default function AgentHubLanding() {
  const router = useRouter();
  const theme = useTheme();
  const accents = getAccents(theme.palette.mode);
  const isLight = theme.palette.mode === 'light';
  const hero = isLight
    ? {
        bg: '#FFFFFF',
        color: '#1C1C1C',
        eyebrow: '#5A5D5C',
        lede: '#5A5D5C',
        ticker: '#5A5D5C',
        figure: '#1C1C1C',
        figureMuted: '#5A5D5C',
        hairline: 'rgba(28, 28, 28, 0.10)',
        grid: 'linear-gradient(rgba(28,28,28,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(28,28,28,0.06) 1px, transparent 1px)',
        mask: 'radial-gradient(ellipse 80% 70% at 70% 40%, #000 30%, transparent 75%)',
        glow: 'radial-gradient(ellipse 55% 50% at 78% 38%, rgba(230,0,0,0.04), transparent 68%)',
        outlineColor: '#1C1C1C',
        outlineBorder: '#8E8D83',
        outlineHoverBorder: '#1C1C1C',
        outlineHoverBg: 'rgba(28,28,28,0.04)',
      }
    : {
        bg: '#1c1c1c',
        color: '#f9f9f7',
        eyebrow: '#b8b3a2',
        lede: '#cccabc',
        ticker: '#8e8d83',
        figure: '#f9f9f7',
        figureMuted: '#b8b3a2',
        hairline: 'rgba(204, 202, 188, 0.18)',
        grid: 'linear-gradient(rgba(249,249,247,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(249,249,247,0.045) 1px, transparent 1px)',
        mask: 'radial-gradient(ellipse 80% 70% at 70% 40%, #000 30%, transparent 75%)',
        glow: 'radial-gradient(ellipse 55% 50% at 78% 38%, rgba(230,0,0,0.14), transparent 68%)',
        outlineColor: '#f9f9f7',
        outlineBorder: '#8e8d83',
        outlineHoverBorder: '#f9f9f7',
        outlineHoverBg: 'rgba(249,249,247,0.04)',
      };

  const [useCases, setUseCases] = useState<UseCaseItem[]>([]);
  useEffect(() => {
    hubApi
      .listWorkflows()
      .then((workflows) => setUseCases(mapWorkflowsToUseCases(workflows)))
      .catch(() => setUseCases([]));
  }, []);

  const customUis = useMemo(() => {
    const fromRegistry = useCases.filter((uc) => uc.hasCustomUi);
    return fromRegistry.length > 0 ? fromRegistry : FALLBACK_CUSTOM_UIS;
  }, [useCases]);

  const consoleWorkflows = useMemo(
    () => useCases.filter((uc) => !uc.hasCustomUi),
    [useCases],
  );

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    ...(useCases.length === 0
      ? [{ id: 'use-cases', label: 'Use Cases', icon: <Layers size={15} />, onClick: () => scrollToSection('use-cases') }]
      : []),
    { id: 'platform', label: 'Platform', icon: <GitBranch size={15} />, onClick: () => scrollToSection('platform') },
    { id: 'team', label: 'Team', icon: <Users size={15} />, onClick: () => scrollToSection('team') },
    { id: 'docs', label: 'Docs', icon: <BookOpen size={15} />, onClick: () => router.push('/docs') },
    { id: 'faq', label: 'FAQs', icon: <HelpCircle size={15} />, onClick: () => scrollToSection('faq') },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', overflowX: 'hidden' }}>
      <UnifiedNavBar
        items={navLinks}
        useCases={useCases}
        alignLinks="right"
        showProductName={false}
        pinned
        onLogoClick={() => router.push('/')}
        actions={<ThemeToggle />}
      />

      {/* ---- Hero: follows the active theme. Light gets a paper stage + charcoal grid. ---- */}
      <Box
        sx={{
          position: 'relative',
          color: hero.color,
          bgcolor: hero.bg,
          overflow: 'hidden',
          borderBottom: '1px solid',
          borderColor: hero.hairline,
          transition: 'background-color 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95), color 0.2s cubic-bezier(0.38, 0.19, 0.32, 0.95)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundImage: hero.grid,
            backgroundSize: '56px 56px',
            maskImage: hero.mask,
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: hero.glow,
            pointerEvents: 'none',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: 'primary.main',
            display: { xs: 'none', md: 'block' },
          }}
        />
        <Container maxWidth="xl" sx={{ ...gutter, position: 'relative', zIndex: 1, pt: { xs: 3, md: 4 }, pb: 0 }}>
          <AnimatedSection delay={0.05}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' },
                gap: { xs: 5, lg: 8 },
                alignItems: 'start',
                pb: { xs: 5, md: 7 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 24, height: 2, bgcolor: 'primary.main', flexShrink: 0 }} />
                  <Typography variant="overline" sx={{ color: hero.eyebrow, lineHeight: 1, letterSpacing: '0.1em' }}>
                    Enterprise multi-agent control plane
                  </Typography>
                </Box>
                <Typography
                  component="h1"
                  sx={{ mb: 1.25, fontWeight: 300, letterSpacing: 0, overflow: 'hidden' }}
                >
                  <ProductName variant="hero" inverse={!isLight} />
                </Typography>
                <Typography
                  sx={{
                    color: hero.color,
                    fontSize: { xs: '1.125rem', md: '1.375rem' },
                    fontWeight: 300,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                    mb: 1.5,
                  }}
                >
                  One HUB. Every agent.
                </Typography>
                <Typography
                  sx={{
                    color: hero.lede,
                    fontSize: { xs: '1.125rem', md: '1.3125rem' },
                    fontWeight: 300,
                    lineHeight: 1.5,
                    maxWidth: 560,
                    mb: { xs: 3.5, md: 4.5 },
                  }}
                >
                  Bring agents, workflows, skills and prompts in as files, run them in the Agent
                  Console, or open a Custom UI when the work needs its own surface
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={() => router.push('/chat')}
                    startIcon={<Terminal size={18} />}
                    endIcon={<ArrowRight size={16} />}
                  >
                    Open Agent Console
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => scrollToSection('use-cases')}
                    startIcon={<Layers size={18} />}
                    sx={{
                      color: hero.outlineColor,
                      borderColor: hero.outlineBorder,
                      '&:hover': { borderColor: hero.outlineHoverBorder, bgcolor: hero.outlineHoverBg },
                    }}
                  >
                    Browse use cases
                  </Button>
                </Box>
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <HubPlatformFlow inverse={!isLight} />
              </Box>
            </Box>
          </AnimatedSection>

          <Box
            sx={{
              display: 'flex',
              gap: 3,
              overflow: 'hidden',
              py: 1.5,
              borderTop: `1px solid ${hero.hairline}`,
              maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 3,
                whiteSpace: 'nowrap',
                animation: 'hubTicker 28s linear infinite',
                '@keyframes hubTicker': {
                  from: { transform: 'translateX(0)' },
                  to: { transform: 'translateX(-50%)' },
                },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            >
              {Array.from({ length: 2 }).flatMap((_, loop) =>
                ['Agents', 'Workflows', 'Skills', 'Prompts', 'Agent Console', 'Custom UIs', 'Jobs', 'Audit trail'].map((item) => (
                  <Typography
                    key={`${loop}-${item}`}
                    variant="overline"
                    sx={{ color: hero.ticker, letterSpacing: '0.14em', lineHeight: 1 }}
                  >
                    {item}
                    <Box component="span" sx={{ color: 'primary.main', mx: 1.5 }}>
                      ·
                    </Box>
                  </Typography>
                )),
              )}
            </Box>
          </Box>

          <Grid container sx={{ borderTop: `1px solid ${hero.hairline}` }}>
            {FIGURES.map((f, i) => (
              <Grid
                key={f.label}
                size={{ xs: 6, md: 3 }}
                sx={{
                  py: { xs: 3.5, md: 5 },
                  pr: { xs: 2, md: 4 },
                  pl: { xs: i % 2 === 1 ? 3 : 0, md: i === 0 ? 0 : 4 },
                  borderLeft: {
                    xs: i % 2 === 1 ? `1px solid ${hero.hairline}` : 0,
                    md: i === 0 ? 0 : `1px solid ${hero.hairline}`,
                  },
                  borderTop: { xs: i >= 2 ? `1px solid ${hero.hairline}` : 0, md: 0 },
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 300,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                    fontSize: { xs: '2.75rem', md: '3.75rem' },
                    color: i === 2 ? '#e60000' : hero.figure,
                    fontVariantNumeric: 'tabular-nums',
                    mb: 1.25,
                  }}
                >
                  {f.value}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.4, color: hero.figure }}>
                  {f.label}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.5, color: hero.figureMuted }}>
                  {f.note}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ---- 01 Use cases: Console + Custom UIs as peers ---- */}
      <Box id="use-cases" sx={{ ...stoneBand, scrollMarginTop: '72px' }}>
        <Container maxWidth="xl" sx={gutter}>
          <SectionHeader
            index="01"
            eyebrow="Use cases & custom UIs"
            title="One platform. Two ways to run."
            lede="The Agent Console runs anything in the registry. A Custom UI is just a dedicated surface a workflow may declare — Test Design and Workflow Builder are two of those, not top-level products."
          />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Panel accent={accents.teal} sx={{ p: 0, overflow: 'hidden' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    minHeight: { md: 320 },
                  }}
                >
                  <Box sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Universal execution plane
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 300, fontSize: { xs: '1.5rem', md: '1.75rem' }, mb: 1.5 }}>
                      Agent Console
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3, flex: 1 }}>
                      Conversational control plane. Pick any onboarded agent, workflow, skill, prompt,
                      and model on the fly. Streams live with session history.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <Button variant="contained" color="secondary" startIcon={<Terminal size={16} />} onClick={() => router.push('/chat')}>
                        Open Agent Console
                      </Button>
                      <Button variant="outlined" color="inherit" onClick={() => router.push('/registry')}>
                        Browse Registry
                      </Button>
                    </Box>
                  </Box>
                  <Box sx={{ p: { xs: 2, md: 2.5 }, bgcolor: '#1c1c1c' }}>
                    <ConsolePreview />
                  </Box>
                </Box>
              </Panel>
            </Grid>

            {customUis.map((uc) => {
              const agents = CUSTOM_UI_AGENTS[uc.id] ?? [];
              const accent = uc.id === 'workflow-builder' ? accents.plum : accents.brand;
              return (
                <Grid key={uc.id} size={{ xs: 12, md: 6 }}>
                  <Panel accent={accent}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Custom UI
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 300, fontSize: { xs: '1.375rem', md: '1.5rem' }, mb: 1.5 }}>
                      {uc.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3, flex: 1 }}>
                      {uc.description}
                    </Typography>
                    {agents.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <PipelineStrip agents={agents} accent={accent} />
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<ExternalLink size={16} />}
                        onClick={() => router.push(uc.path)}
                        disabled={uc.available === false}
                      >
                        Launch custom UI
                      </Button>
                      <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<Terminal size={14} />}
                        onClick={() => router.push(`/chat?workflow=${encodeURIComponent(uc.id)}`)}
                        disabled={uc.available === false}
                      >
                        Run in Console
                      </Button>
                    </Box>
                  </Panel>
                </Grid>
              );
            })}

            {consoleWorkflows.map((uc) => (
              <Grid
                key={uc.id}
                size={{
                  xs: 12,
                  md: consoleWorkflows.length === 1 ? 12 : consoleWorkflows.length === 2 ? 6 : 4,
                }}
              >
                <Panel
                  accent={accents.gold}
                  sx={
                    consoleWorkflows.length === 1
                      ? {
                          flexDirection: { xs: 'column', md: 'row' },
                          alignItems: { md: 'center' },
                          justifyContent: 'space-between',
                          gap: { md: 4 },
                        }
                      : undefined
                  }
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Agent Console
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 300, fontSize: { xs: '1.375rem', md: '1.5rem' }, mb: 2 }}>
                      {uc.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: { xs: 3, md: consoleWorkflows.length === 1 ? 0 : 3 }, maxWidth: 720 }}>
                      {uc.description}
                    </Typography>
                    {uc.available === false && uc.unavailableReason && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, lineHeight: 1.5 }}>
                        {uc.unavailableReason}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<Terminal size={14} />}
                    onClick={() => router.push(uc.path)}
                    disabled={uc.available === false}
                    sx={{ alignSelf: { xs: 'flex-start', md: consoleWorkflows.length === 1 ? 'center' : 'flex-start' }, flexShrink: 0 }}
                  >
                    Run in Console
                  </Button>
                </Panel>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box id="platform" sx={{ ...sectionPad, scrollMarginTop: '72px' }}>
        <Container maxWidth="xl" sx={gutter}>
          <FeatureBentoGrid index="02" />
        </Container>
      </Box>

      <Box sx={stoneBand}>
        <Container maxWidth="xl" sx={gutter}>
          <ComparisonSection index="03" />
        </Container>
      </Box>

      {/* ---- 04 One Custom UI, in focus — not the product. ---- */}
      <Box id="custom-ui" sx={{ ...sectionPad, scrollMarginTop: '72px' }}>
        <Container maxWidth="xl" sx={gutter}>
          <SectionHeader
            index="04"
            eyebrow="Custom UI · example"
            title="Test Design & Evaluation"
            lede="A dedicated surface for one workflow — the same pattern as Workflow Builder. Five agents, an INVEST gate, and in-place healing, from unstructured requirement to a traced suite."
            action={
              <Button
                variant="outlined"
                color="inherit"
                endIcon={<ArrowRight size={16} />}
                onClick={() => router.push('/use-cases/workflow-builder')}
              >
                Workflow Builder
              </Button>
            }
          />
          <RealtimeFlowDiagram />
        </Container>
      </Box>

      <Box sx={stoneBand}>
        <Container maxWidth="xl" sx={gutter}>
          <PipelineExplorer />
        </Container>
      </Box>

      <Box id="simulator" sx={{ ...sectionPad, scrollMarginTop: '72px' }}>
        <Container maxWidth="xl" sx={gutter}>
          <InteractiveSimulator />
        </Container>
      </Box>

      <Box sx={stoneBand}>
        <Container maxWidth="xl" sx={gutter}>
          <DomainSkillsSection index="05" />
        </Container>
      </Box>

      {/* ---- Team: editorial rows, portrait left, no card chrome. ---- */}
      <Box id="team" sx={{ ...sectionPad, scrollMarginTop: '72px' }}>
        <Container maxWidth="xl" sx={gutter}>
          <SectionHeader
            index="06"
            eyebrow="Architecture & engineering"
            title="The team"
            lede="The multi-disciplinary team uniting autonomous systems engineering, financial regulatory compliance, and enterprise test automation."
          />
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            {TEAM_MEMBERS.map((member) => (
              <Box
                key={member.name}
                sx={{
                  display: 'flex',
                  gap: { xs: 2.5, md: 5 },
                  alignItems: { xs: 'flex-start', md: 'center' },
                  py: { xs: 3, md: 4 },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexDirection: { xs: 'column', sm: 'row' },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: { xs: 56, md: 72 },
                    height: { xs: 56, md: 72 },
                    borderRadius: 2,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderTop: `2px solid ${member.tone}`,
                    color: 'text.primary',
                    fontWeight: 300,
                    fontSize: { xs: '1.125rem', md: '1.375rem' },
                    letterSpacing: '0.02em',
                  }}
                >
                  {initials(member.name)}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, md: 5 } }}>
                  <Box sx={{ minWidth: { md: 260 }, flexShrink: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 500, fontSize: '1.0625rem', mb: 0.5 }}>
                      {member.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'primary.main', mb: 0.25 }}>
                      {member.role}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {member.department}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.7, flex: 1, minWidth: 240, maxWidth: 680 }}
                  >
                    {member.bio}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Box id="faq" sx={{ ...stoneBand, scrollMarginTop: '72px' }}>
        <Container maxWidth="xl" sx={gutter}>
          <TechnicalFAQ index="07" />
        </Container>
      </Box>

      {/* ---- Closing band: inverted, asymmetric, generous. ---- */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#1C1C1C', color: '#F9F9F7' }}>
        <Container maxWidth="xl" sx={gutter}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-end">
            <Grid size={{ xs: 12, md: 7 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 24, height: 2, bgcolor: 'primary.main' }} />
                <Typography variant="overline" sx={{ color: '#B8B3A2', lineHeight: 1 }}>
                  Get started
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontWeight: 300,
                  fontSize: { xs: '2rem', md: '3rem' },
                  lineHeight: 1.12,
                  letterSpacing: 0,
                  color: '#F9F9F7',
                  mb: 2,
                }}
              >
                Ready to run a workflow?
              </Typography>
              <Typography sx={{ color: '#B8B3A2', fontWeight: 300, lineHeight: 1.6, fontSize: { md: '1.0625rem' }, maxWidth: 520 }}>
                Open the Agent Console for anything in the registry, or pick a Custom UI from Use Cases.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}>
                <Button variant="contained" color="primary" size="large" onClick={() => router.push('/chat')} endIcon={<ArrowRight size={16} />}>
                  Open Agent Console
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => scrollToSection('use-cases')}
                  sx={{
                    color: '#F9F9F7',
                    borderColor: '#8E8D83',
                    '&:hover': { borderColor: '#F9F9F7', bgcolor: 'transparent' },
                  }}
                >
                  Browse use cases
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 4, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="xl" sx={gutter}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'flex-end' },
              gap: 2,
            }}
          >
            <UnifiedBrand />
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography
                variant="overline"
                sx={{ display: 'block', color: 'text.secondary', lineHeight: 1, letterSpacing: '0.14em', mb: 0.75 }}
              >
                Designed by
              </Typography>
              <Typography
                sx={{
                  fontWeight: 300,
                  fontSize: '0.9375rem',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  color: 'text.primary',
                  display: 'inline-block',
                  pb: 0.5,
                  borderBottom: '2px solid',
                  borderColor: 'primary.main',
                }}
              >
                Aniket Marwadi
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                &copy; 2026 Agent HUB Platform
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
