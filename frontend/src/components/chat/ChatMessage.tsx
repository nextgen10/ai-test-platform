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
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingCursor } from './StreamingIndicator';

interface ChatMessageProps {
  message: Partial<ChatMessageType> & { content: string; role: 'user' | 'assistant' | 'system' };
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
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
              ? '#1e293b'
              : '#334155'
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
                fontWeight: 700,
                fontSize: '0.88rem',
                color: isLight ? '#0f172a' : '#f8fafc',
              }}
            >
              {isUser ? 'You' : message.agent_id ? message.agent_id : 'Assistant'}
            </Typography>

            {!isUser && message.agent_id && (
              <Chip
                icon={<Sparkles size={12} />}
                label={message.agent_id}
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                }}
              />
            )}

            {!isUser && message.model && (
              <Chip
                label={message.model}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  bgcolor: isLight ? '#e2e8f0' : '#1e293b',
                  color: isLight ? '#475569' : '#94a3b8',
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
                {copied ? <Check size={14} color="#2da44e" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Message body */}
        <Box sx={{ color: isLight ? '#1e293b' : '#e2e8f0', fontSize: '0.9rem' }}>
          <MarkdownRenderer content={message.content} />
          {isStreaming && <StreamingCursor />}
        </Box>
      </Box>
    </Box>
  );
};
