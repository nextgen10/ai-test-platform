'use client';

/**
 * A JSON document, laid out as a document.
 *
 * Agents in this hub are contract-bound: the designer emits `test_design.json`,
 * the evaluator emits `evaluation.json`, and so on. That is right for the
 * pipeline — the next agent consumes structure, not prose — but it left the
 * console showing a wall of braces for output whose whole point is to be read
 * by a person before they decide what runs next.
 *
 * Deliberately schema-agnostic. There is a renderer per artifact on the job
 * pages already, and each one is a component that has to be written before its
 * artifact can be displayed; a console that works only for the artifacts
 * somebody remembered is not a console for a platform where agents are added as
 * data. So this walks whatever shape it is handed:
 *
 *   scalars at the top level  ->  a header block
 *   array of objects          ->  a table, columns unioned across rows
 *   array of primitives       ->  a list
 *   nested object             ->  a subsection, recursively
 *
 * `scenarios`, `business_rules` and `coverage_dimensions` all fall out of those
 * four rules without naming any of them here.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';

type Json = unknown;

const isObject = (v: Json): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isPrimitive = (v: Json): v is string | number | boolean | null =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v);

/** `business_rules` -> `Business rules`. Ids stay upper: `id` -> `ID`. */
function humanize(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  if (/^id$/i.test(spaced)) return 'ID';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A cell value as text. Nested structures collapse rather than nest a table. */
function cellText(value: Json): string {
  if (value === null || value === undefined) return '—';
  if (isPrimitive(value)) return String(value);
  if (Array.isArray(value)) {
    return value.every(isPrimitive)
      ? value.map((v) => String(v)).join(', ')
      : JSON.stringify(value);
  }
  return JSON.stringify(value);
}

/**
 * Columns whose values are worth reading as state rather than text.
 *
 * Severity is the reason: eighteen scenarios where four are critical is a
 * different document from eighteen where none are, and that difference should
 * survive a glance rather than requiring the column to be read.
 */
const STATEFUL_COLUMNS = new Set([
  'priority',
  'severity',
  'category',
  'status',
  'source',
  'type',
]);

type ChipTone = 'default' | 'error' | 'warning' | 'info' | 'success';

function toneFor(column: string, raw: string): ChipTone {
  const value = raw.trim().toLowerCase();
  if (column === 'priority' || column === 'severity') {
    if (value === 'critical' || value === 'blocker') return 'error';
    if (value === 'high') return 'warning';
    if (value === 'medium') return 'info';
    return 'default';
  }
  if (column === 'status') {
    if (['pass', 'passed', 'ok', 'complete', 'completed', 'success', 'ready'].includes(value)) return 'success';
    if (['fail', 'failed', 'error', 'rejected', 'timeout'].includes(value)) return 'error';
    if (['running', 'pending', 'queued', 'in progress', 'in-progress', 'streaming', 'waiting', 'blocked'].includes(value)) return 'warning';
    return 'default';
  }
  return 'default';
}

const CellValue: React.FC<{ column: string; value: Json }> = ({ column, value }) => {
  const text = cellText(value);
  const key = column.toLowerCase();

  if (STATEFUL_COLUMNS.has(key) && isPrimitive(value) && text !== '—' && text.length < 24) {
    const tone = toneFor(key, text);
    return (
      <Chip
        size="small"
        label={text}
        color={tone === 'default' ? undefined : tone}
        variant={tone === 'default' ? 'outlined' : 'filled'}
        sx={{
          height: 20,
          borderRadius: '2px',
          fontSize: '0.72rem',
          fontWeight: 500,
          textTransform: 'capitalize',
        }}
      />
    );
  }

  return <>{text}</>;
};

/** Column order: first seen wins, so the agent's own field order is preserved. */
function unionColumns(rows: Record<string, Json>[]): string[] {
  const seen: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

const RecordTable: React.FC<{ rows: Record<string, Json>[] }> = ({ rows }) => {
  const columns = useMemo(() => unionColumns(rows), [rows]);

  return (
    <TableContainer
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '2px',
        // The console clips horizontally, so a wide table scrolls inside its
        // own box rather than dragging the whole page sideways.
        overflowX: 'auto',
        maxWidth: '100%',
      }}
    >
      <Table size="small" sx={{ minWidth: columns.length > 3 ? 560 : undefined }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  bgcolor: 'action.hover',
                  whiteSpace: 'nowrap',
                }}
              >
                {humanize(column)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} hover>
              {columns.map((column) => (
                <TableCell
                  key={column}
                  sx={{
                    fontSize: '0.82rem',
                    verticalAlign: 'top',
                    // Ids and short state columns should not wrap; prose should.
                    whiteSpace: column.toLowerCase() === 'id' ? 'nowrap' : 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  <CellValue column={column} value={row[column]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const PrimitiveList: React.FC<{ items: Json[] }> = ({ items }) => (
  <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    {items.map((item, index) => (
      <Typography key={index} component="li" variant="body2" sx={{ fontSize: '0.85rem' }}>
        {cellText(item)}
      </Typography>
    ))}
  </Box>
);

const SectionHeading: React.FC<{ title: string; count?: number; depth: number }> = ({
  title,
  count,
  depth,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
    <Typography
      sx={{
        fontWeight: 600,
        fontSize: depth === 0 ? '0.86rem' : '0.8rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: depth === 0 ? 'text.primary' : 'text.secondary',
      }}
    >
      {title}
    </Typography>
    {count !== undefined && (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {count}
      </Typography>
    )}
  </Box>
);

/** One key/value pair from an object, rendered by what the value turns out to be. */
const Entry: React.FC<{ name: string; value: Json; depth: number }> = ({
  name,
  value,
  depth,
}) => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Box>
          <SectionHeading title={humanize(name)} count={0} depth={depth} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            None
          </Typography>
        </Box>
      );
    }
    const objects = value.filter(isObject) as Record<string, Json>[];
    return (
      <Box>
        <SectionHeading title={humanize(name)} count={value.length} depth={depth} />
        {objects.length === value.length ? (
          <RecordTable rows={objects} />
        ) : (
          <PrimitiveList items={value} />
        )}
      </Box>
    );
  }

  if (isObject(value)) {
    return (
      <Box>
        <SectionHeading title={humanize(name)} depth={depth} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pl: 1.5,
            borderLeft: '2px solid',
            borderColor: 'divider',
          }}
        >
          {Object.entries(value).map(([key, nested]) => (
            <Entry key={key} name={key} value={nested} depth={depth + 1} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <SectionHeading title={humanize(name)} depth={depth} />
      <Typography variant="body2" sx={{ fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
        {cellText(value)}
      </Typography>
    </Box>
  );
};

/** Top-level scalars, gathered into one block so the document has a header. */
const Summary: React.FC<{ entries: [string, Json][] }> = ({ entries }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
        columnGap: 2,
        rowGap: 1,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '2px',
        bgcolor: theme.palette.mode === 'light' ? 'action.hover' : 'background.paper',
      }}
    >
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              pt: 0.2,
            }}
          >
            {humanize(key)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
            {cellText(value)}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
};

export const JsonDocumentView: React.FC<{ value: Json }> = ({ value }) => {
  // A bare array is a table on its own — an agent that returns just a suite
  // should not have to be wrapped in an object to be readable.
  if (Array.isArray(value)) {
    const objects = value.filter(isObject) as Record<string, Json>[];
    return (
      <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
        {value.length > 0 && objects.length === value.length ? (
          <RecordTable rows={objects} />
        ) : (
          <PrimitiveList items={value} />
        )}
      </Box>
    );
  }

  if (!isObject(value)) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {cellText(value)}
      </Typography>
    );
  }

  const entries = Object.entries(value);
  const scalars = entries.filter(([, v]) => isPrimitive(v));
  const rest = entries.filter(([, v]) => !isPrimitive(v));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, maxWidth: '100%' }}>
      {scalars.length > 0 && <Summary entries={scalars} />}
      {rest.map(([key, nested]) => (
        <Entry key={key} name={key} value={nested} depth={0} />
      ))}
    </Box>
  );
};
