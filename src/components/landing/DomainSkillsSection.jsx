import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, KeyRound, Landmark, TrendingUp } from 'lucide-react';

import { Button, Paper } from '../ui/primitives';
import SectionHeader from './SectionHeader';
import { CardHead, MetaTag } from './Tags';

const BRAND = '#E60000';
const GREEN = '#469a6c';
const AMBER = '#af8626';
const BLUE = '#00759e';

const DOMAINS = [
    {
        icon: <Landmark size={22} />,
        title: 'Payments & Settlement',
        accent: GREEN,
        rulesCount: '40+ Protocol Rules',
        standards: ['ISO 20022', 'SWIFT MT103/202', 'FedNow', 'SEPA Instant', 'RTGS'],
        description:
            'Generates specialized test suites for multi-currency routing, ledger immutability, sanctions screening, and modulus-97 IBAN checksum validations.',
    },
    {
        icon: <TrendingUp size={22} />,
        title: 'Trading & Markets',
        accent: BLUE,
        rulesCount: '60+ FIX Validation Checks',
        standards: ['FIX 4.4 / 5.0', 'MiFID II RTS 25', 'Order Books', 'Tick Sizes', 'Position Limits'],
        description:
            'Enforces sub-millisecond execution rules, TimeInForce (IOC/FOK/DAY) constraints, pre-trade credit checks, and algorithmic trade reconciliation.',
    },
    {
        icon: <KeyRound size={22} />,
        title: 'Security & Identity',
        accent: BRAND,
        rulesCount: '35+ Zero-Trust Rules',
        standards: ['OAuth 2.0 PKCE', 'FIDO2 WebAuthn', 'SAML 2.0', 'Rotating Refresh Tokens', 'Zero Trust'],
        description:
            'Tests cryptographic challenge-response handshakes, adaptive step-up authorization, session replay prevention, and brute-force lockout thresholds.',
    },
    {
        icon: <FileText size={22} />,
        title: 'Regulatory & Risk',
        accent: AMBER,
        rulesCount: '50+ Compliance Controls',
        standards: ['BCBS 239', 'Basel III / IV', 'OFAC / SDN', 'AML / KYC', 'SOX Compliance'],
        description:
            'Validates automated risk aggregation, audit logging retention, dual-control approvals for high-value transactions, and compliance data lineage.',
    },
];

export default function DomainSkillsSection({ index = '06' }) {
    const navigate = useNavigate();

    return (
        <div className="w-full">
            <SectionHeader
                index={index}
                eyebrow="Skills in the registry"
                title="Domain knowledge as files"
                lede="SKILL.md bundles travel with the workflow. Onboard another domain the same way you onboard an agent — no platform change."
                action={
                    <Button variant="outlined-neutral" onClick={() => navigate('/registry?tab=skills')}>
                        Explore all domain skills
                        <ArrowRight size={16} />
                    </Button>
                }
            />

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {DOMAINS.map((domain) => (
                    <Paper
                        key={domain.title}
                        flat
                        className="flex h-full flex-col justify-between border-t-2 p-6 transition-colors hover:bg-surface-hover"
                        style={{ borderTopColor: domain.accent }}
                    >
                        <div>
                            <CardHead accent={domain.accent} icon={domain.icon} tag={domain.rulesCount} />

                            <h3 className="mb-2 text-[1.1rem] font-medium">{domain.title}</h3>

                            <p className="mb-5 text-[0.85rem] leading-relaxed text-subtle">
                                {domain.description}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
                            {domain.standards.map((standard) => (
                                <MetaTag key={standard}>{standard}</MetaTag>
                            ))}
                        </div>
                    </Paper>
                ))}
            </div>
        </div>
    );
}
