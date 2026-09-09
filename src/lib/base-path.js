/**
 * Domino notebook sessions mount the UI under
 * /{owner}/{project}/r/notebookSession/{id}/proxy/{port}.
 * Empty locally so /api/v1 and /login stay unchanged.
 */
const RAW = import.meta.env.VITE_BASE_PATH || '';

/** Normalised to no trailing slash, so `${BASE_PATH}/api/v1` never doubles up. */
export const BASE_PATH = RAW === '/' ? '' : RAW.replace(/\/$/, '');

export function withBasePath(path) {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_PATH}${normalised}`;
}
