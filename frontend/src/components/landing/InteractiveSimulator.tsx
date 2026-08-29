'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  alpha,
  useTheme,
  Collapse,
  IconButton,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Gauge,
  FileCheck2,
  Copy,
  Check,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import SectionHeader from './SectionHeader';
import { AccentTag } from './Tags';

const RED = '#e60000';
const GREEN = '#469a6c';
const AMBER = '#af8626';
const BLUE = '#00759e';

export interface ScenarioPreset {
  id: string;
  badge: string;
  title: string;
  category: string;
  rawRequirement: string;
  investScore: { score: number; verdict: string };
  rqsScore: { score: number; rating: string };
  testCases: Array<{
    id: string;
    title: string;
    category: 'functional' | 'negative' | 'boundary' | 'validation' | 'data';
    priority: 'critical' | 'high' | 'medium';
    preconditions: string[];
    steps: string[];
    expectedResult: string;
  }>;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'swift-wire',
    badge: 'BANKING & PAYMENTS',
    title: 'SWIFT MT103 Cross-Border Wire Transfer',
    category: 'Payments',
    rawRequirement: `REQ-SWIFT-101: High-Value Cross-Border Wire Transfer
The payments gateway must process SWIFT MT103 wire messages with real-time sanctions screening.
- Transfers exceeding $1,000,000.00 require Dual-Control authorization.
- Beneficiary IBAN and BIC must pass ISO 13616 modulus-97 validation before ledger debit.
- OFAC/Sanction hit must freeze transaction in PENDING_COMPLIANCE within 500ms.
- Currency exchange rate must be locked for exactly 120 seconds during checkout.
- Negative balances or overdraft limit breaches must reject the transaction immediately.`,
    investScore: { score: 3.9, verdict: 'Excellent INVEST testability. All numeric limits and compliance timings unambiguous.' },
    rqsScore: { score: 96.5, rating: 'Very Good' },
    testCases: [
      {
        id: 'TC-001',
        title: 'Execute valid SWIFT MT103 transfer with standard single-operator limit ($250,000 USD)',
        category: 'functional',
        priority: 'critical',
        preconditions: ['Origin account has balance >= $250,000.00', 'Beneficiary IBAN validated with valid BIC'],
        steps: [
          '1. Post MT103 wire transfer request of $250,000.00 USD to API /v2/payments/swift.',
          '2. Verify sanctions screening webhook returns CLEAN within 300ms.',
          '3. Trigger automated ledger debit and outbound RTGS dispatch.'
        ],
        expectedResult: 'HTTP 200 returned; transaction status moves to SETTLED; debit memo emitted with valid UETR.'
      },
      {
        id: 'TC-002',
        title: 'Enforce Dual-Control authorization on wire transfer strictly exceeding $1,000,000.00',
        category: 'boundary',
        priority: 'critical',
        preconditions: ['Corporate account balance $5,000,000.00', 'Primary operator logged in'],
        steps: [
          '1. Submit MT103 transfer of $1,000,000.01 USD.',
          '2. Attempt execution with single operator signature.'
        ],
        expectedResult: 'System halts execution, assigns state AWAITING_SECONDARY_APPROVAL, and emits compliance alert.'
      },
      {
        id: 'TC-003',
        title: 'Immediate transaction freeze on OFAC sanctions screening list positive match',
        category: 'negative',
        priority: 'critical',
        preconditions: ['Beneficiary entity is present on active OFAC Specially Designated Nationals (SDN) list'],
        steps: [
          '1. Submit payment request specifying designated sanctioned entity BIC/name.',
          '2. Monitor compliance screening engine callback.'
        ],
        expectedResult: 'Transaction immediately transitions to PENDING_COMPLIANCE in < 500ms; zero ledger funds deducted.'
      },
      {
        id: 'TC-004',
        title: 'Reject wire submission with invalid ISO 13616 IBAN checksum character',
        category: 'validation',
        priority: 'high',
        preconditions: ['User authenticated with valid API credentials'],
        steps: [
          '1. Send payload with IBAN "CH93 0000 0000 0000 0000 X" (invalid check digits).',
          '2. Verify client response code and error payload.'
        ],
        expectedResult: 'HTTP 422 Unprocessable Entity with error code ERR_IBAN_CHECKSUM_FAILED.'
      },
      {
        id: 'TC-005',
        title: 'Verify multi-currency settlement conversion across non-USD pairings (EUR to CHF)',
        category: 'data',
        priority: 'medium',
        preconditions: ['FX rate feed active', 'Locked FX rate window initialized (120s timer)'],
        steps: [
          '1. Request quotation for EUR 500,000 to CHF conversion at t = 0s.',
          '2. Execute settlement transaction at t = 115s.'
        ],
        expectedResult: 'Transaction completes using locked rate; no slippage applied; audit log records FX quote timestamp.'
      }
    ]
  },
  {
    id: 'oauth-mfa',
    badge: 'SECURITY & IAM',
    title: 'OAuth 2.0 PKCE & Adaptive Step-Up Auth',
    category: 'Security',
    rawRequirement: `REQ-AUTH-204: Zero-Trust Step-Up Authentication
The authentication service must enforce OAuth 2.0 Authorization Code flow with PKCE and adaptive risk-based MFA.
- PKCE code_challenge (S256) is mandatory on all client authorization requests.
- High-risk operations (e.g. payout modification, password change) must prompt FIDO2/WebAuthn step-up.
- Failed TOTP / FIDO2 verification must lock step-up session after 3 consecutive failures for 15 minutes.
- Expired access tokens (TTL > 900s) must be refreshed seamlessly using single-use rotating refresh tokens.`,
    investScore: { score: 3.85, verdict: 'High security clarity. Strict cryptographic assertions and lockout parameters.' },
    rqsScore: { score: 95.8, rating: 'Very Good' },
    testCases: [
      {
        id: 'TC-001',
        title: 'Authorize valid client with SHA256 PKCE Code Verifier transformation',
        category: 'functional',
        priority: 'critical',
        preconditions: ['Registered confidential client', 'User credentials validated'],
        steps: [
          '1. Generate 128-byte code_verifier and compute S256 code_challenge.',
          '2. Request authorization code with code_challenge and method=S256.',
          '3. Exchange authorization code with original code_verifier for JWT tokens.'
        ],
        expectedResult: 'HTTP 200 with valid ID token and Access Token (JWT format, 900s TTL).'
      },
      {
        id: 'TC-002',
        title: 'Reject token exchange when code_verifier does not match S256 challenge',
        category: 'negative',
        priority: 'critical',
        preconditions: ['Valid authorization code generated in step 1'],
        steps: [
          '1. Post token exchange payload with altered/tampered code_verifier.',
          '2. Inspect server error response.'
        ],
        expectedResult: 'HTTP 400 Bad Request with error invalid_grant; code revoked permanently.'
      },
      {
        id: 'TC-003',
        title: 'Lock step-up authentication session precisely on 3rd consecutive failed MFA attempt',
        category: 'boundary',
        priority: 'high',
        preconditions: ['High-risk action triggered (Payout Destination Update)'],
        steps: [
          '1. Submit invalid TOTP code 1st time -> Verify retry allowed.',
          '2. Submit invalid TOTP code 2nd time -> Verify retry allowed.',
          '3. Submit invalid TOTP code 3rd time -> Verify lockout trigger.'
        ],
        expectedResult: 'Session locked for 15 minutes; HTTP 423 Locked returned; security email notification dispatched.'
      },
      {
        id: 'TC-004',
        title: 'Validate single-use refresh token rotation and revoke compromised token chains',
        category: 'validation',
        priority: 'critical',
        preconditions: ['Active refresh token in user session'],
        steps: [
          '1. Refresh tokens using RefreshToken_A -> Receive RefreshToken_B.',
          '2. Attempt to replay expired RefreshToken_A.'
        ],
        expectedResult: 'Replay detected; both RefreshToken_A and RefreshToken_B revoked immediately.'
      }
    ]
  },
  {
    id: 'trading-order',
    badge: 'TRADING & FIX PROTOCOL',
    title: 'Algorithmic Equities Limit Order Matching',
    category: 'Trading',
    rawRequirement: `REQ-TRADE-305: FIX 4.4 Limit Order Execution Engine
The equities order management system must validate and match FIX 4.4 NewOrderSingle (MsgType=D) messages.
- Order price must respect tick size rules ($0.01 for stocks > $1.00, $0.0001 for sub-dollar).
- Limit order quantity cannot exceed the portfolio max position limit (100,000 shares per symbol).
- TimeInForce options (DAY, IOC, FOK) must be enforced with microsecond clock precision.
- Pre-trade credit check must confirm available purchasing power before order book injection.`,
    investScore: { score: 3.95, verdict: 'Clear exchange compliance constraints and microsecond settlement rules.' },
    rqsScore: { score: 97.1, rating: 'Very Good' },
    testCases: [
      {
        id: 'TC-001',
        title: 'Submit and match standard FIX 4.4 Limit Buy Order with DAY TimeInForce',
        category: 'functional',
        priority: 'critical',
        preconditions: ['Trader margin account active with $500,000 liquidity', 'FIX session established'],
        steps: [
          '1. Send NewOrderSingle (MsgType=D, ClOrdID=ORD-991, Symbol=UBS, Side=1, Price=28.50, Qty=5000, TimeInForce=0).',
          '2. Verify ExecutionReport (MsgType=8, OrdStatus=0 New) returned in < 15ms.'
        ],
        expectedResult: 'Order accepted into order book; margin reserved; execution report confirms order status New.'
      },
      {
        id: 'TC-002',
        title: 'Immediate cancellation of Fill-or-Kill (FOK) order when full quantity unavailable',
        category: 'negative',
        priority: 'high',
        preconditions: ['Order book depth for ticker UBS at 28.50 is 3,000 shares'],
        steps: [
          '1. Submit FOK limit buy order for 10,000 shares at 28.50.',
          '2. Inspect order book and execution response.'
        ],
        expectedResult: 'Order immediately canceled without partial fill; ExecutionReport OrdStatus=4 (Canceled).'
      },
      {
        id: 'TC-003',
        title: 'Enforce exact boundary limit at maximum allowable portfolio position (100,000 shares)',
        category: 'boundary',
        priority: 'critical',
        preconditions: ['Existing portfolio holding = 90,000 shares of ticker UBS'],
        steps: [
          '1. Submit buy order for 10,000 shares (Total = 100,000 -> allowable).',
          '2. Submit subsequent buy order for 1 additional share (Total = 100,001 -> violation).'
        ],
        expectedResult: 'First order accepts; second order rejects with OrdRejReason=MAX_POSITION_EXCEEDED.'
      }
    ]
  }
];

