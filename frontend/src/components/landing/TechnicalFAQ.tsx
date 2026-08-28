'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

const RED = '#D00000';

const FAQS = [
  {
    category: 'HALLUCINATION MITIGATION',
    q: 'How does Agent HUB Platform prevent AI hallucinations and ungrounded test cases?',
    a: 'Agent HUB Platform prevents hallucinations using a 3-layer architecture. First, the Requirement Analyst grounds all terms into an INVEST report. Second, the Test Designer constructs a deterministic 5-category coverage matrix before test writing begins. Third, the Test Reviewer acts as an independent critic with bounded retries, rejecting test cases that lack direct requirement traceability or reference invented parameters.',
  },
  {
    category: 'SCHEMA & RETRIES',
    q: 'What happens when an agent output fails JSON schema validation?',
    a: 'When an output fails schemas/test-case.schema.json, Layer 1 attempts automatic syntax repair and markdown sanitization. If the failure persists (e.g., missing required fields or unknown enum categories), the exact validation error is fed back to the Reviewer Agent for a targeted retry attempt (up to 2 attempts). If still invalid, the job terminates cleanly with an explicit error rather than propagating corrupted data.',
  },
  {
    category: 'HUMAN APPROVAL',
    q: 'How does the Human-in-the-Loop Approval Gate work in automated pipelines?',
    a: 'After the Requirement Analyst evaluates the 8 INVEST criteria, the job automatically transitions to AWAITING_APPROVAL. An operator or QA lead can inspect the INVEST ratings and either approve or reject with a recorded audit note. Rejections terminate the pipeline immediately, protecting downstream LLM token budgets.',
  },
  {
    category: 'NON-DESTRUCTIVE HEALING',
    q: 'Why is In-Place Gap Closing superior to re-running full suite generation?',
    a: 'Full re-generation is non-deterministic and frequently alters previously verified test cases, creating unexpected regression risks. In contrast, Agent HUB Platform’s Gap Closer inspects the evaluation gaps and amends the existing suite non-destructively. The original suite is snapshotted before modification and automatically restored if the amended suite fails verification.',
  },
  {
    category: 'SECURITY & SANDBOX',
    q: 'How is enterprise sensitive data and requirement text secured?',
    a: 'Requirement inputs are treated as untrusted markdown data. Agent execution is strictly sandboxed inside bounded directories with zero shell or system execution privileges. Intermediate artifacts are persisted as immutable JSON files for compliance and audit retention.',
  },
  {
    category: 'CI/CD & INTEGRATIONS',
    q: 'Can synthesized test cases be exported to Jira, Xray, or TestRail?',
    a: 'Yes. Because all test suites conform strictly to the Draft-07 JSON Schema (with unique IDs, steps, preconditions, categories, and priorities), the output artifacts can be directly exported to Jira Xray, TestRail, Zephyr, or automated Playwright/Cypress runner scripts via REST API.',
  },
];

export default function TechnicalFAQ() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [expanded, setExpanded] = useState<string | false>('faq-0');

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 760, mx: 'auto' }}>
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.75,
          py: 0.5,
          mb: 1.25,
          borderRadius: 4,
          bgcolor: alpha(RED, isLight ? 0.08 : 0.15),
          border: `1px solid ${alpha(RED, 0.25)}`,
        }}>
          <Sparkles size={14} color={RED} />
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.72rem' }}>
            FREQUENTLY ASKED QUESTIONS
          </Typography>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: '1.9rem', md: '2.45rem' }, letterSpacing: '-0.02em' }}>
          Technical Architecture & Guardrails
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
          Everything you need to know about deterministic multi-agent test engineering.
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 880, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {FAQS.map((faq, index) => {
          const panelId = `faq-${index}`;
          const isPanelExpanded = expanded === panelId;

          return (
            <Accordion
              key={faq.q}
              expanded={isPanelExpanded}
              onChange={handleChange(panelId)}
              elevation={0}
              sx={{
                borderRadius: '14px !important',
                border: '1px solid',
                borderColor: isPanelExpanded ? 'primary.main' : 'divider',
                bgcolor: 'background.paper',
                boxShadow: isPanelExpanded
                  ? (isLight ? `0 8px 24px ${alpha(RED, 0.08)}` : `0 8px 24px ${alpha(RED, 0.2)}`)
                  : 'none',
                '&:before': { display: 'none' },
                transition: 'all 0.2s ease',
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ChevronDown size={18} color={isPanelExpanded ? RED : theme.palette.text.secondary} />}
                sx={{
                  px: 3,
                  py: 1.5,
                  '& .MuiAccordionSummary-content': { my: 1 }
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Chip
                    label={faq.category}
                    size="small"
                    sx={{
                      height: 18,
                      alignSelf: 'flex-start',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      bgcolor: isPanelExpanded ? alpha(RED, 0.12) : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
                      color: isPanelExpanded ? RED : 'text.secondary',
                    }}
                  />
                  <Typography variant="subtitle1" sx={{
                    fontWeight: isPanelExpanded ? 800 : 700,
                    fontSize: '0.98rem',
                    color: isPanelExpanded ? 'primary.main' : 'text.primary',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    mt: 0.25,
                  }}>
                    <HelpCircle size={18} color={isPanelExpanded ? RED : theme.palette.text.secondary} style={{ flexShrink: 0 }} />
                    {faq.q}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, fontSize: '0.88rem' }}>
                  {faq.a}
                </Typography>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
}
