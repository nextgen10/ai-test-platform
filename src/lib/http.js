/**
 * The one HTTP client every API module shares.
 *
 * Requests go to this origin: in development Vite proxies `/api/v1` to the
 * FastAPI service, and in production whatever serves the built assets does the
 * same. The browser therefore never talks to a second origin.
 */

import axios from 'axios';

import { errorFromAxios } from './api-errors';
import { withBasePath } from './base-path';

export const API_BASE = withBasePath('/api/v1');

/**
 * How the client obtains an access token, when sign-in is switched on.
 *
 * Registered by the auth provider rather than imported from it: the token comes
 * from a React-owned MSAL instance, and reaching into that from a module that
 * every page imports would make the dependency circular.
 */
let acquireToken = null;

export function registerTokenProvider(provider) {
    acquireToken = provider;
}

export const http = axios.create({
    baseURL: API_BASE,
    withCredentials: false,
    headers: { 'Content-Type': 'application/json' },
    // A generation run is submitted, not awaited, so no request here is slow on
    // purpose. A minute is long enough for a cold orchestrator and short enough
    // that a hung proxy surfaces as an error rather than a spinner.
    timeout: 60_000,
});

http.interceptors.request.use(async (config) => {
    if (!acquireToken) return config;
    try {
        const token = await acquireToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
        // A token that cannot be renewed silently is not a reason to drop the
        // request: the orchestrator may well be running open (AUTH_MODE
        // disabled), in which case it never looks at the header.
    }
    return config;
});

/**
 * Unwrap to the payload and normalise failures.
 *
 * Callers get data or an Error carrying the server's own words — no page has to
 * know what an axios rejection looks like.
 */
export async function request(path, config = {}) {
    try {
        const response = await http.request({ url: path, ...config });
        return response.data;
    } catch (error) {
        throw errorFromAxios(error);
    }
}

export const get = (path, config) => request(path, { method: 'GET', ...config });
export const post = (path, data, config) => request(path, { method: 'POST', data, ...config });
export const put = (path, data, config) => request(path, { method: 'PUT', data, ...config });
export const del = (path, config) => request(path, { method: 'DELETE', ...config });

/**
 * An absolute URL for a request the browser makes itself (a download, an SSE
 * stream), where the axios instance is not in the picture.
 */
export function apiUrl(path) {
    return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The bearer token for those same non-axios requests, or null. */
export async function currentToken() {
    if (!acquireToken) return null;
    try {
        return await acquireToken();
    } catch {
        return null;
    }
}
