/**
 * Getting a usable file out of what an agent replied.
 *
 * Agents in this hub mostly produce documents — a test suite, a quality report,
 * an evaluation — and they arrive as chat text: sometimes raw JSON, sometimes
 * fenced, sometimes a paragraph of preamble wrapped around the real payload.
 * Copy-to-clipboard covers a sentence; it does not cover a two-hundred-line
 * suite someone needs to hand to a test manager.
 *
 * Lifted from the Agent Studio's output panel, which is the one part of it
 * worth keeping: the extraction below is the bit that took real cases to get
 * right, and it applies just as well to a reply in the console transcript.
 */

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Any JSON object or array embedded in a reply, or null if there is none. */
export function extractJson(raw: string): unknown | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  // The whole reply is the document.
  const direct = tryParseJson(trimmed);
  if (direct !== null && typeof direct === 'object') return direct;
  // A JSON-encoded string is prose, not a structured document — leave it for
  // the chat preview rather than the Structured / Data tabs.
  if (typeof direct === 'string') return null;

  // Fenced JSON only. Do not treat ```markdown / ```md / ```typescript as JSON
  // just because the old `(?:json)?` pattern made the language tag optional.
  const fenced = /```(json)?[ \t]*\r?\n([\s\S]*?)```/i.exec(trimmed);
  if (fenced) {
    const lang = (fenced[1] || '').toLowerCase();
    const body = fenced[2].trim();
    if (lang === 'json' || body.startsWith('{') || body.startsWith('[')) {
      const parsed = tryParseJson(body);
      if (parsed !== null && typeof parsed === 'object') return parsed;
    }
  }

  // Last resort: the outermost braces or brackets, for a payload buried in
  // prose. Bounded to one attempt each so a reply that merely mentions a brace
  // does not turn into a parse hunt.
  for (const [open, close] of [
    ['{', '}'],
    ['[', ']'],
  ] as const) {
    const first = trimmed.indexOf(open);
    const last = trimmed.lastIndexOf(close);
    if (first !== -1 && last > first) {
      const parsed = tryParseJson(trimmed.slice(first, last + 1));
      if (parsed !== null && typeof parsed === 'object') return parsed;
    }
  }

  return null;
}

/**
 * Unwrap agent replies into text the Preview tab can render like a chatbot.
 *
 * Models often wrap a finished report in ` ```markdown ` … ` ``` `, which a
 * naive markdown parser then shows as a monospace code block. Strip that
 * wrapper (and a JSON-encoded string body) so headings and lists paint.
 */
export function forChatPreview(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  const wholeMd = /^```(?:markdown|md)\s*\r?\n([\s\S]*?)```\s*$/i.exec(text);
  if (wholeMd) return wholeMd[1].replace(/\s+$/, '');

  const asJson = tryParseJson(text);
  if (typeof asJson === 'string') return forChatPreview(asJson);

  // Inline ```markdown fences → body text (keep real code fences alone).
  text = text.replace(/```(?:markdown|md)\s*\r?\n([\s\S]*?)```/gi, (_m, body: string) =>
    String(body).replace(/\s+$/, ''),
  );

  return text;
}

/**
 * The reply as a file: JSON when it holds a document, Markdown otherwise.
 *
 * A JSON reply is re-serialised rather than saved verbatim, so the prose an
 * agent wrapped around it does not end up in a file something else has to parse.
 */
export function asDownload(
  content: string,
  agentId?: string | null,
): { body: string; filename: string; mime: string } {
  const json = extractJson(content);
  const stem = agentId || 'agent-output';
  if (json !== null) {
    return {
      body: JSON.stringify(json, null, 2),
      filename: `${stem}.json`,
      mime: 'application/json',
    };
  }
  return { body: forChatPreview(content) || content, filename: `${stem}.md`, mime: 'text/markdown' };
}
