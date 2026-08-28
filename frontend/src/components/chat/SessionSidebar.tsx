'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  TextField,
  useTheme,
  alpha,
} from '@mui/material';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';

interface SessionSidebarProps {
  onCloseMobile?: () => void;
}

function relativeTime(iso: string): string {
  const stamp = /([zZ]|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const delta = (Date.now() - new Date(stamp).getTime()) / 1000;
  if (Number.isNaN(delta) || delta < 60) return 'just now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  if (delta < 86400 * 14) return `${Math.floor(delta / 86400)}d`;
  return new Date(stamp).toLocaleDateString();
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ onCloseMobile }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const {
    sessions,
    hasMoreSessions,
    activeSessionId,
    newChat,
    loadMoreSessions,
    selectSession,
    deleteSession,
  } = useChatContext();
  const [query, setQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const handleNewChat = () => {
    newChat();
    onCloseMobile?.();
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadMoreSessions();
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelect = (id: string) => {
    selectSession(id);
    onCloseMobile?.();
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`Delete “${title || 'this session'}”? This cannot be undone.`)) return;
    void deleteSession(id);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || '').toLowerCase().includes(q));
  }, [sessions, query]);

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
          }}
        >
          New chat
        </Button>
        {sessions.length > 6 && (
          <TextField
            size="small"
            placeholder="Filter sessions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            sx={{ mt: 1, '& input': { fontSize: '0.8rem' } }}
          />
        )}
      </Box>

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
          Sessions
        </Typography>

        {query && hasMoreSessions && (
          <Typography
            variant="caption"
            sx={{ px: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.68rem' }}
          >
            Searching the {sessions.length} loaded sessions. Clear the filter to load more.
          </Typography>
        )}

        {visible.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
              {query ? 'No matching sessions.' : 'No sessions yet. Start one above.'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ mt: 0.5 }}>
            {visible.map((s) => {
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
                    primary={s.title || 'Untitled'}
                    secondary={relativeTime(s.last_activity)}
                    primaryTypographyProps={{
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 700 : 500,
                      noWrap: true,
                      color: isActive ? 'primary.main' : isLight ? '#1e293b' : '#e2e8f0',
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.68rem',
                      noWrap: true,
                    }}
                  />
                  <Tooltip title="Delete session">
                    <IconButton
                      size="small"
                      className="delete-btn"
                      aria-label={`Delete ${s.title || 'this session'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s.id, s.title);
                      }}
                      sx={{
                        // Revealed on hover on a pointer device, but always
                        // visible on touch, where there is no hover to reveal it.
                        opacity: { xs: 1, md: 0 },
                        transition: 'opacity 0.2s',
                        '&:focus-visible': { opacity: 1 },
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

        {hasMoreSessions && !query && (
          <Button
            fullWidth
            size="small"
            variant="text"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
            sx={{ mt: 0.5, fontSize: '0.76rem', textTransform: 'none' }}
          >
            {loadingMore ? 'Loading…' : 'Show older sessions'}
          </Button>
        )}
      </Box>
    </Box>
  );
};
