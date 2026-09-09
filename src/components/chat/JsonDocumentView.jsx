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

import React, { Fragment, useMemo } from 'react';

import { cx } from '../ui/cx';
import { Chip } from '../ui/primitives';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const isPrimitive = (value) =>
    value === null || ['string', 'number', 'boolean'].includes(typeof value);

/** `business_rules` -> `Business rules`. Ids stay upper: `id` -> `ID`. */
function humanize(key) {
    const spaced = key.replace(/[_-]+/g, ' ').trim();
    if (/^id$/i.test(spaced)) return 'ID';
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A cell value as text. Nested structures collapse rather than nest a table. */
function cellText(value) {
    if (value === null || value === undefined) return '—';
    if (isPrimitive(value)) return String(value);
    if (Array.isArray(value)) {
        return value.every(isPrimitive) ? value.map(String).join(', ') : JSON.stringify(value);
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
const STATEFUL_COLUMNS = new Set(['priority', 'severity', 'category', 'status', 'source', 'type']);

function toneFor(column, raw) {
    const value = raw.trim().toLowerCase();
    if (column === 'priority' || column === 'severity') {
        if (value === 'critical' || value === 'blocker') return 'error';
        if (value === 'high') return 'warning';
        if (value === 'medium') return 'info';
        return 'default';
    }
    if (column === 'status') {
        if (['pass', 'passed', 'ok', 'complete', 'completed', 'success', 'ready'].includes(value)) {
            return 'success';
        }
        if (['fail', 'failed', 'error', 'rejected', 'timeout'].includes(value)) return 'error';
        if (
            ['running', 'pending', 'queued', 'in progress', 'in-progress', 'streaming', 'waiting', 'blocked'].includes(
                value,
            )
        ) {
            return 'warning';
        }
        return 'default';
    }
    return 'default';
}

function CellValue({ column, value }) {
    const text = cellText(value);
    const key = column.toLowerCase();

    if (STATEFUL_COLUMNS.has(key) && isPrimitive(value) && text !== '—' && text.length < 24) {
        const tone = toneFor(key, text);
        return (
            <Chip
                color={tone === 'default' ? 'default' : tone}
                variant={tone === 'default' ? 'outlined' : 'filled'}
                className="h-5 text-[0.72rem] font-medium capitalize"
            >
                {text}
            </Chip>
        );
    }

    return text;
}

/** Column order: first seen wins, so the agent's own field order is preserved. */
function unionColumns(rows) {
    const seen = [];
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!seen.includes(key)) seen.push(key);
        }
    }
    return seen;
}

function RecordTable({ rows }) {
    const columns = useMemo(() => unionColumns(rows), [rows]);

    return (
        // The console clips horizontally, so a wide table scrolls inside its own
        // box rather than dragging the whole page sideways.
        <div className="max-w-full overflow-x-auto rounded-ubs border border-hairline">
            <table className={cx('ui-table ui-table-dense', columns.length > 3 && 'min-w-[560px]')}>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column}
                                className="whitespace-nowrap text-[0.72rem] uppercase tracking-[0.06em] text-subtle"
                            >
                                {humanize(column)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            {columns.map((column) => (
                                <td
                                    key={column}
                                    className={cx(
                                        'break-words align-top text-[0.82rem]',
                                        // Ids and short state columns should not wrap; prose should.
                                        column.toLowerCase() === 'id' ? 'whitespace-nowrap' : 'whitespace-normal',
                                    )}
                                >
                                    <CellValue column={column} value={row[column]} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PrimitiveList({ items }) {
    return (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-6">
            {items.map((item, index) => (
                <li key={index} className="text-[0.85rem]">
                    {cellText(item)}
                </li>
            ))}
        </ul>
    );
}

function SectionHeading({ title, count, depth }) {
    return (
        <div className="mb-2 flex items-baseline gap-2">
            <span
                className={cx(
                    'font-medium uppercase tracking-[0.05em]',
                    depth === 0 ? 'text-[0.86rem] text-ink' : 'text-[0.8rem] text-subtle',
                )}
            >
                {title}
            </span>
            {count !== undefined && <span className="ui-caption text-subtle">{count}</span>}
        </div>
    );
}

/** One key/value pair from an object, rendered by what the value turns out to be. */
function Entry({ name, value, depth }) {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return (
                <div>
                    <SectionHeading title={humanize(name)} count={0} depth={depth} />
                    <p className="ui-body2 italic text-subtle">None</p>
                </div>
            );
        }
        const objects = value.filter(isObject);
        return (
            <div>
                <SectionHeading title={humanize(name)} count={value.length} depth={depth} />
                {objects.length === value.length ? (
                    <RecordTable rows={objects} />
                ) : (
                    <PrimitiveList items={value} />
                )}
            </div>
        );
    }

    if (isObject(value)) {
        return (
            <div>
                <SectionHeading title={humanize(name)} depth={depth} />
                <div className="flex flex-col gap-4 border-l-2 border-hairline pl-3">
                    {Object.entries(value).map(([key, nested]) => (
                        <Entry key={key} name={key} value={nested} depth={depth + 1} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <SectionHeading title={humanize(name)} depth={depth} />
            <p className="whitespace-pre-wrap text-[0.86rem]">{cellText(value)}</p>
        </div>
    );
}

/** Top-level scalars, gathered into one block so the document has a header. */
function Summary({ entries }) {
    return (
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-ubs border border-hairline bg-elevated p-4 sm:grid-cols-[auto_1fr]">
            {entries.map(([key, value]) => (
                <Fragment key={key}>
                    <span className="ui-caption whitespace-nowrap pt-0.5 font-medium uppercase tracking-[0.05em] text-subtle">
                        {humanize(key)}
                    </span>
                    <span className="whitespace-pre-wrap text-[0.86rem]">{cellText(value)}</span>
                </Fragment>
            ))}
        </div>
    );
}

export function JsonDocumentView({ value }) {
    // A bare array is a table on its own — an agent that returns just a suite
    // should not have to be wrapped in an object to be readable.
    if (Array.isArray(value)) {
        const objects = value.filter(isObject);
        return (
            <div className="min-w-0 max-w-full">
                {value.length > 0 && objects.length === value.length ? (
                    <RecordTable rows={objects} />
                ) : (
                    <PrimitiveList items={value} />
                )}
            </div>
        );
    }

    if (!isObject(value)) {
        return <p className="ui-body2 whitespace-pre-wrap">{cellText(value)}</p>;
    }

    const entries = Object.entries(value);
    const scalars = entries.filter(([, item]) => isPrimitive(item));
    const rest = entries.filter(([, item]) => !isPrimitive(item));

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-6">
            {scalars.length > 0 && <Summary entries={scalars} />}
            {rest.map(([key, nested]) => (
                <Entry key={key} name={key} value={nested} depth={0} />
            ))}
        </div>
    );
}
