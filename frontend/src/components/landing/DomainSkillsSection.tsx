'use client';

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  alpha,
  useTheme,
  Button,
} from '@mui/material';
import {
  Landmark,
  TrendingUp,
  KeyRound,
  FileText,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const RED = '#D00000';
const GREEN = '#1F8A70';
const AMBER = '#D9822B';
const BLUE = '#2D6CDF';

const DOMAINS = [
  {
    icon: <Landmark size={24} />,
    title: 'Payments & Settlement',
    accent: GREEN,
    standards: ['ISO 20022', 'SWIFT MT103/202', 'FedNow', 'SEPA Instant', 'RTGS'],
    description: 'Generates specialized test suites for multi-currency routing, ledger immutability, sanctions screening, and modulus-97 IBAN checksum validations.',
  },
  {
    icon: <TrendingUp size={24} />,
    title: 'Trading & Markets',
    accent: BLUE,
    standards: ['FIX 4.4 / 5.0', 'MiFID II RTS 25', 'Order Books', 'Tick Sizes', 'Position Limits'],
    description: 'Enforces sub-millisecond execution rules, TimeInForce (IOC/FOK/DAY) constraints, pre-trade credit checks, and algorithmic trade reconciliation.',
  },
  {
    icon: <KeyRound size={24} />,
    title: 'Security & Identity',
    accent: RED,
    standards: ['OAuth 2.0 PKCE', 'FIDO2 WebAuthn', 'SAML 2.0', 'Rotating Refresh Tokens', 'Zero Trust'],
    description: 'Tests cryptographic challenge-response handshakes, adaptive step-up authorization, session replay prevention, and brute-force lockout thresholds.',
  },
  {
    icon: <FileText size={24} />,
    title: 'Regulatory & Risk',
    accent: AMBER,
    standards: ['BCBS 239', 'Basel III / IV', 'OFAC / SDN', 'AML / KYC', 'SOX Compliance'],
    description: 'Validates automated risk aggregation, audit logging retention, dual-control approvals for high-value transactions, and compliance data lineage.',
  },
];

export default function DomainSkillsSection() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const router = useRouter();

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
        mb: 5
      }}>
        <Box sx={{ maxWidth: 640 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em' }}>
            ENTERPRISE DOMAIN INTELLIGENCE
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.5, mb: 1, fontSize: { xs: '1.85rem', md: '2.35rem' } }}>
            Pre-Trained Domain Skills
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
            The Qualaris agent chain integrates deep financial and regulatory protocols to synthesize tests with real-world institutional knowledge.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          onClick={() => router.push('/skills')}
          endIcon={<ArrowRight size={16} />}
          sx={{ fontWeight: 600, borderRadius: 2 }}
        >
          Explore All Domain Skills
        </Button>
      </Box>

      <Grid container spacing={3}>
        {DOMAINS.map((domain) => (
          <Grid key={domain.title} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease',
                '&:hover': {
                  borderColor: domain.accent,
                  transform: 'translateY(-3px)',
                  boxShadow: `0 8px 24px ${alpha(domain.accent, 0.12)}`
                }
              }}
            >
              <Box>
                <Box sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: domain.accent,
                  bgcolor: alpha(domain.accent, isLight ? 0.12 : 0.2),
                  mb: 2.5
                }}>
                  {domain.icon}
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25, fontSize: '1.1rem' }}>
                  {domain.title}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6, fontSize: '0.84rem' }}>
                  {domain.description}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                {domain.standards.map((std) => (
                  <Chip
                    key={std}
                    label={std}
                    size="small"
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                      color: 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
