/**
 * Turn an orchestrator error response into a sentence a user can act on.
 *
 * FastAPI answers a validation failure with 422 and a `detail` *list* of issue
 * objects rather than a string. A caller that forwards `detail` only when it is
 * a string therefore throws away the one part of the response that says what to
 * fix, leaving the user with a bare status code — "Request failed (422)" for
 * something as ordinary as a too-short field.
 */

/** How many field errors to spell out before summarising the remainder. */
const MAX_ISSUES = 3;

/** Which `loc` segments name the request part rather than a field. */
const REQUEST_PARTS = new Set(['body', 'query', 'path', 'header', 'cookie']);

/** `["body", "copilot_model"]` becomes `"Copilot model"`. */
function fieldLabel(loc) {
    if (!Array.isArray(loc)) return null;

    const path = loc.filter((part) => typeof part === 'string' && !REQUEST_PARTS.has(part));
    const leaf = path[path.length - 1];
    if (!leaf) return null;

    const spaced = leaf.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function describeIssue(issue) {
    const msg = typeof issue?.msg === 'string' ? issue.msg.trim() : '';
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
export function describeErrorBody(body) {
    if (!body || typeof body !== 'object') return null;
    const { detail } = body;

    if (typeof detail === 'string') return detail.trim() || null;

    if (Array.isArray(detail)) {
        const described = detail.map(describeIssue).filter(Boolean);
        if (described.length === 0) return null;

        const shown = described.slice(0, MAX_ISSUES).join('; ');
        const hidden = described.length - MAX_ISSUES;
        return hidden > 0 ? `${shown} (and ${hidden} more)` : shown;
    }

    return null;
}

/**
 * Build the Error to throw for a failed `fetch` response.
 *
 * Consumes the response body, so callers must not have read it already.
 * Used on the SSE path, which cannot go through axios.
 */
export async function errorFromResponse(response, fallback) {
    let described = null;
    try {
        described = describeErrorBody(await response.json());
    } catch {
        /* non-JSON body — a proxy error page, or no body at all */
    }
    return new Error(described ?? fallback ?? `Request failed (${response.status})`);
}

/**
 * The same treatment for an axios rejection.
 *
 * A request that never reached the server has no response to describe, and
 * "Network Error" tells a user nothing — name the orchestrator instead.
 */
export function errorFromAxios(error, fallback) {
    const response = error?.response;
    if (!response) {
        if (error?.code === 'ECONNABORTED') return new Error('The orchestrator took too long to respond.');
        return new Error('Cannot reach the orchestrator. Try again in a moment.');
    }
    const described = describeErrorBody(response.data);
    return new Error(described ?? fallback ?? `Request failed (${response.status})`);
}
