'use client';

import React, { useEffect, useState } from 'react';
import { Box, Button, Drawer, Alert, TextField, useTheme, useMediaQuery } from '@mui/material';
import { Bot, PanelLeft, Plus } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { MIN_JOB_BRIEF_CHARS } from '@/lib/api';
import { ConfigBar } from './ConfigBar';
import { SessionSidebar } from './SessionSidebar';
import { AgentStudio } from './AgentStudio';

/**
 * Agent Console shell: sessions | compact config | workbench.
 *
 * The workbench (AgentStudio) is the product surface — pick any agent, run it,
 * pass output to the next. Workflows remain a quiet job path via More Options.
 */
export const ChatPanel: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });

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

  // Default open so SSR and the first client paint match. Narrow viewports
  // collapse after mount — useMediaQuery would otherwise flip during hydration.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [jobBrief, setJobBrief] = useState('');
  const selectedWorkflow = catalog?.workflows.find((w) => w.id === config.workflowId);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        width: '100%',
        bgcolor: isLight ? '#ffffff' : '#1c1c1c',
        overflow: 'hidden',
      }}
    >
      {!isMobile && sidebarOpen && (
        <SessionSidebar onCollapse={() => setSidebarOpen(false)} />
      )}

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
          minHeight: 0,
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
            bgcolor: isLight ? '#ffffff' : '#1c1c1c',
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {(isMobile || !sidebarOpen) && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<PanelLeft size={15} />}
                  aria-label="Show sessions"
                  onClick={() => {
                    if (isMobile) setMobileDrawerOpen(true);
                    else setSidebarOpen(true);
                  }}
                  sx={{
                    color: 'text.secondary',
                    borderColor: 'divider',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    px: 1.25,
                    flexShrink: 0,
                  }}
                >
                  Sessions
                </Button>
                <Box
                  aria-hidden
                  sx={{
                    width: '1px',
                    height: 20,
                    bgcolor: 'divider',
                    flexShrink: 0,
                  }}
                />
              </>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Bot size={20} color={theme.palette.primary.main} />
              <Box
                component="span"
                sx={{ fontWeight: 500, fontSize: '0.95rem', display: 'block', lineHeight: 1.2 }}
              >
                Agent Console
              </Box>
            </Box>
          </Box>

          {(isMobile || !sidebarOpen) && (
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<Plus size={14} />}
              onClick={newChat}
              sx={{
                borderRadius: 2,
                fontSize: '0.78rem',
                fontWeight: 500,
                textTransform: 'none',
                flexShrink: 0,
              }}
            >
              New
            </Button>
          )}
        </Box>

        <ConfigBar compact />

        {error && (
          <Alert severity="error" onClose={clearError} sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {selectedWorkflow && (
          <Alert
            severity="info"
            sx={{ mx: 1.5, mt: 1.5, borderRadius: 2 }}
            onClose={() => updateConfig({ workflowId: null })}
          >
            <Box sx={{ fontWeight: 500, mb: 0.5 }}>{selectedWorkflow.name} runs as a job</Box>
            Paste a brief and start the pipeline, or dismiss this to keep running agents one at a time.
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Job brief…"
                value={jobBrief}
                onChange={(e) => setJobBrief(e.target.value)}
                sx={{ flex: '1 1 240px', bgcolor: 'background.paper' }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={isStreaming || jobBrief.trim().length < MIN_JOB_BRIEF_CHARS}
                onClick={() => void sendMessage(jobBrief)}
                sx={{ textTransform: 'none', fontWeight: 500 }}
              >
                Start job
              </Button>
            </Box>
          </Alert>
        )}

        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <AgentStudio />
        </Box>
      </Box>
    </Box>
  );
};
