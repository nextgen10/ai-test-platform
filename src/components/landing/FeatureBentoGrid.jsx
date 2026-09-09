import React from 'react';

import { cx } from '../ui/cx';
import SectionHeader from './SectionHeader';

const PILLARS = [
    {
        index: '01',
        accent: '#af8626',
        tag: 'Onboard',
        title: 'File-based registry',
        body: 'Agents, workflows, skills, and prompts are files. Drop them in the catalog — no migration, no redeploy.',
    },
    {
        index: '02',
        accent: '#00759e',
        tag: 'Run',
        title: 'Agent Console',
        body: 'The universal execution plane. Any onboarded workflow, any model, live SSE, session history.',
    },
    {
        index: '03',
        accent: '#804c95',
        tag: 'Run',
        title: 'Custom UIs',
        body: 'A dedicated surface when the job needs one. Test Design and Workflow Builder are two of those — declared on the workflow, not hardcoded in nav.',
    },
    {
        index: '04',
        accent: '#469a6c',
        tag: 'Trace',
        title: 'Jobs & evidence',
        body: 'One run is one job: isolated execution, versioned artifacts, and an audit trail. Nothing lives only in a chat.',
    },
];

export default function FeatureBentoGrid({ index = '02' }) {
    return (
        <div className="w-full">
            <SectionHeader
                index={index}
                eyebrow="The control plane"
                title="Four things the platform actually does"
                lede="Agent HUB onboards, runs, and records multi-agent work. Custom UIs are optional surfaces on top of that — not a second product."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                {PILLARS.map((pillar, position) => (
                    <div
                        key={pillar.title}
                        style={{ '--pillar-accent': pillar.accent }}
                        className={cx(
                            'group py-6 md:py-2',
                            /* xs: a hairline between stacked pillars. */
                            position > 0 && 'border-t border-hairline',
                            /* sm: two columns — top rule only on the second row. */
                            position < 2 ? 'sm:border-t-0' : 'sm:border-t sm:border-hairline',
                            /* md: one row of four — left rules, no top rules. */
                            'md:border-t-0',
                            position > 0 && 'md:border-l md:border-hairline',
                            /* sm gutters: padding on the inside edge of each pair. */
                            position % 2 === 0 ? 'sm:pr-6' : 'sm:pl-6',
                            /* md gutters: 24px both sides, except the first cell. */
                            position === 0 ? 'md:pl-0 md:pr-6' : 'md:px-6',
                        )}
                    >
                        {/* The figure takes the pillar's accent on hover; the
                            colour rides in as a custom property so one class
                            covers all four. */}
                        <p
                            aria-hidden
                            className="mb-4 text-5xl font-light leading-[0.9] tracking-[-0.03em] tabular-nums text-faint transition-colors duration-200 group-hover:text-[var(--pillar-accent)] md:text-[3.75rem]"
                        >
                            {pillar.index}
                        </p>
                        <div className="mb-3 flex items-center gap-3">
                            <span className="h-0.5 w-4 shrink-0" style={{ backgroundColor: pillar.accent }} />
                            <span className="ui-overline leading-none text-subtle">{pillar.tag}</span>
                        </div>
                        <h3 className="mb-2 text-[1.125rem] font-medium">{pillar.title}</h3>
                        <p className="ui-body2 leading-relaxed text-subtle">{pillar.body}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