export default function InteractiveSimulator({ index }: { index?: string }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const router = useRouter();

  const [activeScenarioId, setActiveScenarioId] = useState<string>('swift-wire');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(100);
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(5);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [copiedCaseId, setCopiedCaseId] = useState<string | null>(null);
  const simulationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Both timers outlive the component if it unmounts mid-run (navigating away
  // while the simulation ticks), so tear them down explicitly.
  useEffect(
    () => () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );

  const scenario = SCENARIO_PRESETS.find((s) => s.id === activeScenarioId) || SCENARIO_PRESETS[0];

  const agentSteps = [
    '1. Requirement Analyst (INVEST Scoring)',
    '2. Human Approval Gatekeeper',
    '3. Test Designer (5-Category Matrix)',
    '4. Test Generator (Concrete Steps)',
    '5. Test Reviewer (Draft-07 Schema Gate)',
    '6. Test Evaluator (5-D RQS Scoring)'
  ];

  const handleRunSimulation = () => {
    if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    setIsSimulating(true);
    setSimulationProgress(0);
    setActiveAgentIndex(0);

    simulationTimerRef.current = setInterval(() => {
      setSimulationProgress((prev) => {
        if (prev >= 100) return 100;
        const next = prev + 20;
        setActiveAgentIndex(Math.min(5, Math.floor(next / 18)));
        if (next >= 100) {
          if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
          simulationTimerRef.current = null;
          setIsSimulating(false);
          setActiveAgentIndex(5);
        }
        return next;
      });
    }, 280);
  };

  const handleOpenInGenerator = () => {
    sessionStorage.setItem('benchmark_req', scenario.rawRequirement);
    router.push('/generate');
  };

  const handleCopyTestCase = async (
    tc: ScenarioPreset['testCases'][number],
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(tc, null, 2));
    } catch {
      // Insecure context, unfocused document, or denied permission — say
      // nothing rather than showing a "Copied!" tick for a copy that failed.
      return;
    }
    setCopiedCaseId(tc.id);
    // Reset the previous case's timer, or copying a second case within 2s
    // would clear the new tick early when the old timer fires.
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedCaseId(null), 2000);
  };

  const filteredCases = scenario.testCases.filter(
    (tc) => selectedCategoryFilter === 'all' || tc.category === selectedCategoryFilter
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'functional': return GREEN;
      case 'negative': return RED;
      case 'boundary': return AMBER;
      case 'validation': return BLUE;
      case 'data': return '#804c95';
      default: return theme.palette.text.secondary;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <SectionHeader
        index={index}
        eyebrow="This custom UI · playground"
        title="A sample Test Design run"
        lede="The same pipeline the Test Design surface runs — without submitting a job. Workflow Builder is a different Custom UI, with a different chain."
      />

      {/* Scenario selector tabs */}
      <Box sx={{
        display: 'flex',
        gap: 1.5,
        flexWrap: 'wrap',
        mb: 4
      }}>
        {SCENARIO_PRESETS.map((preset) => {
          const isSelected = preset.id === activeScenarioId;
          return (
            <Button
              key={preset.id}
              variant={isSelected ? "contained" : "outlined"}
              color="primary"
              onClick={() => {
                setActiveScenarioId(preset.id);
                setSelectedCategoryFilter('all');
                setExpandedCaseId(null);
              }}
              sx={{
                borderRadius: 2,
                px: 2.5,
                py: 1.2,
                fontWeight: 500,
                fontSize: '0.88rem',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'primary.main' : 'background.paper',
                color: isSelected ? '#fff' : 'text.primary',
                '&:hover': {
                  bgcolor: isSelected ? 'primary.dark' : alpha(theme.palette.text.primary, 0.05)
                }
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" sx={{
                  display: 'block',
                  fontSize: '0.66rem',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  opacity: 0.9
                }}>
                  {preset.badge}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {preset.title}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>

      {/* Sandbox Container */}
      <Paper elevation={0} sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        boxShadow: 'none',
      }}>
        {/* Top toolbar */}
        <Box sx={{
          p: { xs: 2, md: 2.5 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => t.palette.mode === 'light' ? '#f9f9f7' : 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={scenario.category}
              size="small"
              sx={{ fontWeight: 500, bgcolor: 'transparent', color: 'text.secondary', border: '1px solid', borderColor: 'divider', fontSize: '0.72rem' }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '1.05rem' }}>
              {scenario.title}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleRunSimulation}
              disabled={isSimulating}
              startIcon={<Play size={14} />}
              sx={{ fontWeight: 500, borderRadius: 2 }}
            >
              {isSimulating ? 'Simulating Agents...' : 'Re-Run Simulation'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleOpenInGenerator}
              endIcon={<ArrowRight size={14} />}
              sx={{ fontWeight: 500, borderRadius: 2 }}
            >
              Open in Live Generator
            </Button>
          </Box>
        </Box>

        {/* Live Simulation Progress Stepper Bar */}
        <Box sx={{
          px: 3,
          py: 1.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => t.palette.mode === 'light' ? '#FFF' : 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.76rem' }}>
              <Gauge size={14} color={isSimulating ? RED : GREEN} />
              {isSimulating ? `RUNNING: ${agentSteps[activeAgentIndex]}` : 'CHAIN COMPLETE: All 6 Agents Succeeded & Validated'}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.76rem' }}>
              {simulationProgress}%
            </Typography>
          </Box>

          <Box sx={{
            height: 6,
            borderRadius: 2,
            bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
            overflow: 'hidden'
          }}>
            <Box sx={{
              height: '100%',
              width: `${simulationProgress}%`,
              bgcolor: isSimulating ? RED : GREEN,
              borderRadius: 2,
              transition: 'width 0.25s ease-in-out'
            }} />
          </Box>
        </Box>

        {/* Two-Column Simulation View: Input Spec vs Generated Test Suite */}
        <Grid container>
          {/* Left: Raw Requirement & INVEST scorecard */}
          <Grid size={{ xs: 12, lg: 5 }} sx={{ borderRight: { lg: '1px solid' }, borderColor: 'divider', p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" sx={{ fontWeight: 500, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
              SOURCE REQUIREMENT SPECIFICATION
            </Typography>

            <Box sx={{
              mt: 1.5,
              mb: 3,
              p: 2,
              borderRadius: 2,
              bgcolor: (t) => t.palette.mode === 'light' ? '#f4f3ee' : '#2a2a2a',
              border: '1px solid',
              borderColor: 'divider',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap'
            }}>
              {scenario.rawRequirement}
            </Box>

            {/* Quality Evaluation Summary */}
            <Typography variant="overline" sx={{ fontWeight: 500, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
              PRE-GENERATION INVEST GATE
            </Typography>

            <Box sx={{
              mt: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              borderTop: `2px solid ${GREEN}`,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CheckCircle2 size={16} color={GREEN} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, color: GREEN, fontSize: '0.85rem' }}>
                    INVEST Score: {scenario.investScore.score} / 4.0
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.74rem' }}>
                  {scenario.investScore.verdict}
                </Typography>
              </Box>
              <Chip
                label="PASS GATE"
                size="small"
                sx={{ fontWeight: 500, bgcolor: 'transparent', color: GREEN, fontSize: '0.68rem', border: `1px solid ${GREEN}`, borderRadius: '2px' }}
              />
            </Box>

            {/* RQS Score breakdown */}
            <Box sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              borderTop: `2px solid ${BLUE}`,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <FileCheck2 size={16} color={BLUE} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, color: BLUE, fontSize: '0.85rem' }}>
                    RQS Evaluation: {scenario.rqsScore.score}% ({scenario.rqsScore.rating})
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.74rem' }}>
                  Weighted scoring on Coverage, Completeness, Traceability, Correctness & Uniqueness.
                </Typography>
              </Box>
              <Chip
                label="VERIFIED"
                size="small"
                sx={{ fontWeight: 500, bgcolor: 'transparent', color: BLUE, fontSize: '0.68rem', border: `1px solid ${BLUE}`, borderRadius: '2px' }}
              />
            </Box>
          </Grid>

          {/* Right: Generated Validated Test Cases */}
          <Grid size={{ xs: 12, lg: 7 }} sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 500, color: 'text.secondary', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                  GENERATED TEST SUITE ({scenario.testCases.length} CASES)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.74rem' }}>
                  Complies with <code style={{ color: RED, fontWeight: 500 }}>schemas/test-case.schema.json</code>
                </Typography>
              </Box>

              {/* Category filters */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {['all', 'functional', 'negative', 'boundary', 'validation', 'data'].map((cat) => (
                  <Chip
                    key={cat}
                    label={cat.toUpperCase()}
                    size="small"
                    clickable
                    onClick={() => setSelectedCategoryFilter(cat)}
                    sx={{
                      fontSize: '0.66rem',
                      fontWeight: 500,
                      bgcolor: selectedCategoryFilter === cat ? (isLight ? '#1c1c1c' : '#FFF') : 'transparent',
                      color: selectedCategoryFilter === cat ? (isLight ? '#FFF' : '#000') : 'text.secondary',
                      border: '1px solid',
                      borderColor: selectedCategoryFilter === cat ? 'transparent' : 'divider',
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Test case cards */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filteredCases.map((tc) => {
                const isExpanded = expandedCaseId === tc.id;
                const catColor = getCategoryColor(tc.category);
                const isCopied = copiedCaseId === tc.id;

                return (
                  <Paper
                    key={tc.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: isExpanded ? catColor : 'divider',
                      bgcolor: isExpanded ? 'var(--col-background-ui-20)' : 'background.paper',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: catColor,
                        bgcolor: isExpanded ? 'var(--col-background-ui-20)' : 'background.paper',
                      }
                    }}
                    onClick={() => setExpandedCaseId(isExpanded ? null : tc.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 500,
                            color: 'text.secondary',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderLeft: `2px solid ${catColor}`,
                            px: 1,
                            py: 0.4,
                            borderRadius: 2,
                            fontSize: '0.74rem'
                          }}
                        >
                          {tc.id}
                        </Typography>

                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.88rem' }}>
                            {tc.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <AccentTag accent={catColor} size="sm">
                              {tc.category.toUpperCase()}
                            </AccentTag>
                            <AccentTag accent={tc.priority === 'critical' ? RED : AMBER} size="sm">
                              {tc.priority.toUpperCase()}
                            </AccentTag>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={isCopied ? "Copied!" : "Copy Test Case"}>
                          <IconButton
                            size="small"
                            onClick={(e) => handleCopyTestCase(tc, e)}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                          >
                            {isCopied ? <Check size={14} color={GREEN} /> : <Copy size={14} />}
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Expandable test case body */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        {/* Preconditions */}
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '0.72rem' }}>
                            PRECONDITIONS:
                          </Typography>
                          {tc.preconditions.map((p, i) => (
                            <Typography key={i} variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', pl: 1 }}>
                              &bull; {p}
                            </Typography>
                          ))}
                        </Box>

                        {/* Steps */}
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '0.72rem' }}>
                            EXECUTION STEPS:
                          </Typography>
                          {tc.steps.map((s, i) => (
                            <Typography key={i} variant="body2" sx={{ fontSize: '0.82rem', fontFamily: 'ui-monospace, monospace', pl: 1, mb: 0.25 }}>
                              {s}
                            </Typography>
                          ))}
                        </Box>

                        {/* Expected result */}
                        <Box sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: 'background.paper',
              borderTop: `2px solid ${GREEN}`,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}>
                          <Typography variant="caption" sx={{ fontWeight: 500, color: GREEN, display: 'block', mb: 0.25, fontSize: '0.72rem' }}>
                            ASSERTION & EXPECTED RESULT:
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.primary', fontWeight: 500 }}>
                            {tc.expectedResult}
                          </Typography>
                        </Box>
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
