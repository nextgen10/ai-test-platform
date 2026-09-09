import { createContext, useContext } from 'react';

export const ChatContext = createContext(null);

export function useChatContext() {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChatContext must be used within ChatProvider');
    return context;
}

export const EMPTY_CONFIG = {
    agentId: null,
    skillId: null,
    workflowId: null,
    promptId: null,
    model: null,
    engine: null,
};

/**
 * A workflow is a job. An agent is a chat. They cannot both be "the thing Send
 * does", so setting one clears the other.
 */
export function exclusiveConfig(previous, update) {
    const next = { ...previous, ...update };
    if (update.workflowId) next.agentId = null;
    if (update.agentId) next.workflowId = null;
    return next;
}
