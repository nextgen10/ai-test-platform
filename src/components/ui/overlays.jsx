import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cx } from './cx';
import { IconButton } from './primitives';

/** Close on Escape, for anything that floats above the page. */
function useEscape(open, onClose) {
    useEffect(() => {
        if (!open || !onClose) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);
}

/**
 * Hold the page still while an overlay is open.
 *
 * The width of the scrollbar is put back as padding, so the layout underneath
 * does not jump sideways the moment a dialog appears.
 */
function useScrollLock(open) {
    useEffect(() => {
        if (!open) return undefined;
        const { body } = document;
        const previousOverflow = body.style.overflow;
        const previousPadding = body.style.paddingRight;
        const gap = window.innerWidth - document.documentElement.clientWidth;
        body.style.overflow = 'hidden';
        if (gap > 0) body.style.paddingRight = `${gap}px`;
        return () => {
            body.style.overflow = previousOverflow;
            body.style.paddingRight = previousPadding;
        };
    }, [open]);
}

/* ----------------------------------------------------------------- dialogs */

const DIALOG_WIDTHS = {
    xs: 'max-w-sm',
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
};

export function Dialog({ open, onClose, maxWidth = 'sm', fullWidth = true, className, children, labelledBy }) {
    useEscape(open, onClose);
    useScrollLock(open);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto p-4"
            role="presentation"
        >
            <div
                className="fixed inset-0 bg-black/40"
                onClick={onClose}
                aria-hidden
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                className={cx(
                    'ui-raised relative z-10 my-8 flex max-h-[calc(100vh-4rem)] flex-col',
                    fullWidth && 'w-full',
                    DIALOG_WIDTHS[maxWidth],
                    className,
                )}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

export function DialogTitle({ children, onClose, id, className }) {
    return (
        <div className={cx('flex items-start justify-between gap-3 border-b border-hairline px-5 py-4', className)}>
            <h2 id={id} className="ui-h5">
                {children}
            </h2>
            {onClose && (
                <IconButton size="small" aria-label="Close" onClick={onClose}>
                    <X size={18} />
                </IconButton>
            )}
        </div>
    );
}

export function DialogContent({ children, className }) {
    return <div className={cx('custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4', className)}>{children}</div>;
}

export function DialogActions({ children, className }) {
    return (
        <div className={cx('flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-3.5', className)}>
            {children}
        </div>
    );
}

/* ------------------------------------------------------------------- menus */

/**
 * A dropdown anchored to whatever wraps it.
 *
 * The parent must be `relative`; that keeps positioning in CSS rather than in a
 * measurement loop, which is what the old popper spent its time on.
 */
export function Menu({
    open,
    onClose,
    align = 'right',
    className,
    children,
    width,
    /** When set, render in a portal at this viewport box (avoids overflow clipping). */
    anchorRect = null,
}) {
    const ref = useRef(null);
    const portaled = Boolean(anchorRect);

    const handlePointerDown = useCallback(
        (event) => {
            if (!ref.current) return;
            const anchorHost = ref.current.parentElement;
            if (
                !ref.current.contains(event.target) &&
                !(anchorHost && !portaled && anchorHost.contains(event.target))
            ) {
                // For portaled menus the trigger is outside; callers pass
                // data-menu-trigger on the button so we can ignore its click.
                const trigger = event.target.closest?.('[data-menu-trigger]');
                if (trigger) return;
                onClose?.();
            }
        },
        [onClose, portaled],
    );

    useEffect(() => {
        if (!open) return undefined;
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open, handlePointerDown]);

    useEscape(open, onClose);

    if (!open) return null;

    const style = {};
    if (width) {
        style.width = width;
        style.minWidth = width;
        style.maxWidth = width;
    }
    if (portaled) {
        style.position = 'fixed';
        style.top = anchorRect.bottom;
        style.left = align === 'right' ? undefined : anchorRect.left;
        style.right = align === 'right' ? window.innerWidth - anchorRect.right : undefined;
        style.width = width || anchorRect.width;
        style.minWidth = width || anchorRect.width;
        style.maxWidth = Math.max(width || anchorRect.width, anchorRect.width);
        style.zIndex = 1400;
    }

    const node = (
        <div
            ref={ref}
            role="menu"
            className={cx(
                'ui-menu custom-scrollbar z-[1250] mt-0 max-h-[min(480px,calc(100vh-72px))] overflow-y-auto overflow-x-hidden',
                !portaled && 'absolute top-full',
                !portaled && (align === 'right' ? 'right-0' : 'left-0'),
                className,
            )}
            style={Object.keys(style).length ? style : undefined}
        >
            {children}
        </div>
    );

    return portaled ? createPortal(node, document.body) : node;
}

export function MenuItem({ selected = false, className, children, ...rest }) {
    return (
        <button
            type="button"
            role="menuitem"
            data-selected={selected || undefined}
            className={cx('ui-menu-item', className)}
            {...rest}
        >
            {children}
        </button>
    );
}

export function MenuLabel({ children }) {
    return <div className="ui-overline px-3 py-2.5 text-subtle">{children}</div>;
}

/* ------------------------------------------------------------------ drawer */

export function Drawer({ open, onClose, anchor = 'right', width = 300, className, children }) {
    useEscape(open, onClose);
    useScrollLock(open);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1300]" role="presentation">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
            <aside
                className={cx(
                    'custom-scrollbar absolute inset-y-0 flex max-w-[85vw] flex-col overflow-y-auto border-hairline bg-surface p-4',
                    anchor === 'right' ? 'right-0 border-l' : 'left-0 border-r',
                    className,
                )}
                style={{ width }}
            >
                {children}
            </aside>
        </div>,
        document.body,
    );
}

/* ---------------------------------------------------------------- snackbar */

/**
 * A transient message at the bottom of the viewport.
 *
 * Auto-dismiss is keyed on the message as well as `open`, so two notices in a
 * row restart the timer instead of the second inheriting what is left of the
 * first.
 */
export function Snackbar({ open, message, severity = 'success', onClose, autoHideDuration = 4000, icon }) {
    useEffect(() => {
        if (!open || !autoHideDuration) return undefined;
        const timer = setTimeout(() => onClose?.(), autoHideDuration);
        return () => clearTimeout(timer);
    }, [open, message, autoHideDuration, onClose]);

    if (!open) return null;

    const tone = {
        success: 'border-l-[var(--acc-green)]',
        error: 'border-l-[var(--col-error)]',
        warning: 'border-l-[var(--acc-gold)]',
        info: 'border-l-[var(--acc-teal)]',
    }[severity];

    const iconTone = {
        success: 'text-moss',
        error: 'text-danger',
        warning: 'text-gold',
        info: 'text-teal',
    }[severity];

    return createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[1400] flex justify-center px-4">
            <div
                role="status"
                className={cx(
                    'ui-raised pointer-events-auto flex min-w-[320px] max-w-full items-center gap-3 border-l-[3px] px-4 py-3 text-sm animate-fade-in',
                    tone,
                )}
            >
                {icon && <span className={cx('shrink-0', iconTone)}>{icon}</span>}
                <span className="min-w-0 flex-1">{message}</span>
                <IconButton size="small" aria-label="Dismiss" onClick={onClose}>
                    <X size={16} />
                </IconButton>
            </div>
        </div>,
        document.body,
    );
}
