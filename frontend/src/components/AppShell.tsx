'use client';

import React from 'react';
import { Box } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, Sparkles, ListChecks, BookOpen, Bot, Gauge, SlidersHorizontal, Home,
} from 'lucide-react';

import ThemeToggle from '@/components/ThemeToggle';
import { UnifiedNavBar } from '@/components/UnifiedNavBar';
import { navItems } from '@/config/nav';

const ICONS: Record<string, React.ReactNode> = {
    home: <Home size={16} />,
    dashboard: <LayoutDashboard size={16} />,
    generate: <Sparkles size={16} />,
    jobs: <ListChecks size={16} />,
    docs: <BookOpen size={16} />,
    settings: <SlidersHorizontal size={16} />,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    // The landing page is full-bleed and renders its own marketing nav bar, so
    // the app chrome would duplicate it.
    if (pathname === '/') return <>{children}</>;

    const items = navItems.map((item) => ({
        id: item.path,
        label: item.label,
        icon: ICONS[item.id],
        active: pathname === item.path || pathname.startsWith(item.path + '/'),
        onClick: () => router.push(item.path),
    }));

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                bgcolor: 'background.default',
                color: 'text.primary',
            }}
        >
            <UnifiedNavBar
                title="Analytic Genie"
                items={items}
                onLogoClick={() => router.push('/')}
                actions={<ThemeToggle />}
            />

            <Box
                component="main"
                sx={{
                    width: '100%',
                    flexGrow: 1,
                    px: { xs: 2, md: 4 },
                    pt: 3,
                    pb: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: 1536,
                    mx: 'auto',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
