'use client';

import React, { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { ChatProvider } from '@/contexts/ChatContext';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function ChatPage() {
  return (
    // The provider reads `?agent=…&workflow=…` to seed its configuration, and
    // useSearchParams needs a Suspense boundary above it.
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      }
    >
      <ChatProvider>
        <ChatPanel />
      </ChatProvider>
    </Suspense>
  );
}
