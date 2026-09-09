import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, FileCheck2, Gauge, Play,
} from 'lucide-react';

import { copyToClipboard } from '@/lib/clipboard';
import { cx } from '../ui/cx';
import { Button, Chip, IconButton, Paper, Tooltip } from '../ui/primitives';
import SectionHeader from './SectionHeader';
import { AccentTag } from './Tags';

const BRAND = '#E60000';
const GREEN = '#469a6c';
const AMBER = '#af8626';
const BLUE = '#00759e';

const CATEGORY_FILTERS = ['all', 'functional', 'negative', 'boundary', 'validation', 'data'];

const AGENT_STEPS = [
    '1. Requirement Analyst (INVEST Scoring)',
    '2. Human Approval Gatekeeper',
    '3. Test Designer (5-Category Matrix)',
    '4. Test Generator (Concrete Steps)',
    '5. Test Reviewer (Draft-07 Schema Gate)',
    '6. Test Evaluator (5-D RQS Scoring)',
];

const OVERLINE = 'ui-overline text-[0.72rem] tracking-[0.06em] text-subtle';

const SCENARIO_PRESETS = [
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

export default function InteractiveSimulator({ index }) {
    const navigate = useNavigate();

    const [activeScenarioId, setActiveScenarioId] = useState('swift-wire');
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationProgress, setSimulationProgress] = useState(100);
    const [activeAgentIndex, setActiveAgentIndex] = useState(5);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [expandedCaseId, setExpandedCaseId] = useState(null);
    const [copiedCaseId, setCopiedCaseId] = useState(null);
    const simulationTimerRef = useRef(null);
    const copyTimerRef = useRef(null);

    // Both timers outlive the component if it unmounts mid-run (navigating away
    // while the simulation ticks), so tear them down explicitly.
    useEffect(
        () => () => {
            if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        },
        [],
    );

    const scenario = SCENARIO_PRESETS.find((preset) => preset.id === activeScenarioId) || SCENARIO_PRESETS[0];

    const handleRunSimulation = () => {
        if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
        setIsSimulating(true);
        setSimulationProgress(0);
        setActiveAgentIndex(0);

        simulationTimerRef.current = setInterval(() => {
            setSimulationProgress((previous) => {
                if (previous >= 100) return 100;
                const next = previous + 20;
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
        navigate('/generate');
    };

    const handleCopyTestCase = async (testCase, event) => {
        event.stopPropagation();
        // Insecure context, unfocused document, or denied permission — say
        // nothing rather than showing a "Copied!" tick for a copy that failed.
        if (!(await copyToClipboard(JSON.stringify(testCase, null, 2)))) return;

        setCopiedCaseId(testCase.id);
        // Reset the previous case's timer, or copying a second case within 2s
        // would clear the new tick early when the old timer fires.
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedCaseId(null), 2000);
    };

    const filteredCases = scenario.testCases.filter(
        (testCase) => selectedCategoryFilter === 'all' || testCase.category === selectedCategoryFilter,
    );

    const getCategoryColor = (category) => {
        switch (category) {
            case 'functional': return GREEN;
            case 'negative': return BRAND;
            case 'boundary': return AMBER;
            case 'validation': return BLUE;
            case 'data': return '#804c95';
            default: return 'var(--col-text-subtle)';
        }
    };

    return (
        <div className="w-full">
            <SectionHeader
                index={index}
                eyebrow="This custom UI · playground"
                title="A sample Test Design run"
                lede="The same pipeline the Test Design surface runs — without submitting a job. Workflow Builder is a different Custom UI, with a different chain."
            />

            {/* Scenario selector */}
            <div className="mb-8 flex flex-wrap gap-3">
                {SCENARIO_PRESETS.map((preset) => {
                    const isSelected = preset.id === activeScenarioId;
                    return (
                        <Button
                            key={preset.id}
                            variant={isSelected ? 'contained' : 'outlined'}
                            className="px-5 py-2.5 text-left"
                            onClick={() => {
                                setActiveScenarioId(preset.id);
                                setSelectedCategoryFilter('all');
                                setExpandedCaseId(null);
                            }}
                        >
                            <span className="block text-left">
                                <span className="block text-[0.66rem] font-medium tracking-[0.04em] opacity-90">
                                    {preset.badge}
                                </span>
                                <span className="block text-[0.875rem] font-medium">{preset.title}</span>
                            </span>
                        </Button>
                    );
                })}
            </div>

            <Paper flat className="overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline bg-elevated p-4 md:p-5">
                    <div className="flex items-center gap-3">
                        <Chip variant="outlined" className="text-[0.72rem] font-medium text-subtle">
                            {scenario.category}
                        </Chip>
                        <p className="text-[1.05rem] font-medium">{scenario.title}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleRunSimulation}
                            disabled={isSimulating}
                        >
                            <Play size={14} />
                            {isSimulating ? 'Simulating agents…' : 'Re-run simulation'}
                        </Button>
                        <Button variant="contained" size="small" onClick={handleOpenInGenerator}>
                            Open in Live Generator
                            <ArrowRight size={14} />
                        </Button>
                    </div>
                </div>

                {/* Progress */}
                <div className="border-b border-hairline bg-surface px-6 py-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[0.76rem] font-medium text-subtle">
                            <Gauge size={14} style={{ color: isSimulating ? BRAND : GREEN }} />
                            {isSimulating
                                ? `RUNNING: ${AGENT_STEPS[activeAgentIndex]}`
                                : 'CHAIN COMPLETE: All 6 Agents Succeeded & Validated'}
                        </span>
                        <span className="text-[0.76rem] font-medium text-subtle">{simulationProgress}%</span>
                    </div>

                    <div className="h-1.5 overflow-hidden bg-[color-mix(in_srgb,var(--col-text-primary)_6%,transparent)]">
                        <div
                            className="h-full transition-[width] duration-[250ms] ease-in-out"
                            style={{
                                width: `${simulationProgress}%`,
                                backgroundColor: isSimulating ? BRAND : GREEN,
                            }}
                        />
                    </div>
                </div>

                <div className="grid lg:grid-cols-12">
                    {/* Source requirement + gates */}
                    <div className="border-hairline p-5 md:p-6 lg:col-span-5 lg:border-r">
                        <span className={OVERLINE}>SOURCE REQUIREMENT SPECIFICATION</span>

                        <div className="mb-6 mt-3 whitespace-pre-wrap rounded-ubs border border-hairline bg-sunken p-4 font-mono text-[0.8rem] leading-relaxed">
                            {scenario.rawRequirement}
                        </div>

                        <span className={OVERLINE}>PRE-GENERATION INVEST GATE</span>

                        <div
                            className="mt-3 flex items-center justify-between gap-4 rounded-ubs border border-hairline bg-surface p-4"
                            style={{ borderTop: `2px solid ${GREEN}` }}
                        >
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <CheckCircle2 size={16} style={{ color: GREEN }} />
                                    <p className="text-[0.85rem] font-medium" style={{ color: GREEN }}>
                                        INVEST Score: {scenario.investScore.score} / 4.0
                                    </p>
                                </div>
                                <p className="block text-[0.74rem] text-subtle">{scenario.investScore.verdict}</p>
                            </div>
                            <Chip
                                variant="outlined"
                                className="text-[0.68rem] font-medium"
                                style={{ color: GREEN, borderColor: GREEN }}
                            >
                                PASS GATE
                            </Chip>
                        </div>

                        <div
                            className="mt-4 flex items-center justify-between gap-4 rounded-ubs border border-hairline bg-surface p-4"
                            style={{ borderTop: `2px solid ${BLUE}` }}
                        >
                            <div>
                                <div className="mb-1 flex items-center gap-2">
                                    <FileCheck2 size={16} style={{ color: BLUE }} />
                                    <p className="text-[0.85rem] font-medium" style={{ color: BLUE }}>
                                        RQS Evaluation: {scenario.rqsScore.score}% ({scenario.rqsScore.rating})
                                    </p>
                                </div>
                                <p className="block text-[0.74rem] text-subtle">
                                    Weighted scoring on Coverage, Completeness, Traceability, Correctness &amp;
                                    Uniqueness.
                                </p>
                            </div>
                            <Chip
                                variant="outlined"
                                className="text-[0.68rem] font-medium"
                                style={{ color: BLUE, borderColor: BLUE }}
                            >
                                VERIFIED
                            </Chip>
                        </div>
                    </div>

                    {/* Generated suite */}
                    <div className="p-5 md:p-6 lg:col-span-7">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <span className={OVERLINE}>
                                    GENERATED TEST SUITE ({scenario.testCases.length} CASES)
                                </span>
                                <p className="block text-[0.74rem] text-subtle">
                                    Complies with{' '}
                                    <code className="font-medium" style={{ color: BRAND }}>
                                        schemas/test-case.schema.json
                                    </code>
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_FILTERS.map((category) => (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => setSelectedCategoryFilter(category)}
                                        className={cx(
                                            'ui-chip text-[0.66rem] font-medium',
                                            selectedCategoryFilter === category
                                                ? 'bg-contrast text-inverted'
                                                : 'ui-chip-outlined text-subtle',
                                        )}
                                    >
                                        {category.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {filteredCases.map((testCase) => {
                                const isExpanded = expandedCaseId === testCase.id;
                                const categoryColor = getCategoryColor(testCase.category);
                                const isCopied = copiedCaseId === testCase.id;

                                return (
                                    <Paper
                                        key={testCase.id}
                                        flat
                                        className={cx(
                                            'cursor-pointer p-4 transition-all duration-200',
                                            isExpanded && 'bg-elevated',
                                        )}
                                        style={isExpanded ? { borderColor: categoryColor } : undefined}
                                        onClick={() => setExpandedCaseId(isExpanded ? null : testCase.id)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <span
                                                    className="rounded-ubs border border-hairline px-2 py-1 font-mono text-[0.74rem] font-medium text-subtle"
                                                    style={{ borderLeft: `2px solid ${categoryColor}` }}
                                                >
                                                    {testCase.id}
                                                </span>

                                                <div>
                                                    <p className="text-[0.88rem] font-medium">{testCase.title}</p>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <AccentTag accent={categoryColor} size="sm">
                                                            {testCase.category.toUpperCase()}
                                                        </AccentTag>
                                                        <AccentTag
                                                            accent={testCase.priority === 'critical' ? BRAND : AMBER}
                                                            size="sm"
                                                        >
                                                            {testCase.priority.toUpperCase()}
                                                        </AccentTag>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Tooltip title={isCopied ? 'Copied!' : 'Copy test case'}>
                                                    <IconButton
                                                        size="small"
                                                        className="border border-hairline"
                                                        aria-label={`Copy ${testCase.id}`}
                                                        onClick={(event) => handleCopyTestCase(testCase, event)}
                                                    >
                                                        {isCopied ? (
                                                            <Check size={14} style={{ color: GREEN }} />
                                                        ) : (
                                                            <Copy size={14} />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                                <IconButton size="small" aria-hidden tabIndex={-1}>
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </IconButton>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-4 border-t border-hairline pt-4">
                                                <div className="mb-3">
                                                    <span className="mb-1 block text-[0.72rem] font-medium text-subtle">
                                                        PRECONDITIONS:
                                                    </span>
                                                    {testCase.preconditions.map((precondition, position) => (
                                                        <p key={position} className="pl-2 text-[0.8rem] text-subtle">
                                                            • {precondition}
                                                        </p>
                                                    ))}
                                                </div>

                                                <div className="mb-3">
                                                    <span className="mb-1 block text-[0.72rem] font-medium text-subtle">
                                                        EXECUTION STEPS:
                                                    </span>
                                                    {testCase.steps.map((step, position) => (
                                                        <p
                                                            key={position}
                                                            className="mb-0.5 pl-2 font-mono text-[0.82rem]"
                                                        >
                                                            {step}
                                                        </p>
                                                    ))}
                                                </div>

                                                <div
                                                    className="rounded-ubs border border-hairline bg-surface p-3"
                                                    style={{ borderTop: `2px solid ${GREEN}` }}
                                                >
                                                    <span
                                                        className="mb-1 block text-[0.72rem] font-medium"
                                                        style={{ color: GREEN }}
                                                    >
                                                        ASSERTION &amp; EXPECTED RESULT:
                                                    </span>
                                                    <p className="text-[0.82rem] font-medium text-ink">
                                                        {testCase.expectedResult}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </Paper>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Paper>
        </div>
    );
}
