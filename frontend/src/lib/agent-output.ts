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

/** Any JSON object or array embedded in a reply, or null if there is none. */
export function extractJson(raw: string): unknown | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  // The whole reply is the document.
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  // Fenced, with or without a language tag — the common case, because agents
  // are told to emit JSON and models like to wrap it anyway.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
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
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        // fall through
      }
    }
  }

  return null;
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
  return { body: content, filename: `${stem}.md`, mime: 'text/markdown' };
}
