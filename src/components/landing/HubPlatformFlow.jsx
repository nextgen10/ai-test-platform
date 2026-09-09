import React from 'react';

import { useThemeMode } from '@/contexts/ThemeContext';
import { alpha } from '@/theme';
import { cx } from '../ui/cx';

const BRAND = '#E60000';

/** Light / dark pairs picked to stay distinct from brand blue on both plates. */
const TONE = {
    gold: ['#A67C12', '#E8C15A'],
    aqua: ['#0D7F8C', '#5ED4DC'],
    orchid: ['#8B47B8', '#D4A8F0'],
    green: ['#2F8F58', '#7ED9A0'],
};

const NODES = [
    { id: 'registry', step: '01', kicker: 'Onboard', label: 'Registry', detail: 'agents · workflows · skills', tone: TONE.gold },
    { id: 'console', step: '02A', kicker: 'Run', label: 'Agent Console', detail: 'SSE · any model', tone: TONE.aqua },
    { id: 'custom', step: '02B', kicker: 'Run', label: 'Custom UI', detail: 'Test Design · Workflow Builder', tone: TONE.orchid },
    { id: 'jobs', step: '03', kicker: 'Trace', label: 'Jobs', detail: 'artifacts · audit trail', tone: TONE.green },
];

function HubMark({ text, line }) {
    return (
        <div
            className="relative mx-auto flex h-[168px] w-[200px] flex-col items-center justify-center rounded-ubs border lg:h-[196px] lg:w-[228px]"
            style={{ borderColor: line, backgroundColor: alpha(BRAND, 0.06) }}
        >
            {/*
              Vertical stubs into the row gap — pixel-matched to the MUI original:
              `left: 50%`, width 1, height 18, top/bottom -19. No translate: the
              original draws the 1px line starting at the midpoint, and that is
              what the light-mode blue connectors read as.
            */}
            <span
                aria-hidden
                className="absolute -top-[19px] left-1/2 h-[18px] w-px"
                style={{ backgroundColor: line }}
            />
            <span
                aria-hidden
                className="absolute -bottom-[19px] left-1/2 h-[18px] w-px"
                style={{ backgroundColor: line }}
            />

            {/*
              Match MUI HubMark: Typography variant="overline" with
              letterSpacing 0.16em, mb 0.75, lineHeight 1 — theme overline
              is 0.6875rem (11px), not 0.75rem.
            */}
            <span
                className="mb-[6px] block text-[0.6875rem] font-medium uppercase leading-none tracking-[0.16em]"
                style={{ color: BRAND }}
            >
                Control plane
            </span>
            <p className="whitespace-nowrap text-center text-[0.9375rem] font-light leading-[1.2] tracking-[-0.02em] lg:text-[1.0625rem]">
                <span style={{ color: BRAND }}>Agent HUB</span>
                <span style={{ color: text }}> Platform</span>
            </p>
        </div>
    );
}

function NodeCard({ node, accent, text, muted, isDark, align = 'left' }) {
    return (
        <div
            className={cx(
                'group min-w-0 rounded-ubs border p-4 transition-[background-color,transform] duration-200 hover:-translate-y-0.5',
                align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
            )}
            style={{
                backgroundColor: alpha(accent, isDark ? 0.12 : 0.08),
                borderColor: alpha(accent, isDark ? 0.45 : 0.35),
                borderTop: `3px solid ${accent}`,
            }}
        >
            {/*
              Match MUI NodeCard: overline (0.6875rem) with lineHeight 1 and
              mb 0.75; title 1.0625rem / lh 1.25 / mb 0.35; caption 0.75rem / lh 1.4.
            */}
            <span
                className="mb-[6px] block text-[0.6875rem] font-medium uppercase leading-none tracking-[0.08em]"
                style={{ color: accent }}
            >
                {node.step}{'  '}{node.kicker}
            </span>
            <p className="mb-[2.8px] text-[1.0625rem] font-light leading-[1.25]" style={{ color: text }}>
                {node.label}
            </p>
            <span className="block text-[0.75rem] leading-[1.4]" style={{ color: muted }}>
                {node.detail}
            </span>
        </div>
    );
}

/**
 * Control-plane stage: four nodes around Agent HUB, with a live pulse.
 * Accents swap luminance in dark mode so gold / aqua / orchid / green still read.
 */
export default function HubPlatformFlow({ inverse = false }) {
    const { mode } = useThemeMode();
    const isDark = inverse || mode === 'dark';
    const pick = (tone) => (isDark ? tone[1] : tone[0]);
    const text = isDark ? '#f9f9f7' : '#1c1c1c';
    const muted = isDark ? '#cccabc' : '#5A5D5C';
    const line = isDark ? 'rgba(204, 202, 188, 0.36)' : 'rgba(230, 0, 0, 0.22)';
    const live = isDark ? '#E8696F' : '#DA0000';

    const card = (node, align) => (
        <NodeCard
            node={node}
            accent={pick(node.tone)}
            text={text}
            muted={muted}
            isDark={isDark}
            align={align}
        />
    );

    return (
        <div className="w-full">
            {/*
              Match MUI: Typography variant="overline" with only letterSpacing
              overridden to 0.08em. Theme overline is 0.6875rem / weight 500 /
              uppercase; MUI's default overline lineHeight is 2.66 — that tall
              strut is what made the hub header ~11px taller than a normal
              0.75rem / leading-none label.
            */}
            <div className="mb-5 flex items-center justify-between gap-4 md:mb-6">
                <span
                    className="text-[0.6875rem] font-medium uppercase tracking-[0.08em]"
                    style={{ color: muted, lineHeight: 2.66 }}
                >
                    How Agent HUB Platform runs
                </span>
                <div className="flex items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full animate-hub-live"
                        style={{ backgroundColor: live, color: live }}
                    />
                    <span
                        className="text-[0.6875rem] font-medium uppercase leading-none tracking-[0.1em]"
                        style={{ color: muted }}
                    >
                        Live
                    </span>
                </div>
            </div>

            {/* Stacked on a phone; the cross layout needs the width to read. */}
            <div className="flex flex-col gap-3 md:hidden">
                {NODES.map((node) => (
                    <React.Fragment key={node.id}>{card(node)}</React.Fragment>
                ))}
            </div>

            {/*
              MUI used theme spacing 2 for both gaps (16px). Keep row and column
              gaps equal so the stubs span the same distance they do on Next.
            */}
            <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-4 md:grid">
                <div />
                {card(NODES[1], 'center')}
                <div />

                {card(NODES[0])}
                <HubMark text={text} line={line} />
                {card(NODES[3], 'right')}

                <div />
                {card(NODES[2], 'center')}
                <div />
            </div>
        </div>
    );
}
