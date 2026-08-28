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
import { Send, Square } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { hubApi } from '@/lib/hub-api';

type QuickPrompt = { label: string; agent?: string; workflow?: string; prompt?: string };

export const ChatInput: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const { isStreaming, sendMessage, stopStreaming, updateConfig, config, messages } = useChatContext();
  const [text, setText] = useState('');
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hubApi
      .catalog()
      .then((catalog) => {
        const wf = catalog.workflows
          .filter((w) => w.available !== false)
          .slice(0, 2)
          .map((w) => ({ label: `Run ${w.name}`, workflow: w.id }));
        const agents = catalog.agents
          .filter((a) => a.id !== 'ocr-extractor')
          .slice(0, 3)
          .map((a) => ({ label: `Ask ${a.name}`, agent: a.id }));
        setQuickPrompts([...wf, ...agents]);
      })
      .catch(() => {
        setQuickPrompts([
          { label: 'Ask Test Designer', agent: 'test-designer' },
          { label: 'Ask Requirement Analyst', agent: 'requirement-analyst' },
        ]);
      });
  }, []);

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    sendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      stopStreaming();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (item: QuickPrompt) => {
    if (item.workflow) {
      updateConfig({ workflowId: item.workflow, agentId: null });
      setText('');
      inputRef.current?.focus();
      return;
    }
    if (item.agent) {
      updateConfig({ agentId: item.agent, workflowId: null });
    }
    if (item.prompt) {
      updateConfig({ promptId: item.prompt });
    }
    inputRef.current?.focus();
  };

  const placeholder = config.workflowId
    ? `Describe the input for ${config.workflowId}. Send starts a job and leaves this page.`
    : config.agentId
      ? `Message @${config.agentId}…`
      : 'Message an agent, or pick a workflow above to run a job…';

  const showSuggestions = messages.length === 0 && !isStreaming && !config.workflowId;

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderTop: '1px solid',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
        bgcolor: isLight ? '#ffffff' : '#0d1117',
      }}
    >
      {showSuggestions && quickPrompts.length > 0 && (
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
            Start with
          </Typography>
          {quickPrompts.map((item) => (
            <Chip
              key={item.label}
              label={item.label}
              size="small"
              onClick={() => handleChipClick(item)}
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
      )}

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
          transition: 'border-color 0.2s',
          '&:focus-within': {
            borderColor: 'primary.main',
          },
        }}
      >
        <TextField
          inputRef={inputRef}
          multiline
          minRows={2}
          maxRows={8}
          fullWidth
          placeholder={placeholder}
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
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
            {isStreaming ? (
              <>Esc or Stop to halt</>
            ) : (
              <>
                Enter to send · Shift+Enter for a newline
              </>
            )}
          </Typography>

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
              }}
            >
              {config.workflowId ? 'Run job' : 'Send'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
