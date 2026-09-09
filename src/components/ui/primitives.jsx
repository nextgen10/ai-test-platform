import React from 'react';

import { cx } from './cx';

/* ---------------------------------------------------------------- surfaces */

/**
 * Surface container — mirrors MUI Paper defaults.
 *
 * Default: background + 2px radius, no border, no shadow (MUI elevation 0).
 * `flat`: hairline border, still no shadow (MUI outlined Paper / card edge).
 * `raised`: hairline + the soft rest shadow for menus and dialogs.
 */
export function Paper({ as: Tag = 'div', flat = false, raised = false, className, children, ...rest }) {
    const base = raised ? 'ui-raised' : flat ? 'ui-paper-flat' : 'ui-paper';
    return (
        <Tag className={cx(base, className)} {...rest}>
            {children}
        </Tag>
    );
}

export function Divider({ className, vertical = false, ...rest }) {
    if (vertical) {
        return <span aria-hidden className={cx('w-px self-stretch bg-hairline', className)} {...rest} />;
    }
    return <hr className={cx('ui-divider', className)} {...rest} />;
}

/* ----------------------------------------------------------------- buttons */

/**
 * MUI Button defaults `color="primary"`, so `variant="outlined"` is brand blue
 * (`outlinedPrimary`), not ink. Map our bare `outlined` the same way; keep
 * `outlined-neutral` for the rare ink-bordered control.
 */
const BUTTON_VARIANTS = {
    contained: 'ui-btn-contained',
    secondary: 'ui-btn-secondary',
    outlined: 'ui-btn-outlined-primary',
    'outlined-primary': 'ui-btn-outlined-primary',
    'outlined-neutral': 'ui-btn-outlined',
    'outlined-warning': 'ui-btn-outlined-warning',
    'outlined-danger': 'ui-btn-outlined-danger',
    text: 'ui-btn-text',
    'text-primary': 'ui-btn-text-primary',
    danger: 'ui-btn-danger',
};

const BUTTON_SIZES = { small: 'ui-btn-sm', medium: '', large: 'ui-btn-lg' };

/**
 * Buttons carry their icon as a child element rather than a `startIcon` prop —
 * the gap is on the flex container, so `<Button><Save size={16}/>Save</Button>`
 * spaces correctly without any per-call-site padding.
 */
export function Button({
    variant = 'text',
    size = 'medium',
    startIcon,
    endIcon,
    className,
    children,
    type = 'button',
    ...rest
}) {
    return (
        <button
            type={type}
            className={cx('ui-btn', BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
            {...rest}
        >
            {startIcon}
            {children}
            {endIcon}
        </button>
    );
}

export function IconButton({ size = 'medium', className, children, type = 'button', ...rest }) {
    return (
        <button
            type={type}
            className={cx('ui-icon-btn', size === 'small' && 'ui-icon-btn-sm', className)}
            {...rest}
        >
            {children}
        </button>
    );
}

/* ------------------------------------------------------------------- chips */

const CHIP_TONES = {
    default: '',
    primary: 'ui-chip-primary',
    secondary: 'ui-chip-secondary',
    success: 'ui-chip-success',
    warning: 'ui-chip-warning',
    error: 'ui-chip-error',
    info: 'ui-chip-info',
};

export function Chip({ label, color = 'default', variant = 'filled', className, children, ...rest }) {
    return (
        <span
            className={cx('ui-chip', CHIP_TONES[color], variant === 'outlined' && 'ui-chip-outlined', className)}
            {...rest}
        >
            {children ?? label}
        </span>
    );
}

/* ---------------------------------------------------------------- feedback */

/** MUI's CircularProgress, as an SVG that owes nothing to a library. */
export function Spinner({ size = 32, className, label = 'Loading' }) {
    return (
        <svg
            className={cx('animate-ubs-spin', className)}
            width={size}
            height={size}
            viewBox="0 0 44 44"
            role="status"
            aria-label={label}
        >
            <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeDasharray="80 40"
                className="text-brand"
            />
        </svg>
    );
}

/** A page-sized loading state, matching the old `display: grid; place-items` block. */
export function LoadingBlock({ className }) {
    return (
        <div className={cx('grid grow place-items-center py-16', className)}>
            <Spinner />
        </div>
    );
}

const PROGRESS_TONES = {
    inherit: 'bg-brand',
    primary: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-danger',
    info: 'bg-warning',
};

/**
 * A determinate bar when `value` is a number, indeterminate otherwise —
 * the same split MuiLinearProgress made on its `variant` prop.
 */
export function LinearProgress({ value, color = 'primary', className }) {
    const indeterminate = value === undefined || value === null;
    return (
        <div
            className={cx('ui-progress', indeterminate && 'ui-progress-indeterminate', className)}
            role="progressbar"
            aria-valuenow={indeterminate ? undefined : Math.round(value)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={cx('ui-progress-bar', PROGRESS_TONES[color] ?? PROGRESS_TONES.primary)}
                style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }}
            />
        </div>
    );
}

export function Skeleton({ variant = 'text', width, height, className }) {
    const shape =
        variant === 'circular' ? 'rounded-full' : variant === 'text' ? 'rounded-none' : '';
    const style = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height ?? (variant === 'text' ? '1em' : undefined),
    };
    return <span className={cx('ui-skeleton block', shape, className)} style={style} aria-hidden />;
}

const ALERT_TONES = {
    error: 'ui-alert-error',
    success: 'ui-alert-success',
    warning: 'ui-alert-warning',
    info: 'ui-alert-info',
};

export function Alert({ severity = 'info', icon, action, className, children, ...rest }) {
    return (
        <div role="alert" className={cx('ui-alert', ALERT_TONES[severity], className)} {...rest}>
            {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
            <div className="min-w-0 flex-1">{children}</div>
            {action}
        </div>
    );
}

/* ---------------------------------------------------------------- tooltips */

/**
 * A CSS-only tooltip.
 *
 * Deliberately not a portal: every use here labels a control inside normal page
 * flow, and a portal would need the positioning machinery that made the old
 * MUI popper the heaviest thing in the nav bar.
 */
export function Tooltip({ title, placement = 'top', className, children }) {
    if (!title) return children;

    const position =
        placement === 'bottom'
            ? 'top-full mt-1.5 left-1/2 -translate-x-1/2'
            : placement === 'left'
              ? 'right-full mr-1.5 top-1/2 -translate-y-1/2'
              : placement === 'right'
                ? 'left-full ml-1.5 top-1/2 -translate-y-1/2'
                : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2';

    return (
        <span className={cx('ui-tooltip-host group', className)}>
            {children}
            <span
                role="tooltip"
                className={cx(
                    'ui-tooltip opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
                    position,
                )}
            >
                {title}
            </span>
        </span>
    );
}
