import React from 'react';

import { cx } from './ui/cx';

/** Product page title: light weight, hierarchy from size. */
export default function PageHeader({ title, subtitle, actions, inlineSubtitle = false, className }) {
    return (
        <div
            className={cx(
                'mb-6 flex flex-col items-start justify-between gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center',
                className,
            )}
        >
            {inlineSubtitle ? (
                <div className="flex flex-wrap items-baseline gap-3">
                    {/* Matches MUI `Typography variant="h3"` used on product pages:
                        1.5rem → 1.75rem on md, weight 300, line-height 1.25. */}
                    <h1 className="text-2xl font-light leading-[1.25] md:text-[1.75rem]">{title}</h1>
                    {subtitle && <p className="ui-body2 text-subtle">{subtitle}</p>}
                </div>
            ) : (
                <div>
                    <h1 className="text-2xl font-light leading-[1.25] md:text-[1.75rem]">{title}</h1>
                    {subtitle && <p className="ui-body2 mt-1.5 max-w-[720px] text-subtle">{subtitle}</p>}
                </div>
            )}
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
    );
}
