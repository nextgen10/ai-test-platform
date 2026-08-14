export interface UserSettings {
    copilotModel: string; // e.g. "claude-sonnet-4.5"
    githubToken: string;  // e.g. "ghp_..."
    autoApproveQualityThreshold: number; // default quality score threshold
    savedAt?: string;
}

const SETTINGS_KEY = 'ai_test_platform_user_settings';

export const DEFAULT_SETTINGS: UserSettings = {
    copilotModel: 'claude-3.5-sonnet',
    githubToken: '',
    autoApproveQualityThreshold: 80,
};

export function getSavedSettings(): UserSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(stored);
        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: Partial<UserSettings>): UserSettings {
    const current = getSavedSettings();
    const updated: UserSettings = {
        ...current,
        ...settings,
        savedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    }
    return updated;
}
