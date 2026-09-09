/**
 * User preferences, kept in this browser.
 *
 * The GitHub token is deliberately *not* persisted. A PAT in localStorage is
 * readable by any script on this origin and survives long after the person has
 * walked away, so it is held in memory for the session only — and in most
 * deployments it is not needed at all, because the server holds its own
 * credential (see `server_token_configured` on GET /settings).
 */

const SETTINGS_KEY = 'ai_test_platform_user_settings';

/** Keys that must never reach persistent storage, whatever gets passed in. */
const NEVER_PERSIST = ['githubToken', 'github_token', 'token', 'apiToken'];

export const DEFAULT_SETTINGS = {
    // A new machine has no Copilot CLI, and sending `copilot` anyway fails
    // immediately, so the safe default is the deterministic stand-in.
    generationEngine: 'mock',
    copilotModel: '',
};

/**
 * The session's GitHub token, in memory only.
 *
 * Cleared by a refresh, which is the intended behaviour: a credential the user
 * pasted for one sitting should not outlive it.
 */
let sessionGithubToken = '';

export function getSessionGithubToken() {
    return sessionGithubToken;
}

export function setSessionGithubToken(value) {
    sessionGithubToken = value.trim();
}

/** Drop any credential-shaped key, including one left over from an older build. */
function strip(value) {
    const copy = { ...value };
    for (const key of NEVER_PERSIST) delete copy[key];
    return copy;
}

export function getSavedSettings() {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return DEFAULT_SETTINGS;
        return { ...DEFAULT_SETTINGS, ...strip(JSON.parse(stored)) };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings) {
    const updated = {
        ...getSavedSettings(),
        ...strip(settings),
        savedAt: new Date().toISOString(),
    };
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {
        /* private mode, quota, or blocked storage — preferences are optional */
    }
    return updated;
}

/**
 * Remove a token written by a previous version of this app.
 *
 * Older builds stored the PAT in localStorage; anyone who used one still has it
 * sitting there. Call this on startup so upgrading actually clears it.
 */
export function purgeLegacyStoredToken() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (NEVER_PERSIST.some((key) => key in parsed)) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(strip(parsed)));
        }
    } catch {
        /* nothing readable to clean up */
    }
}
