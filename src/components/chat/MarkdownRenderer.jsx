import React, { Fragment, memo, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { copyToClipboard } from '@/lib/clipboard';
import { cx } from '../ui/cx';
import { IconButton, Tooltip } from '../ui/primitives';

/**
 * The href of a markdown link, or null if it is not one we will follow.
 *
 * Agent output is untrusted text, so `javascript:` and `data:` targets must not
 * become clickable.
 */
function safeHref(raw) {
    const url = raw.trim();
    if (url.startsWith('/') || url.startsWith('#')) return url;
    try {
        const { protocol } = new URL(url);
        return ['http:', 'https:', 'mailto:'].includes(protocol) ? url : null;
    } catch {
        return null;
    }
}

function renderInline(text) {
    // Links, bold, italic, code pills.
    const tokens = text.split(/(`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g);

    return tokens.map((token, index) => {
        if (token.startsWith('`') && token.endsWith('`')) {
            return (
                <code
                    key={index}
                    className="rounded-ubs bg-[color-mix(in_srgb,var(--col-border-illustrative)_35%,transparent)] px-1.5 py-0.5 font-mono text-[0.82rem] text-brand"
                >
                    {token.slice(1, -1)}
                </code>
            );
        }

        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
        if (link) {
            const href = safeHref(link[2]);
            if (!href) return link[1];
            return (
                <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="font-medium">
                    {link[1]}
                </a>
            );
        }

        if (token.startsWith('**') && token.endsWith('**')) {
            return (
                <strong key={index} className="font-medium">
                    {token.slice(2, -2)}
                </strong>
            );
        }

        if (token.startsWith('*') && token.endsWith('*')) {
            return (
                <em key={index} className="italic">
                    {token.slice(1, -1)}
                </em>
            );
        }

        return token;
    });
}

function CodeBlock({ language, code }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!(await copyToClipboard(code))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-3 min-w-0 max-w-full overflow-hidden rounded-ubs border border-hairline bg-elevated">
            <div className="flex items-center justify-between border-b border-hairline bg-sunken px-3 py-1">
                <span className="font-mono text-[0.75rem] font-medium lowercase text-subtle">
                    {language || 'code'}
                </span>
                <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
                    <IconButton size="small" onClick={handleCopy} aria-label="Copy code">
                        {copied ? <Check size={14} className="text-moss" /> : <Copy size={14} />}
                    </IconButton>
                </Tooltip>
            </div>
            <pre className="m-0 overflow-x-auto p-3 font-mono text-[0.82rem] leading-relaxed text-ink">
                <code>{code}</code>
            </pre>
        </div>
    );
}

function MarkdownTable({ lines }) {
    if (lines.length < 2) return null;

    const parseRow = (line) =>
        line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());

    const headers = parseRow(lines[0]);
    const rows = lines.slice(2).map(parseRow);

    return (
        // A wide markdown table must scroll itself; letting it clip forced the
        // console column wider instead.
        <div className="my-3 max-w-full overflow-x-auto rounded-ubs border border-hairline bg-surface">
            <table className="ui-table ui-table-dense">
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index} className="text-[0.8rem]">
                                {renderInline(header)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="text-[0.8rem]">
                                    {renderInline(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function renderTextBlocks(text) {
    const lines = text.split('\n');
    const elements = [];
    let tableBuffer = [];
    let inTable = false;

    const flushTable = () => {
        if (tableBuffer.length > 0) {
            elements.push(<MarkdownTable key={`table-${elements.length}`} lines={tableBuffer} />);
            tableBuffer = [];
            inTable = false;
        }
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];

        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            inTable = true;
            tableBuffer.push(line);
            continue;
        } else if (inTable) {
            flushTable();
        }

        if (line.startsWith('### ')) {
            elements.push(
                <p key={`h3-${i}`} className="ui-subtitle1 mb-1 mt-3 text-ink">
                    {renderInline(line.slice(4))}
                </p>,
            );
        } else if (line.startsWith('## ')) {
            elements.push(
                <p key={`h2-${i}`} className="mb-1.5 mt-4 text-[1.05rem] font-medium text-ink">
                    {renderInline(line.slice(3))}
                </p>,
            );
        } else if (line.startsWith('# ')) {
            elements.push(
                <p key={`h1-${i}`} className="mb-2 mt-5 text-[1.25rem] font-medium text-ink">
                    {renderInline(line.slice(2))}
                </p>,
            );
        } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            elements.push(
                <div
                    key={`li-${i}`}
                    className={cx('my-0.5 flex items-start gap-2 leading-relaxed', line.startsWith('  ') ? 'ml-6' : 'ml-3')}
                >
                    <span className="mt-2 inline-block size-[5px] shrink-0 rounded-full bg-subtle" />
                    <span className="text-[0.88rem]">{renderInline(line.trim().substring(2))}</span>
                </div>,
            );
        } else if (/^\d+\.\s/.test(line.trim())) {
            const match = line.trim().match(/^(\d+)\.\s(.*)/);
            if (match) {
                elements.push(
                    <div key={`oli-${i}`} className="my-1 ml-3 flex items-start gap-2 leading-relaxed">
                        <span className="min-w-4 text-[0.85rem] font-medium text-brand">{match[1]}.</span>
                        <span className="text-[0.88rem]">{renderInline(match[2])}</span>
                    </div>,
                );
            }
        } else if (line.trim() === '---' || line.trim() === '***') {
            elements.push(<hr key={`hr-${i}`} className="ui-divider my-3" />);
        } else if (line.trim().length > 0) {
            elements.push(
                <p key={`p-${i}`} className="my-1.5 text-[0.88rem] leading-relaxed text-ink">
                    {renderInline(line)}
                </p>,
            );
        }
    }

    flushTable();
    return elements;
}

/** Parse code blocks, tables, headers, lists, and paragraphs into elements. */
function parseMarkdown(rawText) {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    const pushText = (text) => {
        if (!text) return;
        parts.push(<Fragment key={`text-${keyIndex++}`}>{renderTextBlocks(text)}</Fragment>);
    };

    while ((match = codeBlockRegex.exec(rawText)) !== null) {
        pushText(rawText.substring(lastIndex, match.index));
        const language = (match[1] || 'text').toLowerCase();
        const code = match[2];
        // Agents wrap finished reports in ```markdown — render those as prose,
        // not as a monospace dump.
        if (language === 'markdown' || language === 'md') {
            pushText(code);
        } else {
            parts.push(<CodeBlock key={`code-${keyIndex++}`} language={match[1] || 'text'} code={code} />);
        }
        lastIndex = match.index + match[0].length;
    }

    const rest = rawText.substring(lastIndex);
    if (rest) {
        // A fence whose closing ``` has not streamed in yet. Rendering the
        // remainder as loose text lets the table and list detectors chew on code
        // and then snap the whole block into shape when the fence arrives, so
        // treat an unterminated opener as a code block that is still growing.
        const unterminated = /```([a-zA-Z0-9_-]*)[ \t]*\n?([\s\S]*)$/.exec(rest);
        if (unterminated) {
            pushText(rest.substring(0, unterminated.index));
            const language = (unterminated[1] || 'text').toLowerCase();
            if (language === 'markdown' || language === 'md') {
                pushText(unterminated[2]);
            } else {
                parts.push(
                    <CodeBlock key={`code-${keyIndex++}`} language={unterminated[1] || 'text'} code={unterminated[2]} />,
                );
            }
        } else {
            pushText(rest);
        }
    }

    return parts;
}

/**
 * Memoised because a streaming reply re-renders its bubble on every token, and
 * an unmemoised parse re-walks the whole message each time.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ content }) {
    const rendered = useMemo(() => parseMarkdown(content), [content]);

    // max-width/min-width pin this to the column it is in. Without them a wide
    // table or code line sets the width and drags the console layout sideways.
    return <div className="w-full min-w-0 max-w-full break-words">{rendered}</div>;
});

export default MarkdownRenderer;
