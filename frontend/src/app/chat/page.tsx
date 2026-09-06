'use client';

import React from 'react';
import { Box } from '@mui/material';
import { ChatProvider } from '@/contexts/ChatContext';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function ChatPage() {
  return (
    // No Suspense boundary here on purpose. The provider used to read its
    // launch parameters with `useSearchParams`, which requires one — and a
    // suspended subtree hydrates after its parent, by which time the theme
    // effect has already swapped the palette. The console then hydrated in the
    // stored theme against server HTML rendered in the default one, which React
    // reports as a mismatch it cannot patch. The provider now reads
    // `window.location` instead, so the console hydrates with its parent.
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ChatProvider>
        <ChatPanel />
      </ChatProvider>
    </Box>
  );
}
