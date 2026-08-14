'use client';

import React, { useState } from 'react';
import {
    Box, Button, Container, Typography, useTheme, alpha,
    IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon, X } from 'lucide-react';
import { UbsLogoFull } from './UbsLogoFull';
import { BrandPipe } from './BrandPipe';
import AnimatedQualarisWord from './AnimatedQualarisWord';

interface NavItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
}

interface UnifiedNavBarProps {
    title: string;
    items: NavItem[];
    onLogoClick?: () => void;
    actions?: React.ReactNode;
    centerContent?: React.ReactNode;
    compact?: boolean;  // auto-set true when items.length > 6
}

/**
 * UBS-style navigation bar: clean, minimal, professional.
 * Collapses to hamburger drawer on mobile/tablet.
 */
export const UnifiedNavBar: React.FC<UnifiedNavBarProps> = ({
    title,
    items,
    onLogoClick,
    actions,
    centerContent,
    compact: compactProp,
}) => {
    const compact = compactProp ?? items.length > 6;
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [drawerOpen, setDrawerOpen] = useState(false);

    const renderTitle = (titleStr: string) => {
        const parts = titleStr.split(' ');
        const evalIdx = parts.findIndex(p => p.toUpperCase() === 'EVAL');
        const lastWord = parts[parts.length - 1].toUpperCase();
        const titleSx = {
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'text.primary',
            whiteSpace: 'nowrap',
            fontSize: { xs: '0.95rem', md: '1.05rem' },
        };
        const titleUpper = titleStr.toUpperCase();
        const isGenie = titleUpper.includes('GENIE') || titleUpper === 'QUALARIS';

        if (titleUpper === 'ANALYTIC GENIE' || titleUpper === 'QUALARIS') {
            return (
                <Typography variant="h6" sx={titleSx}>
                    <AnimatedQualarisWord word="Analytic Genie" />
                </Typography>
            );
        }

        if (evalIdx >= 0 && evalIdx < parts.length - 1) {
            const mainPart = parts.slice(0, evalIdx).join(' ');
            const redPart = parts.slice(evalIdx).join(' ');
            return (
                <Typography variant="h6" sx={titleSx}>
                    {mainPart}{mainPart ? ' ' : ''}<Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{redPart}</Box>
                </Typography>
            );
        }
        if (parts.length > 1 && (lastWord === 'EVAL' || lastWord === 'DOCS' || lastWord === 'GENERATOR' || lastWord === 'COMPASS' || lastWord === 'GENIE')) {
            const mainPart = parts.slice(0, -1).join(' ');
            return (
                <Typography variant="h6" sx={titleSx}>
                    {mainPart} <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{parts[parts.length - 1]}</Box>
                </Typography>
            );
        }
        return <Typography variant="h6" sx={titleSx}>{titleStr}</Typography>;
    };

    return (
        <>
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1200,
                    width: '100%',
                    bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(18,22,29,0.92)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Container
                    maxWidth="xl"
                    sx={{
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: { xs: 2, sm: 3, md: 4 },
                        position: 'relative',
                    }}
                >
                    {/* Brand */}
                    <Box sx={{ display: 'flex', alignItems: 'center', zIndex: 1 }}>
                        <Box onClick={onLogoClick} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
                            <UbsLogoFull
                                height={isMobile ? 22 : 26}
                                keysColor={isLight ? theme.palette.text.primary : theme.palette.primary.main}
                                wordmarkColor={isLight ? theme.palette.primary.main : '#FFFFFF'}
                            />
                            <BrandPipe />
                            {renderTitle(title)}
                        </Box>
                    </Box>

                    {/* Desktop: centered nav links/content */}
                    {!isMobile && (
                        <Box
                            sx={{
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.25,
                                minWidth: 0,
                                maxWidth: '62vw',
                            }}
                        >
                            {centerContent || items.map((item) => (
                                <Button
                                    key={item.id}
                                    onClick={item.onClick}
                                    startIcon={compact ? undefined : item.icon}
                                    variant="text"
                                    sx={{
                                        px: compact ? 1.25 : 2,
                                        py: compact ? 0.75 : 1,
                                        borderRadius: 1,
                                        fontSize: compact ? '0.78rem' : '0.875rem',
                                        minWidth: compact ? 0 : 100,
                                        whiteSpace: 'nowrap',
                                        color: item.active ? 'primary.main' : 'text.secondary',
                                        bgcolor: item.active ? (isLight ? '#FFE5E5' : alpha(theme.palette.primary.main, 0.12)) : 'transparent',
                                        fontWeight: item.active ? 700 : 600,
                                        '&:hover': {
                                            color: 'primary.main',
                                            bgcolor: isLight ? 'rgba(208,0,0,0.06)' : alpha(theme.palette.primary.main, 0.08),
                                        },
                                    }}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </Box>
                    )}

                    {/* Right side */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, zIndex: 1 }}>
                        {!isMobile && actions}
                        {isMobile && (
                            <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: 'text.primary' }}>
                                <MenuIcon size={22} />
                            </IconButton>
                        )}
                    </Box>
                </Container>
            </Box>

            {/* Mobile drawer */}
            <Drawer
                anchor="right"
                open={drawerOpen && isMobile}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{
                    sx: { width: 280, bgcolor: 'background.paper', pt: 1 },
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} color="text.secondary">Menu</Typography>
                    <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                        <X size={18} />
                    </IconButton>
                </Box>
                <Divider />
                <List sx={{ px: 1, py: 1 }}>
                    {items.map((item) => (
                        <ListItemButton
                            key={item.id}
                            onClick={() => { item.onClick?.(); setDrawerOpen(false); }}
                            sx={{
                                borderRadius: 2, mb: 0.5,
                                bgcolor: item.active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                color: item.active ? 'primary.main' : 'text.primary',
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                            }}
                        >
                            {item.icon && <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>}
                            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: item.active ? 700 : 500, fontSize: '0.9rem' }} />
                        </ListItemButton>
                    ))}
                </List>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {actions}
                </Box>
            </Drawer>
        </>
    );
};
