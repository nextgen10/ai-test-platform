import React from 'react';
import { Bot } from 'lucide-react';

/** Three pulsing dots and a status line, while an agent is still writing. */
export function StreamingIndicator({ statusText = 'Generating with GitHub Copilot…' }) {
    return (
        <div className="mt-2 inline-flex items-center gap-3 rounded-ubs border border-[color-mix(in_srgb,var(--col-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--col-warning)_8%,transparent)] px-3.5 py-1.5">
            <div className="flex items-center gap-1.5 text-warning">
                <Bot size={15} />
                {[0, 0.2, 0.4].map((delay) => (
                    <span
                        key={delay}
                        className="size-1.5 animate-ubs-pulse rounded-full bg-warning"
                        style={{ animationDelay: `${delay}s`, animationDuration: '1.2s' }}
                    />
                ))}
            </div>

            <span className="text-[0.78rem] font-medium text-subtle">{statusText}</span>
        </div>
    );
}

/** The blinking caret at the end of streamed text. */
export function StreamingCursor() {
    return (
        <span className="ml-[3px] inline-block h-3.5 w-1.5 animate-ubs-pulse rounded-[1px] bg-brand align-middle" />
    );
}
