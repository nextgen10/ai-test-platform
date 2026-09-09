import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Copy, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';

import { copyToClipboard } from '@/lib/clipboard';
import { alpha } from '@/theme';
import { cx } from '../ui/cx';
import { Button, Chip, IconButton, Paper, Tooltip } from '../ui/primitives';
import SectionHeader from './SectionHeader';

const AMBER = '#af8626';
const GREEN = '#469a6c';
const BRAND = '#E60000';
const BLUE = '#00759e';

const STAGES_DATA = [
  {
    id: 'analyst',
    number: 1,
    name: 'Requirement Analyst',
    role: 'Scores requirement against 8 INVEST dimensions & flags ambiguities',
    accent: AMBER,
    inputArtifact: 'input/requirement.md',
    outputArtifact: 'quality_report.json',
    guardrails: [
      'Strict INVEST scoring (1-4 scale)',
      'Blocks vague or test-unfriendly requirements',
      'Automated deficiency & ambiguity detection',
    ],
    summary: 'Analyzes the raw business requirement before any test design starts. Evaluates Independent, Negotiable, Valuable, Estimable, Small, Testable, Acceptance Criteria, and Unambiguity criteria.',
    sampleJson: {
      requirement_reference: "REQ-402",
      overall: { score: 3.75, rating: "good", verdict: "Requirement is clear and test-ready." },
      criteria: [
        { id: "independent", rating: "very_good", rationale: "Self-contained payment authorization flow." },
        { id: "testable", rating: "very_good", rationale: "Clear pass/fail criteria with numeric balance thresholds." },
        { id: "unambiguous", rating: "good", rationale: "Timeout window specified as 300 seconds." }
      ],
      blocking_issues: []
    }
  },
  {
    id: 'approval',
    number: 2,
    name: 'Human Approval Gate',
    role: 'Quality gatekeeper: Holds execution for operator verification',
    accent: GREEN,
    inputArtifact: 'quality_report.json',
    outputArtifact: 'approval_decision.json',
    guardrails: [
      'Halts execution if INVEST score < 2.5',
      'Enforces audit log of approver & timestamp',
      'Rejection ends run cleanly without token waste',
    ],
    summary: 'Parks the job in AWAITING_APPROVAL. An operator or QA lead reviews the INVEST quality report. Rejection terminates the pipeline early, preventing generation of weak or inaccurate tests.',
    sampleJson: {
      decision: "APPROVED",
      reviewer: "lead.qa@agenthub.ubs.com",
      timestamp: "2026-08-14T04:30:00Z",
      notes: "INVEST report looks solid. Authorized for 5-category matrix design."
    }
  },
  {
    id: 'designer',
    number: 3,
    name: 'Test Designer',
    role: 'Formulates comprehensive coverage matrix across 5 categories',
    accent: BRAND,
    inputArtifact: 'quality_report.json + requirement.md',
    outputArtifact: 'test_design.json',
    guardrails: [
      'Enforces all 5 test categories (Functional to Data)',
      'Maps business risk to test priority levels',
      'Constructs boundary equivalence partitions',
    ],
    summary: 'Maps business requirements into a formal test architecture ensuring coverage across Functional, Negative, Boundary, Validation, and Data test categories.',
    sampleJson: {
      coverage_matrix: {
        functional: ["TC-001: Authorized SWIFT MT103 Settlement", "TC-002: Real-time Account Debit"],
        negative: ["TC-003: Insufficient Available Liquidity", "TC-004: Sanctioned BIC Routing Reject"],
        boundary: ["TC-005: Exact Daily Limit Transfer ($1,000,000.00)", "TC-006: Sub-cent Fractional Amount"],
        validation: ["TC-007: Invalid IBAN Checksum", "TC-008: Expired Settlement Timestamp"],
        data: ["TC-009: Multi-currency Cross-border Conversion"]
      }
    }
  },
  {
    id: 'generator',
    number: 4,
    name: 'Test Generator',
    role: 'Synthesizes concrete executable test cases with preconditions & steps',
    accent: BRAND,
    inputArtifact: 'test_design.json',
    outputArtifact: 'draft_test_cases.json',
    guardrails: [
      'Exact JSON syntax compliance',
      'Minimum 2 concrete actionable steps per case',
      'Explicit expected results with deterministic assertions',
    ],
    summary: 'Translates the abstract test design matrix into actionable, concrete test case specifications with unambiguous setup preconditions, execution steps, and verification assertions.',
    sampleJson: {
      requirement_reference: "REQ-402",
      test_cases: [
        {
          id: "TC-001",
          title: "Verify standard SWIFT MT103 domestic wire transfer",
          category: "functional",
          priority: "critical",
          preconditions: ["Sender account active with balance >= $50,000.00", "Beneficiary IBAN validated"],
          steps: [
            "1. Initiate MT103 wire transfer of $15,000.00 with valid BIC.",
            "2. Submit for real-time gross settlement (RTGS)."
          ],
          expected_result: "Transfer state enters SETTLED within 1200ms; debit memo emitted.",
          requirement_reference: "REQ-402"
        }
      ]
    }
  },
  {
    id: 'reviewer',
    number: 5,
    name: 'Test Reviewer',
    role: 'Independent critic with bounded self-correction retry loop',
    accent: BRAND,
    inputArtifact: 'draft_test_cases.json',
    outputArtifact: 'test_cases.json',
    guardrails: [
      'Validates against schemas/test-case.schema.json',
      'Checks for duplicate steps & duplicate IDs',
      'Auto-corrects syntax errors up to 2 retry attempts',
    ],
    summary: 'Acts as an independent critic (not the author). Runs strict 3-tier validation (syntax, JSON schema, and semantic business rules). Feeds failures back into a bounded correction loop.',
    sampleJson: {
      schema_valid: true,
      duplicate_rate: "0.0%",
      coverage_verified: true,
      total_cases: 12,
      critic_verdict: "Suite passes all structural and semantic quality gates."
    }
  },
  {
    id: 'evaluator',
    number: 6,
    name: 'Test Evaluator',
    role: 'Computes 5-dimension weighted RQS score & discovers gaps',
    accent: BLUE,
    inputArtifact: 'test_cases.json + requirement.md',
    outputArtifact: 'evaluation.json',
    guardrails: [
      'Weighted 5-dimension scoring (0-100 scale)',
      'Identifies unaddressed edge cases',
      'Emits structured actionable recommendations',
    ],
    summary: 'Evaluates the final suite across Coverage (30%), Completeness (25%), Traceability (20%), Correctness (15%), and Uniqueness (10%). Generates actionable gap recommendations for reprocess runs.',
    sampleJson: {
      overall: { score: 95.4, rating: "very_good", verdict: "Enterprise-ready with comprehensive edge coverage." },
      scores: [
        { id: "coverage", name: "Requirements Coverage", score: 98.0 },
        { id: "completeness", name: "Step Completeness", score: 94.5 },
        { id: "traceability", name: "Requirement Traceability", score: 100.0 },
        { id: "correctness", name: "Assertion Precision", score: 92.0 },
        { id: "uniqueness", name: "Test Case Uniqueness", score: 96.0 }
      ],
      gaps: []
    }
  },
  {
    id: 'gapcloser',
    number: 7,
    name: 'Gap Closer (Reprocess)',
    role: 'Amends suite in-place without restarting the pipeline',
    accent: BLUE,
    inputArtifact: 'evaluation.json + test_cases.json',
    outputArtifact: 'amended_suite.json',
    guardrails: [
      'Preserves previously verified passing tests',
      'Snapshots original suite before mutation',
      'Auto-rolls back if amended suite fails validation',
    ],
    summary: 'Triggered on Reprocess. Reads the evaluation gaps and amends the existing suite directly. Avoids costly and non-deterministic full regenerations.',
    isReprocessOnly: true,
    sampleJson: {
      amendment_type: "IN_PLACE_EXPANSION",
      preserved_count: 12,
      added_count: 2,
      resolved_gaps: ["Added rate-limit boundary test for 100 consecutive rapid wire requests"],
      snapshot_id: "snap-20260814-042"
    }
  }
];

