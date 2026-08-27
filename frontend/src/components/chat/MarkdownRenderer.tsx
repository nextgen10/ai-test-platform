'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // Helper to parse blocks of markdown: code blocks, tables, headers, lists, and paragraphs
  const renderFormatted = (rawText: string) => {
    // Split by code blocks first
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyIdx = 0;

    while ((match = codeBlockRegex.exec(rawText)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        const textBefore = rawText.substring(lastIndex, match.index);
        parts.push(
          <React.Fragment key={`text-${keyIdx++}`}>
            {renderTextBlocks(textBefore, isLight)}
          </React.Fragment>
        );
      }

      // Code block
      const lang = match[1] || 'text';
      const code = match[2];
      parts.push(
        <CodeBlock key={`code-${keyIdx++}`} language={lang} code={code} isLight={isLight} />
      );

      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < rawText.length) {
      parts.push(
        <React.Fragment key={`text-${keyIdx++}`}>
          {renderTextBlocks(rawText.substring(lastIndex), isLight)}
        </React.Fragment>
      );
    }

    return parts;
  };

  return <Box sx={{ width: '100%', wordBreak: 'break-word' }}>{renderFormatted(content)}</Box>;
};

const CodeBlock: React.FC<{ language: string; code: string; isLight: boolean }> = ({
  language,
  code,
  isLight,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        my: 1.5,
        borderRadius: 1.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)',
        bgcolor: isLight ? '#f6f8fa' : '#0d1117',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          bgcolor: isLight ? '#eaeef2' : '#161b22',
          borderBottom: '1px solid',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: isLight ? '#57606a' : '#8b949e',
            textTransform: 'lowercase',
          }}
        >
          {language || 'code'}
        </Typography>
        <Tooltip title={copied ? 'Copied!' : 'Copy Code'}>
          <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5 }}>
            {copied ? <Check size={14} color="#2da44e" /> : <Copy size={14} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          p: 1.5,
          m: 0,
          overflowX: 'auto',
          fontSize: '0.82rem',
          fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
          lineHeight: 1.5,
          color: isLight ? '#24292f' : '#e6edf3',
        }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  );
};

function renderTextBlocks(text: string, isLight: boolean) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      elements.push(
        <MarkdownTable key={`table-${elements.length}`} lines={tableBuffer} isLight={isLight} />
      );
      tableBuffer = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check table line
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      tableBuffer.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <Typography
          key={`h3-${i}`}
          variant="subtitle1"
          sx={{ fontWeight: 700, mt: 1.5, mb: 0.5, color: isLight ? '#1a1f2c' : '#f0f6fc' }}
        >
          {renderInline(line.slice(4))}
        </Typography>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <Typography
          key={`h2-${i}`}
          variant="h6"
          sx={{ fontWeight: 700, fontSize: '1.05rem', mt: 2, mb: 0.75, color: isLight ? '#1a1f2c' : '#f0f6fc' }}
        >
          {renderInline(line.slice(3))}
        </Typography>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <Typography
          key={`h1-${i}`}
          variant="h5"
          sx={{ fontWeight: 800, fontSize: '1.25rem', mt: 2.5, mb: 1, color: isLight ? '#1a1f2c' : '#f0f6fc' }}
        >
          {renderInline(line.slice(2))}
        </Typography>
      );
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <Box
          key={`li-${i}`}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            ml: line.startsWith('  ') ? 3 : 1.5,
            my: 0.25,
            lineHeight: 1.6,
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: isLight ? '#57606a' : '#8b949e',
              mt: '8px',
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" component="span" sx={{ fontSize: '0.88rem' }}>
            {renderInline(line.trim().substring(2))}
          </Typography>
        </Box>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <Box
            key={`oli-${i}`}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              ml: 1.5,
              my: 0.35,
              lineHeight: 1.6,
            }}
          >
            <Typography
              variant="body2"
              component="span"
              sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.85rem', minWidth: 16 }}
            >
              {match[1]}.
            </Typography>
            <Typography variant="body2" component="span" sx={{ fontSize: '0.88rem' }}>
              {renderInline(match[2])}
            </Typography>
          </Box>
        );
      }
    } else if (line.trim() === '---' || line.trim() === '***') {
      elements.push(
        <Box
          key={`hr-${i}`}
          component="hr"
          sx={{
            my: 1.5,
            border: 'none',
            borderTop: '1px solid',
            borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
          }}
        />
      );
    } else if (line.trim().length > 0) {
      elements.push(
        <Typography
          key={`p-${i}`}
          variant="body2"
          sx={{
            my: 0.75,
            fontSize: '0.88rem',
            lineHeight: 1.6,
            color: isLight ? '#24292f' : '#e6edf3',
          }}
        >
          {renderInline(line)}
        </Typography>
      );
    }
  }

  flushTable();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold, italic, code pills
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return tokens.map((token, idx) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <Box
          key={idx}
          component="code"
          sx={{
            px: 0.6,
            py: 0.2,
            borderRadius: 1,
            fontSize: '0.82rem',
            fontFamily: 'SFMono-Regular, Consolas, monospace',
            bgcolor: (t) =>
              t.palette.mode === 'light' ? 'rgba(175,184,193,0.2)' : 'rgba(110,118,129,0.4)',
            color: (t) => (t.palette.mode === 'light' ? '#cf222e' : '#ff7b72'),
          }}
        >
          {token.slice(1, -1)}
        </Box>
      );
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <Box key={idx} component="strong" sx={{ fontWeight: 700 }}>
          {token.slice(2, -2)}
        </Box>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <Box key={idx} component="em" sx={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </Box>
      );
    }
    return token;
  });
}

const MarkdownTable: React.FC<{ lines: string[]; isLight: boolean }> = ({ lines, isLight }) => {
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        my: 1.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
        bgcolor: isLight ? '#ffffff' : '#161b22',
        overflow: 'hidden',
      }}
    >
      <Table size="small">
        <TableHead sx={{ bgcolor: isLight ? '#f6f8fa' : '#21262d' }}>
          <TableRow>
            {headers.map((h, idx) => (
              <TableCell
                key={idx}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  py: 0.75,
                  borderBottom: '1px solid',
                  borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
                  color: isLight ? '#24292f' : '#f0f6fc',
                }}
              >
                {renderInline(h)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rIdx) => (
            <TableRow
              key={rIdx}
              sx={{
                '&:hover': {
                  bgcolor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                },
              }}
            >
              {row.map((cell, cIdx) => (
                <TableCell
                  key={cIdx}
                  sx={{
                    fontSize: '0.8rem',
                    py: 0.65,
                    borderBottom:
                      rIdx === rows.length - 1
                        ? 'none'
                        : `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {renderInline(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
