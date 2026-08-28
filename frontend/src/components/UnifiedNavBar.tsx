'use client';

import React, { useEffect, useState } from 'react';
import {
    Box, Button, Container, Typography, useTheme, useMediaQuery, alpha,
    IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider,
    Menu, MenuItem, Chip,
} from '@mui/material';
import {
    Menu as MenuIcon, X, ChevronDown, FlaskConical, Bot, FileSearch, Layers, Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UbsLogoFull } from './UbsLogoFull';
import { BrandPipe } from './BrandPipe';
import AnimatedQualarisWord from './AnimatedQualarisWord';
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
}

const USE_CASE_ICONS: Record<string, React.ReactNode> = {
    'flask-conical': <FlaskConical size={18} color="#D00000" />,
    'file-search': <FileSearch size={18} color="#10B981" />,
    'bot': <Bot size={18} color="#3B82F6" />,
    'layers': <Layers size={18} color="#F59E0B" />,
};

/**
 * Unified Brand Logo + Pipe + Platform Name component.
 */
export const UnifiedBrand: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
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
            <BrandPipe />
            <Typography
                variant="h6"
                component="div"
                sx={{
                    fontWeight: 800,
                    minWidth: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: 1,
                }}
            >
                <AnimatedQualarisWord sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' } }} />
            </Typography>
        </Box>
    );
};

/**
 * Agent HUB unified navigation bar.
 * Separates Core Platform navigation links from Bespoke Use Cases.
 */
