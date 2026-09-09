import React from 'react';

import { Paper } from '../ui/primitives';
import SectionHeader from './SectionHeader';

const COMPARISON_ROWS = [
    {
        feature: 'Onboarding a workflow',
        generic: 'Hardcoded into the application. A new use case is a release.',
        agentHub: 'A file in the registry. Drop a .workflow.yaml — it is live, with no redeploy.',
    },
    {
        feature: 'How work is run',
        generic: 'One chat window, or one purpose-built screen that is the product.',
        agentHub: 'Agent Console for anything onboarded. A Custom UI only when the workflow declares one.',
    },
    {
        feature: 'Adding a new use case',
        generic: 'Rewrite agents, prompts, and UI in the platform codebase.',
        agentHub: 'Describe it in English. Workflow Builder designs, writes, and installs it into the registry.',
    },
    {
        feature: 'Record of a run',
        generic: 'An ephemeral transcript. Nothing to audit, replay, or export.',
        agentHub: 'One job per run: versioned artifacts, status history, and a complete event trail.',
    },
    {
        feature: 'Human control',
        generic: 'Hope the model asked the right question. No structured gate.',
        agentHub: 'Workflows can pause for approval. Decisions are recorded on the job.',
    },
    {
        feature: 'Isolation',
        generic: 'A long-lived shared process. A crash or injection lands on everyone.',
        agentHub: '1 request = 1 job. Sandboxed workspace, no shell, bounded filesystem.',
    },
];

export default function ComparisonSection({ index = '03' }) {
    return (
        <div className="w-full">
            <SectionHeader
                index={index}
                eyebrow="The architectural difference"
                title="A control plane, not a chatbot"
                lede="Prompting a model in a window is not an enterprise execution platform. Agent HUB onboards files, runs jobs, and keeps evidence — Custom UIs are optional surfaces on that plane."
            />

            <Paper flat className="overflow-x-auto">
                <table className="ui-table min-w-[700px]">
                    <thead>
                        <tr>
                            <th className="w-[22%] text-[0.85rem]">Capability</th>
                            <th className="w-[38%] text-[0.85rem] text-subtle">A prompt, or a hardcoded app</th>
                            <th className="w-[40%] border-l border-hairline bg-brand-tint text-[0.9rem] text-brand">
                                Agent HUB Platform
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {COMPARISON_ROWS.map((row) => (
                            <tr key={row.feature}>
                                <th scope="row" className="bg-transparent align-top text-[0.86rem] font-medium">
                                    {row.feature}
                                </th>
                                <td className="align-top text-[0.85rem] leading-relaxed text-subtle">
                                    {row.generic}
                                </td>
                                <td className="border-l border-hairline bg-[color-mix(in_srgb,var(--col-background-brand)_3%,transparent)] align-top text-[0.86rem] leading-relaxed text-ink">
                                    {row.agentHub}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Paper>
        </div>
    );
}
