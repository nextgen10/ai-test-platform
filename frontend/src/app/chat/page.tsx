'use client';

import React, { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { ChatProvider } from '@/contexts/ChatContext';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function ChatPage() {
  return (
    // The provider reads `?agent=…&workflow=…` to seed its configuration, and
    // useSearchParams needs a Suspense boundary above it.
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <CircularProgress />
          </Box>
        }
      >
        <ChatProvider>
          <ChatPanel />
        </ChatProvider>
      </Suspense>
    </Box>
  );
}
