import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AlarmClock, BookOpen, Bot, ChevronRight, FlaskConical, Home, Layers,
    LayoutDashboard, ListChecks, SlidersHorizontal,
} from 'lucide-react';

import { coreNavItems, mapWorkflowsToUseCases } from '@/config/nav';
import { hubApi } from '@/lib/hub-api';
import ThemeToggle from './ThemeToggle';
import UnifiedNavBar from './UnifiedNavBar';
import { ProductName } from './brand';
import { cx } from './ui/cx';
import { Chip } from './ui/primitives';

const ICONS = {
    home: <Home size={16} />,
    chat: <Bot size={16} />,
    registry: <Layers size={16} />,
    'use-cases': <FlaskConical size={16} />,
    automation: <AlarmClock size={16} />,
    dashboard: <LayoutDashboard size={16} />,
    jobs: <ListChecks size={16} />,
    docs: <BookOpen size={16} />,
    settings: <SlidersHorizontal size={16} />,
};

export default function AppShell() {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    // Use cases are whatever the registry says they are, so onboarding a
    // workflow with a custom UI adds it to the navigation on its own.
    const [useCases, setUseCases] = useState([]);
    useEffect(() => {
        hubApi
            .listWorkflows()
            .then((workflows) => setUseCases(mapWorkflowsToUseCases(workflows)))
            .catch(() => setUseCases([]));
    }, []);

    // The landing page is full-bleed and renders its own marketing nav bar.
    // Hooks above this line run unconditionally, as the rules of hooks require.
    if (pathname === '/') return <Outlet />;

    const items = coreNavItems.map((item) => ({
        id: item.path,
        label: item.label,
        icon: ICONS[item.id],
        active: pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`)),
        onClick: () => navigate(item.path),
    }));

    // Chat, Test Design and Workflow Builder fill the viewport below the
    // chrome; other pages scroll normally inside a padded container.
    const isImmersive =
        pathname === '/chat' ||
        pathname.startsWith('/chat/') ||
        pathname === '/generate' ||
        pathname.startsWith('/generate/') ||
        pathname.startsWith('/use-cases/workflow-builder');

    // A workflow that launches in the Console lives at `/chat?workflow=…`;
    // that must not paint a use-case ribbon over the Console itself.
    const activeUseCase = useCases.find((uc) => {
        const base = uc.path.split('?')[0];
        if (!base || base === '/' || base === '/chat') return false;
        return pathname === base || pathname.startsWith(`${base}/`);
    });

    return (
        <div
            className={cx(
                'flex min-h-screen flex-col overflow-x-hidden bg-surface text-ink',
                isImmersive && 'h-screen overflow-hidden',
            )}
        >
            {/*
              Fixed, not sticky, on every page that scrolls: this container sets
              `overflow-x: hidden`, and an ancestor with any non-visible overflow
              becomes the sticky containing block — so the bar would stick to the
              top of *that* box and scroll away with it. Immersive routes need no
              pinning; that shell is 100vh and only the panels inside it scroll.
            */}
            <UnifiedNavBar
                items={items}
                useCases={useCases}
                pinned={!isImmersive}
                onLogoClick={() => navigate('/')}
                actions={<ThemeToggle />}
            />

            {activeUseCase && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-sunken px-4 py-[7px] sm:px-6 md:px-8">
                    <nav aria-label="breadcrumb" className="flex items-center gap-2 text-[0.8rem] font-medium">
                        <button type="button" onClick={() => navigate('/')} className="cursor-pointer">
                            <ProductName variant="inline" />
                        </button>
                        <ChevronRight size={13} className="text-subtle" />
                        <button
                            type="button"
                            onClick={() => navigate('/registry?tab=workflows')}
                            className="cursor-pointer hover:text-brand"
                        >
                            Use Cases
                        </button>
                        <ChevronRight size={13} className="text-subtle" />
                        <span className="flex items-center gap-1.5">
                            <FlaskConical size={14} className="text-brand" />
                            <span className="font-medium text-ink">{activeUseCase.label}</span>
                            <Chip color="primary" className="h-[18px] px-1.5 text-[0.65rem] font-medium">
                                Bespoke UI
                            </Chip>
                        </span>
                    </nav>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => navigate(`/chat?workflow=${activeUseCase.id}`)}
                            className="ui-btn ui-btn-text ui-btn-sm px-2 text-[0.76rem]"
                        >
                            <Bot size={14} className="text-brand" />
                            Open in Agent Console
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/registry')}
                            className="ui-btn ui-btn-text ui-btn-sm px-2 text-[0.76rem] text-subtle"
                        >
                            <Layers size={14} />
                            View Registry
                        </button>
                    </div>
                </div>
            )}

            {isImmersive ? (
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <Outlet />
                </main>
            ) : (
                <main className="ui-container flex grow flex-col px-4 py-6 sm:px-6 md:px-8">
                    <Outlet />
                </main>
            )}
        </div>
    );
}
