import React from 'react';

import { cx } from './cx';

/**
 * A tab strip.
 *
 * `items` is `[{ value, label, badge }]`; the caller owns the selected value,
 * exactly as MUI's controlled Tabs worked.
 */
export function Tabs({ value, onChange, items, className }) {
    return (
        <div role="tablist" className={cx('ui-tabs custom-scrollbar', className)}>
            {items.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={value === item.value}
                    disabled={item.disabled}
                    className={cx('ui-tab', item.disabled && 'cursor-not-allowed text-faint hover:text-faint')}
                    onClick={() => onChange(item.value)}
                >
                    <span className="flex items-center gap-2">
                        {item.icon}
                        {item.label}
                        {item.badge !== undefined && item.badge !== null && (
                            <span className="ui-chip h-[18px] px-1.5 text-[0.65rem]">{item.badge}</span>
                        )}
                    </span>
                </button>
            ))}
        </div>
    );
}

export function TabPanel({ value, current, children, className }) {
    if (value !== current) return null;
    return (
        <div role="tabpanel" className={cx('animate-fade-in', className)}>
            {children}
        </div>
    );
}
