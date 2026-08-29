'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import { Bot, User, Copy, Check, Clock, Sparkles } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/lib/chat-api';
import { copyToClipboard } from '@/lib/clipboard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingCursor } from './StreamingIndicator';

interface ChatMessageProps {
  message: Partial<ChatMessageType> & { content: string; role: 'user' | 'assistant' | 'system' };
  isStreaming?: boolean;
}

function displayAgent(id?: string | null): string {
  if (!id) return 'Assistant';
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Memoised because a streaming reply re-renders the panel on every token, and
 * each settled message would otherwise re-run its whole markdown parse. Message
 * objects keep their identity once committed, so the shallow compare holds.
 */
export const ChatMessage: React.FC<ChatMessageProps> = React.memo(function ChatMessage({
  message,
  isStreaming = false,
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyToClipboard(message.content))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: { xs: 1.25, sm: 2 },
        py: 2,
        px: { xs: 1.5, sm: 2.5 },
        bgcolor: isUser
          ? isLight
            ? 'rgba(0, 0, 0, 0.02)'
            : 'rgba(255, 255, 255, 0.02)'
          : 'transparent',
        borderBottom: '1px solid',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
        },
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isUser
            ? isLight
              ? '#2a2a2a'
              : '#404040'
            : theme.palette.primary.main,
          color: '#ffffff',
          flexShrink: 0,
          boxShadow: isUser
            ? 'none'
            : `0 0 12px ${alpha(theme.palette.primary.main, 0.35)}`,
        }}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </Avatar>

      {/* Content Area */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Header line: Role + Model/Agent badge + Timestamp / Time */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 0.75,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 500,
                fontSize: '0.88rem',
                color: isLight ? '#1c1c1c' : '#f9f9f7',
              }}
            >
              {isUser ? 'You' : displayAgent(message.agent_id)}
            </Typography>

            {!isUser && message.agent_id && (
              <Sparkles size={13} color={theme.palette.primary.main} />
            )}

            {!isUser && message.model && (
              <Chip
                label={message.model}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  bgcolor: isLight ? '#e0dfd7' : '#2a2a2a',
                  color: isLight ? '#404040' : '#8e8d83',
                }}
              />
            )}

            {message.duration_ms && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                  color: 'text.secondary',
                  fontSize: '0.72rem',
                }}
              >
                <Clock size={11} />
                <span>{(message.duration_ms / 1000).toFixed(1)}s</span>
              </Box>
            )}
          </Box>

          {/* Action buttons (Copy) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={copied ? 'Copied' : 'Copy message'}>
              <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5 }}>
                {copied ? <Check size={14} color="#469a6c" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Message body */}
        <Box sx={{ color: isLight ? '#2a2a2a' : '#e0dfd7', fontSize: '0.9rem' }}>
          <MarkdownRenderer content={message.content} />
          {isStreaming && <StreamingCursor />}
        </Box>
      </Box>
    </Box>
  );
});
