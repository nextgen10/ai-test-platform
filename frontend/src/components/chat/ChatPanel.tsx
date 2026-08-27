'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  useTheme,
  alpha,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  Bot,
  PanelLeft,
  FlaskConical,
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
  } = useChatContext();

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [catalog, setCatalog] = useState<HubCatalog | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Quick-start cards come from the registry, so onboarding an agent or
  // workflow puts it on this screen without a code change.
  useEffect(() => {
    hubApi.catalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  // Autoscroll on new messages or streaming chunks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleLaunchUseCase = (route: string) => {
    router.push(route);
  };

  const quickCardSx = (accent: string) => ({
    cursor: 'pointer',
    borderRadius: 2,
    height: '100%',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: accent,
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 12px ${alpha(accent, 0.15)}`,
    },
  });

  return (
    <Box
      sx={{
        display: 'flex',
        height: 'calc(100vh - 60px)',
        width: '100%',
        bgcolor: isLight ? '#ffffff' : '#0a0d12',
        overflow: 'hidden',
      }}
    >
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && <SessionSidebar />}

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
      >
        <SessionSidebar onCloseMobile={() => setMobileDrawerOpen(false)} />
      </Drawer>

      {/* Main Chat Area */}
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
        {/* Header Bar */}
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
            <Tooltip title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
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

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<FlaskConical size={14} />}
              onClick={() => handleLaunchUseCase('/generate')}
              sx={{
                borderRadius: 1.5,
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'none',
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              Open Test Gen UI
            </Button>
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<Plus size={14} />}
              onClick={() => createSession('New Session')}
              sx={{
                borderRadius: 1.5,
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              New
            </Button>
          </Box>
        </Box>

        {/* Configuration Bar */}
        <ConfigBar />

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            onClose={clearError}
            sx={{ m: 1.5, mb: 0, borderRadius: 1.5 }}
          >
            {error}
          </Alert>
        )}

        {notice && (
          <Alert
            severity="info"
            onClose={clearNotice}
            sx={{ m: 1.5, mb: 0, borderRadius: 1.5 }}
          >
            {notice}
          </Alert>
        )}

        {/* Message Feed */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {messages.length === 0 && !isStreaming ? (
            /* Empty State Hero Greeting */
            <Box
              sx={{
                m: 'auto',
                p: { xs: 2, sm: 4 },
                maxWidth: 720,
                textAlign: 'center',
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
                sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', mb: 3 }}
              >
                Trigger any onboarded agent, multi-agent workflow, skill, or prompt template. Select an agent from the configuration bar above, or choose a quick-start flow below.
              </Typography>

              {/* Quick start, straight from the registry */}
              <Grid container spacing={2} sx={{ textAlign: 'left' }}>
                {(catalog?.workflows ?? [])
                  .filter((wf) => wf.available !== false)
                  .slice(0, 2)
                  .map((wf) => (
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
                            <span>{wf.has_custom_ui ? 'Open its UI' : 'Run this workflow'}</span>
                            <ChevronRight size={13} />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}

                {(catalog?.agents ?? []).slice(0, 2).map((agent) => (
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
                          {agent.description || 'Specialized Copilot agent reasoning profile.'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>Activate this agent</span>
                          <ChevronRight size={13} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {catalog && catalog.agents.length === 0 && catalog.workflows.length === 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Card variant="outlined" sx={{ borderRadius: 2, borderStyle: 'dashed' }}>
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          Nothing onboarded yet
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
            /* Render active message history */
            <Box sx={{ py: 1 }}>
              {messages.map((m) => (
                <ChatMessage key={m.id || m.sequence} message={m} />
              ))}

              {/* Streaming active response */}
              {isStreaming && (
                <>
                  {streamingContent ? (
                    <ChatMessage
                      message={{
                        role: 'assistant',
                        content: streamingContent,
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

        {/* Input Bar */}
        <ChatInput />
      </Box>
    </Box>
  );
};
