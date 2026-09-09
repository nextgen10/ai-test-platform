import React from 'react';

/**
 * Horizontal agent chain — a visual instead of a numbered list.
 * 2px nodes, hairline connectors, UBS chart accents.
 */
export default function PipelineStrip({ agents, accent }) {
    return (
        <div className="custom-scrollbar flex items-stretch overflow-x-auto pb-1">
            {agents.map((name, index) => (
                <div key={name} className="flex min-w-[72px] flex-1 items-start">
                    <div className="min-w-0 flex-1">
                        <span
                            className="mb-2 block size-2 rounded-full border-[1.5px]"
                            style={{
                                backgroundColor: index === 0 ? accent : 'transparent',
                                borderColor: accent,
                            }}
                        />
                        <span className="block text-[0.6875rem] leading-snug tabular-nums text-subtle">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <p className="mt-0.5 text-[0.75rem] font-medium leading-snug">{name}</p>
                    </div>
                    {index < agents.length - 1 && (
                        <span
                            className="mt-[3.25px] h-[1.5px] flex-[0_0_10px] opacity-35"
                            style={{ backgroundColor: accent }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
