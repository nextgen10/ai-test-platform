import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowRight, Award, Bot, BookOpen, Check, CheckCircle2, Copy, Database, Gauge, Layers, Lock,
    RotateCcw, ScanText, ShieldAlert, ShieldCheck,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { cx } from '@/components/ui/cx';
import { Button, Chip, Divider, LoadingBlock, Paper } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { alpha } from '@/theme';

const AMBER = '#af8626';
const GREEN = '#469a6c';
const BRAND = '#E60000';
const BLUE = '#00759e';
const PURPLE = '#804c95';

/**
 * Hand-written notes for agents that have them.
 *
 * Enrichment, never a gate: an agent missing from this map still renders, using
 * the role, description and artifact contract it declares in its own
 * frontmatter. Adding an agent to the hub must not require editing this file.
 */
const STAGE_CONFIG = {
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
        accent: BRAND,
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
        accent: BRAND,
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
        accent: BRAND,
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

const MAIN_TABS = ['agents', 'skills', 'evaluation'];

const FIELD_LABEL = 'ui-caption font-medium uppercase tracking-[0.04em] text-subtle';

/** The dark code slab used for raw prompts and skill sources. */
function CodeSlab({ children, className }) {
    return (
        <pre
            className={cx(
                'max-h-[560px] overflow-auto whitespace-pre-wrap rounded-ubs border border-[#7a7870] bg-[#1c1c1c] p-5 font-mono text-[0.82rem] leading-relaxed text-[#f9f9f7]',
                className,
            )}
        >
            {children}
        </pre>
    );
}

export default function DocsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [mainTab, setMainTab] = useState('agents');

    const tabParam = searchParams.get('tab');
    useEffect(() => {
        if (tabParam && MAIN_TABS.includes(tabParam)) setMainTab(tabParam);
    }, [tabParam]);

    // Agents
    const [agents, setAgents] = useState([]);
    const [workflows, setWorkflows] = useState([]);
    const [selectedAgentId, setSelectedAgentId] = useState('requirement-analyst');
    const [agentTab, setAgentTab] = useState('briefing');

    // Skills
    const [skills, setSkills] = useState([]);
    const [selectedSkillId, setSelectedSkillId] = useState('test-case-generation');
    const [skillSubTab, setSkillSubTab] = useState('categories');

    // Evaluation
    const [benchmarkData, setBenchmarkData] = useState(null);
    const [selectedSample, setSelectedSample] = useState(null);

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
            const sortedAgents = [...agentsData].sort(
                (a, b) => (STAGE_CONFIG[a.id]?.order ?? 99) - (STAGE_CONFIG[b.id]?.order ?? 99),
            );
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

    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) || agents[0];
    const agentCfg = selectedAgent ? STAGE_CONFIG[selectedAgent.id] : undefined;
    const agentAccent = agentCfg?.accent || BRAND;
    const currentSkill = skills.find((skill) => skill.id === selectedSkillId) || skills[0];

    const handleCopy = async (text) => {
        if (!text) return;
        if (!(await copyToClipboard(text))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRunBenchmark = (sample) => {
        sessionStorage.setItem('benchmark_req', sample.content);
        navigate('/generate?benchmark=1');
    };

    return (
        <div className="mx-auto w-full max-w-[1400px] pb-12">
            <PageHeader
                title="Documentation"
                subtitle="Complete technical reference for Copilot multi-agent state machines, domain skills, and 5-D RQS mathematical scoring."
                actions={
                    <Button variant="contained" onClick={() => navigate('/generate')}>
                        Generate Test Cases
                        <ArrowRight size={18} />
                    </Button>
                }
            />

            <Paper flat className="mb-6 overflow-hidden bg-elevated">
                <Tabs
                    className="px-4"
                    value={mainTab}
                    onChange={(value) => {
                        setMainTab(value);
                        setSearchParams({ tab: value }, { replace: true });
                    }}
                    items={[
                        { value: 'agents', label: 'Copilot Agents & Chain', icon: <Bot size={18} /> },
                        { value: 'skills', label: 'Testing Rules & Quality Gates', icon: <BookOpen size={18} /> },
                        { value: 'evaluation', label: '5-D Evaluation & Benchmarks', icon: <Gauge size={18} /> },
                    ]}
                />
            </Paper>

            {loading ? (
                <LoadingBlock />
            ) : (
                <div>
                    {/* ================= AGENTS & CHAIN ================= */}
                    {mainTab === 'agents' && (
                        <div className="flex flex-col gap-6">
                            <Paper flat className="p-6">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="ui-h6 flex items-center gap-2">
                                        <Layers size={20} style={{ color: BRAND }} />
                                        Multi-Agent Autonomous Execution Pipeline
                                    </h2>
                                    <Chip
                                        className="font-medium"
                                        style={{ backgroundColor: alpha(BRAND, 0.1), color: BRAND }}
                                    >
                                        {`${agents.length} Specialized Agents • ${workflows.length} Workflow${workflows.length === 1 ? '' : 's'}`}
                                    </Chip>
                                </div>
                                <p className="ui-body2 mb-5 text-subtle">
                                    Every agent onboarded to the hub, across every workflow. Agents pass validated
                                    artifacts rather than free text, and each one declares the contract it must
                                    satisfy. Select one to read its full prompt.
                                </p>

                                {/* Auto-fitting, so onboarding an agent does not need a column count here. */}
                                <div className="grid w-full gap-3 [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]">
                                    {agents.map((agent) => {
                                        const isSelected = agent.id === selectedAgent?.id;
                                        const stageCfg = STAGE_CONFIG[agent.id];
                                        const stageNum = stageCfg?.order ?? '-';
                                        const accent = stageCfg?.accent || BRAND;

                                        return (
                                            <button
                                                key={agent.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedAgentId(agent.id);
                                                    setAgentTab('briefing');
                                                }}
                                                className="flex h-[105px] min-w-0 flex-col justify-between overflow-hidden rounded-ubs border-[1.5px] p-3 text-left transition-colors hover:bg-surface-hover"
                                                style={{
                                                    borderColor: isSelected ? accent : 'var(--col-border-illustrative)',
                                                    backgroundColor: isSelected
                                                        ? alpha(accent, 0.1)
                                                        : 'var(--col-background-ui-10)',
                                                }}
                                            >
                                                <span className="block min-w-0">
                                                    <span className="mb-1.5 flex items-center justify-between">
                                                        <span
                                                            className="flex size-[26px] shrink-0 items-center justify-center rounded-ubs text-[0.75rem] font-medium"
                                                            style={{
                                                                backgroundColor: isSelected ? accent : alpha(accent, 0.12),
                                                                color: isSelected ? '#FFFFFF' : accent,
                                                            }}
                                                        >
                                                            {agent.id === 'ocr-extractor' ? (
                                                                <ScanText size={13} />
                                                            ) : agent.id === 'gap-closer' ? (
                                                                <RotateCcw size={13} />
                                                            ) : (
                                                                stageNum
                                                            )}
                                                        </span>
                                                        <span
                                                            className="font-mono text-[0.65rem] font-medium uppercase"
                                                            style={{ color: isSelected ? accent : 'var(--col-text-subtle)' }}
                                                        >
                                                            {agent.stage}
                                                        </span>
                                                    </span>
                                                    <span className="block min-w-0 truncate text-[0.82rem] font-medium leading-tight">
                                                        {agent.name}
                                                    </span>
                                                </span>
                                                <span className="block min-w-0 truncate text-[0.7rem] leading-tight text-subtle">
                                                    {agent.role}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Paper>

                            {selectedAgent && (
                                <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                                    {/* Specification */}
                                    <Paper flat className="flex flex-col gap-5 p-7" style={{ borderColor: agentAccent }}>
                                        <div>
                                            <div className="mb-2 flex items-center gap-3">
                                                <span
                                                    className="flex rounded-ubs p-2 text-white"
                                                    style={{ backgroundColor: agentAccent }}
                                                >
                                                    <Bot size={22} />
                                                </span>
                                                <div>
                                                    <p className="ui-h6">{selectedAgent.name}</p>
                                                    <p className="ui-caption text-subtle">{selectedAgent.role}</p>
                                                </div>
                                            </div>
                                            <Chip variant="outlined" className="mt-1 font-mono text-[0.75rem]">
                                                {selectedAgent.file}
                                            </Chip>
                                        </div>

                                        <Divider />

                                        <div>
                                            <p className={FIELD_LABEL}>Pipeline Position</p>
                                            <p className="ui-body2 mt-1 font-medium" style={{ color: agentAccent }}>
                                                Stage {STAGE_CONFIG[selectedAgent.id]?.order ?? 'Specialized'} •{' '}
                                                {selectedAgent.stage.toUpperCase()}
                                            </p>
                                        </div>

                                        <div>
                                            <p className={FIELD_LABEL}>Input Contract</p>
                                            <p className="mt-1 rounded-ubs border border-hairline bg-sunken p-2 font-mono text-[0.8rem]">
                                                {selectedAgent.input_artifact}
                                            </p>
                                        </div>

                                        <div>
                                            <p className={FIELD_LABEL}>Output Contract</p>
                                            <p
                                                className="mt-1 rounded-ubs border border-hairline bg-sunken p-2 font-mono text-[0.8rem] font-medium"
                                                style={{ color: agentAccent }}
                                            >
                                                {selectedAgent.output_artifact}
                                            </p>
                                        </div>

                                        {agentCfg?.schema && (
                                            <div>
                                                <p className={FIELD_LABEL}>JSON Schema Enforcement</p>
                                                <p className="mt-1 font-mono text-[0.78rem] text-subtle">
                                                    {agentCfg.schema}
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <p className={FIELD_LABEL}>Permitted Sandboxed Tools</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {selectedAgent.tools.map((tool) => (
                                                    <Chip
                                                        key={tool}
                                                        variant="outlined"
                                                        color="primary"
                                                        className="gap-1 font-medium"
                                                    >
                                                        <ShieldCheck size={12} />
                                                        {tool}
                                                    </Chip>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t border-hairline pt-2">
                                            <p className="ui-caption flex items-center gap-1.5 text-subtle">
                                                <Lock size={14} style={{ color: GREEN }} />
                                                Air-gapped workspace isolation (/workspace)
                                            </p>
                                        </div>
                                    </Paper>

                                    {/* Inspector */}
                                    <Paper flat className="p-7">
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                            <Tabs
                                                className="border-b-0"
                                                value={agentTab}
                                                onChange={setAgentTab}
                                                items={[
                                                    { value: 'briefing', label: 'Agent Briefing & Guardrails' },
                                                    { value: 'prompt', label: 'Copilot Prompt (.agent.md)' },
                                                ]}
                                            />

                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleCopy(selectedAgent.content)}
                                            >
                                                {copied ? (
                                                    <Check size={14} style={{ color: GREEN }} />
                                                ) : (
                                                    <Copy size={14} />
                                                )}
                                                {copied ? 'Copied' : 'Copy Prompt'}
                                            </Button>
                                        </div>

                                        <Divider className="mb-5" />

                                        {agentTab === 'briefing' ? (
                                            <div className="flex flex-col gap-6">
                                                <div>
                                                    <p
                                                        className="ui-subtitle2 mb-1 uppercase tracking-[0.04em]"
                                                        style={{ color: agentAccent }}
                                                    >
                                                        Role Description
                                                    </p>
                                                    <p className="leading-relaxed">
                                                        {agentCfg?.brief ||
                                                            selectedAgent.description ||
                                                            selectedAgent.role}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="ui-subtitle2 mb-3 uppercase tracking-[0.04em] text-subtle">
                                                        Active Guardrails & Verification Rules
                                                    </p>
                                                    <div className="flex flex-col gap-3">
                                                        {agentCfg?.rules.map((rule) => (
                                                            <div key={rule} className="flex items-start gap-3">
                                                                <CheckCircle2
                                                                    size={16}
                                                                    className="mt-0.5 shrink-0"
                                                                    style={{ color: GREEN }}
                                                                />
                                                                <p className="text-[0.88rem]">{rule}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="rounded-ubs border border-hairline bg-elevated p-4">
                                                    <p className="ui-subtitle2 mb-1 flex items-center gap-2">
                                                        <ShieldAlert size={16} style={{ color: AMBER }} />
                                                        Trust Boundary & Sandboxing
                                                    </p>
                                                    <p className="ui-caption block leading-relaxed text-subtle">
                                                        All input documents are treated as untrusted markdown. Agent
                                                        instructions embedded inside requirements are treated as content
                                                        to analyze, never executable commands. Blocked shell access and
                                                        strict directory bounds prevent system escape.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <CodeSlab>{selectedAgent.content}</CodeSlab>
                                        )}
                                    </Paper>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================= DOMAIN SKILLS ================= */}
                    {mainTab === 'skills' && skills.length > 0 && currentSkill && (
                        <div className="flex flex-col gap-6">
                            {skills.length > 1 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="ui-caption mr-1 text-[0.72rem] font-medium uppercase tracking-[0.04em] text-subtle">
                                        Active Skill:
                                    </span>
                                    {skills.map((skill) => {
                                        const selected = skill.id === selectedSkillId;
                                        return (
                                            <button
                                                key={skill.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSkillId(skill.id);
                                                    setSkillSubTab('categories');
                                                }}
                                                className="h-[30px] rounded-ubs border-[1.5px] px-3 text-[0.78rem] font-medium"
                                                style={{
                                                    borderColor: selected ? BRAND : 'var(--col-border-illustrative)',
                                                    backgroundColor: selected
                                                        ? alpha(BRAND, 0.1)
                                                        : 'var(--col-background-ui-10)',
                                                    color: selected ? BRAND : 'var(--col-text-primary)',
                                                }}
                                            >
                                                {skill.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <Paper flat className="p-6">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <span
                                            className="flex rounded-ubs p-3 text-white"
                                            style={{ backgroundColor: BRAND }}
                                        >
                                            <BookOpen size={28} />
                                        </span>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h2 className="text-xl font-medium">{currentSkill.name}</h2>
                                                <Chip color="success" className="gap-1">
                                                    <CheckCircle2 size={13} />
                                                    Active Workflow
                                                </Chip>
                                                <Chip variant="outlined">{currentSkill.version}</Chip>
                                            </div>
                                            <p className="mt-1 font-mono text-[0.85rem] text-subtle">
                                                {currentSkill.path}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outlined" onClick={() => handleCopy(currentSkill.content)}>
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                        {copied ? 'Copied' : 'Copy SKILL.md'}
                                    </Button>
                                </div>
                            </Paper>

                            <Paper flat className="p-6">
                                <Tabs
                                    className="mb-6"
                                    value={skillSubTab}
                                    onChange={setSkillSubTab}
                                    items={[
                                        { value: 'categories', label: '5 Coverage Categories' },
                                        { value: 'gates', label: 'Quality Gates & Invariants' },
                                        { value: 'source', label: 'Full SKILL.md Specification' },
                                    ]}
                                />

                                {skillSubTab === 'categories' && (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {CATEGORIES.map((category) => (
                                            <Paper key={category.key} flat className="p-4">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <p className="ui-subtitle1">{category.name}</p>
                                                    <Chip color={category.color} className="text-[0.72rem] font-medium">
                                                        {category.key}
                                                    </Chip>
                                                </div>
                                                <p className="text-[0.85rem] leading-relaxed text-subtle">
                                                    {category.desc}
                                                </p>
                                            </Paper>
                                        ))}
                                    </div>
                                )}

                                {skillSubTab === 'gates' && (
                                    <div className="overflow-x-auto">
                                        <table className="ui-table">
                                            <thead>
                                                <tr>
                                                    <th>Quality Rule</th>
                                                    <th>Strict Threshold</th>
                                                    <th>Architectural Rationale</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {QUALITY_GATES.map((gate) => (
                                                    <tr key={gate.rule}>
                                                        <td className="font-medium">{gate.rule}</td>
                                                        <td>
                                                            <Chip variant="outlined" color="primary" className="font-medium">
                                                                {gate.threshold}
                                                            </Chip>
                                                        </td>
                                                        <td className="text-subtle">{gate.rationale}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {skillSubTab === 'source' && <CodeSlab>{currentSkill.content}</CodeSlab>}
                            </Paper>
                        </div>
                    )}

                    {/* ================= EVALUATION & BENCHMARKS ================= */}
                    {mainTab === 'evaluation' && benchmarkData && (
                        <div className="flex flex-col gap-6">
                            <Paper flat className="p-6">
                                <div className="mb-2 flex items-center gap-3">
                                    <span className="flex rounded-ubs p-2 text-white" style={{ backgroundColor: BRAND }}>
                                        <Award size={22} />
                                    </span>
                                    <div>
                                        <h2 className="ui-h6">
                                            The Five Requirements Quality Score (RQS) Dimensions
                                        </h2>
                                        <p className="ui-caption text-subtle">
                                            RQS = 0.30 × Coverage + 0.25 × Completeness + 0.20 × Traceability + 0.15 ×
                                            Correctness + 0.10 × Uniqueness
                                        </p>
                                    </div>
                                </div>

                                <Divider className="my-4" />

                                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                                    {benchmarkData.dimensions.map((dimension) => (
                                        <Paper key={dimension.id} flat className="p-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="ui-subtitle2">{dimension.name}</p>
                                                <Chip color="primary" className="h-5 text-[0.7rem] font-medium">
                                                    {`${Math.round(dimension.weight * 100)}%`}
                                                </Chip>
                                            </div>
                                            <p className="ui-caption block min-h-12 text-[0.75rem] leading-snug text-subtle">
                                                {dimension.description}
                                            </p>
                                        </Paper>
                                    ))}
                                </div>
                            </Paper>

                            <Paper flat className="p-6">
                                <h2 className="ui-h6 mb-4 flex items-center gap-2">
                                    <Database size={20} style={{ color: BLUE }} />
                                    Standard Benchmark Requirements
                                </h2>
                                <p className="ui-body2 mb-6 text-subtle">
                                    Select a golden benchmark requirement to inspect its testability structure or run it
                                    directly through the multi-agent generation pipeline.
                                </p>

                                <div className="grid gap-6 md:grid-cols-[320px_1fr]">
                                    <div className="flex flex-col gap-2">
                                        {benchmarkData.benchmarks.map((sample) => {
                                            const selected = sample.id === selectedSample?.id;
                                            return (
                                                <button
                                                    key={sample.id}
                                                    type="button"
                                                    onClick={() => setSelectedSample(sample)}
                                                    className={cx(
                                                        'rounded-ubs border-[1.5px] p-4 text-left',
                                                        selected
                                                            ? 'border-brand bg-sunken'
                                                            : 'border-hairline bg-surface hover:border-brand',
                                                    )}
                                                >
                                                    <p className="ui-subtitle2">{sample.title}</p>
                                                    <p className="ui-caption font-mono text-subtle">
                                                        {sample.filename} • {sample.size_bytes} bytes
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {selectedSample && (
                                        <Paper flat className="bg-elevated p-6">
                                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                                <p className="ui-subtitle1">{selectedSample.title}</p>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    onClick={() => handleRunBenchmark(selectedSample)}
                                                >
                                                    Load into Generator
                                                    <ArrowRight size={16} />
                                                </Button>
                                            </div>
                                            <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap rounded-ubs border border-hairline bg-surface p-5 font-mono text-[0.82rem] leading-relaxed">
                                                {selectedSample.content}
                                            </pre>
                                        </Paper>
                                    )}
                                </div>
                            </Paper>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
