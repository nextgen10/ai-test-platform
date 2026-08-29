/**
 * Domino notebook sessions mount the UI under
 * /{owner}/{project}/r/notebookSession/{id}/proxy/{port}.
 * Empty locally so /api/v1 and /login stay unchanged.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBasePath(path: string): string {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_PATH}${normalised}`;
}
