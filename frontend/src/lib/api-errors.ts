/**
 * Turn an orchestrator error response into a sentence a user can act on.
 *
 * FastAPI answers a validation failure with 422 and a `detail` *list* of issue
 * objects rather than a string. A caller that forwards `detail` only when it is
 * a string therefore throws away the one part of the response that says what to
 * fix, leaving the user with a bare status code — "Request failed (422)" for
 * something as ordinary as a too-short field.
 */

/** One entry from FastAPI's 422 `detail` list. */
interface ValidationIssue {
    loc?: unknown[];
    msg?: string;
}

/** How many field errors to spell out before summarising the remainder. */
const MAX_ISSUES = 3;

/** Which `loc` segments name the request part rather than a field. */
const REQUEST_PARTS = new Set(['body', 'query', 'path', 'header', 'cookie']);

/** `["body", "copilot_model"]` becomes `"Copilot model"`. */
function fieldLabel(loc: unknown[] | undefined): string | null {
    if (!Array.isArray(loc)) return null;

    const path = loc.filter(
        (part): part is string => typeof part === 'string' && !REQUEST_PARTS.has(part),
    );
    const leaf = path[path.length - 1];
    if (!leaf) return null;

    const spaced = leaf.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function describeIssue(issue: ValidationIssue): string | null {
    const msg = typeof issue.msg === 'string' ? issue.msg.trim() : '';
    if (!msg) return null;
    const label = fieldLabel(issue.loc);
    return label ? `${label}: ${msg}` : msg;
}

/**
 * A readable message for a parsed error body, or null if it carries none.
 *
 * A non-string, non-list `detail` yields null rather than raw JSON: the caller's
 * status-based fallback is more use to a reader than a serialised object.
 */
export function describeErrorBody(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const detail = (body as { detail?: unknown }).detail;

    if (typeof detail === 'string') return detail.trim() || null;

    if (Array.isArray(detail)) {
        const described = detail
            .map((issue) => describeIssue(issue as ValidationIssue))
            .filter((text): text is string => Boolean(text));
        if (described.length === 0) return null;

        const shown = described.slice(0, MAX_ISSUES).join('; ');
        const hidden = described.length - MAX_ISSUES;
        return hidden > 0 ? `${shown} (and ${hidden} more)` : shown;
    }

    return null;
}

/**
 * Build the Error to throw for a failed response.
 *
 * Consumes the response body, so callers must not have read it already.
 */
export async function errorFromResponse(
    response: Response,
    fallback?: string,
): Promise<Error> {
    let described: string | null = null;
    try {
        described = describeErrorBody(await response.json());
    } catch {
        /* non-JSON body — a proxy error page, or no body at all */
    }
    return new Error(described ?? fallback ?? `Request failed (${response.status})`);
}
