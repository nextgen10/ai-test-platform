import React from 'react';

import { ChatPanel } from '@/components/chat/ChatPanel';
import ChatProvider from '@/contexts/ChatProvider';

export default function ChatPage() {
    return (
        <div className="flex h-full min-h-0 flex-1 flex-col">
            <ChatProvider>
                <ChatPanel />
            </ChatProvider>
        </div>
    );
}