export const UnifiedNavBar: React.FC<UnifiedNavBarProps> = ({
    items = [],
    useCases = [],
    onLogoClick,
    actions,
    centerContent,
    alignLinks = 'center',
    compact: compactProp,
}) => {
    const router = useRouter();
    const compact = compactProp ?? items.length > 6;
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

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

    const renderNavButtons = () => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Core Platform Links */}
            {items.map((item) => (
                <Button
                    key={item.id}
                    onClick={item.onClick}
                    startIcon={compact ? undefined : item.icon}
                    variant="text"
                    sx={{
                        px: compact ? 1.25 : 1.5,
                        py: 0.75,
                        borderRadius: 1,
                        fontSize: compact ? '0.78rem' : '0.84rem',
                        minWidth: 'auto',
                        whiteSpace: 'nowrap',
                        textTransform: 'none',
                        color: item.active ? 'primary.main' : 'text.secondary',
                        bgcolor: item.active ? (isLight ? '#FFE5E5' : alpha(theme.palette.primary.main, 0.12)) : 'transparent',
                        fontWeight: item.active ? 700 : 600,
                        '&:hover': {
                            color: 'text.primary',
                            bgcolor: item.active
                                ? (isLight ? '#FFE5E5' : alpha(theme.palette.primary.main, 0.12))
                                : 'action.hover',
                        },
                    }}
                >
                    {item.label}
                </Button>
            ))}

            {/* Bespoke Use Cases Dropdown Trigger */}
            {useCases && useCases.length > 0 && (
                <>
                    <Button
                        onClick={handleOpenUseCases}
                        endIcon={<ChevronDown size={14} style={{ transform: isUseCasesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                        variant="outlined"
                        size="small"
                        sx={{
                            ml: 0.5,
                            px: 1.5,
                            py: 0.65,
                            borderRadius: 1.5,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            borderColor: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
                            color: isLight ? '#1e293b' : '#e2e8f0',
                            bgcolor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                            '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                            },
                        }}
                    >
                        Use Cases
                    </Button>

                    <Menu
                        anchorEl={useCasesAnchorEl}
                        open={isUseCasesOpen}
                        onClose={handleCloseUseCases}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                mt: 1,
                                width: 340,
                                p: 1,
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: isLight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                                bgcolor: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(18,22,29,0.75)',
                                backdropFilter: 'blur(24px)',
                                boxShadow: isLight ? '0 12px 40px -12px rgba(0,0,0,0.15)' : '0 12px 40px -12px rgba(0,0,0,0.6)',
                            },
                        }}
                    >
                        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', mb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Bespoke Use Cases &amp; Custom UIs
                            </Typography>
                        </Box>

                        {useCases.map((uc) => (
                            <MenuItem
                                key={uc.id}
                                onClick={() => handleSelectUseCase(uc.path)}
                                sx={{
                                    borderRadius: 1.5,
                                    py: 1.25,
                                    px: 1.5,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {USE_CASE_ICONS[uc.icon || ''] || <Sparkles size={16} color={theme.palette.primary.main} />}
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                        {uc.label}
                                    </Typography>
                                  </Box>
                                  {uc.badge && (
                                    <Chip
                                      label={uc.badge}
                                      size="small"
                                      color={uc.hasCustomUi ? 'primary' : 'default'}
                                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.76rem', lineHeight: 1.4 }}>
                                    {uc.description}
                                </Typography>
                            </MenuItem>
                        ))}

                        <Divider sx={{ my: 1 }} />
                        <MenuItem
                            onClick={() => handleSelectUseCase('/use-cases')}
                            sx={{ borderRadius: 1.5, py: 0.75, fontSize: '0.8rem', fontWeight: 600, color: 'primary.main' }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Layers size={14} />
                                <span>Browse All Use Cases &rarr;</span>
                            </Box>
                        </MenuItem>
                    </Menu>
                </>
            )}
        </Box>
    );

    return (
        <>
            <Box
                component="header"
                sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1200,
                    width: '100%',
                    bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(255,255,255,0.75)' : 'rgba(18,22,29,0.75)',
                    backdropFilter: 'blur(24px)',
                    borderBottom: '1px solid',
                    borderColor: (t) => t.palette.mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    boxShadow: (t) => t.palette.mode === 'light' ? '0 4px 30px rgba(0,0,0,0.03)' : '0 4px 30px rgba(0,0,0,0.3)',
                }}
            >
                <Container
                    maxWidth="xl"
                    sx={{
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        px: { xs: 2, sm: 3, md: 4 },
                        position: 'relative',
                    }}
                >
                    {/* Brand */}
                    <Box sx={{ display: 'flex', alignItems: 'center', zIndex: 1, minWidth: 0, flexShrink: 0 }}>
                        <UnifiedBrand onClick={onLogoClick} />
                    </Box>

                    {/* Center links (if alignLinks is 'center') */}
                    {alignLinks === 'center' && (
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'flex' },
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                alignItems: 'center',
                                gap: 0.5,
                                minWidth: 0,
                                maxWidth: '64vw',
                            }}
                        >
                            {centerContent || renderNavButtons()}
                        </Box>
                    )}

                    {/* Right side */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, flexShrink: 0, zIndex: 1 }}>
                        {alignLinks === 'right' && (
                            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
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
                </Container>
            </Box>

            {/* Mobile Drawer */}
            {(items.length > 0 || (useCases && useCases.length > 0)) && (
                <Drawer
                    anchor="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    PaperProps={{
                        sx: { width: 300, p: 2, bgcolor: 'background.paper' },
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            Agent HUB
                        </Typography>
                        <IconButton size="small" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
                            <X size={18} />
                        </IconButton>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <List sx={{ px: 0, py: 0 }}>
                        <Typography variant="caption" sx={{ px: 1, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
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
                                    borderRadius: 1.5,
                                    mb: 0.5,
                                    bgcolor: item.active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                    color: item.active ? 'primary.main' : 'text.primary',
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                }}
                            >
                                {item.icon && <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>{item.icon}</ListItemIcon>}
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{ fontWeight: item.active ? 700 : 600, fontSize: '0.9rem' }}
                                />
                            </ListItemButton>
                        ))}

                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="caption" sx={{ px: 1, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
                            Bespoke Use Cases
                        </Typography>
                        {useCases.map((uc) => (
                            <ListItemButton
                                key={uc.id}
                                onClick={() => {
                                    router.push(uc.path);
                                    setDrawerOpen(false);
                                }}
                                sx={{ borderRadius: 1.5, mb: 0.5 }}
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    {USE_CASE_ICONS[uc.icon || ''] || <Sparkles size={16} color={theme.palette.primary.main} />}
                                </ListItemIcon>
                                <ListItemText
                                    primary={uc.label}
                                    secondary={uc.badge}
                                    primaryTypographyProps={{ fontWeight: 700, fontSize: '0.86rem' }}
                                    secondaryTypographyProps={{ fontSize: '0.72rem' }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Drawer>
            )}
        </>
    );
};
