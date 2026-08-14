'use client';
import React from 'react';
import { Snackbar, Alert, useTheme, alpha } from '@mui/material';
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

type Severity = 'success' | 'error' | 'warning' | 'info';

interface UBSSnackbarProps {
    open: boolean;
    message: string;
    severity?: Severity;
    onClose: () => void;
    autoHideDuration?: number;
}

const ICON_MAP: Record<Severity, React.ReactElement> = {
    success: <CheckCircle2 size={18} />,
    error: <AlertTriangle size={18} />,
    warning: <AlertCircle size={18} />,
    info: <Info size={18} />,
};

const COLOR_MAP: Record<Severity, string> = {
    success: '#1F8A70',
    error: '#C23030',
    warning: '#D9822B',
    info: '#2D6CDF',
};

export default function UBSSnackbar({
    open,
    message,
    severity = 'success',
    onClose,
    autoHideDuration = 4000,
}: UBSSnackbarProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const color = COLOR_MAP[severity];

    return (
        <Snackbar
            open={open}
            autoHideDuration={autoHideDuration}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
            <Alert
                onClose={onClose}
                severity={severity}
                icon={ICON_MAP[severity]}
                sx={{
                    width: '100%',
                    minWidth: 320,
                    borderRadius: 2,
                    fontWeight: 700,
                    backdropFilter: 'blur(12px)',
                    bgcolor: alpha(color, isDark ? 0.14 : 0.07),
                    color,
                    border: `1px solid ${alpha(color, isDark ? 0.3 : 0.22)}`,
                    '.MuiAlert-icon': { color },
                    '.MuiAlert-action .MuiIconButton-root': { color: alpha(color, 0.7) },
                    boxShadow: `0 4px 24px ${alpha(color, isDark ? 0.18 : 0.1)}`,
                }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
}
