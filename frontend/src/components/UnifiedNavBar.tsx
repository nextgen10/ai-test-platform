'use client';

import React, { useEffect, useState } from 'react';
import {
    Box, Button, Typography, useTheme, useMediaQuery,
    IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider,
    Menu, MenuItem,
} from '@mui/material';
import {
    Menu as MenuIcon, X, ChevronDown, FlaskConical, Bot, FileSearch, Layers, Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UbsLogoFull } from './UbsLogoFull';
import { BrandPipe } from './BrandPipe';
import ProductName from './ProductName';
import { getAccents } from '@/theme';
import { type UseCaseItem } from '@/config/nav';

export interface NavItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
}

export interface UnifiedNavBarProps {
    items?: NavItem[];
    useCases?: UseCaseItem[];
    onLogoClick?: () => void;
    actions?: React.ReactNode;
    centerContent?: React.ReactNode;
    alignLinks?: 'center' | 'right';
    compact?: boolean;
    /** Hide the product wordmark; UBS logo remains. Landing page only. */
    showProductName?: boolean;
    /** Pin the bar to the viewport so page content scrolls underneath. */
    pinned?: boolean;
}

/**
 * UBS logo, optional hairline pipe and Agent (red) HUB (body).
 */
export const UnifiedBrand: React.FC<{ onClick?: () => void; showProductName?: boolean }> = ({
    onClick,
    showProductName = true,
}) => {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, sm: 1.5 },
                cursor: onClick ? 'pointer' : 'default',
                minWidth: 0,
                overflow: 'hidden',
                userSelect: 'none',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    '& svg': { height: { xs: 22, md: 26 }, width: 'auto' },
                }}
            >
                <UbsLogoFull
                    height={26}
                    keysColor={isLight ? theme.palette.text.primary : theme.palette.primary.main}
                    wordmarkColor={isLight ? theme.palette.primary.main : '#FFFFFF'}
                />
            </Box>
            {showProductName && (
                <>
                    <BrandPipe />
                    <ProductName variant="nav" />
                </>
            )}
        </Box>
    );
};

/**
 * Agent HUB navigation. Solid surface, hairline, text links — the ubs.com header,

 * not a frosted SaaS bar.
 */
