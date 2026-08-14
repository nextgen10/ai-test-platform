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
  Collapse,
  IconButton,
  Grid,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Gauge,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const RED = '#D00000';
const GREEN = '#1F8A70';
const AMBER = '#D9822B';
const BLUE = '#2D6CDF';

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

export default function InteractiveSimulator() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const router = useRouter();

  const [activeScenarioId, setActiveScenarioId] = useState<string>('swift-wire');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(100);
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(5);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  const scenario = SCENARIO_PRESETS.find((s) => s.id === activeScenarioId) || SCENARIO_PRESETS[0];

  const agentSteps = [
    '1. Requirement Analyst (INVEST Scoring)',
    '2. Human Approval Gatekeeper',
    '3. Test Designer (Coverage Matrix)',
    '4. Test Generator (Concrete Specs)',
    '5. Test Reviewer (Schema Gate)',
    '6. Test Evaluator (5-D RQS Scoring)'
  ];

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimulationProgress(0);
    setActiveAgentIndex(0);

    const interval = setInterval(() => {
      setSimulationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSimulating(false);
          setActiveAgentIndex(5);
          return 100;
        }
        const next = prev + 20;
        setActiveAgentIndex(Math.min(5, Math.floor(next / 18)));
        return next;
      });
    }, 280);
  };

  const handleOpenInGenerator = () => {
    sessionStorage.setItem('benchmark_req', scenario.rawRequirement);
    router.push('/generate');
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
      case 'data': return '#8E44AD';
      default: return theme.palette.text.secondary;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 780, mx: 'auto' }}>
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.6,
          mb: 2,
          borderRadius: 4,
          bgcolor: (t) => t.palette.mode === 'light' ? '#FFE5E5' : 'rgba(208,0,0,0.12)',
          border: '1px solid',
          borderColor: (t) => t.palette.mode === 'light' ? 'rgba(208,0,0,0.2)' : 'rgba(208,0,0,0.3)',
        }}>
          <Sparkles size={16} color={RED} />
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.04em' }}>
            LIVE INTERACTIVE PLAYGROUND
          </Typography>
        </Box>

        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1.5, fontSize: { xs: '1.85rem', md: '2.4rem' } }}>
          Experience Autonomous Test Generation in 1 Click
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          Select an enterprise requirement scenario below. Watch the agent chain score INVEST criteria, construct the coverage matrix, and enforce strict 3-tier validation guardrails.
        </Typography>
      </Box>

      {/* Scenario selector tabs */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
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
                borderRadius: 2.5,
                px: 2.5,
                py: 1.2,
                fontWeight: 600,
                fontSize: '0.88rem',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'primary.main' : 'background.paper',
                color: isSelected ? '#fff' : 'text.primary',
                boxShadow: isSelected ? '0 4px 14px rgba(208,0,0,0.25)' : 'none',
                '&:hover': {
                  bgcolor: isSelected ? 'primary.dark' : alpha(theme.palette.text.primary, 0.05)
                }
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" sx={{
                  display: 'block',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  opacity: 0.85
                }}>
                  {preset.badge}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {preset.title}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>

      {/* Sandbox Container */}
      <Paper elevation={0} sx={{
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden'
      }}>
        {/* Top toolbar */}
        <Box sx={{
          p: { xs: 2, md: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => t.palette.mode === 'light' ? '#F9FBFC' : 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={scenario.category}
              size="small"
              sx={{ fontWeight: 700, bgcolor: alpha(RED, 0.12), color: RED }}
            />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
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
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              {isSimulating ? 'Simulating Agents...' : 'Re-Run Simulation'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleOpenInGenerator}
              endIcon={<ArrowRight size={14} />}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              Open in Live Generator
            </Button>
          </Box>
        </Box>

        {/* Live Simulation Progress Stepper Bar */}
        <Box sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => t.palette.mode === 'light' ? '#FFF' : 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Gauge size={14} color={isSimulating ? RED : GREEN} />
              {isSimulating ? `RUNNING: ${agentSteps[activeAgentIndex]}` : 'CHAIN COMPLETE: All 6 Agents Succeeded & Validated'}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              {simulationProgress}%
            </Typography>
          </Box>

          <Box sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
            overflow: 'hidden'
          }}>
            <Box sx={{
              height: '100%',
              width: `${simulationProgress}%`,
              bgcolor: isSimulating ? RED : GREEN,
              borderRadius: 3,
              transition: 'width 0.25s ease-in-out'
            }} />
          </Box>
        </Box>

        {/* Two-Column Simulation View: Input Spec vs Generated Test Suite */}
        <Grid container>
          {/* Left: Raw Requirement & INVEST scorecard */}
          <Grid size={{ xs: 12, lg: 5 }} sx={{ borderRight: { lg: '1px solid' }, borderColor: 'divider', p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em' }}>
              SOURCE REQUIREMENT SPECIFICATION
            </Typography>

            <Box sx={{
              mt: 1.5,
              mb: 3,
              p: 2.5,
              borderRadius: 2.5,
              bgcolor: (t) => t.palette.mode === 'light' ? '#F5F7FA' : '#161B22',
              border: '1px solid',
              borderColor: 'divider',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap'
            }}>
              {scenario.rawRequirement}
            </Box>

            {/* Quality Evaluation Summary */}
            <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em' }}>
              PRE-GENERATION INVEST GATE
            </Typography>

            <Box sx={{
              mt: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(GREEN, 0.08),
              border: '1px solid',
              borderColor: alpha(GREEN, 0.3),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CheckCircle2 size={16} color={GREEN} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: GREEN }}>
                    INVEST Score: {scenario.investScore.score} / 4.0
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>
                  {scenario.investScore.verdict}
                </Typography>
              </Box>
              <Chip
                label="PASS GATE"
                size="small"
                sx={{ fontWeight: 800, bgcolor: GREEN, color: '#FFF', fontSize: '0.7rem' }}
              />
            </Box>

            {/* RQS Score breakdown */}
            <Box sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(BLUE, 0.08),
              border: '1px solid',
              borderColor: alpha(BLUE, 0.3),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <FileCheck2 size={16} color={BLUE} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: BLUE }}>
                    RQS Evaluation: {scenario.rqsScore.score}% ({scenario.rqsScore.rating})
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>
                  Weighted scoring on Coverage, Completeness, Traceability, Correctness & Uniqueness.
                </Typography>
              </Box>
              <Chip
                label="VERIFIED"
                size="small"
                sx={{ fontWeight: 800, bgcolor: BLUE, color: '#FFF', fontSize: '0.7rem' }}
              />
            </Box>
          </Grid>

          {/* Right: Generated Validated Test Cases */}
          <Grid size={{ xs: 12, lg: 7 }} sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em' }}>
                  GENERATED TEST SUITE ({scenario.testCases.length} CASES)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Complies with <code style={{ color: RED }}>schemas/test-case.schema.json</code>
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
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: selectedCategoryFilter === cat ? (isLight ? '#1C1F24' : '#FFF') : 'transparent',
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

                return (
                  <Paper
                    key={tc.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: isExpanded ? catColor : 'divider',
                      bgcolor: isExpanded ? alpha(catColor, 0.04) : 'background.paper',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => setExpandedCaseId(isExpanded ? null : tc.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 800,
                            color: catColor,
                            bgcolor: alpha(catColor, 0.12),
                            px: 1,
                            py: 0.4,
                            borderRadius: 1,
                            fontSize: '0.75rem'
                          }}
                        >
                          {tc.id}
                        </Typography>

                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            {tc.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip
                              label={tc.category.toUpperCase()}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: alpha(catColor, 0.1),
                                color: catColor
                              }}
                            />
                            <Chip
                              label={tc.priority.toUpperCase()}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: tc.priority === 'critical' ? alpha(RED, 0.1) : alpha(AMBER, 0.1),
                                color: tc.priority === 'critical' ? RED : AMBER
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>

                      <IconButton size="small">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </IconButton>
                    </Box>

                    {/* Expandable test case body */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        {/* Preconditions */}
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                            PRECONDITIONS:
                          </Typography>
                          {tc.preconditions.map((p, i) => (
                            <Typography key={i} variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', pl: 1 }}>
                              • {p}
                            </Typography>
                          ))}
                        </Box>

                        {/* Steps */}
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
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
                          borderRadius: 1.5,
                          bgcolor: alpha(GREEN, 0.08),
                          border: '1px solid',
                          borderColor: alpha(GREEN, 0.25)
                        }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: GREEN, display: 'block', mb: 0.25 }}>
                            ASSERTION & EXPECTED RESULT:
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.primary' }}>
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
