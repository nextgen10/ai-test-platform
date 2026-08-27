'use client';

import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Chip, Button, Breadcrumbs, useTheme } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, ListChecks, BookOpen, SlidersHorizontal, Home, Bot, Layers,
    ChevronRight, FlaskConical, AlarmClock,
} from 'lucide-react';

import ThemeToggle from '@/components/ThemeToggle';
import { UnifiedNavBar } from '@/components/UnifiedNavBar';
import { coreNavItems, mapWorkflowsToUseCases, type UseCaseItem } from '@/config/nav';
import { hubApi } from '@/lib/hub-api';

const ICONS: Record<string, React.ReactNode> = {
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

export default function AppShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    // Use cases are whatever the registry says they are, so onboarding a
    // workflow with a custom UI adds it to the navigation on its own.
    const [useCases, setUseCases] = useState<UseCaseItem[]>([]);
    useEffect(() => {
        hubApi
            .listWorkflows()
            .then((workflows) => setUseCases(mapWorkflowsToUseCases(workflows)))
            .catch(() => setUseCases([]));
    }, []);

    // The landing page is full-bleed and renders its own marketing nav bar.
    // Hooks above this line run unconditionally, as the rules of hooks require.
    if (pathname === '/') return <>{children}</>;

    const items = coreNavItems.map((item) => ({
        id: item.path,
        label: item.label,
        icon: ICONS[item.id],
        active: pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path + '/')),
        onClick: () => router.push(item.path),
    }));

    // Chat page takes full viewport below nav without outer container margins
    const isChat = pathname === '/chat';

    // Check if current route is a bespoke use case
    const activeUseCase = useCases.find((uc) => {
        const base = uc.path.split('?')[0];
        return pathname === base || pathname.startsWith(base + '/');
    });

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                bgcolor: 'background.default',
                color: 'text.primary',
                overflowX: 'hidden',
            }}
        >
            <UnifiedNavBar
                items={items}
                useCases={useCases}
                onLogoClick={() => router.push('/')}
                actions={<ThemeToggle />}
            />

            {/* Bespoke Use Case Context & Breadcrumb Ribbon */}
            {activeUseCase && (
                <Box
                    sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isLight ? 'rgba(208, 0, 0, 0.03)' : 'rgba(208, 0, 0, 0.08)',
                        px: { xs: 2, sm: 3, md: 4 },
                        py: 0.85,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1.5,
                    }}
                >
                    <Breadcrumbs
                        separator={<ChevronRight size={13} />}
                        aria-label="breadcrumb"
                        sx={{
                            '& .MuiBreadcrumbs-li': { fontSize: '0.8rem', fontWeight: 600 },
                        }}
                    >
                        <Typography
                            color="inherit"
                            onClick={() => router.push('/')}
                            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                        >
                            Agent HUB
                        </Typography>
                        <Typography
                            color="inherit"
                            onClick={() => router.push('/registry?tab=workflows')}
                            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                        >
                            Use Cases
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <FlaskConical size={14} color={theme.palette.primary.main} />
                            <Typography color="text.primary" sx={{ fontWeight: 800 }}>
                                {activeUseCase.label}
                            </Typography>
                            <Chip
                                label="Bespoke UI"
                                size="small"
                                color="primary"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }}
                            />
                        </Box>
                    </Breadcrumbs>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                            size="small"
                            variant="text"
                            color="inherit"
                            startIcon={<Bot size={14} color={theme.palette.primary.main} />}
                            onClick={() => router.push(`/chat?workflow=${activeUseCase.id}`)}
                            sx={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'none', px: 1 }}
                        >
                            Open in Agent Console
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            color="inherit"
                            startIcon={<Layers size={14} />}
                            onClick={() => router.push('/registry')}
                            sx={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'none', px: 1, color: 'text.secondary' }}
                        >
                            View Registry
                        </Button>
                    </Box>
                </Box>
            )}

            {isChat ? (
                <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    {children}
                </Box>
            ) : (
                <Container
                    component="main"
                    maxWidth="xl"
                    sx={{
                        flexGrow: 1,
                        px: { xs: 2, sm: 3, md: 4 },
                        py: 3,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {children}
                </Container>
            )}
        </Box>
    );
}
