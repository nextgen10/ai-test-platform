'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Chip,
  Paper,
  useTheme,
  alpha,
  Typography,
} from '@mui/material';
import { Send, Square, Sparkles } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { hubApi } from '@/lib/hub-api';

type QuickPrompt = { label: string; agent?: string; prompt?: string };

const DEFAULT_QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Generate test cases for login', agent: 'test-designer' },
  { label: 'Assess INVEST quality of requirement', agent: 'requirement-analyst' },
  { label: 'Review code for security & edge cases', prompt: 'code-review' },
  { label: 'Extract requirement from document', agent: 'ocr-extractor' },
];

export const ChatInput: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const { isStreaming, sendMessage, stopStreaming, updateConfig, config } = useChatContext();
  const [text, setText] = useState('');
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(DEFAULT_QUICK_PROMPTS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hubApi.catalog()
      .then(catalog => {
        const topAgents = catalog.agents.slice(0, 2).map(a => ({ label: a.description || `Ask ${a.name}`, agent: a.id }));
        const topPrompts = catalog.prompts.slice(0, 2).map(p => ({ label: p.description || p.name, prompt: p.id }));
        if (topAgents.length > 0 || topPrompts.length > 0) {
           setQuickPrompts([...topAgents, ...topPrompts]);
        }
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    sendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (item: QuickPrompt) => {
    if (item.agent) {
      updateConfig({ agentId: item.agent });
    }
    if (item.prompt) {
      updateConfig({ promptId: item.prompt });
    }
    setText(item.label);
    inputRef.current?.focus();
  };

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderTop: '1px solid',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
        bgcolor: isLight ? '#ffffff' : '#0d1117',
      }}
    >
      {/* Quick Starter Suggestions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5,
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
            display: { xs: 'none', sm: 'inline' },
          }}
        >
          Suggestions:
        </Typography>
        {quickPrompts.map((item, idx) => (
          <Chip
            key={idx}
            label={item.label}
            size="small"
            onClick={() => handleChipClick(item)}
            icon={<Sparkles size={11} />}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              bgcolor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
              border: '1px solid',
              borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderColor: theme.palette.primary.main,
              },
            }}
          />
        ))}
      </Box>

      {/* Main Input Box */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          border: '1px solid',
          borderColor: isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)',
          bgcolor: isLight ? '#fcfcfc' : '#161b22',
          overflow: 'hidden',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:focus-within': {
            borderColor: 'primary.main',
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
          },
        }}
      >
        <TextField
          inputRef={inputRef}
          multiline
          minRows={2}
          maxRows={8}
          fullWidth
          placeholder={
            config.agentId
              ? `Ask @${config.agentId} anything or trigger the workflow...`
              : 'Ask Agent Hub / GitHub Copilot anything, type a requirement, or ask for code/tests...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiOutlinedInput-root': {
              p: 1.5,
              fontSize: '0.9rem',
              lineHeight: 1.5,
              '& fieldset': { border: 'none' },
            },
          }}
        />

        {/* Action Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 0.75,
            borderTop: '1px solid',
            borderColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
            bgcolor: isLight ? '#f8fafc' : '#11161d',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
            >
              Press <strong>Enter ↵</strong> to send, <strong>Shift+Enter</strong> for newline
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isStreaming ? (
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<Square size={13} fill="currentColor" />}
                onClick={stopStreaming}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  py: 0.5,
                  px: 1.5,
                }}
              >
                Stop
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                size="small"
                endIcon={<Send size={13} />}
                disabled={!text.trim()}
                onClick={handleSend}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  py: 0.5,
                  px: 2,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                }}
              >
                Send
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
