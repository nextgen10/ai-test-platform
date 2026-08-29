'use client';

import React, { useEffect, useState, Suspense } from 'react';
import {
    Box, Paper, Typography, Button, Chip, Divider,
    CircularProgress, Stack, alpha, useTheme,
    Tabs, Tab, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Bot, ArrowRight, ShieldCheck,
    Layers, CheckCircle2, Copy, Check,
    RotateCcw, Lock, BookOpen, ScanText,
    Gauge, Award, ShieldAlert, Database,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { api, type AgentInfo, type SkillInfo, type BenchmarkResponse, type BenchmarkItem, type Workflow } from '@/lib/api';

const AMBER = '#af8626';
const GREEN = '#469a6c';
const RED = '#e60000';
const BLUE = '#00759e';
const PURPLE = '#804c95';

/**
 * Hand-written notes for agents that have them.
 *
 * Enrichment, never a gate: an agent missing from this map still renders, using
 * the role, description and artifact contract it declares in its own
 * frontmatter. Adding an agent to the hub must not require editing this file.
 */
const STAGE_CONFIG: Record<string, {
    order: number;
    accent: string;
    schema?: string;
    rules: string[];
    brief: string;
}> = {
    'ocr-extractor': {
        order: 0,
        accent: GREEN,
        rules: [
            'Dynamically loads document-ocr SKILL.md — zero hardcoded prompts',
            'Multimodal Vision via GHCP (gpt-4o / claude-3.7-sonnet)',
            'Untrusted document boundary: image content is data, never instruction',
            'Zero external binaries — pure stdlib + GitHub Models API',
        ],
        brief: 'Phase 0 pre-processor. Transforms uploaded document images, scanned specifications, UI wireframes, and flowcharts into structured Markdown requirement specifications before the analysis pipeline begins.',
    },
    'requirement-analyst': {
        order: 1,
        accent: AMBER,
        schema: 'schemas/quality-report.schema.json',
        rules: [
            'Evaluates exactly 8 INVEST criteria on 1-4 rating scale',
            'Flags ambiguity and missing information before test design',
            'Untrusted requirement boundary: zero command execution',
        ],
        brief: 'Acts as the pre-flight gatekeeper. Evaluates raw requirements for completeness, clarity, testability, and feasibility before any test authoring begins.',
    },
    'test-designer': {
        order: 2,
        accent: RED,
        schema: 'schemas/test-design.schema.json',
        rules: [
            'Constructs coverage matrix across 5 mandatory categories',
            'Identifies stated vs inferred business rules',
            'Maps scenarios to priority ratings and risk factors',
        ],
        brief: 'QA architect agent. Analyzes business logic to construct the coverage matrix and scenario blueprint without writing concrete test steps.',
    },
    'test-generator': {
        order: 3,
        accent: RED,
        schema: 'schemas/test-case.schema.json',
        rules: [
            'Generates concrete actionable steps (minimum 2 steps per case)',
            'Enforces explicit verifiable expected results',
            'Validates unique IDs and bidirectional requirement traceability',
        ],
        brief: 'Test authoring agent. Translates test design blueprints into concrete, executable test case specifications with setup preconditions and step assertions.',
    },
    'test-reviewer': {
        order: 4,
        accent: RED,
        schema: 'schemas/test-case.schema.json',
        rules: [
            'Independent critic: detects duplicates, weak assertions, and gaps',
            'Validates against Draft-07 JSON schema with up to 2 retry attempts',
            'Emits review.json audit report alongside final test_cases.json',
        ],
        brief: 'Independent quality critic. Reviews draft suites, eliminates duplicate steps, fixes weak assertions, and enforces strict schema compliance.',
    },
    'test-evaluator': {
        order: 5,
        accent: BLUE,
        schema: 'schemas/evaluation.schema.json',
        rules: [
            'Scores 5 weighted dimensions (Coverage, Completeness, Traceability, Correctness, Uniqueness)',
            'Identifies uncovered boundary edge cases and scenario gaps',
            'Emits actionable recommendations for reprocess runs',
        ],
        brief: 'Mathematical evaluation agent. Evaluates final suites against source requirements and computes the weighted Requirements Quality Score (RQS).',
    },
    'gap-closer': {
        order: 6,
        accent: BLUE,
        schema: 'schemas/test-case.schema.json',
        rules: [
            'In-place delta amendment: closes specific gaps named in evaluation',
            'Preserves previously passing verified test cases',
            'Snapshots suite before mutation with automated rollback on failure',
        ],
        brief: 'Healing & reprocess agent. Triggered on reprocess runs to patch missing test scenarios directly in-place without restarting the pipeline.',
    },
    'workflow-architect': {
        order: 10,
        accent: PURPLE,
        rules: [
            'Emits a structured architecture as JSON, not prose',
            'Decides how many agents the described work actually needs',
            'Declares depends_on so independent stages can run concurrently',
        ],
        brief: 'Opening stage of the Workflow Builder. Reads a plain-English description of a desired workflow and designs the multi-agent architecture to deliver it.',
    },
    'architecture-reviewer': {
        order: 11,
        accent: PURPLE,
        rules: [
            'Independent critic: checks the design against the original request',
            'May restructure stages, but keeps the approved JSON contract',
            'Rejects designs that split work no agent can actually do alone',
        ],
        brief: 'Principal systems reviewer. Challenges the drafted architecture before a single agent prompt is written, when changing it is still cheap.',
    },
    'agent-writer': {
        order: 12,
        accent: PURPLE,
        rules: [
            'Generates the .workflow.yaml and every .agent.md the design needs',
            'Chains each agent input to an earlier stage output, so the workflow runs',
            'Enforces kebab-case ids and workspace-relative artifact paths',
        ],
        brief: 'Implementation engineer. Turns the approved architecture into the actual files the Registry accepts.',
    },
    'agent-code-reviewer': {
        order: 13,
        accent: PURPLE,
        rules: [
            'Validates YAML syntax and indentation before anything is installed',
            'Hardens the generated prompts against hallucination and injection',
            'Never alters the approved architecture — only the code quality',
        ],
        brief: 'Lead agent engineer. Final gate on generated code, producing the document the Workflow Builder UI installs from.',
    },
};

const CATEGORIES = [
    { name: 'Functional', key: 'functional', color: 'primary', desc: 'The documented happy path and supported business variations.' },
    { name: 'Negative', key: 'negative', color: 'error', desc: 'Invalid input, unauthorized access, failure states and error responses.' },
    { name: 'Boundary', key: 'boundary', color: 'warning', desc: 'Limits: min, max, min-1, max+1, empty collections, overflow, and timeouts.' },
    { name: 'Validation', key: 'validation', color: 'info', desc: 'Field-level format, data types, required-ness constraints and regex patterns.' },
    { name: 'Data', key: 'data', color: 'secondary', desc: 'Behavior across differing data states, volumes, special characters and currencies.' },
];

const QUALITY_GATES = [
    { rule: 'Minimum Test Cases', threshold: '≥ 5 test cases', rationale: 'Prevents shallow or superficial test suites' },
    { rule: 'Category Coverage', threshold: '≥ 3 distinct categories', rationale: 'Enforces diverse scenario types across edge cases' },
    { rule: 'Duplicate Rate', threshold: '< 10% title duplication', rationale: 'Eliminates redundant generated tests' },
    { rule: 'Steps per Case', threshold: '≥ 2 non-empty steps', rationale: 'Ensures reproducible and clear execution paths' },
    { rule: 'Expected Results', threshold: 'Non-empty & observable', rationale: 'Requires checkable assertions without vague prose' },
    { rule: 'Requirement Traceability', threshold: 'Resolved REQ reference', rationale: 'Guarantees audit traceability to source requirement' },
];

function DocsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    // Tabs: 0=Agents, 1=Skills, 2=Evaluation
    const tabParam = searchParams.get('tab');
    const initialTab = tabParam === 'skills' ? 1 : tabParam === 'evaluation' ? 2 : 0;
    const [mainTab, setMainTab] = useState<number>(initialTab);

    // Agents State
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('requirement-analyst');
    const [agentTab, setAgentTab] = useState<number>(0);

    // Skills State
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [selectedSkillId, setSelectedSkillId] = useState<string>('test-case-generation');
    const [skillSubTab, setSkillSubTab] = useState<number>(0);

    // Evaluation State
    const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);
    const [selectedSample, setSelectedSample] = useState<BenchmarkItem | null>(null);

    // Loading & Copy
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        Promise.all([
            api.agents().catch(() => []),
            api.skills().catch(() => []),
            api.benchmarks().catch(() => null),
            api.workflows().catch(() => []),
        ]).then(([agentsData, skillsData, benchData, workflowsData]) => {
            setWorkflows(workflowsData);
            const sortedAgents = [...agentsData].sort((a, b) => {
                const orderA = STAGE_CONFIG[a.id]?.order ?? 99;
                const orderB = STAGE_CONFIG[b.id]?.order ?? 99;
                return orderA - orderB;
            });
            setAgents(sortedAgents);
            if (sortedAgents.length > 0) setSelectedAgentId(sortedAgents[0].id);

            setSkills(skillsData);
            if (benchData) {
                setBenchmarkData(benchData);
                if (benchData.benchmarks?.length > 0) setSelectedSample(benchData.benchmarks[0]);
            }
            setLoading(false);
        });
    }, []);

    const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
    const agentCfg = selectedAgent ? STAGE_CONFIG[selectedAgent.id] : undefined;
    const agentAccent = agentCfg?.accent || RED;
    const currentSkill = skills.find((s) => s.id === selectedSkillId) || skills[0];

    const handleCopy = (text?: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRunBenchmark = (sample: BenchmarkItem) => {
        sessionStorage.setItem('benchmark_req', sample.content);
        router.push('/generate?benchmark=1');
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 6 }}>
            <PageHeader
                title="Documentation"
                subtitle="Complete technical reference for Copilot multi-agent state machines, domain skills, and 5-D RQS mathematical scoring."
                actions={
                    <Button
                        variant="contained"
                        color="primary"
                        endIcon={<ArrowRight size={18} />}
                        onClick={() => router.push('/generate')}
                        sx={{ fontWeight: 500, borderRadius: 2 }}
                    >
                        Generate Test Cases
                    </Button>
                }
            />

            {/* Top Level Section Tabs (3 Clean Tabs) */}
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3, overflow: 'hidden' }}>
                <Tabs
                    value={mainTab}
                    onChange={(_, val) => {
                        setMainTab(val);
                        const tabNames = ['agents', 'skills', 'evaluation'];
                        window.history.replaceState(null, '', `/docs?tab=${tabNames[val]}`);
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        bgcolor: isLight ? '#f9f9f7' : 'background.paper',
                        px: 2,
                        '& .MuiTab-root': {
                            fontWeight: 500,
                            fontSize: '0.9rem',
                            textTransform: 'none',
                            minHeight: 52,
                            py: 1.5,
                        },
                    }}
                >
                    <Tab icon={<Bot size={18} />} iconPosition="start" label="Copilot Agents & Chain" />
                    <Tab icon={<BookOpen size={18} />} iconPosition="start" label="Testing Rules & Quality Gates" />
                    <Tab icon={<Gauge size={18} />} iconPosition="start" label="5-D Evaluation & Benchmarks" />
                </Tabs>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box>
                    {/* ================= TAB 0: AGENTS & CHAIN ================= */}
                    {mainTab === 0 && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Pipeline Overview Ribbon */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                    <Typography variant="h6" fontWeight={500} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Layers size={20} color={RED} />
                                        Multi-Agent Autonomous Execution Pipeline
                                    </Typography>
                                    <Chip
                                        label={`${agents.length} Specialized Agents \u2022 ${workflows.length} Workflow${workflows.length === 1 ? '' : 's'}`}
                                        size="small"
                                        sx={{ fontWeight: 500, bgcolor: alpha(RED, 0.1), color: RED }}
                                    />
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                                    Every agent onboarded to the hub, across every workflow. Agents pass
                                    validated artifacts rather than free text, and each one declares the
                                    contract it must satisfy. Select one to read its full prompt.
                                </Typography>

                                {/* Auto-fitting, so onboarding an agent does not need a column count here. */}
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))',
                                    gap: 1.5,
                                    width: '100%',
                                }}>
                                    {agents.map((ag) => {
                                        const isSelected = ag.id === selectedAgent?.id;
                                        const stageCfg = STAGE_CONFIG[ag.id];
                                        const stageNum = stageCfg?.order ?? '-';
                                        const accent = stageCfg?.accent || RED;

                                        return (
                                            <Paper
                                                key={ag.id}
                                                elevation={0}
                                                onClick={() => {
                                                    setSelectedAgentId(ag.id);
                                                    setAgentTab(0);
                                                }}
                                                sx={{
                                                    p: 1.75,
                                                    cursor: 'pointer',
                                                    borderRadius: 2,
                                                    border: '1.5px solid',
                                                    borderColor: isSelected ? accent : 'divider',
                                                    bgcolor: isSelected ? alpha(accent, isLight ? 0.08 : 0.15) : 'background.paper',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isSelected ? `0 4px 14px ${alpha(accent, 0.2)}` : 'none',
                                                    minWidth: 0,
                                                    height: 105,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    overflow: 'hidden',
                                                    '&:hover': { borderColor: accent, bgcolor: 'var(--col-background-ui-10-hovered)' },
                                                }}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                                                        <Box sx={{
                                                            width: 26,
                                                            height: 26,
                                                            borderRadius: 2,
                                                            bgcolor: alpha(accent, isSelected ? 1 : 0.12),
                                                            color: isSelected ? '#FFFFFF' : accent,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 500,
                                                            fontSize: '0.75rem',
                                                            flexShrink: 0,
                                                        }}>
                                                            {ag.id === 'ocr-extractor' ? <ScanText size={13} /> : ag.id === 'gap-closer' ? <RotateCcw size={13} /> : stageNum}
                                                        </Box>
                                                        <Typography variant="caption" sx={{
                                                            fontWeight: 500,
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.65rem',
                                                            color: isSelected ? accent : 'text.secondary',
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            {ag.stage}
                                                        </Typography>
                                                    </Box>
                                                    <Typography
                                                        variant="subtitle2"
                                                        fontWeight={500}
                                                        sx={{
                                                            fontSize: '0.82rem',
                                                            lineHeight: 1.2,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            minWidth: 0,
                                                        }}
                                                    >
                                                        {ag.name}
                                                    </Typography>
                                                </Box>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        display: 'block',
                                                        fontSize: '0.7rem',
                                                        lineHeight: 1.2,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    {ag.role}
                                                </Typography>
                                            </Paper>
                                        );
                                    })}
                                </Box>
                            </Paper>

                            {/* Detailed Inspector for Selected Agent */}
                            {selectedAgent && (
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' }, gap: 3 }}>
                                    {/* Left Specification Column */}
                                    <Paper elevation={0} sx={{ p: 3.5, borderRadius: 2, border: '1px solid', borderColor: agentAccent, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: agentAccent, color: '#FFFFFF', display: 'flex' }}>
                                                    <Bot size={22} />
                                                </Box>
                                                <Box>
                                                    <Typography variant="h6" fontWeight={500}>
                                                        {selectedAgent.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {selectedAgent.role}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Chip size="small" variant="outlined" label={selectedAgent.file} sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 0.5 }} />
                                        </Box>

                                        <Divider />

                                        <Box>
                                            <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Pipeline Position
                                            </Typography>
                                            <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5, color: agentAccent }}>
                                                Stage {STAGE_CONFIG[selectedAgent.id]?.order ?? 'Specialized'} &bull; {selectedAgent.stage.toUpperCase()}
                                            </Typography>
                                        </Box>

                                        <Box>
                                            <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Input Contract
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mt: 0.5, bgcolor: isLight ? '#f4f3ee' : '#2a2a2a', p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                                {selectedAgent.input_artifact}
                                            </Typography>
                                        </Box>

                                        <Box>
                                            <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Output Contract
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mt: 0.5, bgcolor: isLight ? '#f4f3ee' : '#2a2a2a', p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', color: agentAccent, fontWeight: 500 }}>
                                                {selectedAgent.output_artifact}
                                            </Typography>
                                        </Box>

                                        {agentCfg?.schema && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    JSON Schema Enforcement
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', mt: 0.5, color: 'text.secondary' }}>
                                                    {agentCfg.schema}
                                                </Typography>
                                            </Box>
                                        )}

                                        <Box>
                                            <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Permitted Sandboxed Tools
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, mt: 0.8, flexWrap: 'wrap' }}>
                                                {selectedAgent.tools.map((t) => (
                                                    <Chip key={t} size="small" label={t} color="primary" variant="outlined" icon={<ShieldCheck size={12} />} sx={{ fontWeight: 500 }} />
                                                ))}
                                            </Box>
                                        </Box>

                                        <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                <Lock size={14} color={GREEN} />
                                                Air-gapped workspace isolation (/workspace)
                                            </Typography>
                                        </Box>
                                    </Paper>

                                    {/* Right Dual-Tab Inspector Column */}
                                    <Paper elevation={0} sx={{ p: 3.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                                            <Tabs
                                                value={agentTab}
                                                onChange={(_, val) => setAgentTab(val)}
                                                sx={{ minHeight: 38 }}
                                            >
                                                <Tab label="Agent Briefing & Guardrails" sx={{ fontWeight: 500, fontSize: '0.85rem', textTransform: 'none' }} />
                                                <Tab label="Copilot Prompt (.agent.md)" sx={{ fontWeight: 500, fontSize: '0.85rem', textTransform: 'none' }} />
                                            </Tabs>

                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={copied ? <Check size={14} color={GREEN} /> : <Copy size={14} />}
                                                onClick={() => handleCopy(selectedAgent.content)}
                                                sx={{ fontWeight: 500, borderRadius: 2 }}
                                            >
                                                {copied ? 'Copied' : 'Copy Prompt'}
                                            </Button>
                                        </Box>

                                        <Divider sx={{ mb: 2.5 }} />

                                        {agentTab === 0 ? (
                                            /* Tab 1: Formatted Briefing */
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight={500} color={agentAccent} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>
                                                        Role Description
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
                                                        {agentCfg?.brief || selectedAgent.description || selectedAgent.role}
                                                    </Typography>
                                                </Box>

                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1.5 }}>
                                                        Active Guardrails & Verification Rules
                                                    </Typography>
                                                    <Stack spacing={1.5}>
                                                        {agentCfg?.rules.map((rule) => (
                                                            <Box key={rule} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                                                                <CheckCircle2 size={16} color={GREEN} style={{ marginTop: 2, flexShrink: 0 }} />
                                                                <Typography variant="body2" sx={{ fontSize: '0.88rem' }}>
                                                                    {rule}
                                                                </Typography>
                                                            </Box>
                                                        ))}
                                                    </Stack>
                                                </Box>

                                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: isLight ? '#f9f9f7' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="subtitle2" fontWeight={500} sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <ShieldAlert size={16} color={AMBER} />
                                                        Trust Boundary & Sandboxing
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
                                                        All input documents are treated as untrusted markdown. Agent instructions embedded inside requirements are treated as content to analyze, never executable commands. Blocked shell access and strict directory bounds prevent system escape.
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ) : (
                                            /* Tab 2: Raw Code / Prompt */
                                            <Box
                                                component="pre"
                                                sx={{
                                                    p: 2.5,
                                                    borderRadius: 2,
                                                    bgcolor: '#1c1c1c',
                                                    color: '#f9f9f7',
                                                    border: '1px solid',
                                                    borderColor: '#7a7870',
                                                    overflowX: 'auto',
                                                    fontFamily: 'ui-monospace, monospace',
                                                    fontSize: '0.82rem',
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap',
                                                    maxHeight: 560,
                                                }}
                                            >
                                                {selectedAgent.content}
                                            </Box>
                                        )}
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* ================= TAB 1: DOMAIN SKILLS ================= */}
                    {mainTab === 1 && skills.length > 0 && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Skill Selector Chips */}
                            {skills.length > 1 && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.5, fontSize: '0.72rem' }}>
                                        Active Skill:
                                    </Typography>
                                    {skills.map((sk) => (
                                        <Chip
                                            key={sk.id}
                                            label={sk.name}
                                            size="small"
                                            clickable
                                            onClick={() => { setSelectedSkillId(sk.id); setSkillSubTab(0); }}
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: '0.78rem',
                                                height: 30,
                                                borderRadius: 2,
                                                border: '1.5px solid',
                                                borderColor: sk.id === selectedSkillId ? RED : 'divider',
                                                bgcolor: sk.id === selectedSkillId ? alpha(RED, 0.1) : 'background.paper',
                                                color: sk.id === selectedSkillId ? RED : 'text.primary',
                                                '&:hover': { borderColor: RED, color: RED },
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}

                            {/* Skill Banner */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: RED, color: '#FFFFFF', display: 'flex' }}>
                                            <BookOpen size={28} />
                                        </Box>
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                <Typography variant="h5" fontWeight={500}>
                                                    {currentSkill.name}
                                                </Typography>
                                                <Chip size="small" color="success" label="Active Workflow" icon={<CheckCircle2 size={13} />} />
                                                <Chip size="small" variant="outlined" label={currentSkill.version} />
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {currentSkill.path}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
                                        onClick={() => handleCopy(currentSkill.content)}
                                        sx={{ borderRadius: 2, fontWeight: 500 }}
                                    >
                                        {copied ? 'Copied' : 'Copy SKILL.md'}
                                    </Button>
                                </Box>
                            </Paper>

                            {/* Sub-tabs for Skill components */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Tabs
                                    value={skillSubTab}
                                    onChange={(_, val) => setSkillSubTab(val)}
                                    sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
                                >
                                    <Tab label="5 Coverage Categories" sx={{ fontWeight: 500, textTransform: 'none' }} />
                                    <Tab label="Quality Gates & Invariants" sx={{ fontWeight: 500, textTransform: 'none' }} />
                                    <Tab label="Full SKILL.md Specification" sx={{ fontWeight: 500, textTransform: 'none' }} />
                                </Tabs>

                                {skillSubTab === 0 && (
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                                        {CATEGORIES.map((cat) => (
                                            <Card key={cat.key} variant="outlined" sx={{ borderRadius: 2 }}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                        <Typography variant="subtitle1" fontWeight={500}>
                                                            {cat.name}
                                                        </Typography>
                                                        <Chip size="small" label={cat.key} color={cat.color as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'} sx={{ fontWeight: 500, fontSize: '0.72rem' }} />
                                                    </Box>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                                                        {cat.desc}
                                                    </Typography>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Box>
                                )}

                                {skillSubTab === 1 && (
                                    <Table size="medium">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 500 }}>Quality Rule</TableCell>
                                                <TableCell sx={{ fontWeight: 500 }}>Strict Threshold</TableCell>
                                                <TableCell sx={{ fontWeight: 500 }}>Architectural Rationale</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {QUALITY_GATES.map((g) => (
                                                <TableRow key={g.rule}>
                                                    <TableCell sx={{ fontWeight: 500 }}>{g.rule}</TableCell>
                                                    <TableCell>
                                                        <Chip size="small" label={g.threshold} color="primary" variant="outlined" sx={{ fontWeight: 500 }} />
                                                    </TableCell>
                                                    <TableCell sx={{ color: 'text.secondary' }}>{g.rationale}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}

                                {skillSubTab === 2 && (
                                    <Box
                                        component="pre"
                                        sx={{
                                            p: 2.5,
                                            borderRadius: 2,
                                            bgcolor: '#1c1c1c',
                                            color: '#f9f9f7',
                                            border: '1px solid',
                                            borderColor: '#7a7870',
                                            overflowX: 'auto',
                                            fontFamily: 'ui-monospace, monospace',
                                            fontSize: '0.82rem',
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: 560,
                                        }}
                                    >
                                        {currentSkill.content}
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    )}

                    {/* ================= TAB 2: EVALUATION & BENCHMARKS ================= */}
                    {mainTab === 2 && benchmarkData && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Five Dimensions Card */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: RED, color: '#FFFFFF', display: 'flex' }}>
                                        <Award size={22} />
                                    </Box>
                                    <Box>
                                        <Typography variant="h6" fontWeight={500}>
                                            The Five Requirements Quality Score (RQS) Dimensions
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            RQS = 0.30 &times; Coverage + 0.25 &times; Completeness + 0.20 &times; Traceability + 0.15 &times; Correctness + 0.10 &times; Uniqueness
                                        </Typography>
                                    </Box>
                                </Box>

                                <Divider sx={{ my: 2 }} />

                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2 }}>
                                    {benchmarkData.dimensions.map((dim) => (
                                        <Card key={dim.id} variant="outlined" sx={{ borderRadius: 2 }}>
                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="subtitle2" fontWeight={500}>
                                                        {dim.name}
                                                    </Typography>
                                                    <Chip label={`${Math.round(dim.weight * 100)}%`} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 500 }} />
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', minHeight: 48, fontSize: '0.75rem', lineHeight: 1.4 }}>
                                                    {dim.description}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            </Paper>

                            {/* Benchmark Samples */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" fontWeight={500} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Database size={20} color={BLUE} />
                                        Standard Benchmark Requirements
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Select a golden benchmark requirement to inspect its testability structure or run it directly through the multi-agent generation pipeline.
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 3 }}>
                                    <Stack spacing={1}>
                                        {benchmarkData.benchmarks.map((sample) => {
                                            const isSel = sample.id === selectedSample?.id;
                                            return (
                                                <Paper
                                                    key={sample.id}
                                                    elevation={0}
                                                    onClick={() => setSelectedSample(sample)}
                                                    sx={{
                                                        p: 2,
                                                        cursor: 'pointer',
                                                        borderRadius: 2,
                                                        border: '1.5px solid',
                                                        borderColor: isSel ? 'primary.main' : 'divider',
                                                        bgcolor: isSel ? 'action.selected' : 'background.paper',
                                                        '&:hover': { borderColor: 'primary.light' },
                                                    }}
                                                >
                                                    <Typography variant="subtitle2" fontWeight={500}>
                                                        {sample.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                        {sample.filename} &bull; {sample.size_bytes} bytes
                                                    </Typography>
                                                </Paper>
                                            );
                                        })}
                                    </Stack>

                                    {selectedSample && (
                                        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: isLight ? '#f9f9f7' : 'background.paper' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                                                <Typography variant="subtitle1" fontWeight={500}>
                                                    {selectedSample.title}
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    size="small"
                                                    endIcon={<ArrowRight size={16} />}
                                                    onClick={() => handleRunBenchmark(selectedSample)}
                                                    sx={{ fontWeight: 500, borderRadius: 2 }}
                                                >
                                                    Load into Generator
                                                </Button>
                                            </Box>
                                            <Box
                                                component="pre"
                                                sx={{
                                                    p: 2.5,
                                                    borderRadius: 2,
                                                    bgcolor: isLight ? '#FFFFFF' : '#1c1c1c',
                                                    color: isLight ? 'text.primary' : '#f9f9f7',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    overflowX: 'auto',
                                                    fontFamily: 'ui-monospace, monospace',
                                                    fontSize: '0.82rem',
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap',
                                                    maxHeight: 380,
                                                }}
                                            >
                                                {selectedSample.content}
                                            </Box>
                                        </Paper>
                                    )}
                                </Box>
                            </Paper>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}

export default function DocsPage() {
    return (
        <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        }>
            <DocsContent />
        </Suspense>
    );
}
