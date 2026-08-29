'use client';
import React from 'react';
import { Snackbar, Alert, useTheme } from '@mui/material';
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { getAccents, getTokens } from '@/theme';

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

export default function UBSSnackbar({
    open,
    message,
    severity = 'success',
    onClose,
    autoHideDuration = 4000,
}: UBSSnackbarProps) {
    const theme = useTheme();
    const accents = getAccents(theme.palette.mode);
    const tokens = getTokens(theme.palette.mode);
    const color: Record<Severity, string> = {
        success: accents.green,
        error: tokens.error,
        warning: accents.gold,
        info: accents.teal,
    };
    const tone = color[severity];

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
                    fontWeight: 400,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: `3px solid ${tone}`,
                    boxShadow: 'none',
                    '.MuiAlert-icon': { color: tone },
                }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
}
