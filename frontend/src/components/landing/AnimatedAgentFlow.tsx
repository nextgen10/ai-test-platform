'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  alpha,
  useTheme,
  Button,
  Grid,
  Stack,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  FileText,
  FileJson,
  Layers,
  Sparkles,
  Bot,
  AlertTriangle,
  ArrowDown,
} from 'lucide-react';

const AMBER = '#D9822B';
const GREEN = '#1F8A70';
const RED = '#D00000';
const BLUE = '#2D6CDF';

export interface FlowNode {
  id: string;
  step: number | string;
  name: string;
  role: string;
  accent: string;
  kind: 'input' | 'agent' | 'gate' | 'output' | 'loop';
  artifactOut?: string;
  artifactDesc?: string;
  details: string;
}

const FLOW_NODES: FlowNode[] = [
  {
    id: 'input',
    step: '0',
    name: 'Requirement Input',
    role: 'Raw business requirement specification',
    accent: '#5B6472',
    kind: 'input',
    artifactOut: 'requirement.md',
    artifactDesc: 'Source requirement document',
    details: 'The user pastes or uploads a business requirement markdown file containing acceptance criteria and business rules.'
  },
  {
    id: 'analyst',
    step: '1',
    name: 'Requirement Analyst',
    role: 'Scores 8 INVEST quality criteria',
    accent: AMBER,
    kind: 'agent',
    artifactOut: 'quality_report.json',
    artifactDesc: 'INVEST ratings & ambiguities',
    details: 'Evaluates Independent, Negotiable, Valuable, Estimable, Small, Testable, Acceptance Criteria, and Unambiguous dimensions. Detects blocking issues before any tests are written.'
  },
  {
    id: 'approval',
    step: '2',
    name: 'Human Approval Gate',
    role: 'Quality gate: Hold in AWAITING_APPROVAL',
    accent: GREEN,
    kind: 'gate',
    artifactOut: 'approval_decision.json',
    artifactDesc: 'Operator authorization log',
    details: 'Execution pauses until an operator reviews the INVEST score. Rejecting terminates the run immediately with the reason recorded, saving tokens.'
  },
  {
    id: 'designer',
    step: '3',
    name: 'Test Designer',
    role: 'Constructs 5-category coverage matrix',
    accent: RED,
    kind: 'agent',
    artifactOut: 'test_design.json',
    artifactDesc: 'Coverage & category matrix',
    details: 'Maps business rules to 5 structured test categories: Functional, Negative, Boundary, Validation, and Data.'
  },
  {
    id: 'generator',
    step: '4',
    name: 'Test Generator',
    role: 'Synthesizes concrete executable test cases',
    accent: RED,
    kind: 'agent',
    artifactOut: 'draft_test_cases.json',
    artifactDesc: 'Draft test case specifications',
    details: 'Generates unambiguous test cases with required IDs, preconditions, actionable step sequences, and explicit expected results.'
  },
  {
    id: 'reviewer',
    step: '5',
    name: 'Test Reviewer',
    role: 'Independent critic with 3-tier validation & retries',
    accent: RED,
    kind: 'agent',
    artifactOut: 'test_cases.json',
    artifactDesc: 'Schema-validated test suite',
    details: 'Validates against test-case.schema.json. If validation fails, error feedback is passed back for up to 2 self-correction retry attempts.'
  },
  {
    id: 'evaluator',
    step: '6',
    name: 'Test Evaluator',
    role: 'Scores 5 weighted RQS dimensions',
    accent: BLUE,
    kind: 'agent',
    artifactOut: 'evaluation.json',
    artifactDesc: 'Quality scorecard & gaps',
    details: 'Independently assesses the generated suite on Coverage (30%), Completeness (25%), Traceability (20%), Correctness (15%), and Uniqueness (10%).'
  },
  {
    id: 'gapcloser',
    step: '↺',
    name: 'Gap Closer (Reprocess)',
    role: 'Amends suite in-place on reprocess',
    accent: BLUE,
    kind: 'loop',
    artifactOut: 'amended_suite.json',
    artifactDesc: 'Non-destructive delta amendment',
    details: 'When a reprocess is requested, only the Gap Closer runs. It snapshots the existing suite and patches uncovered gaps without wiping validated passing tests.'
  }
];

