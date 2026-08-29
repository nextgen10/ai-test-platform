'use client';

import React, { useContext } from 'react';
import { IconButton, useTheme, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { ThemeContext } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
    const theme = useTheme();
    const colorMode = useContext(ThemeContext);

    return (
        <Tooltip title={theme.palette.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
                onClick={colorMode.toggleColorMode}
                color="inherit"
                aria-label={theme.palette.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                {theme.palette.mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    );
}
