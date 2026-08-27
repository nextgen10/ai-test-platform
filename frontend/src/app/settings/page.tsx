'use client';

import React, { useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, TextField, MenuItem, Chip, Alert,
    Divider, InputAdornment, IconButton, Card, CardContent,
    Snackbar, CircularProgress, RadioGroup, Radio,
    useTheme, alpha,
} from '@mui/material';
import {
    Cpu, KeyRound, Save, RotateCcw, Eye, EyeOff, ShieldCheck,
    CheckCircle2, Server, Sparkles, Lock, AlertTriangle, Zap,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { api, type ModelOption } from '@/lib/api';
import {
    getSavedSettings,
    saveSettings,
    DEFAULT_SETTINGS,
    getSessionGithubToken,
    setSessionGithubToken,
    purgeLegacyStoredToken,
    type UserSettings,
} from '@/lib/settings';

/** Shapes GitHub currently issues. Used to warn early, not to block. */
const PAT_PREFIXES = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'];

export default function SettingsPage() {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';

    const [models, setModels] = useState<ModelOption[]>([]);
    const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [showToken, setShowToken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [platform, setPlatform] = useState<{
        executor: string;
        engine: string;
        auth_mode: string;
        server_token_configured: boolean;
    } | null>(null);
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
            !window.confirm('This clears the token you entered this session and restores defaults. Continue?')
        ) {
            return;
        }
        setSettingsState(saveSettings(DEFAULT_SETTINGS));
        setTokenInput('');
        setSessionGithubToken('');
        setSavedSuccess(true);
    };

    const selectedModelObj = models.find((m) => m.id === settings.copilotModel);
    const token = tokenInput.trim();
    const tokenLooksWrong = token.length > 0 && !PAT_PREFIXES.some((p) => token.startsWith(p));

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 6 }}>
            <PageHeader
                title="Settings &amp; Preferences"
                subtitle="Your preferences for this browser. They travel with each run — nothing here changes the platform for other people."
            />

            <Snackbar
                open={savedSuccess}
                autoHideDuration={4000}
                onClose={() => setSavedSuccess(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSavedSuccess(false)}
                    severity="success"
                    variant="filled"
                    icon={<CheckCircle2 size={20} />}
                    sx={{ width: '100%', boxShadow: 3 }}
                >
                    Preferences saved. New runs will use the <strong>{settings.generationEngine.toUpperCase()}</strong> engine.
                </Alert>
            </Snackbar>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* 1. Generation Engine Selector Card (Full Width) */}
                <Paper
                    sx={{
                        p: 3.5,
                        borderRadius: 3,
                        border: '2px solid',
                        borderColor: settings.generationEngine === 'copilot' ? 'primary.main' : 'divider',
                        transition: 'border-color 0.2s',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                                <Zap size={22} />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={800} fontSize="1.15rem">
                                    Generation Engine
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Choose whether workflows run via live GitHub Copilot CLI or simulated Mock Engine
                                </Typography>
                            </Box>
                        </Box>
                        <Chip
                            label={settings.generationEngine === 'copilot' ? 'Live Copilot CLI' : 'Deterministic Mock'}
                            color={settings.generationEngine === 'copilot' ? 'primary' : 'default'}
                            sx={{ fontWeight: 800, fontSize: '0.76rem', height: 26 }}
                        />
                    </Box>

                    <Divider sx={{ mb: 2.5 }} />

                    <RadioGroup
                        value={settings.generationEngine}
                        onChange={(e) => setSettingsState((prev) => ({ ...prev, generationEngine: e.target.value as 'mock' | 'copilot' }))}
                    >
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                            {/* Copilot Engine Option */}
                            <Paper
                                variant="outlined"
                                onClick={() => setSettingsState((prev) => ({ ...prev, generationEngine: 'copilot' }))}
                                sx={{
                                    p: 2.5,
                                    borderRadius: 2.5,
                                    cursor: 'pointer',
                                    border: '2px solid',
                                    borderColor: settings.generationEngine === 'copilot' ? 'primary.main' : 'divider',
                                    bgcolor: settings.generationEngine === 'copilot'
                                        ? (isLight ? '#FFF5F5' : alpha(theme.palette.primary.main, 0.08))
                                        : 'transparent',
                                    transition: 'all 0.2s',
                                    '&:hover': { borderColor: 'primary.main' },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                    <Radio
                                        checked={settings.generationEngine === 'copilot'}
                                        value="copilot"
                                        sx={{ p: 0.5, mt: 0.25 }}
                                    />
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary' }}>
                                            GitHub Copilot CLI Engine
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mt: 0.5, lineHeight: 1.5 }}>
                                            Executes real multi-agent reasoning, skills, and model synthesis using your GitHub Copilot subscription.
                                        </Typography>
                                        <Chip
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                            label="Production Mode"
                                            sx={{ mt: 1.25, height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                                        />
                                    </Box>
                                </Box>
                            </Paper>

                            {/* Mock Engine Option */}
                            <Paper
                                variant="outlined"
                                onClick={() => setSettingsState((prev) => ({ ...prev, generationEngine: 'mock' }))}
                                sx={{
                                    p: 2.5,
                                    borderRadius: 2.5,
                                    cursor: 'pointer',
                                    border: '2px solid',
                                    borderColor: settings.generationEngine === 'mock' ? 'info.main' : 'divider',
                                    bgcolor: settings.generationEngine === 'mock'
                                        ? (isLight ? '#F0F9FF' : alpha(theme.palette.info.main, 0.08))
                                        : 'transparent',
                                    transition: 'all 0.2s',
                                    '&:hover': { borderColor: 'info.main' },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                    <Radio
                                        checked={settings.generationEngine === 'mock'}
                                        value="mock"
                                        sx={{ p: 0.5, mt: 0.25, color: 'info.main', '&.Mui-checked': { color: 'info.main' } }}
                                    />
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary' }}>
                                            Mock Engine (Simulation)
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mt: 0.5, lineHeight: 1.5 }}>
                                            Fast, deterministic test execution with zero token usage. Ideal for demos, development, and offline testing.
                                        </Typography>
                                        <Chip
                                            size="small"
                                            color="info"
                                            variant="outlined"
                                            label="Zero Token Consumption"
                                            sx={{ mt: 1.25, height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                                        />
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    </RadioGroup>
                </Paper>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                    {/* 2. AI Model Selection Card */}
                    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex' }}>
                                <Cpu size={20} />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
                                    Default AI Model
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Choose the LLM used for multi-agent synthesis
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 2.5 }} />

                        <TextField
                            select
                            fullWidth
                            size="small"
                            label="Select AI Model"
                            value={settings.copilotModel}
                            onChange={(e) => setSettingsState((prev) => ({ ...prev, copilotModel: e.target.value }))}
                            disabled={loading}
                            sx={{ mb: 2.5 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Cpu size={16} />
                                    </InputAdornment>
                                ),
                                endAdornment: loading ? <CircularProgress size={16} sx={{ mr: 2 }} /> : undefined,
                            }}
                        >
                            <MenuItem value="">
                                <em>Default (Platform Config)</em>
                            </MenuItem>
                            {models.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                        <span>{m.name}</span>
                                        <Chip size="small" label={m.provider} variant="outlined" sx={{ height: 18, fontSize: '0.65rem', ml: 1 }} />
                                    </Box>
                                </MenuItem>
                            ))}
                        </TextField>

                        {/* Active Saved Model Banner */}
                        <Card variant="outlined" sx={{ bgcolor: 'action.hover', borderStyle: 'dashed', mt: 'auto' }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Saved Model Status
                                    </Typography>
                                    <Chip
                                        size="small"
                                        color="primary"
                                        icon={<Sparkles size={12} />}
                                        label="Active Setting"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                </Box>
                                <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                                    {(selectedModelObj?.name ?? settings.copilotModel) || 'Default (Platform Setting)'}
                                </Typography>
                                {selectedModelObj && (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                        Provider: <strong>{selectedModelObj.provider}</strong> — Model ID: <code>{selectedModelObj.id}</code>
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Paper>

                    {/* 3. GitHub Personal Access Token (PAT) Card */}
                    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'info.main', color: 'info.contrastText', display: 'flex' }}>
                                <KeyRound size={20} />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
                                    GitHub Personal Access Token (PAT)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Run test generation under your GitHub Copilot subscription
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 2.5 }} />

                        <TextField
                            fullWidth
                            size="small"
                            type={showToken ? 'text' : 'password'}
                            label="GitHub PAT"
                            placeholder="ghp_... or gho_..."
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            error={tokenLooksWrong}
                            helperText={
                                tokenLooksWrong
                                    ? "Doesn't match a known GitHub token prefix (ghp_, gho_, github_pat_, …). It will still be sent as-is."
                                    : ' '
                            }
                            sx={{ mb: 2 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock size={16} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setShowToken(!showToken)} edge="end">
                                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* Token Status */}
                        <Card variant="outlined" sx={{ bgcolor: 'action.hover', borderStyle: 'dashed', mt: 'auto' }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        PAT Status
                                    </Typography>
                                    {token ? (
                                        <Chip size="small" color="success" icon={<ShieldCheck size={12} />} label="Configured &amp; Saved" sx={{ height: 20, fontSize: '0.7rem' }} />
                                    ) : (
                                        <Chip size="small" variant="outlined" label="Not Set (Uses System Default)" sx={{ height: 20, fontSize: '0.7rem' }} />
                                    )}
                                </Box>

                                {token ? (
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1, fontSize: '0.85rem' }}>
                                        {token.slice(0, 4)}••••••••{token.slice(-4)}
                                    </Typography>
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1, fontSize: '0.82rem' }}>
                                        No custom PAT configured. System default PAT will be used.
                                    </Typography>
                                )}

                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                    <span>
                                        Held in browser local storage and applied transiently to your jobs. Never stored permanently in the database.
                                    </span>
                                </Typography>
                            </CardContent>
                        </Card>
                    </Paper>
                </Box>

                {/* 4. Execution Environment Status */}
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'secondary.main', color: 'secondary.contrastText', display: 'flex' }}>
                            <Server size={20} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
                                Runtime Environment Status
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Backend orchestrator connection and active execution status
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 2.5 }} />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="text.secondary">
                                Executor
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                                {platform?.executor ?? (loading ? '—' : 'Unknown')}
                            </Typography>
                        </Box>
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="text.secondary">
                                Platform default engine
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'uppercase', color: 'primary.main' }}>
                                {platform?.engine ?? (loading ? '—' : 'Unknown')}
                            </Typography>
                        </Box>
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="text.secondary">
                                Copilot credential
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>
                                {loading ? (
                                    <Chip size="small" variant="outlined" label="Checking…" />
                                ) : platform?.server_token_configured ? (
                                    <Chip size="small" color="success" label="Held by the server" />
                                ) : (
                                    <Chip size="small" color="warning" label="Per-user token needed" />
                                )}
                            </Box>
                        </Box>
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="text.secondary">
                                Orchestrator
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                {loading ? (
                                    <Chip size="small" variant="outlined" label="Checking…" />
                                ) : platform ? (
                                    <Chip size="small" color="success" label={`Connected · auth ${platform.auth_mode}`} />
                                ) : (
                                    <Chip size="small" color="error" label="Unreachable" />
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </Box>

            {/* Save & Reset Action Bar */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<RotateCcw size={16} />}
                    onClick={handleReset}
                    disabled={saving}
                >
                    Reset Defaults
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />}
                    onClick={handleSave}
                    disabled={saving}
                    sx={{ px: 4, fontWeight: 700, borderRadius: 2 }}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </Box>
        </Box>
    );
}
