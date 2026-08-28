/**
 * Copy to clipboard without assuming a secure context.
 *
 * `navigator.clipboard` is undefined on a plain-HTTP origin, which is exactly
 * how this platform gets deployed on an internal host. Calling it there throws
 * a TypeError from an event handler, so the copy button silently does nothing
 * and reports nothing.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            /* denied by permissions policy — fall through to the legacy path */
        }
    }

    if (typeof document === 'undefined') return false;

    // Deprecated, but it is the only thing that works off a secure origin.
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    try {
        scratch.select();
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(scratch);
    }
}
