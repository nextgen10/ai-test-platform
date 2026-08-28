/**
 * What a job's pipeline is, and how far through it the run got.
 *
 * One derivation, shared by the stepper across the top of a job and the live
 * side panel, so the two can never disagree about what ran. Every stage comes
 * from the workflow definition or from the run's own provenance — nothing here
 * knows about test generation specifically.
 */

import { ACTIVE_STATUSES, formatDuration, type Job, type Workflow } from '@/lib/api';

export type PhaseState =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'blocked';

export interface Phase {
    key: string;
    label: string;
    /** The workflow's own description of the stage, for a tooltip. */
    hint?: string;
    /** True for the human approval gate, which is not an agent. */
    gate?: boolean;
}

export interface DerivedPhases {
    phases: Phase[];
    states: Record<string, { state: PhaseState; detail: string }>;
    /**
     * The workflow definition has not arrived yet and the run has recorded
     * nothing, so there is no honest pipeline to draw. Render a placeholder
     * rather than a guess.
     */
    unknown: boolean;
}

/** `gap-closer` → `Gap closer`. */
export function humanise(value: string): string {
    const spaced = value.replace(/[-_]/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The bespoke test-generation chain, for rows that predate provenance.
 *
 * Reached only when the workflow registry is unreachable *and* the job names
 * that workflow. Any other workflow renders as unknown instead of borrowing
 * this pipeline.
 */
const LEGACY_BESPOKE_PHASES: Phase[] = [
    { key: 'ocr-extractor', label: 'OCR Extraction' },
    { key: 'requirement-analyst', label: 'Requirement analysis' },
    { key: 'test-designer', label: 'Test design' },
    { key: 'test-generator', label: 'Test generation' },
    { key: 'test-reviewer', label: 'Review & validation' },
];

const LEGACY_BESPOKE_WORKFLOW = 'test-case-generation';

/** The synthetic phase for a workflow that pauses for a human. */
export const APPROVAL_KEY = '__approval__';

interface RecordedStage {
    agent_id?: string;
    stage?: string;
    status?: string;
    duration_ms?: number;
    detail?: string;
    resumed?: boolean;
    attempts?: number;
}

/**
 * The stages a run has, in declaration order.
 *
 * Declared stages come first and always all appear — a run that died at stage
 * one still shows the stages it never reached, rather than collapsing to a
 * one-item pipeline. Anything the run recorded but the workflow does not
 * declare is appended, so provenance is never hidden either.
 */
function buildPhases(job: Job, workflow: Workflow | null | undefined, recorded: RecordedStage[]): Phase[] {
    const phases: Phase[] = [];
    const seen = new Set<string>();

    const push = (phase: Phase) => {
        if (!phase.key || seen.has(phase.key)) return;
        seen.add(phase.key);
        phases.push(phase);
    };

    if (workflow?.agents?.length) {
        // The bespoke chain can transcribe a document before its first declared
        // agent runs. That step is a property of the run, not of the workflow,
        // so it is only shown for the runner that can perform it.
        if (workflow.runner === 'bespoke') {
            push({ key: 'ocr-extractor', label: 'OCR Extraction' });
        }
        for (const agent of workflow.agents) {
            push({
                key: agent.id,
                label: humanise(agent.stage || agent.id),
                hint: agent.description,
            });
        }
    } else if (!workflow && recorded.length === 0 && job.workflow === LEGACY_BESPOKE_WORKFLOW) {
        for (const phase of LEGACY_BESPOKE_PHASES) push(phase);
    }

    for (const record of recorded) {
        const key = String(record.agent_id ?? record.stage ?? '');
        push({ key, label: humanise(String(record.stage ?? record.agent_id ?? key)) });
    }

    // The human gate is not an agent, so no stage list contains it. Place it
    // after the stage whose output the approver reads.
    if (workflow?.approval_gate && phases.length > 0) {
        const anchor = phases.findIndex((p) => p.key === 'requirement-analyst');
        const at = anchor === -1 ? 0 : anchor;
        phases.splice(at + 1, 0, { key: APPROVAL_KEY, label: 'Approval', gate: true });
    }

    return phases;
}

/** Collapse the reviewer's stats line into something that fits one row. */
function tidy(detail: string): string {
    if (detail.includes('categories=')) {
        const match = detail.match(/^(\d+\s+test\s+cases)/i);
        return match ? match[1] : 'Passed';
    }
    return detail;
}

export function derivePhases(job: Job, workflow?: Workflow | null): DerivedPhases {
    const recorded = (job.provenance?.stages ?? []) as RecordedStage[];
    const phases = buildPhases(job, workflow, recorded);

    if (phases.length === 0) {
        return { phases: [], states: {}, unknown: true };
    }

    const states: Record<string, { state: PhaseState; detail: string }> = {};
    for (const phase of phases) states[phase.key] = { state: 'pending', detail: '' };

    // OCR is offered by the bespoke chain but only used for image input.
    if (states['ocr-extractor'] && workflow?.runner === 'bespoke') {
        const usedOcr =
            (job.events ?? []).some((e) => (e.event_metadata?.phase as string) === 'ocr-extractor') ||
            (job.provenance?.phases ?? []).some((p) => p.name === 'ocr-extractor');
        if (!usedOcr) {
            states['ocr-extractor'] = { state: 'skipped', detail: 'text input — skipped' };
        }
    }

    // Live events first: they are the only signal mid-run.
    for (const event of job.events ?? []) {
        const name = (event.event_metadata?.phase as string) ?? '';
        if (!(name in states)) continue;
        if (event.event_type === 'phase.started') {
            states[name] = { state: 'running', detail: '' };
        } else if (event.event_type === 'phase.completed') {
            states[name] = {
                state: 'completed',
                detail: tidy((event.event_metadata?.detail as string) ?? ''),
            };
        }
    }

    // The bespoke runner writes `phases`; the generic one writes `stages`.
    // Both are authoritative once present, so they overwrite the live guess.
    for (const record of job.provenance?.phases ?? []) {
        if (!(record.name in states)) continue;
        const detail = tidy(record.detail || '');
        const duration = record.duration_ms ? formatDuration(record.duration_ms) : '';
        states[record.name] = {
            state: record.status === 'failed' ? 'failed' : 'completed',
            detail: duration ? (detail ? `${detail} · ${duration}` : duration) : detail,
        };
    }

    for (const record of recorded) {
        const key = String(record.agent_id ?? record.stage ?? '');
        if (!(key in states)) continue;

        const bits: string[] = [];
        if (record.resumed) bits.push('resumed');
        if (record.duration_ms) bits.push(formatDuration(record.duration_ms));
        if ((record.attempts ?? 1) > 1) bits.push(`${record.attempts} attempts`);
        if (record.status === 'skipped' && record.detail) bits.push(record.detail);

        states[key] = {
            state:
                record.status === 'failed'
                    ? 'failed'
                    : record.status === 'skipped'
                      ? 'skipped'
                      : 'completed',
            detail: bits.join(' · '),
        };
    }

    if (APPROVAL_KEY in states) {
        if (job.status === 'REJECTED') {
            states[APPROVAL_KEY] = { state: 'failed', detail: 'rejected' };
        } else if (job.status === 'AWAITING_APPROVAL') {
            states[APPROVAL_KEY] = { state: 'blocked', detail: 'action needed' };
        } else if (job.approved_at) {
            states[APPROVAL_KEY] = { state: 'completed', detail: job.approved_by ?? '' };
        }
    }

    const active = ACTIVE_STATUSES.includes(job.status);

    // A stage the runner started but never reported finishing did not survive a
    // terminal failure, whatever the log fell silent about.
    if (!active && job.status !== 'COMPLETED' && job.status !== 'AWAITING_APPROVAL') {
        for (const phase of phases) {
            if (states[phase.key].state === 'running') states[phase.key].state = 'failed';
        }
    }

    // An optional stage the run finished without is genuinely skipped, not
    // still pending — the run is over and it is not coming.
    if (job.status === 'COMPLETED') {
        const optional = new Set(
            (workflow?.agents ?? []).filter((a) => a.optional).map((a) => a.id),
        );
        for (const phase of phases) {
            if (optional.has(phase.key) && states[phase.key].state === 'pending') {
                states[phase.key] = { state: 'skipped', detail: 'not run' };
            }
        }
    }

    return { phases, states, unknown: false };
}
