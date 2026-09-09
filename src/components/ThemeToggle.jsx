import React from 'react';
import { Moon, Sun } from 'lucide-react';

import { useThemeMode } from '@/contexts/ThemeContext';
import { IconButton, Tooltip } from './ui/primitives';

export default function ThemeToggle() {
    const { mode, toggleColorMode } = useThemeMode();
    const label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <Tooltip title={label} placement="bottom">
            <IconButton onClick={toggleColorMode} aria-label={label}>
                {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
        </Tooltip>
    );
}
