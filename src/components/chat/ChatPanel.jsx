import React, { useEffect, useState } from 'react';
import { Bot, PanelLeft, Plus } from 'lucide-react';

import { useChatContext } from '@/contexts/ChatContext';
import { MIN_JOB_BRIEF_CHARS } from '@/lib/api';
import { Alert, Button, IconButton } from '../ui/primitives';
import { Drawer } from '../ui/overlays';
import { AgentStudio } from './AgentStudio';
import { ConfigBar } from './ConfigBar';
import { SessionSidebar } from './SessionSidebar';

/**
 * Agent Console shell: sessions | compact config | workbench.
 *
 * The workbench (AgentStudio) is the product surface — pick any agent, run it,
 * pass output to the next. Workflows remain a quiet job path via More Options.
 */
export function ChatPanel() {
    const {
        error,
        clearError,
        loadSessions,
        newChat,
        catalog,
        config,
        updateConfig,
        sendMessage,
        isStreaming,
    } = useChatContext();

    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [jobBrief, setJobBrief] = useState('');

    const selectedWorkflow = catalog?.workflows.find((wf) => wf.id === config.workflowId);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    useEffect(() => {
        const query = window.matchMedia('(max-width: 899px)');
        const sync = (event) => {
            setIsMobile(event.matches);
            if (event.matches) setSidebarOpen(false);
        };
        sync(query);
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-surface">
            {!isMobile && sidebarOpen && <SessionSidebar onCollapse={() => setSidebarOpen(false)} />}

            <Drawer
                anchor="left"
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                width={280}
                className="p-0"
            >
                <SessionSidebar onCloseMobile={() => setMobileDrawerOpen(false)} />
            </Drawer>

            <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 shrink-0 items-center justify-between border-b border-hairline bg-surface px-4 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                        {(isMobile || !sidebarOpen) && (
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    className="shrink-0 px-2.5 text-[0.78rem] text-subtle"
                                    aria-label="Show sessions"
                                    onClick={() => {
                                        if (isMobile) setMobileDrawerOpen(true);
                                        else setSidebarOpen(true);
                                    }}
                                >
                                    <PanelLeft size={15} />
                                    Sessions
                                </Button>
                                <span aria-hidden className="h-5 w-px shrink-0 bg-hairline" />
                            </>
                        )}

                        <div className="flex min-w-0 items-center gap-2">
                            <Bot size={20} className="text-brand" />
                            <span className="block text-[0.95rem] font-medium leading-tight">Agent Console</span>
                        </div>
                    </div>

                    {(isMobile || !sidebarOpen) && (
                        <Button
                            variant="text"
                            size="small"
                            className="shrink-0 text-[0.78rem]"
                            onClick={newChat}
                        >
                            <Plus size={14} />
                            New
                        </Button>
                    )}
                </div>

                <ConfigBar compact />

                {error && (
                    <Alert
                        severity="error"
                        className="m-3 mb-0"
                        action={
                            <IconButton size="small" aria-label="Dismiss" onClick={clearError}>
                                ×
                            </IconButton>
                        }
                    >
                        {error}
                    </Alert>
                )}

                {selectedWorkflow && (
                    <Alert
                        severity="info"
                        className="mx-3 mt-3"
                        action={
                            <IconButton
                                size="small"
                                aria-label="Dismiss"
                                onClick={() => updateConfig({ workflowId: null })}
                            >
                                ×
                            </IconButton>
                        }
                    >
                        <p className="mb-1 font-medium">{selectedWorkflow.name} runs as a job</p>
                        Paste a brief and start the pipeline, or dismiss this to keep running agents one at a
                        time.
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                                className="ui-input flex-[1_1_240px] bg-surface"
                                placeholder="Job brief…"
                                value={jobBrief}
                                onChange={(event) => setJobBrief(event.target.value)}
                                aria-label="Job brief"
                            />
                            <Button
                                variant="contained"
                                size="small"
                                disabled={isStreaming || jobBrief.trim().length < MIN_JOB_BRIEF_CHARS}
                                onClick={() => sendMessage(jobBrief)}
                            >
                                Start job
                            </Button>
                        </div>
                    </Alert>
                )}

                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <AgentStudio />
                </div>
            </div>
        </div>
    );
}
