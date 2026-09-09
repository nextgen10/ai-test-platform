import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bot, ChevronDown, FileSearch, FlaskConical, Layers, LogOut, Menu as MenuIcon, Sparkles, X,
} from 'lucide-react';

import { useAuth } from '@/auth/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { getAccents } from '@/theme';
import { UnifiedBrand, ProductName } from './brand';
import { cx } from './ui/cx';
import { Divider, IconButton } from './ui/primitives';
import { Drawer, Menu, MenuItem, MenuLabel } from './ui/overlays';

/** Horizontal inset shared by the nav bar and the landing footer so the brand mark lines up. */
export const NAV_CHROME_GUTTER = 'px-4 md:px-6';

function AdminMark({ size = 28, initials }) {
    return (
        <span
            aria-hidden
            className="grid shrink-0 place-items-center rounded-full bg-brand font-medium leading-none tracking-[0.08em] text-white"
            style={{ width: size, height: size, fontSize: size >= 36 ? '0.6875rem' : '0.5625rem' }}
        >
            {initials}
        </span>
    );
}

/**
 * The signed-in identity.
 *
 * With sign-in switched off this still renders — a console that shows nobody at
 * all reads as broken — but the menu says so rather than offering a sign-out
 * that cannot do anything.
 */
function AccountMenu({ expanded = false }) {
    const { enabled, account, name, email, initials, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const hostRef = useRef(null);

    const role = enabled ? (account ? 'Signed in' : 'Signed out') : 'Platform Administrator';

    return (
        <div className="relative" ref={hostRef}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={open}
                className="group m-0 inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-1 py-0 text-ink"
            >
                <AdminMark size={expanded ? 32 : 28} initials={initials} />
                <span className={cx('min-w-0 flex-col items-end', expanded ? 'flex' : 'hidden md:flex')}>
                    <span className="whitespace-nowrap text-[0.8125rem] leading-tight tracking-[-0.01em] transition-colors group-hover:text-brand">
                        {name}
                    </span>
                    <span className="mt-[1px] whitespace-nowrap text-[0.7rem] leading-tight text-brand">
                        {enabled ? email || role : '(Admin)'}
                    </span>
                </span>
            </button>

            {/*
              Match the Next AdminPlaceholder when auth is off: two disabled
              items ("Account settings", "Sign out") rather than a one-line
              "Sign-in is not enabled" note. When MSAL is on and someone is
              signed in, Sign out is the only live action.
            */}
            <Menu open={open} onClose={() => setOpen(false)} width={280} className="mt-2 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                    <AdminMark size={36} initials={initials} />
                    <div className="min-w-0 flex-1">
                        <p className="whitespace-nowrap text-sm font-medium leading-tight">{name}</p>
                        <p className="mt-0.5 whitespace-nowrap text-xs text-brand">{email || role}</p>
                    </div>
                </div>
                <Divider />
                {enabled && account ? (
                    <MenuItem
                        className="rounded-none px-4 py-[8.8px] text-[0.8125rem]"
                        onClick={() => {
                            setOpen(false);
                            signOut();
                        }}
                    >
                        <LogOut size={15} />
                        Sign out
                    </MenuItem>
                ) : (
                    <>
                        <MenuItem disabled className="rounded-none px-4 py-[8.8px] text-[0.8125rem]">
                            Account settings
                        </MenuItem>
                        <MenuItem disabled className="rounded-none px-4 py-[8.8px] text-[0.8125rem]">
                            Sign out
                        </MenuItem>
                    </>
                )}
            </Menu>
        </div>
    );
}

/**
 * Agent HUB navigation. Solid surface, hairline, text links — a product
 * header, not a frosted SaaS bar.
 */
export function UnifiedNavBar({
    items = [],
    useCases = [],
    onLogoClick,
    actions,
    centerContent,
    compact: compactProp,
    showProductName = true,
    pinned = false,
}) {
    const navigate = useNavigate();
    const { mode } = useThemeMode();
    const accents = getAccents(mode);
    const compact = compactProp ?? items.length > 6;

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [useCasesOpen, setUseCasesOpen] = useState(false);

    // The drawer is the small-screen affordance; leaving it mounted while the
    // viewport grows traps the page behind a scrim nothing can dismiss.
    useEffect(() => {
        const query = window.matchMedia('(min-width: 768px)');
        const sync = (event) => {
            if (event.matches) setDrawerOpen(false);
        };
        sync(query);
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    const USE_CASE_ICONS = {
        'flask-conical': <FlaskConical size={16} color={accents.brand} />,
        'file-search': <FileSearch size={16} color={accents.green} />,
        bot: <Bot size={16} color={accents.teal} />,
        layers: <Layers size={16} color={accents.gold} />,
    };

    const iconFor = (useCase) =>
        USE_CASE_ICONS[useCase.icon || ''] || <Sparkles size={16} color={accents.brand} />;

    const go = (path) => {
        setUseCasesOpen(false);
        setDrawerOpen(false);
        navigate(path);
    };

    const customUis = useCases.filter((uc) => uc.hasCustomUi);
    const consoleWorkflows = useCases.filter((uc) => !uc.hasCustomUi);

    const renderUseCaseItem = (uc) => (
        <MenuItem
            key={uc.id}
            onClick={() => go(uc.path)}
            className="flex-col items-start gap-1 whitespace-normal px-3 py-2.5"
        >
            <span className="flex w-full items-center gap-2">
                {iconFor(uc)}
                <span className="text-sm font-medium">{uc.label}</span>
            </span>
            <span className="line-clamp-2-box text-xs leading-relaxed text-subtle">{uc.description}</span>
        </MenuItem>
    );

    const navButtonClass = (active) =>
        cx(
            'inline-flex min-h-10 items-center whitespace-nowrap border-b-2 bg-transparent py-1.5 text-sm font-normal transition-colors',
            compact ? 'px-2.5' : 'px-3',
            active
                ? 'border-brand text-ink'
                : 'border-transparent text-subtle hover:border-hairline hover:text-ink',
        );

    const barHeight = 'h-[52px] md:h-[60px]';

    return (
        <>
            <header
                className={cx(
                    'left-0 right-0 top-0 z-[1200] w-full border-b border-hairline bg-surface',
                    pinned ? 'fixed' : 'sticky',
                )}
            >
                <div
                    className={cx(
                        'relative flex w-full max-w-full shrink-0 items-stretch justify-between gap-4 overflow-visible',
                        barHeight,
                        NAV_CHROME_GUTTER,
                    )}
                >
                    <div className="z-[1] flex min-w-0 shrink-0 items-center">
                        <UnifiedBrand onClick={onLogoClick} showProductName={showProductName} />
                    </div>

                    <div className="absolute left-1/2 hidden h-full min-w-0 max-w-[min(720px,calc(100%-420px))] -translate-x-1/2 items-stretch md:flex">
                        {centerContent || (
                            <nav className="flex items-stretch gap-0.5">
                                {items.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={item.onClick}
                                        className={navButtonClass(item.active)}
                                    >
                                        {item.label}
                                    </button>
                                ))}

                                <div className="relative flex items-stretch">
                                    <button
                                        type="button"
                                        onClick={() => setUseCasesOpen((value) => !value)}
                                        className={cx(navButtonClass(useCasesOpen), 'gap-1')}
                                    >
                                        Use Cases
                                        <ChevronDown
                                            size={14}
                                            className={cx('transition-transform', useCasesOpen && 'rotate-180')}
                                        />
                                    </button>

                                    <Menu
                                        open={useCasesOpen}
                                        onClose={() => setUseCasesOpen(false)}
                                        width={360}
                                        className="p-1"
                                    >
                                        {customUis.length > 0 && (
                                            <>
                                                <MenuLabel>Custom UIs</MenuLabel>
                                                {customUis.map(renderUseCaseItem)}
                                            </>
                                        )}
                                        {consoleWorkflows.length > 0 && (
                                            <>
                                                {customUis.length > 0 && <Divider className="my-1" />}
                                                <MenuLabel>Agent Console</MenuLabel>
                                                {consoleWorkflows.map(renderUseCaseItem)}
                                            </>
                                        )}
                                        <Divider className="my-1" />
                                        <MenuItem
                                            onClick={() => go('/use-cases')}
                                            className="text-[0.8125rem] font-medium text-brand"
                                        >
                                            <Layers size={14} />
                                            Browse all use cases
                                        </MenuItem>
                                    </Menu>
                                </div>
                            </nav>
                        )}
                    </div>

                    <div className="z-[1] flex shrink-0 items-center gap-0.5 md:gap-1">
                        <AccountMenu />
                        <div className="ml-0.5 flex items-center border-l border-hairline pl-0.5 md:ml-1 md:pl-1">
                            {actions}
                        </div>
                        {(items.length > 0 || useCases.length > 0) && (
                            <IconButton
                                aria-label="Open navigation menu"
                                onClick={() => setDrawerOpen(true)}
                                className="md:hidden"
                            >
                                <MenuIcon size={20} />
                            </IconButton>
                        )}
                    </div>
                </div>
            </header>

            {/* A pinned bar is out of flow, so the page needs its height back. */}
            {pinned && <div aria-hidden className={cx('shrink-0', barHeight)} />}

            {(items.length > 0 || useCases.length > 0) && (
                <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                    <div className="mb-4 flex items-center justify-between">
                        {showProductName ? <ProductName variant="nav" /> : <UnifiedBrand showProductName={false} />}
                        <IconButton size="small" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
                            <X size={18} />
                        </IconButton>
                    </div>
                    <Divider className="mb-3" />
                    <div className="mb-4">
                        <AccountMenu expanded />
                    </div>

                    <MenuLabel>Platform</MenuLabel>
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                item.onClick?.();
                                setDrawerOpen(false);
                            }}
                            className={cx(
                                'mb-1 flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left text-[0.9rem]',
                                item.active
                                    ? 'border-brand bg-sunken font-medium'
                                    : 'border-transparent hover:bg-surface-hover',
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}

                    {customUis.length > 0 && (
                        <>
                            <Divider className="my-3" />
                            <MenuLabel>Custom UIs</MenuLabel>
                            {customUis.map((uc) => (
                                <button
                                    key={uc.id}
                                    type="button"
                                    onClick={() => go(uc.path)}
                                    className="mb-1 flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.86rem] font-medium hover:bg-surface-hover"
                                >
                                    {iconFor(uc)}
                                    {uc.label}
                                </button>
                            ))}
                        </>
                    )}

                    {consoleWorkflows.length > 0 && (
                        <>
                            <Divider className="my-3" />
                            <MenuLabel>Agent Console</MenuLabel>
                            {consoleWorkflows.map((uc) => (
                                <button
                                    key={uc.id}
                                    type="button"
                                    onClick={() => go(uc.path)}
                                    className="mb-1 flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.86rem] font-medium hover:bg-surface-hover"
                                >
                                    {iconFor(uc)}
                                    {uc.label}
                                </button>
                            ))}
                        </>
                    )}
                </Drawer>
            )}
        </>
    );
}

export default UnifiedNavBar;
