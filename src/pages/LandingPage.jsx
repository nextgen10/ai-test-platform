import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, BookOpen, ExternalLink, GitBranch, HelpCircle, Layers, Terminal, Users,
} from 'lucide-react';

import ThemeToggle from '@/components/ThemeToggle';
import UnifiedNavBar, { NAV_CHROME_GUTTER } from '@/components/UnifiedNavBar';
import { ProductName, UnifiedBrand } from '@/components/brand';
import { cx } from '@/components/ui/cx';
import { Button } from '@/components/ui/primitives';
import AnimatedSection from '@/components/landing/AnimatedSection';
import ComparisonSection from '@/components/landing/ComparisonSection';
import ConsolePreview from '@/components/landing/ConsolePreview';
import DomainSkillsSection from '@/components/landing/DomainSkillsSection';
import FeatureBentoGrid from '@/components/landing/FeatureBentoGrid';
import HubPlatformFlow from '@/components/landing/HubPlatformFlow';
import InteractiveSimulator from '@/components/landing/InteractiveSimulator';
import PipelineExplorer from '@/components/landing/PipelineExplorer';
import PipelineStrip from '@/components/landing/PipelineStrip';
import RealtimeFlowDiagram from '@/components/landing/RealtimeFlowDiagram';
import SectionHeader from '@/components/landing/SectionHeader';
import TechnicalFAQ from '@/components/landing/TechnicalFAQ';
import { mapWorkflowsToUseCases } from '@/config/nav';
import { useThemeMode } from '@/contexts/ThemeContext';
import { hubApi } from '@/lib/hub-api';
import { getAccents } from '@/theme';

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
 * underneath — the number carries the page, not a bold weight.
 */
const FIGURES = [
    { value: '4', label: 'Registry artifact types', note: 'Agents, workflows, skills, and prompts — as files' },
    { value: '2', label: 'Ways to run', note: 'Agent Console, or a dedicated Custom UI' },
    { value: '0', label: 'Migrations to onboard', note: 'Drop a file. It is live.' },
    { value: '1', label: 'Job per run', note: 'Isolated execution, artifacts, and an audit trail' },
];

