import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cx } from '../ui/cx';
import { Paper } from '../ui/primitives';
import SectionHeader from './SectionHeader';
import { AccentTag } from './Tags';

const BRAND = '#E60000';

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

export default function TechnicalFAQ({ index = '07' }) {
    const [expanded, setExpanded] = useState('faq-0');

    return (
        <div className="w-full">
            <SectionHeader
                index={index}
                eyebrow="Frequently asked questions"
                title="The platform, not a single workflow"
                lede="How Agent HUB onboards, runs, and records work — and where Custom UIs fit."
            >
                <div className="flex flex-col gap-3">
                    {FAQS.map((faq, position) => {
                        const panelId = `faq-${position}`;
                        const open = expanded === panelId;

                        return (
                            <Paper
                                key={faq.q}
                                flat
                                className={cx('overflow-hidden', open && 'border-brand')}
                            >
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    aria-controls={`${panelId}-panel`}
                                    onClick={() => setExpanded(open ? false : panelId)}
                                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                                >
                                    <span className="flex flex-col gap-1">
                                        <AccentTag
                                            accent={open ? BRAND : 'var(--col-border-illustrative)'}
                                            size="sm"
                                        >
                                            {faq.category}
                                        </AccentTag>
                                        <span
                                            className={cx(
                                                'mt-0.5 text-[0.98rem] text-ink',
                                                open ? 'font-medium' : 'font-normal',
                                            )}
                                        >
                                            {faq.q}
                                        </span>
                                    </span>
                                    <ChevronDown
                                        size={18}
                                        className={cx(
                                            'shrink-0 transition-transform',
                                            open ? 'rotate-180 text-brand' : 'text-subtle',
                                        )}
                                    />
                                </button>

                                {open && (
                                    <div id={`${panelId}-panel`} className="px-6 pb-6 pt-0">
                                        <p className="max-w-[720px] text-[0.88rem] leading-[1.75] text-subtle">
                                            {faq.a}
                                        </p>
                                    </div>
                                )}
                            </Paper>
                        );
                    })}
                </div>
            </SectionHeader>
        </div>
    );
}
