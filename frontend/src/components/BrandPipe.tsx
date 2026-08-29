'use client';

import { Box } from '@mui/material';

/** Vertical hairline between the UBS logo and the product name. */
export const BrandPipe = () => (
    <Box
        component="span"
        sx={{
            width: '1px',
            minWidth: '1px',
            height: 22,
            bgcolor: 'var(--col-border-illustrative)',
            flexShrink: 0,
            display: 'inline-block',
            alignSelf: 'center',
        }}
    />
);
