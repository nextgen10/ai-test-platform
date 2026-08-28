'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Grid,
  Card,
  CardContent,
  Drawer,
  Alert,
  TextField,
  CircularProgress,
  useTheme,
  useMediaQuery,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Bot,
  PanelLeft,
  Workflow,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { hubApi, type HubCatalog } from '@/lib/hub-api';
import { ConfigBar } from './ConfigBar';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SessionSidebar } from './SessionSidebar';
import { StreamingIndicator } from './StreamingIndicator';
import { useRouter } from 'next/navigation';

export const ChatPanel: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();

  const {
    messages,
    isStreaming,
    streamingContent,
    error,
    notice,
    clearError,
    clearNotice,
    loadSessions,
    updateConfig,
    createSession,
    config,
    sessionLoading,
  } = useChatContext();

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [catalog, setCatalog] = useState<HubCatalog | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    hubApi.catalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = remaining < 96;
  };

  useEffect(() => {
    if (!stickToBottom.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const q = catalogQuery.trim().toLowerCase();
  const workflows = useMemo(
    () =>
      (catalog?.workflows ?? [])
        .filter((wf) => wf.available !== false)
        .filter((wf) => !q || `${wf.name} ${wf.description} ${wf.id}`.toLowerCase().includes(q)),
    [catalog, q],
  );
  const agents = useMemo(
    () =>
      (catalog?.agents ?? [])
        .filter((ag) => ag.id !== 'ocr-extractor')
        .filter((ag) => !q || `${ag.name} ${ag.description} ${ag.id}`.toLowerCase().includes(q)),
    [catalog, q],
  );

  const selectedWorkflow = catalog?.workflows.find((w) => w.id === config.workflowId);
  const showEmpty = messages.length === 0 && !isStreaming && !sessionLoading;

  const quickCardSx = (accent: string) => ({
    cursor: 'pointer',
    borderRadius: 2,
    height: '100%',
    transition: 'border-color 0.15s, transform 0.15s',
    '&:hover': {
      borderColor: accent,
      transform: 'translateY(-1px)',
    },
  });

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        bgcolor: isLight ? '#ffffff' : '#0a0d12',
        overflow: 'hidden',
      }}
    >
      {!isMobile && sidebarOpen && <SessionSidebar />}

      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
      >
        <SessionSidebar onCloseMobile={() => setMobileDrawerOpen(false)} />
      </Drawer>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderBottom: '1px solid',
            borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
            bgcolor: isLight ? '#ffffff' : '#0d1117',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={sidebarOpen ? 'Hide sessions' : 'Show sessions'}>
              <IconButton
                size="small"
                onClick={() => {
                  if (isMobile) setMobileDrawerOpen(true);
                  else setSidebarOpen(!sidebarOpen);
                }}
                sx={{ color: 'text.secondary' }}
              >
                <PanelLeft size={18} />
              </IconButton>
            </Tooltip>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Bot size={20} color={theme.palette.primary.main} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                Agent Console
              </Typography>
            </Box>
          </Box>

          {isMobile && (
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<Plus size={14} />}
              onClick={() => createSession('New Chat')}
              sx={{
                borderRadius: 1.5,
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              New
            </Button>
          )}
        </Box>

        <ConfigBar />

        {error && (
          <Alert severity="error" onClose={clearError} sx={{ m: 1.5, mb: 0, borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        {notice && (
          <Alert severity="info" onClose={clearNotice} sx={{ m: 1.5, mb: 0, borderRadius: 1.5 }}>
            {notice}
          </Alert>
        )}

        <Box
          ref={scrollerRef}
          onScroll={onScroll}
          sx={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {sessionLoading ? (
            <Box sx={{ m: 'auto', py: 8 }}>
              <CircularProgress size={28} />
            </Box>
          ) : showEmpty && selectedWorkflow ? (
            <Box sx={{ m: 'auto', p: { xs: 2, sm: 4 }, maxWidth: 640, textAlign: 'center' }}>
              <Workflow size={32} color="#3b82f6" />
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 2, mb: 1 }}>
                Run {selectedWorkflow.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                This is a workflow, not a chat. Your next message becomes the job
                input
                {selectedWorkflow.approval_gate ? ' and it will pause for approval' : ''}. You
                will leave this page for the job.
              </Typography>
              <Button size="small" onClick={() => updateConfig({ workflowId: null })}>
                Switch to chat instead
              </Button>
            </Box>
          ) : showEmpty ? (
            <Box
              sx={{
                m: 'auto',
                p: { xs: 2, sm: 4 },
                maxWidth: 760,
                textAlign: 'center',
                width: '100%',
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 2,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  mb: 2,
                }}
              >
                <Bot size={36} />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Agent Console
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', mb: 2 }}
              >
                Chat with an onboarded agent, or run a workflow as a job. Pick one
                below — Send will not do both.
              </Typography>

              <TextField
                size="small"
                placeholder="Filter agents and workflows…"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                fullWidth
                sx={{ mb: 2, maxWidth: 400, mx: 'auto', display: 'block' }}
              />

              <Grid container spacing={2} sx={{ textAlign: 'left' }}>
                {workflows.slice(0, 8).map((wf) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={wf.id}>
                    <Card
                      variant="outlined"
                      sx={quickCardSx('#3b82f6')}
                      onClick={() =>
                        wf.has_custom_ui && wf.custom_ui_route
                          ? router.push(wf.custom_ui_route)
                          : updateConfig({ workflowId: wf.id, agentId: null })
                      }
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <Workflow size={16} color="#3b82f6" />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {wf.name}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                          {wf.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>{wf.has_custom_ui ? 'Open its UI' : 'Run as a job'}</span>
                          <ChevronRight size={13} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {agents.slice(0, 8).map((agent) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={agent.id}>
                    <Card
                      variant="outlined"
                      sx={quickCardSx(theme.palette.primary.main)}
                      onClick={() => updateConfig({ agentId: agent.id, workflowId: null })}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <Bot size={16} color={theme.palette.primary.main} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {agent.name}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                          {agent.description || 'Specialized Copilot agent.'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>Chat with this agent</span>
                          <ChevronRight size={13} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {catalog && workflows.length === 0 && agents.length === 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Card variant="outlined" sx={{ borderRadius: 2, borderStyle: 'dashed' }}>
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {q ? 'Nothing matches that filter' : 'Nothing onboarded yet'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                          Add an agent or workflow in the Registry and it will appear here.
                        </Typography>
                        <Button size="small" variant="contained" onClick={() => router.push('/registry')}>
                          Open the Registry
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ py: 1 }}>
              {messages.map((m) => (
                <ChatMessage key={m.id || m.sequence} message={m} />
              ))}

              {isStreaming && (
                <>
                  {streamingContent ? (
                    <ChatMessage
                      message={{
                        role: 'assistant',
                        content: streamingContent,
                        agent_id: config.agentId,
                      }}
                      isStreaming={true}
                    />
                  ) : (
                    <Box sx={{ px: 3, py: 2 }}>
                      <StreamingIndicator />
                    </Box>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </Box>
          )}
        </Box>

        <ChatInput />
      </Box>
    </Box>
  );
};
