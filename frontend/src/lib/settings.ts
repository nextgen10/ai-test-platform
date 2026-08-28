/**
 * User preferences, kept in this browser.
 *
 * The GitHub token is deliberately *not* persisted. A PAT in localStorage is
 * readable by any script on this origin and survives long after the person has
 * walked away, so it is held in memory for the session only — and in most
 * deployments it is not needed at all, because the server holds its own
 * credential (see `server_token_configured` on GET /settings).
 */

export interface UserSettings {
    /** Which engine to request per job or per message. Not server state. */
    generationEngine: 'mock' | 'copilot';
    copilotModel: string;
    savedAt?: string;
}

const SETTINGS_KEY = 'ai_test_platform_user_settings';

/** Keys that must never reach persistent storage, whatever gets passed in. */
const NEVER_PERSIST = ['githubToken', 'github_token', 'token', 'apiToken'] as const;

export const DEFAULT_SETTINGS: UserSettings = {
    generationEngine: 'copilot',
    copilotModel: '',
};

/**
 * The session's GitHub token, in memory only.
 *
 * Cleared by a refresh, which is the intended behaviour: a credential the user
 * pasted for one sitting should not outlive it.
 */
let sessionGithubToken = '';

export function getSessionGithubToken(): string {
    return sessionGithubToken;
}

export function setSessionGithubToken(value: string): void {
    sessionGithubToken = value.trim();
}

export function getSavedSettings(): UserSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(stored) as Partial<UserSettings>;
        return { ...DEFAULT_SETTINGS, ...strip(parsed) };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: Partial<UserSettings>): UserSettings {
    const updated: UserSettings = {
        ...getSavedSettings(),
        ...strip(settings),
        savedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
        } catch {
            /* private mode, quota, or blocked storage — preferences are optional */
        }
    }
    return updated;
}

/** Drop any credential-shaped key, including one left over from an older build. */
function strip<T extends object>(value: T): T {
    const copy = { ...value } as Record<string, unknown>;
    for (const key of NEVER_PERSIST) delete copy[key];
    return copy as T;
}

/**
 * Remove a token written by a previous version of this app.
 *
 * Older builds stored the PAT in localStorage; anyone who used one still has it
 * sitting there. Call this on startup so upgrading actually clears it.
 */
export function purgeLegacyStoredToken(): void {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        if (NEVER_PERSIST.some((key) => key in parsed)) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(strip(parsed)));
        }
    } catch {
        /* nothing readable to clean up */
    }
}
