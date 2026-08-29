'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import SectionHeader from './SectionHeader';
import { AccentTag } from './Tags';

const AMBER = '#af8626';
const GREEN = '#469a6c';
const RED = '#e60000';
const BLUE = '#00759e';

export interface StageInfo {
  id: string;
  number: number;
  name: string;
  role: string;
  accent: string;
  outputArtifact: string;
  inputArtifact: string;
  guardrails: string[];
  summary: string;
  sampleJson: Record<string, unknown>;
  isReprocessOnly?: boolean;
}

export const STAGES_DATA: StageInfo[] = [
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
    accent: RED,
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
    accent: RED,
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
    accent: RED,
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

export default function PipelineExplorer({ index }: { index?: string }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [selectedId, setSelectedId] = useState<string>('analyst');
  const [copied, setCopied] = useState(false);
  const [reprocessMode, setReprocessMode] = useState(false);

  const selectedStage = STAGES_DATA.find((s) => s.id === selectedId) || STAGES_DATA[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedStage.sampleJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top control bar */}
      <SectionHeader
        index={index}
        eyebrow="Inside this custom UI"
        title="The six-agent chain"
        lede="Test Design is a workflow like any other. Click a stage to inspect the artifact it hands to the next agent."
        action={
          <Box sx={{ display: 'flex' }}>
            <Button
              variant={!reprocessMode ? 'contained' : 'outlined'}
              color={!reprocessMode ? 'primary' : 'inherit'}
              onClick={() => {
                setReprocessMode(false);
                if (selectedId === 'gapcloser') setSelectedId('analyst');
              }}
              sx={{ borderRadius: '2px 0 0 2px' }}
            >
              Standard run
            </Button>
            <Button
              variant={reprocessMode ? 'contained' : 'outlined'}
              color={reprocessMode ? 'primary' : 'inherit'}
              onClick={() => {
                setReprocessMode(true);
                setSelectedId('gapcloser');
              }}
              startIcon={<RotateCcw size={14} />}
              sx={{ borderRadius: '0 2px 2px 0', ml: '-1px' }}
            >
              Reprocess loop
            </Button>
          </Box>
        }
      />

      {/* Main interactive split view */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1.15fr' },
        gap: 3,
        alignItems: 'stretch'
      }}>
        {/* Left column: Pipeline visual node graph */}
        <Paper elevation={0} sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'none',
        }}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: '0.05em', fontSize: '0.74rem' }}>
              CLICK ANY NODE TO INSPECT LIVE ARTIFACTS
            </Typography>
            <Chip
              size="small"
              label={reprocessMode ? "Reprocess Mode Active" : "Full Execution Chain"}
              color={reprocessMode ? "info" : "default"}
              sx={{ fontWeight: 500, fontSize: '0.72rem' }}
            />
          </Box>

          {/* Node items */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {STAGES_DATA.map((stage, idx) => {
              const isSelected = selectedId === stage.id;
              const isReprocess = stage.isReprocessOnly;
              const isDimmed = !reprocessMode && isReprocess;

              return (
                <React.Fragment key={stage.id}>
                  <Box
                    component={motion.div}
                    whileHover={{ scale: 1.01, x: 3 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedId(stage.id)}
                    sx={{
                      p: 1.75,
                      borderRadius: 2,
                      border: '1.5px solid',
                      borderColor: isSelected ? stage.accent : (isDimmed ? 'transparent' : 'divider'),
                      bgcolor: isSelected ? alpha(stage.accent, 0.04) : 'background.paper',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      opacity: isDimmed ? 0.55 : 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {/* Step icon / badge */}
                        <Box sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(stage.accent, isSelected ? 1 : 0.15),
                          color: isSelected ? '#FFFFFF' : stage.accent,
                          fontWeight: 500,
                          fontSize: '0.82rem'
                        }}>
                          {stage.id === 'approval' ? (
                            <UserCheck size={16} />
                          ) : stage.id === 'gapcloser' ? (
                            <RotateCcw size={16} />
                          ) : (
                            stage.number
                          )}
                        </Box>

                        {/* Title & summary */}
                        <Box>
                          <Typography variant="subtitle2" sx={{
                            fontWeight: isSelected ? 500 : 400,
                            color: isSelected ? (isLight ? 'text.primary' : '#fff') : 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            fontSize: '0.88rem'
                          }}>
                            {stage.name}
                            {stage.isReprocessOnly && (
                              <Chip
                                label="Loop"
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'transparent', color: BLUE, fontWeight: 500, border: `1px solid ${BLUE}` }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.74rem' }}>
                            {stage.role}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Right edge tag */}
                      <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.72rem',
                            color: isSelected ? stage.accent : 'text.secondary',
                            fontWeight: 500,
                            bgcolor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                            px: 1,
                            py: 0.35,
                            borderRadius: 2
                          }}
                        >
                          → {stage.outputArtifact}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Connecting edge */}
                  {idx < STAGES_DATA.length - 1 && idx !== 5 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 8 }}>
                      <Box sx={{ width: 2, height: 8, bgcolor: alpha(theme.palette.text.primary, 0.15) }} />
                    </Box>
                  )}
                  {idx === 5 && (
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 0.5
                    }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 500 }}>
                        ↓ Final Verified Suite
                      </Typography>
                      <Typography variant="caption" sx={{ color: alpha(BLUE, 0.9), fontSize: '0.7rem', fontWeight: 500 }}>
                        ↺ In-Place Reprocess Target
                      </Typography>
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
          </Box>
        </Paper>

        {/* Right column: Live Artifact Inspector & Guardrail Details */}
        <Paper elevation={0} sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: selectedStage.accent,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'none',
        }}>
          {/* Top accent banner */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            bgcolor: selectedStage.accent
          }} />

          <Box>
            {/* Header info */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Chip
                    label={`Agent Step ${selectedStage.number} of 7`}
                    size="small"
                    sx={{
                      fontWeight: 500,
                      fontSize: '0.7rem',
                      bgcolor: alpha(selectedStage.accent, 0.15),
                      color: selectedStage.accent
                    }}
                  />
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace', color: 'text.secondary', fontWeight: 500 }}>
                    {selectedStage.outputArtifact}
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 500 }}>
                  {selectedStage.name}
                </Typography>
              </Box>

              <Tooltip title={copied ? "Copied!" : "Copy JSON Payload"}>
                <IconButton onClick={handleCopy} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  {copied ? <Check size={16} color={GREEN} /> : <Copy size={16} />}
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65, fontSize: '0.88rem' }}>
              {selectedStage.summary}
            </Typography>

            {/* Guardrails check */}
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1.25, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.85rem' }}>
                <ShieldCheck size={17} color={selectedStage.accent} />
                Active Guardrails & Verification Rules
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {selectedStage.guardrails.map((rule) => (
                  <Box key={rule} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <CheckCircle2 size={15} color={GREEN} style={{ flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.84rem', color: 'text.primary' }}>{rule}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Live Schema Output Preview with Terminal Bar */}
            <Box>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1,
                bgcolor: (t) => t.palette.mode === 'light' ? '#2a2a2a' : '#1c1c1c',
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                border: '1px solid',
                borderColor: (t) => t.palette.mode === 'light' ? '#5a5d5c' : '#1c1c1c',
                borderBottom: 'none',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#da0000' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e4a911' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#469a6c' }} />
                  <Typography variant="caption" sx={{ ml: 1, fontWeight: 500, color: '#b8b3a2', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                    {selectedStage.outputArtifact}
                  </Typography>
                </Box>
                <Chip
                  label="SCHEMA DRAFT-07 VALID"
                  size="small"
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 500, bgcolor: 'transparent', color: GREEN, border: `1px solid ${GREEN}` }}
                />
              </Box>

              <Box sx={{
                p: 2,
                borderBottomLeftRadius: 10,
                borderBottomRightRadius: 10,
                bgcolor: (t) => t.palette.mode === 'light' ? '#2a2a2a' : '#1c1c1c',
                color: '#f9f9f7',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: (t) => t.palette.mode === 'light' ? '#5a5d5c' : '#1c1c1c',
              }}>
                <pre style={{ margin: 0 }}>
                  {JSON.stringify(selectedStage.sampleJson, null, 2)}
                </pre>
              </Box>
            </Box>
          </Box>

          {/* Bottom artifact pipeline link */}
          <Box sx={{
            mt: 3,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Input: <strong>{selectedStage.inputArtifact}</strong>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: selectedStage.accent, fontWeight: 500, fontSize: '0.78rem' }}>
              <span>Deterministic Transition</span>
              <ArrowRight size={14} />
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
