import React, { useEffect, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, Cpu, Eye, EyeOff, KeyRound, Lock, RotateCcw, Save,
    Server, ShieldCheck, Sparkles, Zap,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { Button, Chip, Divider, Paper, Spinner } from '@/components/ui/primitives';
import { Snackbar } from '@/components/ui/overlays';
import { cx } from '@/components/ui/cx';
import { api } from '@/lib/api';
import {
    DEFAULT_SETTINGS, getSavedSettings, getSessionGithubToken, purgeLegacyStoredToken,
    saveSettings, setSessionGithubToken,
} from '@/lib/settings';

/** Shapes GitHub currently issues. Used to warn early, not to block. */
const PAT_PREFIXES = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'];

function SectionHeading({ icon, title, subtitle, tone = 'brand' }) {
    const chip = {
        brand: 'bg-brand text-white',
        info: 'bg-[var(--col-info)] text-white',
        contrast: 'bg-contrast text-inverted',
    }[tone];

    return (
        <div className="mb-4 flex items-center gap-3">
            <span className={cx('flex rounded-ubs p-2', chip)}>{icon}</span>
            <div>
                <h2 className="text-[1.05rem] font-medium">{title}</h2>
                <p className="ui-caption text-subtle">{subtitle}</p>
            </div>
        </div>
    );
}

function StatusTile({ label, children }) {
    return (
        <div className="rounded-ubs border border-hairline bg-surface p-4">
            <p className="ui-caption text-subtle">{label}</p>
            <div className="mt-1">{children}</div>
        </div>
    );
}

export default function SettingsPage() {
    const [models, setModels] = useState([]);
    const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
    const [showToken, setShowToken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [platform, setPlatform] = useState(null);
    // The token lives in memory for this session only, so it is component state
    // rather than part of the persisted settings object.
    const [tokenInput, setTokenInput] = useState('');

    useEffect(() => {
        // Clear anything an older build left in localStorage.
        purgeLegacyStoredToken();
        setSettingsState(getSavedSettings());
        setTokenInput(getSessionGithubToken());

        Promise.all([
            api.models().then(setModels).catch(() => []),
            api.settings().then(setPlatform).catch(() => null),
        ]).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Preferences are local. The engine is sent with each job or message
            // rather than written to the server: it used to be a process-global,
            // so one person switching to mock switched it for everyone.
            setSettingsState(saveSettings(settings));
            setSessionGithubToken(tokenInput);
            setSavedSuccess(true);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (
            tokenInput.trim() &&
            !window.confirm(
                'This clears the token you entered this session and restores defaults. Continue?',
            )
        ) {
            return;
        }
        setSettingsState(saveSettings(DEFAULT_SETTINGS));
        setTokenInput('');
        setSessionGithubToken('');
        setSavedSuccess(true);
    };

    const selectedModel = models.find((model) => model.id === settings.copilotModel);
    const token = tokenInput.trim();
    const tokenLooksWrong = token.length > 0 && !PAT_PREFIXES.some((prefix) => token.startsWith(prefix));

    const engineOption = (value, title, description, badge, badgeTone, activeBorder) => (
        <button
            type="button"
            onClick={() => setSettingsState((prev) => ({ ...prev, generationEngine: value }))}
            className={cx(
                'flex items-start gap-3 rounded-ubs border-2 p-5 text-left transition-colors',
                settings.generationEngine === value ? activeBorder : 'border-hairline hover:border-brand',
            )}
        >
            <span
                className={cx(
                    'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2',
                    settings.generationEngine === value ? 'border-brand' : 'border-edge',
                )}
            >
                {settings.generationEngine === value && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className="block">
                <span className="ui-subtitle1 block">{title}</span>
                <span className="mt-1 block text-[0.82rem] leading-relaxed text-subtle">{description}</span>
                <Chip
                    variant="outlined"
                    color={badgeTone}
                    className="mt-3 h-5 text-[0.68rem] font-medium"
                >
                    {badge}
                </Chip>
            </span>
        </button>
    );

    return (
        <div className="mx-auto w-full max-w-[1100px] pb-12">
            <PageHeader
                title="Settings & Preferences"
                subtitle="Your preferences for this browser. They travel with each run — nothing here changes the platform for other people."
            />

            <Snackbar
                open={savedSuccess}
                onClose={() => setSavedSuccess(false)}
                severity="success"
                icon={<CheckCircle2 size={18} />}
                message={
                    <>
                        Preferences saved. New runs will use the{' '}
                        <strong>{settings.generationEngine.toUpperCase()}</strong> engine.
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                {/* 1. Generation engine */}
                <Paper
                    className={cx(
                        'border-2 p-6 transition-colors',
                        settings.generationEngine === 'copilot' ? 'border-brand' : 'border-hairline',
                    )}
                >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="rounded-ubs bg-brand-tint p-2.5 text-brand">
                                <Zap size={22} />
                            </span>
                            <div>
                                <h2 className="text-[1.15rem] font-medium">Generation Engine</h2>
                                <p className="ui-caption text-subtle">
                                    Choose whether workflows run via live GitHub Copilot CLI or the simulated
                                    Mock Engine
                                </p>
                            </div>
                        </div>

                        {settings.generationEngine === 'copilot' ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5">
                                <span className="size-2 animate-hub-live rounded-full bg-danger" style={{ color: 'var(--col-error)' }} />
                                <span className="text-[0.6875rem] font-medium uppercase leading-none tracking-[0.1em] text-subtle">
                                    Live
                                </span>
                            </span>
                        ) : (
                            <Chip color="warning" className="h-[26px] text-[0.76rem] font-medium">
                                Deterministic Mock
                            </Chip>
                        )}
                    </div>

                    <Divider className="mb-5" />

                    <div role="radiogroup" className="grid gap-4 sm:grid-cols-2">
                        {engineOption(
                            'copilot',
                            'GitHub Copilot CLI Engine',
                            'Executes real multi-agent reasoning, skills, and model synthesis using your GitHub Copilot subscription.',
                            'Production Mode',
                            'primary',
                            'border-brand bg-brand-tint',
                        )}
                        {engineOption(
                            'mock',
                            'Mock Engine (Simulation)',
                            'Fast, deterministic test execution with zero token usage. Ideal for demos, development, and offline testing.',
                            'Zero Token Consumption',
                            'info',
                            'border-[var(--col-info)] bg-elevated',
                        )}
                    </div>
                </Paper>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* 2. Model */}
                    <Paper className="flex h-full flex-col p-6">
                        <SectionHeading
                            icon={<Cpu size={20} />}
                            title="Default AI Model"
                            subtitle="Choose the LLM used for multi-agent synthesis"
                        />
                        <Divider className="mb-5" />

                        <label className="ui-label" htmlFor="model-select">
                            Select AI Model
                        </label>
                        <div className="relative mb-5">
                            <Cpu size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                            <select
                                id="model-select"
                                className="ui-select pl-9"
                                value={settings.copilotModel}
                                disabled={loading}
                                onChange={(event) =>
                                    setSettingsState((prev) => ({ ...prev, copilotModel: event.target.value }))
                                }
                            >
                                <option value="">Default (Platform Config)</option>
                                {models.map((model) => (
                                    <option key={model.id} value={model.id}>
                                        {`${model.name} — ${model.provider}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-auto rounded-ubs border border-dashed border-hairline bg-surface-hover p-4">
                            <div className="mb-2 flex items-start justify-between gap-2">
                                <p className="ui-caption font-medium uppercase tracking-[0.05em] text-subtle">
                                    Saved Model Status
                                </p>
                                <Chip color="primary" className="h-5 gap-1 text-[0.7rem]">
                                    <Sparkles size={12} />
                                    Active Setting
                                </Chip>
                            </div>
                            <p className="ui-subtitle1 text-brand">
                                {(selectedModel?.name ?? settings.copilotModel) || 'Default (Platform Setting)'}
                            </p>
                            {selectedModel && (
                                <p className="text-[0.8rem] text-subtle">
                                    Provider: <strong>{selectedModel.provider}</strong> — Model ID:{' '}
                                    <code>{selectedModel.id}</code>
                                </p>
                            )}
                        </div>
                    </Paper>

                    {/* 3. GitHub PAT */}
                    <Paper className="flex h-full flex-col p-6">
                        <SectionHeading
                            icon={<KeyRound size={20} />}
                            title="GitHub Personal Access Token (PAT)"
                            subtitle="Run test generation under your GitHub Copilot subscription"
                            tone="info"
                        />
                        <Divider className="mb-5" />

                        <label className="ui-label" htmlFor="pat-input">
                            GitHub PAT
                        </label>
                        <div className="relative">
                            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                            <input
                                id="pat-input"
                                type={showToken ? 'text' : 'password'}
                                className={cx('ui-input px-9', tokenLooksWrong && 'border-danger')}
                                placeholder="ghp_... or gho_..."
                                value={tokenInput}
                                onChange={(event) => setTokenInput(event.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-subtle"
                                aria-label={showToken ? 'Hide token' : 'Show token'}
                                onClick={() => setShowToken((value) => !value)}
                            >
                                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className={cx('ui-helper mb-4 min-h-[1.2em]', tokenLooksWrong && 'text-danger')}>
                            {tokenLooksWrong
                                ? "Doesn't match a known GitHub token prefix (ghp_, gho_, github_pat_, …). It will still be sent as-is."
                                : ' '}
                        </p>

                        <div className="mt-auto rounded-ubs border border-dashed border-hairline bg-surface-hover p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="ui-caption font-medium uppercase tracking-[0.05em] text-subtle">
                                    PAT Status
                                </p>
                                {token ? (
                                    <Chip color="success" className="h-5 gap-1 text-[0.7rem]">
                                        <ShieldCheck size={12} />
                                        Configured for this session
                                    </Chip>
                                ) : (
                                    <Chip variant="outlined" className="h-5 text-[0.7rem]">
                                        Not Set (Uses System Default)
                                    </Chip>
                                )}
                            </div>

                            {token ? (
                                <p className="mb-2 font-mono text-[0.85rem]">
                                    {token.slice(0, 4)}••••••••{token.slice(-4)}
                                </p>
                            ) : (
                                <p className="mb-2 text-[0.82rem] italic text-subtle">
                                    No custom PAT configured. System default PAT will be used.
                                </p>
                            )}

                            <p className="ui-caption flex items-start gap-1 text-subtle">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                <span>
                                    Held in memory for this browser tab. A refresh clears it. It is never written
                                    to local storage or the database.
                                </span>
                            </p>
                        </div>
                    </Paper>
                </div>

                {/* 4. Runtime environment */}
                <Paper className="p-6">
                    <SectionHeading
                        icon={<Server size={20} />}
                        title="Runtime Environment Status"
                        subtitle="Backend orchestrator connection and active execution status"
                        tone="contrast"
                    />
                    <Divider className="mb-5" />

                    <div className="grid gap-4 sm:grid-cols-4">
                        <StatusTile label="Executor">
                            <p className="ui-subtitle1 capitalize">
                                {platform?.executor ?? (loading ? '—' : 'Unknown')}
                            </p>
                        </StatusTile>
                        <StatusTile label="Platform default engine">
                            <p className="ui-subtitle1 uppercase text-brand">
                                {platform?.engine ?? (loading ? '—' : 'Unknown')}
                            </p>
                        </StatusTile>
                        <StatusTile label="Copilot credential">
                            {loading ? (
                                <Chip variant="outlined">Checking…</Chip>
                            ) : platform?.server_token_configured ? (
                                <Chip color="success">Held by the server</Chip>
                            ) : (
                                <Chip color="warning">Per-user token needed</Chip>
                            )}
                        </StatusTile>
                        <StatusTile label="Orchestrator">
                            {loading ? (
                                <Chip variant="outlined">Checking…</Chip>
                            ) : platform ? (
                                <Chip color="success">{`Connected · auth ${platform.auth_mode}`}</Chip>
                            ) : (
                                <Chip color="error">Unreachable</Chip>
                            )}
                        </StatusTile>
                    </div>
                </Paper>
            </div>

            <div className="mt-6 flex justify-end gap-4">
                <Button variant="outlined" onClick={handleReset} disabled={saving}>
                    <RotateCcw size={16} />
                    Reset Defaults
                </Button>
                <Button variant="contained" size="large" className="px-8" onClick={handleSave} disabled={saving}>
                    {saving ? <Spinner size={18} className="text-white" /> : <Save size={18} />}
                    {saving ? 'Saving…' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
