'use client';

import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';

interface SessionSidebarProps {
  onCloseMobile?: () => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ onCloseMobile }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const {
    sessions,
    activeSessionId,
    createSession,
    selectSession,
    deleteSession,
  } = useChatContext();

  const handleNewChat = async () => {
    await createSession('New Chat');
    onCloseMobile?.();
  };

  const handleSelect = (id: string) => {
    selectSession(id);
    onCloseMobile?.();
  };

  return (
    <Box
      sx={{
        width: { xs: 280, md: 260 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isLight ? '#f6f8fa' : '#0d1117',
        borderRight: '1px solid',
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Top action: New Chat */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<Plus size={16} />}
          onClick={handleNewChat}
          sx={{
            borderRadius: 1.5,
            fontWeight: 700,
            fontSize: '0.84rem',
            textTransform: 'none',
            py: 0.8,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
          }}
        >
          New Session
        </Button>
      </Box>

      {/* Sessions List */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            display: 'block',
            fontWeight: 700,
            color: 'text.secondary',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Recent Sessions
        </Typography>

        {sessions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
              No session history yet. Start a new session above!
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ mt: 0.5 }}>
            {sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <ListItemButton
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.5,
                    px: 1.25,
                    py: 0.75,
                    bgcolor: isActive
                      ? isLight
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.primary.main, 0.18)
                      : 'transparent',
                    borderLeft: isActive
                      ? `3px solid ${theme.palette.primary.main}`
                      : '3px solid transparent',
                    '&:hover': {
                      bgcolor: isActive
                        ? isLight
                          ? alpha(theme.palette.primary.main, 0.14)
                          : alpha(theme.palette.primary.main, 0.22)
                        : isLight
                        ? 'rgba(0,0,0,0.03)'
                        : 'rgba(255,255,255,0.03)',
                      '& .delete-btn': { opacity: 1 },
                    },
                  }}
                >
                  <MessageSquare
                    size={15}
                    color={isActive ? theme.palette.primary.main : isLight ? '#64748b' : '#94a3b8'}
                    style={{ flexShrink: 0, marginRight: 8 }}
                  />
                  <ListItemText
                    primary={s.title || 'Untitled Session'}
                    primaryTypographyProps={{
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 700 : 500,
                      noWrap: true,
                      color: isActive ? 'primary.main' : isLight ? '#1e293b' : '#e2e8f0',
                    }}
                  />
                  <Tooltip title="Delete session">
                    <IconButton
                      size="small"
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      sx={{
                        opacity: { xs: 1, md: 0 },
                        transition: 'opacity 0.2s',
                        p: 0.4,
                        color: 'text.secondary',
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};
