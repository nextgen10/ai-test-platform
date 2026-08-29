'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { AccentTag } from './Tags';

const RED = '#e60000';

const FAQS = [
  {
    category: 'WHAT THIS IS',
    q: 'Is Agent HUB a test-generation product?',
    a: 'No. Agent HUB is a multi-agent control plane: a registry, an Agent Console, optional Custom UIs, and a job record. Test Design & Evaluation is one workflow installed on that plane, with a dedicated UI — the same pattern as Workflow Builder. Adding another use case is a file, not a new product.',
  },
  {
    category: 'CUSTOM UI',
    q: 'When do I use a Custom UI instead of the Agent Console?',
    a: 'Use the Agent Console for any onboarded workflow. Open a Custom UI only when the job needs a purpose-built surface — for example the Test Design pipeline (INVEST gate, coverage matrix, Excel export) or the Workflow Builder installer. Both surfaces still create Hub jobs and write the same artifacts.',
  },
  {
    category: 'ONBOARDING',
    q: 'How do I add a new agent or workflow?',
    a: 'Put a .agent.md, .workflow.yaml, SKILL.md, or .prompt.md in the registry. To have a dedicated page, set has_custom_ui and custom_ui_route on the workflow — it then appears under Use Cases, not as a new top-level product. Workflow Builder can design and write those files for you, then install them live.',
  },
  {
    category: 'EXECUTION',
    q: 'How is a run isolated?',
    a: 'One request is one job. The runner executes in a sandboxed workspace with no shell access and a bounded filesystem. A crashed job takes nothing else down with it. State lives in the database, not in the UI.',
  },
  {
    category: 'EVIDENCE',
    q: 'Where is the audit trail?',
    a: 'Every transition appends a job event. Intermediate artifacts are persisted as versioned JSON (or Markdown) files. Human approval decisions are recorded on the job. Nothing that matters lives only in a chat transcript.',
  },
  {
    category: 'GUARDRAILS',
    q: 'How does a Custom UI keep model output honest?',
    a: 'That depends on the workflow. Test Design, for example, uses an INVEST pre-flight gate, a deterministic coverage matrix, Draft-07 schema validation, an independent reviewer with bounded retries, and in-place gap closing. Those rules live with the workflow and its skill — not as platform-wide test opinions.',
  },
];

export default function TechnicalFAQ({ index = '07' }: { index?: string }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | false>('faq-0');

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <SectionHeader
        index={index}
        eyebrow="Frequently asked questions"
        title="The platform, not a single workflow"
        lede="How Agent HUB onboards, runs, and records work — and where Custom UIs fit."
      >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {FAQS.map((faq, i) => {
          const panelId = `faq-${i}`;
          const isPanelExpanded = expanded === panelId;

          return (
            <Accordion
              key={faq.q}
              expanded={isPanelExpanded}
              onChange={handleChange(panelId)}
              elevation={0}
              sx={{
                borderColor: isPanelExpanded ? 'primary.main' : 'divider',
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ChevronDown size={18} color={isPanelExpanded ? RED : theme.palette.text.secondary} />}
                sx={{
                  px: 3,
                  py: 1.5,
                  '& .MuiAccordionSummary-content': { my: 1 },
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <AccentTag
                    accent={isPanelExpanded ? RED : theme.palette.divider}
                    size="sm"
                  >
                    {faq.category}
                  </AccentTag>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: isPanelExpanded ? 500 : 400,
                      fontSize: '0.98rem',
                      color: 'text.primary',
                      mt: 0.25,
                    }}
                  >
                    {faq.q}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.75, fontSize: '0.88rem', maxWidth: 720 }}
                >
                  {faq.a}
                </Typography>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
      </SectionHeader>
    </Box>
  );
}
