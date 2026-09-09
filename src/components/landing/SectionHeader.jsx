import React from 'react';

import { cx } from '../ui/cx';

/**
 * The one section opener used by every landing block.
 *
 * The page stacks nine sections, so they have to share a rhythm or they read as
 * nine unrelated templates glued together. Everything is fixed here: the
 * tabular index in the left rail, the brand hairline, the Light headline, and
 * the measure of the lede. Sections vary only in their words and their action.
 */
export default function SectionHeader({ index, eyebrow, title, lede, action, children }) {
    return (
        <div className={cx('flex gap-4 md:gap-8', children ? 'mb-0' : 'mb-8 md:mb-12')}>
            {index && (
                <span
                    aria-hidden
                    className="min-w-6 shrink-0 pt-1 text-sm font-light tabular-nums text-faint md:min-w-10 md:text-base"
                >
                    {index}
                </span>
            )}

            <div className="min-w-0 flex-1">
                <div
                    className={cx(
                        'flex flex-wrap items-end justify-between gap-5 md:gap-8',
                        children && 'mb-8 md:mb-12',
                    )}
                >
                    <div className="max-w-[720px]">
                        <div className="mb-3 flex items-center gap-3">
                            <span className="h-0.5 w-6 shrink-0 bg-brand" />
                            <span className="ui-overline leading-none text-subtle">{eyebrow}</span>
                        </div>
                        <h2
                            className={cx(
                                'text-[1.75rem] font-light leading-tight tracking-normal md:text-[2.375rem]',
                                lede && 'mb-3.5',
                            )}
                        >
                            {title}
                        </h2>
                        {lede && (
                            <p className="text-base font-light leading-relaxed text-subtle md:text-[1.0625rem]">
                                {lede}
                            </p>
                        )}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
                {children}
            </div>
        </div>
    );
}
