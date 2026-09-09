import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cx } from './cx';
import { Menu, MenuItem } from './overlays';

/**
 * A labelled text input.
 *
 * The label sits above the field rather than floating into a notch: the UBS
 * type system has no bold face and hierarchy comes from size, so a static label
 * reads better than the MUI shrink animation it replaces.
 *
 * `variant="outline"` floats the label on the border (ConfigBar / MUI outlined).
 */
export function TextField({
    label,
    helperText,
    error = false,
    className,
    inputClassName,
    id,
    variant = 'stacked',
    ...rest
}) {
    const generated = useId();
    const fieldId = id ?? generated;
    const outline = variant === 'outline';

    return (
        <div className={cx(outline ? 'relative min-w-0' : 'w-full', className)}>
            {label && (
                <label
                    className={cx(outline ? 'ui-label-outline' : 'ui-label')}
                    htmlFor={fieldId}
                >
                    {label}
                </label>
            )}
            <input
                id={fieldId}
                className={cx(
                    'ui-input w-full',
                    outline && 'ui-input-compact',
                    error && 'border-danger',
                    inputClassName,
                )}
                aria-invalid={error || undefined}
                {...rest}
            />
            {helperText && (
                <p className={cx('ui-helper', error && 'text-danger')}>{helperText}</p>
            )}
        </div>
    );
}

export function TextArea({
    label,
    helperText,
    error = false,
    rows = 4,
    className,
    inputClassName,
    id,
    ...rest
}) {
    const generated = useId();
    const fieldId = id ?? generated;

    return (
        <div className={cx('w-full', className)}>
            {label && (
                <label className="ui-label" htmlFor={fieldId}>
                    {label}
                </label>
            )}
            <textarea
                id={fieldId}
                rows={rows}
                className={cx('ui-textarea', error && 'border-danger', inputClassName)}
                aria-invalid={error || undefined}
                {...rest}
            />
            {helperText && (
                <p className={cx('ui-helper', error && 'text-danger')}>{helperText}</p>
            )}
        </div>
    );
}

/**
 * A native select.
 *
 * `variant="outline"` floats the label on the border (ConfigBar / MUI outlined
 * small). `variant="stacked"` keeps the label above the field.
 */
export function Select({
    label,
    helperText,
    className,
    style,
    id,
    variant = 'stacked',
    children,
    ...rest
}) {
    const generated = useId();
    const fieldId = id ?? generated;
    const outline = variant === 'outline';
    const sized = Boolean(style && (style.width != null || style.flex != null || style.flexBasis != null));

    return (
        <div
            className={cx(
                outline && 'relative min-w-0',
                !sized && !outline && 'w-full',
                !sized && outline && 'w-full',
                className,
            )}
            style={style}
        >
            {label && (
                <label
                    className={cx(outline ? 'ui-label-outline' : 'ui-label')}
                    htmlFor={fieldId}
                >
                    {label}
                </label>
            )}
            <select
                id={fieldId}
                className={cx('ui-select w-full', outline && 'ui-select-compact')}
                {...rest}
            >
                {children}
            </select>
            {helperText && <p className="ui-helper">{helperText}</p>}
        </div>
    );
}

/**
 * Select whose open menu can show a name + description per option.
 *
 * Native <option> cannot render secondary text; the Agent Console picker needs
 * it, matching the Next/MUI ListItemText primary/secondary layout.
 */
export function DescribedSelect({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select…',
    emptyLabel,
    disabled = false,
    className,
    id,
    variant = 'stacked',
}) {
    const generated = useId();
    const fieldId = id ?? generated;
    const triggerRef = React.useRef(null);
    const [open, setOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState(null);
    const outline = variant === 'outline';

    const selected = options.find((option) => option.value === value);
    const display = selected?.label ?? '';

    const syncAnchor = () => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setAnchorRect({
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
        });
    };

    const toggle = () => {
        if (disabled) return;
        if (!open) syncAnchor();
        setOpen((current) => !current);
    };

    React.useEffect(() => {
        if (!open) return undefined;
        const onReposition = () => syncAnchor();
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        return () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [open]);

    const choose = (next) => {
        setOpen(false);
        if (next === value) return;
        onChange?.({ target: { value: next } });
    };

    return (
        <div className={cx(outline ? 'relative w-full min-w-0' : 'relative w-full', className)}>
            {label && (
                <label
                    className={cx(outline ? 'ui-label-outline' : 'ui-label')}
                    htmlFor={fieldId}
                    id={`${fieldId}-label`}
                >
                    {label}
                </label>
            )}
            <button
                ref={triggerRef}
                id={fieldId}
                type="button"
                data-menu-trigger
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-labelledby={label ? `${fieldId}-label` : undefined}
                className={cx(
                    'ui-select ui-select-trigger flex w-full items-center justify-between gap-2 text-left',
                    outline && 'ui-select-compact',
                    disabled && 'cursor-not-allowed',
                    open && 'border-[var(--col-focus-ring)]',
                )}
                onClick={toggle}
            >
                <span className={cx('min-w-0 flex-1 truncate', !display && 'text-subtle')}>
                    {display || placeholder}
                </span>
                <ChevronDown
                    size={14}
                    className={cx('shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
                    aria-hidden
                />
            </button>

            <Menu
                open={open}
                onClose={() => setOpen(false)}
                align="left"
                anchorRect={anchorRect}
                className="max-h-[420px]"
            >
                {emptyLabel != null && (
                    <MenuItem
                        selected={!value}
                        className="italic text-subtle"
                        onClick={() => choose('')}
                    >
                        {emptyLabel}
                    </MenuItem>
                )}
                {options.map((option) => (
                    <MenuItem
                        key={option.value}
                        selected={option.value === value}
                        disabled={option.disabled}
                        className="!items-start whitespace-normal py-2"
                        onClick={() => !option.disabled && choose(option.value)}
                    >
                        <span className="flex min-w-0 flex-col gap-0.5 text-left">
                            <span className="text-[0.85rem] font-medium leading-snug">
                                {option.label}
                            </span>
                            {option.description && (
                                <span className="whitespace-normal text-[0.75rem] font-normal leading-snug text-subtle">
                                    {option.description}
                                </span>
                            )}
                        </span>
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}

export function Checkbox({ label, className, id, ...rest }) {
    const generated = useId();
    const fieldId = id ?? generated;

    return (
        <label htmlFor={fieldId} className={cx('flex cursor-pointer items-center gap-2 text-sm', className)}>
            <input
                id={fieldId}
                type="checkbox"
                className="size-4 shrink-0 accent-[var(--col-background-brand)]"
                {...rest}
            />
            {label && <span>{label}</span>}
        </label>
    );
}

/** A switch, drawn from two divs so it can be styled to the 2px UBS corner. */
export function Switch({ checked, onChange, label, disabled = false, className, id }) {
    const generated = useId();
    const fieldId = id ?? generated;

    return (
        <label
            htmlFor={fieldId}
            className={cx(
                'flex items-center gap-2.5 text-sm',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                className,
            )}
        >
            <input
                id={fieldId}
                type="checkbox"
                role="switch"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange?.(event.target.checked)}
            />
            <span
                aria-hidden
                className={cx(
                    'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150',
                    checked ? 'bg-brand' : 'bg-[var(--col-background-disabled)]',
                )}
            >
                <span
                    className={cx(
                        'absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-150',
                        checked ? 'left-[18px]' : 'left-0.5',
                    )}
                />
            </span>
            {label && <span>{label}</span>}
        </label>
    );
}