export default function PipelineExplorer({ index }) {
    const [selectedId, setSelectedId] = useState('analyst');
    const [copied, setCopied] = useState(false);
    const [reprocessMode, setReprocessMode] = useState(false);

    const selectedStage = STAGES_DATA.find((stage) => stage.id === selectedId) || STAGES_DATA[0];

    const handleCopy = async () => {
        if (!(await copyToClipboard(JSON.stringify(selectedStage.sampleJson, null, 2)))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full">
            <SectionHeader
                index={index}
                eyebrow="Inside this custom UI"
                title="The six-agent chain"
                lede="Test Design is a workflow like any other. Click a stage to inspect the artifact it hands to the next agent."
                action={
                    <div className="flex">
                        <Button
                            variant={reprocessMode ? 'outlined' : 'contained'}
                            onClick={() => {
                                setReprocessMode(false);
                                if (selectedId === 'gapcloser') setSelectedId('analyst');
                            }}
                        >
                            Standard run
                        </Button>
                        <Button
                            variant={reprocessMode ? 'contained' : 'outlined'}
                            className="-ml-px"
                            onClick={() => {
                                setReprocessMode(true);
                                setSelectedId('gapcloser');
                            }}
                        >
                            <RotateCcw size={14} />
                            Reprocess loop
                        </Button>
                    </div>
                }
            />

            <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1.15fr]">
                {/* Node graph */}
                <Paper flat className="flex flex-col justify-between p-5 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <span className="text-[0.74rem] font-medium tracking-[0.05em] text-subtle">
                            CLICK ANY NODE TO INSPECT LIVE ARTIFACTS
                        </span>
                        <Chip
                            color={reprocessMode ? 'info' : 'default'}
                            className="text-[0.72rem] font-medium"
                        >
                            {reprocessMode ? 'Reprocess Mode Active' : 'Full Execution Chain'}
                        </Chip>
                    </div>

                    <div className="flex flex-col gap-3">
                        {STAGES_DATA.map((stage, position) => {
                            const isSelected = selectedId === stage.id;
                            // The gap closer only runs on a reprocess, so it recedes
                            // rather than disappearing — the chain still has seven
                            // stages, one of which is conditional.
                            const isDimmed = !reprocessMode && stage.isReprocessOnly;

                            return (
                                <React.Fragment key={stage.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(stage.id)}
                                        className={cx(
                                            'relative rounded-ubs border-[1.5px] p-3.5 text-left transition-all duration-200 hover:translate-x-[3px]',
                                            isDimmed && 'opacity-55',
                                        )}
                                        style={{
                                            borderColor: isSelected
                                                ? stage.accent
                                                : isDimmed
                                                  ? 'transparent'
                                                  : 'var(--col-border-illustrative)',
                                            backgroundColor: isSelected
                                                ? alpha(stage.accent, 0.04)
                                                : 'var(--col-background-ui-10)',
                                        }}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-3">
                                                <span
                                                    className="flex size-8 items-center justify-center rounded-ubs text-[0.82rem] font-medium"
                                                    style={{
                                                        backgroundColor: isSelected
                                                            ? stage.accent
                                                            : alpha(stage.accent, 0.15),
                                                        color: isSelected ? '#FFFFFF' : stage.accent,
                                                    }}
                                                >
                                                    {stage.id === 'approval' ? (
                                                        <UserCheck size={16} />
                                                    ) : stage.id === 'gapcloser' ? (
                                                        <RotateCcw size={16} />
                                                    ) : (
                                                        stage.number
                                                    )}
                                                </span>

                                                <span className="block">
                                                    <span
                                                        className={cx(
                                                            'flex items-center gap-2 text-[0.88rem] text-ink',
                                                            isSelected ? 'font-medium' : 'font-normal',
                                                        )}
                                                    >
                                                        {stage.name}
                                                        {stage.isReprocessOnly && (
                                                            <Chip
                                                                variant="outlined"
                                                                className="h-[18px] text-[0.65rem] font-medium"
                                                                style={{ color: BLUE, borderColor: BLUE }}
                                                            >
                                                                Loop
                                                            </Chip>
                                                        )}
                                                    </span>
                                                    <span className="block text-[0.74rem] text-subtle">
                                                        {stage.role}
                                                    </span>
                                                </span>
                                            </span>

                                            <span className="hidden text-right sm:block">
                                                <span
                                                    className="rounded-ubs bg-sunken px-2 py-1 font-mono text-[0.72rem] font-medium"
                                                    style={{
                                                        color: isSelected
                                                            ? stage.accent
                                                            : 'var(--col-text-subtle)',
                                                    }}
                                                >
                                                    → {stage.outputArtifact}
                                                </span>
                                            </span>
                                        </span>
                                    </button>

                                    {position < STAGES_DATA.length - 1 && position !== 5 && (
                                        <div className="flex h-2 items-center justify-center">
                                            <span className="h-2 w-0.5 bg-[color-mix(in_srgb,var(--col-text-primary)_15%,transparent)]" />
                                        </div>
                                    )}
                                    {position === 5 && (
                                        <div className="flex items-center justify-between px-4 py-1">
                                            <span className="text-[0.7rem] font-medium text-subtle">
                                                ↓ Final Verified Suite
                                            </span>
                                            <span
                                                className="text-[0.7rem] font-medium"
                                                style={{ color: alpha(BLUE, 0.9) }}
                                            >
                                                ↺ In-Place Reprocess Target
                                            </span>
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </Paper>

                {/* Artifact inspector */}
                <Paper
                    flat
                    className="relative flex flex-col justify-between overflow-hidden p-5 md:p-7"
                    style={{ borderColor: selectedStage.accent }}
                >
                    <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ backgroundColor: selectedStage.accent }}
                    />

                    <div>
                        <div className="mb-5 flex items-start justify-between gap-2">
                            <div>
                                <div className="mb-1 flex items-center gap-3">
                                    <Chip
                                        className="text-[0.7rem] font-medium"
                                        style={{
                                            backgroundColor: alpha(selectedStage.accent, 0.15),
                                            color: selectedStage.accent,
                                        }}
                                    >
                                        {`Agent Step ${selectedStage.number} of 7`}
                                    </Chip>
                                    <span className="ui-caption font-mono font-medium text-subtle">
                                        {selectedStage.outputArtifact}
                                    </span>
                                </div>
                                <h3 className="text-xl font-medium">{selectedStage.name}</h3>
                            </div>

                            <Tooltip title={copied ? 'Copied!' : 'Copy JSON payload'}>
                                <IconButton
                                    size="small"
                                    className="border border-hairline"
                                    aria-label="Copy JSON payload"
                                    onClick={handleCopy}
                                >
                                    {copied ? (
                                        <Check size={16} style={{ color: GREEN }} />
                                    ) : (
                                        <Copy size={16} />
                                    )}
                                </IconButton>
                            </Tooltip>
                        </div>

                        <p className="mb-5 text-[0.88rem] leading-relaxed text-subtle">
                            {selectedStage.summary}
                        </p>

                        <div className="mb-5">
                            <p className="mb-3 flex items-center gap-2 text-[0.85rem] font-medium">
                                <ShieldCheck size={17} style={{ color: selectedStage.accent }} />
                                Active Guardrails &amp; Verification Rules
                            </p>
                            <div className="flex flex-col gap-2">
                                {selectedStage.guardrails.map((rule) => (
                                    <div key={rule} className="flex items-center gap-3">
                                        <CheckCircle2 size={15} className="shrink-0" style={{ color: GREEN }} />
                                        <p className="text-[0.84rem] text-ink">{rule}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Terminal-framed artifact preview */}
                        <div>
                            <div className="flex items-center justify-between rounded-t-[10px] border border-b-0 border-[#5a5d5c] bg-[#2a2a2a] px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="size-2.5 rounded-full bg-[#E60000]" />
                                    <span className="size-2.5 rounded-full bg-[#e4a911]" />
                                    <span className="size-2.5 rounded-full bg-[#469a6c]" />
                                    <span className="ml-2 font-mono text-[0.72rem] font-medium text-[#b8b3a2]">
                                        {selectedStage.outputArtifact}
                                    </span>
                                </div>
                                <Chip
                                    variant="outlined"
                                    className="h-[18px] text-[0.62rem] font-medium"
                                    style={{ color: GREEN, borderColor: GREEN }}
                                >
                                    SCHEMA DRAFT-07 VALID
                                </Chip>
                            </div>

                            <div className="custom-scrollbar max-h-[220px] overflow-y-auto rounded-b-[10px] border border-[#5a5d5c] bg-[#2a2a2a] p-4 font-mono text-[0.78rem] leading-normal text-[#f9f9f7]">
                                <pre className="m-0">{JSON.stringify(selectedStage.sampleJson, null, 2)}</pre>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
                        <span className="text-[0.75rem] text-subtle">
                            Input: <strong>{selectedStage.inputArtifact}</strong>
                        </span>
                        <span
                            className="flex items-center gap-1 text-[0.78rem] font-medium"
                            style={{ color: selectedStage.accent }}
                        >
                            <span>Deterministic Transition</span>
                            <ArrowRight size={14} />
                        </span>
                    </div>
                </Paper>
            </div>
        </div>
    );
}
