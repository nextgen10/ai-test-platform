'use client';

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
} from '@mui/material';
import {
  Landmark,
  TrendingUp,
  KeyRound,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import SectionHeader from './SectionHeader';
import { CardHead, MetaTag } from './Tags';

const RED = '#e60000';
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
    description: 'Generates specialized test suites for multi-currency routing, ledger immutability, sanctions screening, and modulus-97 IBAN checksum validations.',
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'Trading & Markets',
    accent: BLUE,
    rulesCount: '60+ FIX Validation Checks',
    standards: ['FIX 4.4 / 5.0', 'MiFID II RTS 25', 'Order Books', 'Tick Sizes', 'Position Limits'],
    description: 'Enforces sub-millisecond execution rules, TimeInForce (IOC/FOK/DAY) constraints, pre-trade credit checks, and algorithmic trade reconciliation.',
  },
  {
    icon: <KeyRound size={22} />,
    title: 'Security & Identity',
    accent: RED,
    rulesCount: '35+ Zero-Trust Rules',
    standards: ['OAuth 2.0 PKCE', 'FIDO2 WebAuthn', 'SAML 2.0', 'Rotating Refresh Tokens', 'Zero Trust'],
    description: 'Tests cryptographic challenge-response handshakes, adaptive step-up authorization, session replay prevention, and brute-force lockout thresholds.',
  },
  {
    icon: <FileText size={22} />,
    title: 'Regulatory & Risk',
    accent: AMBER,
    rulesCount: '50+ Compliance Controls',
    standards: ['BCBS 239', 'Basel III / IV', 'OFAC / SDN', 'AML / KYC', 'SOX Compliance'],
    description: 'Validates automated risk aggregation, audit logging retention, dual-control approvals for high-value transactions, and compliance data lineage.',
  },
];

export default function DomainSkillsSection({ index = '06' }: { index?: string }) {
  const router = useRouter();

  return (
    <Box sx={{ width: '100%' }}>
      <SectionHeader
        index={index}
        eyebrow="Skills in the registry"
        title="Domain knowledge as files"
        lede="SKILL.md bundles travel with the workflow. Onboard another domain the same way you onboard an agent — no platform change."
        action={
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => router.push('/skills')}
            endIcon={<ArrowRight size={16} />}
          >
            Explore all domain skills
          </Button>
        }
      />

      <Grid container spacing={3}>
        {DOMAINS.map((domain) => (
          <Grid key={domain.title} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderTop: `2px solid ${domain.accent}`,
                bgcolor: 'background.paper',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: 'var(--col-background-ui-10-hovered)',
                }
              }}
            >
              <Box>
                <CardHead accent={domain.accent} icon={domain.icon} tag={domain.rulesCount} />

                <Typography variant="h6" sx={{ fontWeight: 500, mb: 1, fontSize: '1.1rem' }}>
                  {domain.title}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6, fontSize: '0.85rem' }}>
                  {domain.description}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                {domain.standards.map((std) => (
                  <MetaTag key={std}>{std}</MetaTag>
                ))}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
