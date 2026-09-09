'use client';

import React from 'react';
import { Box } from '@mui/material';

/** Cognizant mark from `/public/CTSH.svg`. */
export interface UbsLogoFullProps {
    /** Height in pixels on md+; xs scales slightly smaller. */
    height?: number;
    /** Unused – kept for call-site compatibility with the old UBS SVG. */
    keysColor?: string;
    /** Unused – kept for call-site compatibility with the old UBS SVG. */
    wordmarkColor?: string;
    className?: string;
    style?: React.CSSProperties;
}

export const UbsLogoFull: React.FC<UbsLogoFullProps> = ({
    height = 28,
    className,
    style,
}) => {
    return (
        <Box
            component="img"
            src="/CTSH.svg"
            alt="Cognizant"
            className={className}
            style={style}
            sx={{
                display: 'block',
                flexShrink: 0,
                height: { xs: Math.max(20, Math.round(height * 0.86)), md: height },
                width: 'auto',
            }}
        />
    );
};