export const UnifiedNavBar: React.FC<UnifiedNavBarProps> = ({
    items = [],
    useCases = [],
    onLogoClick,
    actions,
    centerContent,
    alignLinks = 'center',
    compact: compactProp,
    showProductName = true,
    pinned = false,
}) => {
    const router = useRouter();
    const compact = compactProp ?? items.length > 6;
    const theme = useTheme();
    const accents = getAccents(theme.palette.mode);

    const USE_CASE_ICONS: Record<string, React.ReactNode> = {
        'flask-conical': <FlaskConical size={16} color={accents.brand} />,
        'file-search': <FileSearch size={16} color={accents.green} />,
        'bot': <Bot size={16} color={accents.teal} />,
        'layers': <Layers size={16} color={accents.gold} />,
    };

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [useCasesAnchorEl, setUseCasesAnchorEl] = useState<null | HTMLElement>(null);
    const isUseCasesOpen = Boolean(useCasesAnchorEl);

    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    useEffect(() => {
        if (isDesktop) setDrawerOpen(false);
    }, [isDesktop]);

    const handleOpenUseCases = (event: React.MouseEvent<HTMLButtonElement>) => {
        setUseCasesAnchorEl(event.currentTarget);
    };

    const handleCloseUseCases = () => {
        setUseCasesAnchorEl(null);
    };

    const handleSelectUseCase = (path: string) => {
        handleCloseUseCases();
        router.push(path);
    };

    const customUis = useCases.filter((uc) => uc.hasCustomUi);
    const consoleWorkflows = useCases.filter((uc) => !uc.hasCustomUi);

    const renderUseCaseItem = (uc: UseCaseItem) => (
        <MenuItem
            key={uc.id}
            onClick={() => handleSelectUseCase(uc.path)}
            sx={{
                borderRadius: 2,
                py: 1.25,
                px: 1.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.5,
                whiteSpace: 'normal',
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {USE_CASE_ICONS[uc.icon || ''] || <Sparkles size={16} color={theme.palette.primary.main} />}
                    <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {uc.label}
                    </Typography>
                </Box>
            </Box>
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {uc.description}
            </Typography>
        </MenuItem>
    );

    const navButtonSx = (active?: boolean) => ({
        px: compact ? 1.25 : 1.5,
        py: 0.75,
        minHeight: 40,
        borderRadius: 0,
        fontSize: '0.875rem',
        fontWeight: 400,
        minWidth: 'auto',
        whiteSpace: 'nowrap',
        textTransform: 'none' as const,
        color: active ? 'text.primary' : 'text.secondary',
        bgcolor: 'transparent',
        boxShadow: 'none',
        borderBottom: '2px solid',
        borderColor: active ? 'primary.main' : 'transparent',
        '&:hover': {
            color: 'text.primary',
            bgcolor: 'transparent',
            borderColor: active ? 'primary.main' : 'divider',
        },
    });

    const renderNavButtons = () => (
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.25 }}>
            {items.map((item) => (
                <Button
                    key={item.id}
                    onClick={item.onClick}
                    variant="text"
                    sx={navButtonSx(item.active)}
                >
                    {item.label}
                </Button>
            ))}

            {useCases && useCases.length > 0 && (
                <Button
                    onClick={handleOpenUseCases}
                    endIcon={<ChevronDown size={14} style={{ transform: isUseCasesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />}
                    variant="text"
                    sx={navButtonSx(isUseCasesOpen)}
                >
                    Use Cases
                </Button>
            )}
        </Box>
    );

    return (
        <>
            <Box
                component="header"
                sx={{
                    position: pinned ? 'fixed' : 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1200,
                    width: '100%',
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Box
                    sx={{
                        height: { xs: 52, md: 60 },
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        px: { xs: 2, md: 3 },
                        width: '100%',
                        maxWidth: '100%',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', zIndex: 1, minWidth: 0, flexShrink: 0 }}>
                        <UnifiedBrand onClick={onLogoClick} showProductName={showProductName} />
                    </Box>

                    {alignLinks === 'center' && (
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'flex' },
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                alignItems: 'stretch',
                                minWidth: 0,
                                maxWidth: '64vw',
                                height: '100%',
                            }}
                        >
                            {centerContent || renderNavButtons()}
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, flexShrink: 0, zIndex: 1 }}>
                        {alignLinks === 'right' && (
                            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'stretch', height: '100%' }}>
                                {centerContent || renderNavButtons()}
                            </Box>
                        )}
                        {actions}
                        {(items.length > 0 || (useCases && useCases.length > 0)) && (
                            <IconButton
                                aria-label="Open navigation menu"
                                onClick={() => setDrawerOpen(true)}
                                sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.primary' }}
                            >
                                <MenuIcon size={20} />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Box>
            {pinned && (
                <Box aria-hidden sx={{ height: { xs: 52, md: 60 }, flexShrink: 0 }} />
            )}

            <Menu
                anchorEl={useCasesAnchorEl}
                open={isUseCasesOpen}
                onClose={handleCloseUseCases}
                disableScrollLock
                disableAutoFocus
                disableEnforceFocus
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                    paper: {
                        elevation: 0,
                        sx: {
                            mt: 0,
                            width: 360,
                            maxHeight: 'min(480px, calc(100vh - 72px))',
                            p: 0.5,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            boxShadow: (t) => t.palette.mode === 'light'
                                ? '0 2px 6px rgba(0,0,0,0.06)'
                                : 'none',
                        },
                    },
                }}
            >
                {[
                    ...(customUis.length > 0
                        ? [
                            <Box key="custom-uis-label" sx={{ px: 1.5, py: 1.25 }}>
                                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                    Custom UIs
                                </Typography>
                            </Box>,
                            ...customUis.map(renderUseCaseItem),
                        ]
                        : []),
                    ...(consoleWorkflows.length > 0
                        ? [
                            <Divider key="console-divider" sx={{ my: 0.5 }} />,
                            <Box key="console-label" sx={{ px: 1.5, py: 1.25 }}>
                                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                    Agent Console
                                </Typography>
                            </Box>,
                            ...consoleWorkflows.map(renderUseCaseItem),
                        ]
                        : []),
                    <Divider key="browse-divider" sx={{ my: 0.5 }} />,
                    <MenuItem
                        key="browse-all"
                        onClick={() => handleSelectUseCase('/use-cases')}
                        sx={{ borderRadius: 2, py: 1, fontSize: '0.8125rem', fontWeight: 500, color: 'primary.main' }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Layers size={14} />
                            <span>Browse all use cases</span>
                        </Box>
                    </MenuItem>,
                ]}
            </Menu>

            {(items.length > 0 || (useCases && useCases.length > 0)) && (
                <Drawer
                    anchor="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    PaperProps={{
                        sx: { width: 300, p: 2, bgcolor: 'background.paper', borderRadius: 0 },
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        {showProductName ? (
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                <ProductName variant="nav" />
                            </Typography>
                        ) : (
                            <UnifiedBrand showProductName={false} />
                        )}
                        <IconButton size="small" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
                            <X size={18} />
                        </IconButton>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <List sx={{ px: 0, py: 0 }}>
                        <Typography variant="overline" sx={{ px: 1, color: 'text.secondary' }}>
                            Platform
                        </Typography>
                        {items.map((item) => (
                            <ListItemButton
                                key={item.id}
                                onClick={() => {
                                    item.onClick?.();
                                    setDrawerOpen(false);
                                }}
                                sx={{
                                    borderRadius: 2,
                                    mb: 0.5,
                                    bgcolor: item.active ? 'action.selected' : 'transparent',
                                    color: item.active ? 'text.primary' : 'text.primary',
                                    borderLeft: '2px solid',
                                    borderColor: item.active ? 'primary.main' : 'transparent',
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                {item.icon && <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>{item.icon}</ListItemIcon>}
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{ fontWeight: item.active ? 500 : 400, fontSize: '0.9rem' }}
                                />
                            </ListItemButton>
                        ))}

                        {customUis.length > 0 && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="overline" sx={{ px: 1, color: 'text.secondary' }}>
                                    Custom UIs
                                </Typography>
                                {customUis.map((uc) => (
                                    <ListItemButton
                                        key={uc.id}
                                        onClick={() => {
                                            router.push(uc.path);
                                            setDrawerOpen(false);
                                        }}
                                        sx={{ borderRadius: 2, mb: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            {USE_CASE_ICONS[uc.icon || ''] || <Sparkles size={16} color={theme.palette.primary.main} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={uc.label}
                                            primaryTypographyProps={{ fontWeight: 500, fontSize: '0.86rem' }}
                                        />
                                    </ListItemButton>
                                ))}
                            </>
                        )}

                        {consoleWorkflows.length > 0 && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="overline" sx={{ px: 1, color: 'text.secondary' }}>
                                    Agent Console
                                </Typography>
                                {consoleWorkflows.map((uc) => (
                                    <ListItemButton
                                        key={uc.id}
                                        onClick={() => {
                                            router.push(uc.path);
                                            setDrawerOpen(false);
                                        }}
                                        sx={{ borderRadius: 2, mb: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            {USE_CASE_ICONS[uc.icon || ''] || <Sparkles size={16} color={theme.palette.primary.main} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={uc.label}
                                            primaryTypographyProps={{ fontWeight: 500, fontSize: '0.86rem' }}
                                        />
                                    </ListItemButton>
                                ))}
                            </>
                        )}
                    </List>
                </Drawer>
            )}
        </>
    );
};
