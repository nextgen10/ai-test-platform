import React from 'react';

import { cx } from '../ui/cx';

/**
 * UBS carries category through a hairline, not a fill.
 *
 * The earlier landing page tinted every badge with its own colour at 12%
 * opacity, which put five pastel fills on screen at once and read as a generic
 * template rather than a UBS surface. `AccentTag` keeps the same colour coding
 * but spends it on a 2px rule, leaving the type in the neutral ramp.
 */
export function AccentTag({ accent, children, size = 'md' }) {
    return (
        <span className={cx('inline-flex shrink-0 items-center', size === 'sm' ? 'gap-1.5' : 'gap-2')}>
            <span
                className={cx('w-0.5 shrink-0', size === 'sm' ? 'h-2.5' : 'h-3')}
                style={{ backgroundColor: accent }}
            />
            <span
                className={cx(
                    'ui-overline whitespace-nowrap leading-none text-subtle',
                    size === 'sm' ? 'text-[0.625rem]' : 'text-[0.6875rem]',
                )}
            >
                {children}
            </span>
        </span>
    );
}

/**
 * A neutral, hairline-bordered token for factual labels — standards, protocols,
 * file names. No fill, so a dozen of them in a row stay quiet.
 */
export function MetaTag({ children }) {
    return (
        <span className="inline-flex items-center whitespace-nowrap rounded-ubs border border-hairline px-1.5 py-0.5 text-[0.6875rem] leading-snug text-subtle">
            {children}
        </span>
    );
}

/**
 * Card opener: a plain accent-coloured icon and an `AccentTag`, split to the
 * card's edges. UBS does not put a coloured plate behind an icon.
 */
export function CardHead({ accent, icon, tag }) {
    return (
        <div className="mb-5 flex items-center justify-between gap-4">
            <span className="inline-flex shrink-0" style={{ color: accent }}>
                {icon}
            </span>
            {tag && <AccentTag accent={accent}>{tag}</AccentTag>}
        </div>
    );
}