export default function AnimatedAgentFlow() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('analyst');

  // Auto-advance transaction packet animation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % FLOW_NODES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const activeNode = FLOW_NODES[activeStepIndex];
  const inspectedNode = FLOW_NODES.find((n) => n.id === selectedNodeId) || FLOW_NODES[1];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Header Controls */}
      <Box sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3
      }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em' }}>
            DETERMINISTIC RUN ARCHITECTURE
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.25 }}>
            Animated Agent Transaction Flow
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            size="small"
            label={isPlaying ? "Live Transaction Flow Active" : "Animation Paused"}
            sx={{
              fontWeight: 700,
              bgcolor: isPlaying ? alpha(GREEN, 0.12) : alpha(theme.palette.text.primary, 0.08),
              color: isPlaying ? GREEN : 'text.secondary',
              border: '1px solid',
              borderColor: isPlaying ? alpha(GREEN, 0.3) : 'divider',
            }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => setIsPlaying(!isPlaying)}
            startIcon={isPlaying ? <Pause size={14} /> : <Play size={14} />}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {isPlaying ? 'Pause' : 'Auto-Play'}
          </Button>
        </Box>
      </Box>

      {/* Main Flow Layout */}
      <Grid container spacing={3} alignItems="stretch">
        {/* Flow Visualizer Column */}
        <Grid size={{ xs: 12, lg: 7.5 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 3.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Stage Nodes Flow List with dynamic animated packet */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, position: 'relative' }}>
              {FLOW_NODES.map((node, index) => {
                const isActiveTransaction = activeStepIndex === index;
                const isSelected = selectedNodeId === node.id;
                const isLoopNode = node.kind === 'loop';

                return (
                  <React.Fragment key={node.id}>
                    <Box
                      component={motion.div}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => {
                        setSelectedNodeId(node.id);
                        setActiveStepIndex(index);
                      }}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: '1.5px solid',
                        borderColor: isSelected
                          ? node.accent
                          : (isActiveTransaction ? alpha(node.accent, 0.5) : 'divider'),
                        bgcolor: isSelected
                          ? alpha(node.accent, isLight ? 0.06 : 0.12)
                          : (isActiveTransaction ? alpha(node.accent, isLight ? 0.03 : 0.06) : 'background.paper'),
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        boxShadow: isActiveTransaction || isSelected
                          ? `0 4px 18px ${alpha(node.accent, 0.2)}`
                          : 'none',
                      }}
                    >
                      {/* Left Accent indicator */}
                      <Box sx={{
                        position: 'absolute',
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 4,
                        borderRadius: '0 4px 4px 0',
                        bgcolor: node.accent,
                        opacity: isSelected || isActiveTransaction ? 1 : 0.4
                      }} />

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 1 }}>
                          {/* Step Badge */}
                          <Box sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(node.accent, isActiveTransaction || isSelected ? 1 : 0.12),
                            color: isActiveTransaction || isSelected ? '#FFF' : node.accent,
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            boxShadow: isActiveTransaction ? `0 0 12px ${node.accent}` : 'none',
                            transition: 'all 0.3s ease'
                          }}>
                            {node.kind === 'gate' ? <UserCheck size={17} /> : node.step}
                          </Box>

                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
                                {node.name}
                              </Typography>
                              {node.kind === 'gate' && (
                                <Chip
                                  label="Human-in-the-Loop Gate"
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha(GREEN, 0.15), color: GREEN }}
                                />
                              )}
                              {isLoopNode && (
                                <Chip
                                  label="On Reprocess"
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha(BLUE, 0.15), color: BLUE }}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', display: 'block' }}>
                              {node.role}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Right Artifact Badge */}
                        {node.artifactOut && (
                          <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                px: 1,
                                py: 0.3,
                                borderRadius: 1,
                                bgcolor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                                color: isSelected || isActiveTransaction ? node.accent : 'text.secondary',
                                border: '1px solid',
                                borderColor: isSelected || isActiveTransaction ? alpha(node.accent, 0.3) : 'transparent',
                              }}
                            >
                              → {node.artifactOut}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Animated Edge connector */}
                    {index < FLOW_NODES.length - 1 && (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 12,
                        position: 'relative'
                      }}>
                        <Box sx={{ width: 2, height: 12, bgcolor: alpha(theme.palette.text.primary, 0.15) }} />
                        {isActiveTransaction && (
                          <motion.div
                            initial={{ y: -6, opacity: 0 }}
                            animate={{ y: 6, opacity: 1 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            style={{
                              position: 'absolute',
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: node.accent,
                              boxShadow: `0 0 8px ${node.accent}`
                            }}
                          />
                        )}
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* Selected Stage Detail & Artifact Card */}
        <Grid size={{ xs: 12, lg: 4.5 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 3.5 },
              borderRadius: 3.5,
              border: '1.5px solid',
              borderColor: inspectedNode.accent,
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Top Color Accent */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              bgcolor: inspectedNode.accent
            }} />

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Chip
                  label={inspectedNode.kind === 'gate' ? "APPROVAL GATE" : `AGENT STAGE ${inspectedNode.step}`}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    bgcolor: alpha(inspectedNode.accent, 0.15),
                    color: inspectedNode.accent
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Click any stage to inspect
                </Typography>
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {inspectedNode.name}
              </Typography>
              <Typography variant="subtitle2" sx={{ color: inspectedNode.accent, fontWeight: 600, mb: 2.5 }}>
                {inspectedNode.role}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3 }}>
                {inspectedNode.details}
              </Typography>

              {/* Output Artifact Info */}
              {inspectedNode.artifactOut && (
                <Box sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: isLight ? '#F5F7FA' : '#161B22',
                  border: '1px solid',
                  borderColor: 'divider',
                  mb: 3
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    HANDED-OFF ARTIFACT:
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'text.primary' }}>
                    {inspectedNode.artifactOut}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {inspectedNode.artifactDesc}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Key Execution Guarantees */}
            <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em', display: 'block', mb: 1 }}>
                GUARANTEED EXECUTION RULES:
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle2 size={15} color={GREEN} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    JSON Schema conformance strictly verified
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle2 size={15} color={GREEN} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Independent critic review with bounded retries
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle2 size={15} color={GREEN} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Deterministic audit trail for compliance
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
