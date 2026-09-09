import React from 'react';

const LINES = [
    { role: 'you', text: 'Run the payments-settlement workflow on gpt-4.1' },
    { role: 'sys', text: 'workflow · payments-settlement  ·  model · gpt-4.1' },
    { role: 'agent', text: 'Requirement Analyst  ·  INVEST 3.9  ·  gate clear' },
    { role: 'agent', text: 'Streaming designer coverage matrix…' },
];

/**
 * A quiet console mock for the featured Agent Console card.
 * Charcoal panel, Light type, a blinking caret — not screenshot chrome.
 */
export default function ConsolePreview() {
    return (
        <div
            aria-hidden
            className="flex h-full min-h-[220px] flex-col gap-3 bg-[#1c1c1c] p-5 text-[#f9f9f7] md:p-6"
        >
            <div className="mb-1 flex items-center justify-between">
                <span className="ui-overline leading-none tracking-[0.1em] text-[#b8b3a2]">
                    Agent Console
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="size-1.5 animate-ubs-pulse rounded-full bg-[#E60000]" />
                    <span className="text-[0.625rem] text-[#b8b3a2]">SSE</span>
                </div>
            </div>

            {LINES.map((line, index) => (
                <div key={index} className="flex min-w-0 gap-3">
                    <span
                        className="min-w-9 pt-px text-xs tabular-nums"
                        style={{ color: line.role === 'you' ? '#E60000' : '#8e8d83' }}
                    >
                        {line.role === 'you' ? 'you' : line.role === 'sys' ? 'hub' : 'run'}
                    </span>
                    <p
                        className="text-[0.8125rem] font-light leading-snug"
                        style={{ color: line.role === 'agent' ? '#f9f9f7' : '#cccabc' }}
                    >
                        {line.text}
                        {index === LINES.length - 1 && (
                            <span className="ml-1 inline-block h-[0.9em] w-[7px] animate-ubs-pulse bg-[#E60000] align-text-bottom" />
                        )}
                    </p>
                </div>
            ))}
        </div>
    );
}
