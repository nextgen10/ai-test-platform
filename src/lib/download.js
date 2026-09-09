/**
 * Hand the browser a file built in memory.
 *
 * The object URL is revoked on the next tick rather than immediately: Safari
 * cancels a download whose blob URL is released in the same frame as the click.
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The same, for text content with a known MIME type. */
export function downloadText(text, filename, mime = 'text/plain') {
    downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

/** Pretty-printed JSON as a file. */
export function downloadJson(value, filename) {
    downloadText(JSON.stringify(value, null, 2), filename, 'application/json');
}