/** Shown if the registry has not answered yet, so the two Custom UIs stay peers. */
const FALLBACK_CUSTOM_UIS = [
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

const CUSTOM_UI_AGENTS = {
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

/** First letter of the first and last name — "Aniket Kalyan Marwadi" -> "AM". */
function initials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const SECTION_PAD = 'py-14 md:py-20';
const STONE_BAND = `${SECTION_PAD} border-y border-hairline bg-sunken`;
const GUTTER = 'px-4 sm:px-6 md:px-8';

/** An editorial panel: accent hairline on top, no icon chrome. */
function Panel({ accent, className, children }) {
    return (
        <div
            className={cx(
                'flex h-full flex-col rounded-ubs border border-hairline bg-surface p-6 transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:bg-surface-hover hover:shadow-[0_10px_28px_rgba(28,28,28,0.1)] md:p-8',
                className,
            )}
            style={{ borderTop: `2px solid ${accent}` }}
        >
            {children}
        </div>
    );
}

const TICKER_ITEMS = [
    'Agents', 'Workflows', 'Skills', 'Prompts', 'Agent Console', 'Custom UIs', 'Jobs', 'Audit trail',
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { mode } = useThemeMode();
    const accents = getAccents(mode);
    const isLight = mode === 'light';

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
          };

    const [useCases, setUseCases] = useState([]);
    useEffect(() => {
        hubApi
            .listWorkflows()
            .then((workflows) => setUseCases(mapWorkflowsToUseCases(workflows)))
            .catch(() => setUseCases([]));
    }, []);

    const customUis = useMemo(() => {
        const fromRegistry = useCases.filter((useCase) => useCase.hasCustomUi);
        return fromRegistry.length > 0 ? fromRegistry : FALLBACK_CUSTOM_UIS;
    }, [useCases]);

    const consoleWorkflows = useMemo(
        () => useCases.filter((useCase) => !useCase.hasCustomUi),
        [useCases],
    );

    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    const navLinks = [
        { id: 'platform', label: 'Platform', icon: <GitBranch size={15} />, onClick: () => scrollToSection('platform') },
        { id: 'team', label: 'Team', icon: <Users size={15} />, onClick: () => scrollToSection('team') },
        { id: 'docs', label: 'Docs', icon: <BookOpen size={15} />, onClick: () => navigate('/docs') },
        { id: 'faq', label: 'FAQs', icon: <HelpCircle size={15} />, onClick: () => scrollToSection('faq') },
    ];

    // A lone console workflow gets the full row and lays out sideways; two share
    // the row; three or more tile.
    const consoleSpan =
        consoleWorkflows.length === 1 ? '' : consoleWorkflows.length === 2 ? 'md:w-1/2' : 'md:w-1/3';

    return (
        <div className="min-h-screen overflow-x-hidden bg-surface text-ink">
            <UnifiedNavBar
                items={navLinks}
                useCases={useCases}
                showProductName={false}
                pinned
                onLogoClick={() => navigate('/')}
                actions={<ThemeToggle />}
            />

            {/* ---- Hero: follows the active theme. Light gets a paper stage + charcoal grid. ---- */}
            <div
                className="relative overflow-hidden border-b transition-colors duration-200"
                style={{ color: hero.color, backgroundColor: hero.bg, borderColor: hero.hairline }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                        backgroundImage: hero.grid,
                        backgroundSize: '56px 56px',
                        maskImage: hero.mask,
                        WebkitMaskImage: hero.mask,
                    }}
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{ background: hero.glow }}
                />

                <div className={cx('ui-container relative z-[1] pb-0 pt-6 md:pt-8', GUTTER)}>
                    <AnimatedSection delay={0.05}>
                        <div className="grid items-start gap-10 pb-10 md:pb-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
                            <div className="min-w-0">
                                <div className="mb-4 flex items-center gap-3">
                                    <span className="h-0.5 w-6 shrink-0 bg-brand" />
                                    <span
                                        className="ui-overline leading-none tracking-[0.1em]"
                                        style={{ color: hero.eyebrow }}
                                    >
                                        Enterprise multi-agent control plane
                                    </span>
                                </div>

                                {/* Margins/line-heights match Next page.tsx (MUI spacing 8px):
                                    h1 mb 1.25 → 10px; oneHub lh 1.3; lede lh 1.5 — not
                                    Tailwind's leading-tight/relaxed defaults. */}
                                <h1 className="mb-2.5 overflow-hidden font-light tracking-normal">
                                    <ProductName variant="hero" inverse={!isLight} />
                                </h1>

                                <p
                                    className="mb-3 text-[1.125rem] font-light leading-[1.3] tracking-[-0.01em] md:text-[1.375rem]"
                                    style={{ color: hero.color }}
                                >
                                    One HUB. Every agent.
                                </p>

                                <p
                                    className="mb-7 max-w-[560px] text-[1.125rem] font-light leading-[1.5] md:mb-9 md:text-[1.3125rem]"
                                    style={{ color: hero.lede }}
                                >
                                    Bring agents, workflows, skills and prompts in as files, run them in the Agent
                                    Console, or open a Custom UI when the work needs its own surface
                                </p>

                                <div className="flex flex-wrap items-center gap-3">
                                    <Button variant="contained" size="large" onClick={() => navigate('/chat')}>
                                        <Terminal size={18} />
                                        Open Agent Console
                                        <ArrowRight size={16} />
                                    </Button>
                                    <Button
                                        variant="outlined-neutral"
                                        size="large"
                                        onClick={() => scrollToSection('use-cases')}
                                        style={{ color: hero.outlineColor, borderColor: hero.outlineBorder }}
                                    >
                                        <Layers size={18} />
                                        Browse use cases
                                    </Button>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <HubPlatformFlow inverse={!isLight} />
                            </div>
                        </div>
                    </AnimatedSection>

                    {/* Marquee of what the registry holds. */}
                    <div
                        className="flex gap-6 overflow-hidden border-t py-3"
                        style={{
                            borderColor: hero.hairline,
                            maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
                            WebkitMaskImage:
                                'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
                        }}
                    >
                        <div className="flex animate-[hubTicker_28s_linear_infinite] gap-6 whitespace-nowrap motion-reduce:animate-none">
                            {[0, 1].flatMap((loop) =>
                                TICKER_ITEMS.map((item) => (
                                    <span
                                        key={`${loop}-${item}`}
                                        className="ui-overline leading-none tracking-[0.14em]"
                                        style={{ color: hero.ticker }}
                                    >
                                        {item}
                                        <span className="mx-3 text-brand">·</span>
                                    </span>
                                )),
                            )}
                        </div>
                    </div>

                    <div
                        className="grid grid-cols-2 border-t md:grid-cols-4"
                        style={{ borderColor: hero.hairline }}
                    >
                        {FIGURES.map((figure, position) => (
                            <div
                                key={figure.label}
                                className={cx(
                                    'py-7 pr-4 md:py-10 md:pr-8',
                                    /* xs: 2-col — left rule + gutter on the odd column. */
                                    position % 2 === 1 && 'border-l pl-6',
                                    /* xs: top rule on the second row. Dropped at md (one row of four). */
                                    position >= 2 && 'border-t md:border-t-0',
                                    /* md: 4-col — left rule + gutter on every cell except the first. */
                                    position === 0 ? 'md:border-l-0 md:pl-0' : 'md:border-l md:pl-8',
                                )}
                                style={{ borderColor: hero.hairline }}
                            >
                                <p
                                    className="mb-3 text-[2.75rem] font-light leading-none tracking-[-0.03em] tabular-nums md:text-[3.75rem]"
                                    style={{ color: position === 2 ? '#E60000' : hero.figure }}
                                >
                                    {figure.value}
                                </p>
                                <p
                                    className="ui-subtitle2 mb-1"
                                    style={{ color: hero.figure }}
                                >
                                    {figure.label}
                                </p>
                                <p
                                    className="ui-caption block leading-relaxed"
                                    style={{ color: hero.figureMuted }}
                                >
                                    {figure.note}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ---- 01 Use cases: Console + Custom UIs as peers ---- */}
            <section id="use-cases" className={cx(STONE_BAND, 'scroll-mt-[72px]')}>
                <div className={cx('ui-container', GUTTER)}>
                    <SectionHeader
                        index="01"
                        eyebrow="Use cases & custom UIs"
                        title="One platform. Two ways to run."
                        lede="The Agent Console runs anything in the registry. A Custom UI is just a dedicated surface a workflow may declare — Test Design and Workflow Builder are two of those, not top-level products."
                    />

                    <div className="flex flex-col gap-6">
                        <Panel accent={accents.teal} className="overflow-hidden p-0 hover:translate-y-0">
                            <div className="grid md:min-h-[320px] md:grid-cols-2">
                                <div className="flex flex-col p-6 md:p-8">
                                    <span className="ui-overline mb-2 block text-subtle">
                                        Universal execution plane
                                    </span>
                                    <h3 className="mb-3 text-2xl font-light md:text-[1.75rem]">Agent Console</h3>
                                    <p className="ui-body2 mb-6 flex-1 leading-relaxed text-subtle">
                                        Conversational control plane. Pick any onboarded agent, workflow, skill,
                                        prompt, and model on the fly. Streams live with session history.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <Button variant="secondary" onClick={() => navigate('/chat')}>
                                            <Terminal size={16} />
                                            Open Agent Console
                                        </Button>
                                        <Button variant="outlined-neutral" onClick={() => navigate('/registry')}>
                                            Browse Registry
                                        </Button>
                                    </div>
                                </div>
                                <div className="bg-[#1c1c1c] p-4 md:p-5">
                                    <ConsolePreview />
                                </div>
                            </div>
                        </Panel>

                        <div className="grid gap-6 md:grid-cols-2">
                            {customUis.map((useCase) => {
                                const agents = CUSTOM_UI_AGENTS[useCase.id] ?? [];
                                const accent =
                                    useCase.id === 'workflow-builder' ? accents.plum : accents.brand;
                                return (
                                    <Panel key={useCase.id} accent={accent}>
                                        <span className="ui-overline mb-2 block text-subtle">Custom UI</span>
                                        <h3 className="mb-3 text-[1.375rem] font-light md:text-2xl">
                                            {useCase.label}
                                        </h3>
                                        <p className="ui-body2 mb-6 flex-1 leading-relaxed text-subtle">
                                            {useCase.description}
                                        </p>
                                        {agents.length > 0 && (
                                            <div className="mb-6">
                                                <PipelineStrip agents={agents} accent={accent} />
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                variant="contained"
                                                disabled={useCase.available === false}
                                                onClick={() => navigate(useCase.path)}
                                            >
                                                <ExternalLink size={16} />
                                                Launch custom UI
                                            </Button>
                                            <Button
                                                variant="outlined-neutral"
                                                disabled={useCase.available === false}
                                                onClick={() =>
                                                    navigate(`/chat?workflow=${encodeURIComponent(useCase.id)}`)
                                                }
                                            >
                                                <Terminal size={14} />
                                                Run in Console
                                            </Button>
                                        </div>
                                    </Panel>
                                );
                            })}
                        </div>

                        {consoleWorkflows.length > 0 && (
                            <div className="flex flex-col gap-6 md:flex-row md:flex-wrap">
                                {consoleWorkflows.map((useCase) => (
                                    <div
                                        key={useCase.id}
                                        className={cx('w-full', consoleSpan)}
                                        style={
                                            consoleWorkflows.length > 1
                                                ? { flex: '1 1 320px', maxWidth: '100%' }
                                                : undefined
                                        }
                                    >
                                        <Panel
                                            accent={accents.gold}
                                            className={
                                                consoleWorkflows.length === 1
                                                    ? 'md:flex-row md:items-center md:justify-between md:gap-8'
                                                    : undefined
                                            }
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="ui-overline mb-2 block text-subtle">
                                                    Agent Console
                                                </span>
                                                <h3 className="mb-4 text-[1.375rem] font-light md:text-2xl">
                                                    {useCase.label}
                                                </h3>
                                                <p
                                                    className={cx(
                                                        'ui-body2 max-w-[720px] leading-relaxed text-subtle',
                                                        consoleWorkflows.length === 1 ? 'mb-6 md:mb-0' : 'mb-6',
                                                    )}
                                                >
                                                    {useCase.description}
                                                </p>
                                                {useCase.available === false && useCase.unavailableReason && (
                                                    <p className="ui-caption mt-3 block leading-relaxed text-subtle">
                                                        {useCase.unavailableReason}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="outlined-neutral"
                                                className="shrink-0 self-start md:self-center"
                                                disabled={useCase.available === false}
                                                onClick={() => navigate(useCase.path)}
                                            >
                                                <Terminal size={14} />
                                                Run in Console
                                            </Button>
                                        </Panel>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section id="platform" className={cx(SECTION_PAD, 'scroll-mt-[72px]')}>
                <div className={cx('ui-container', GUTTER)}>
                    <FeatureBentoGrid index="02" />
                </div>
            </section>

            <section className={STONE_BAND}>
                <div className={cx('ui-container', GUTTER)}>
                    <ComparisonSection index="03" />
                </div>
            </section>

            {/* ---- 04 One Custom UI, in focus — not the product. ---- */}
            <section id="custom-ui" className={cx(SECTION_PAD, 'scroll-mt-[72px]')}>
                <div className={cx('ui-container', GUTTER)}>
                    <SectionHeader
                        index="04"
                        eyebrow="Custom UI · example"
                        title="Test Design & Evaluation"
                        lede="A dedicated surface for one workflow — the same pattern as Workflow Builder. Five agents, an INVEST gate, and in-place healing, from unstructured requirement to a traced suite."
                        action={
                            <Button
                                variant="outlined-neutral"
                                onClick={() => navigate('/use-cases/workflow-builder')}
                            >
                                Workflow Builder
                                <ArrowRight size={16} />
                            </Button>
                        }
                    />
                    <RealtimeFlowDiagram />
                </div>
            </section>

            <section className={STONE_BAND}>
                <div className={cx('ui-container', GUTTER)}>
                    <PipelineExplorer />
                </div>
            </section>

            <section id="simulator" className={cx(SECTION_PAD, 'scroll-mt-[72px]')}>
                <div className={cx('ui-container', GUTTER)}>
                    <InteractiveSimulator />
                </div>
            </section>

            <section className={STONE_BAND}>
                <div className={cx('ui-container', GUTTER)}>
                    <DomainSkillsSection index="05" />
                </div>
            </section>

            {/* ---- Team: editorial rows, portrait left, no card chrome. ---- */}
            <section id="team" className={cx(SECTION_PAD, 'scroll-mt-[72px]')}>
                <div className={cx('ui-container', GUTTER)}>
                    <SectionHeader
                        index="06"
                        eyebrow="Architecture & engineering"
                        title="The team"
                        lede="The multi-disciplinary team uniting autonomous systems engineering, financial regulatory compliance, and enterprise test automation."
                    />
                    <div className="border-t border-hairline">
                        {TEAM_MEMBERS.map((member) => (
                            <div
                                key={member.name}
                                className="flex flex-col items-start gap-5 border-b border-hairline py-6 sm:flex-row md:items-center md:gap-10 md:py-8"
                            >
                                <span
                                    aria-hidden
                                    className="flex size-14 shrink-0 items-center justify-center rounded-ubs border border-hairline bg-surface text-[1.125rem] font-light tracking-[0.02em] text-ink md:size-[72px] md:text-[1.375rem]"
                                    style={{ borderTop: `2px solid ${member.tone}` }}
                                >
                                    {initials(member.name)}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-wrap gap-3 md:gap-10">
                                    <div className="shrink-0 md:min-w-[260px]">
                                        <p className="mb-1 text-[1.0625rem] font-medium">{member.name}</p>
                                        <p className="ui-body2 mb-0.5 text-brand">{member.role}</p>
                                        <p className="ui-caption text-subtle">{member.department}</p>
                                    </div>
                                    <p className="ui-body2 min-w-[240px] max-w-[680px] flex-1 leading-relaxed text-subtle">
                                        {member.bio}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="faq" className={cx(STONE_BAND, 'scroll-mt-[72px]')}>
                <div className={cx('ui-container', GUTTER)}>
                    <TechnicalFAQ index="07" />
                </div>
            </section>

            {/* ---- Closing band: inverted, asymmetric, generous. ---- */}
            <section className="bg-[#1C1C1C] py-16 text-[#F9F9F7] md:py-24">
                <div className={cx('ui-container', GUTTER)}>
                    <div className="grid items-end gap-8 md:grid-cols-12 md:gap-12">
                        <div className="md:col-span-7">
                            <div className="mb-4 flex items-center gap-3">
                                <span className="h-0.5 w-6 bg-brand" />
                                <span className="ui-overline leading-none text-[#B8B3A2]">Get started</span>
                            </div>
                            <p className="mb-4 text-[2rem] font-light leading-[1.12] text-[#F9F9F7] md:text-5xl">
                                Ready to run a workflow?
                            </p>
                            <p className="max-w-[520px] font-light leading-relaxed text-[#B8B3A2] md:text-[1.0625rem]">
                                Open the Agent Console for anything in the registry, or pick a Custom UI from Use
                                Cases.
                            </p>
                        </div>
                        <div className="md:col-span-5">
                            <div className="flex flex-wrap gap-4 md:justify-end">
                                <Button variant="contained" size="large" onClick={() => navigate('/chat')}>
                                    Open Agent Console
                                    <ArrowRight size={16} />
                                </Button>
                                <Button
                                    variant="outlined-neutral"
                                    size="large"
                                    onClick={() => scrollToSection('use-cases')}
                                    style={{ color: '#F9F9F7', borderColor: '#8E8D83' }}
                                >
                                    Browse use cases
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="border-t border-hairline bg-surface py-8">
                <div
                    className={cx(
                        'flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-end',
                        NAV_CHROME_GUTTER,
                    )}
                >
                    <UnifiedBrand />
                    {/* The nav's icon button is 40px with 8px padding; inset this
                        column so “Designed by” shares the toggle's right edge. */}
                    <div className="text-left sm:pr-2 sm:text-right">
                        <span className="ui-overline mb-1.5 block leading-none tracking-[0.14em] text-subtle">
                            Designed by
                        </span>
                        <p className="inline-block border-b-2 border-brand pb-1 text-[0.9375rem] font-light leading-tight tracking-[-0.01em] text-ink">
                            Aniket Marwadi
                        </p>
                        <p className="ui-caption mt-3 block text-subtle">© 2026 Agent HUB Platform</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
