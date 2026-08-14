'use client';

import React, { useEffect, useState } from 'react';
import {
    Box, Paper, Typography, Button, TextField, MenuItem, Chip, Alert,
    Divider, InputAdornment, IconButton, Card, CardContent,
    Snackbar, CircularProgress,
} from '@mui/material';
import {
    Cpu, KeyRound, Save, RotateCcw, Eye, EyeOff, ShieldCheck,
    CheckCircle2, Server, Sparkles, Lock, AlertTriangle,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { api, type ModelOption } from '@/lib/api';
import { getSavedSettings, saveSettings, DEFAULT_SETTINGS, type UserSettings } from '@/lib/settings';

/** Shapes GitHub currently issues. Used to warn early, not to block: the list
 *  changes, and only the orchestrator can say whether a token actually works. */
const PAT_PREFIXES = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'];

export default function SettingsPage() {
    const [models, setModels] = useState<ModelOption[]>([]);
    const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [showToken, setShowToken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [health, setHealth] = useState<{ status: string; executor: string; engine: string } | null>(null);

    useEffect(() => {
        // Load saved preferences
        const saved = getSavedSettings();
        setSettingsState(saved);

        // Fetch models & health from backend API. Either may fail independently:
        // `health` staying null after loading means the orchestrator is unreachable.
        Promise.all([
            api.models().then(setModels).catch(() => []),
            api.health().then(setHealth).catch(() => null),
        ]).finally(() => setLoading(false));
    }, []);

    const handleSave = () => {
        const updated = saveSettings(settings);
        setSettingsState(updated);
        setSavedSuccess(true);
    };

    const handleReset = () => {
        // Reset writes through to localStorage immediately, so a saved PAT is gone
        // the moment this runs. Confirm before discarding one.
        if (settings.githubToken.trim()
            && !window.confirm('Reset will clear your saved GitHub PAT. Continue?')) {
            return;
        }
        const reset = saveSettings(DEFAULT_SETTINGS);
        setSettingsState(reset);
        setSavedSuccess(true);
    };

    const selectedModelObj = models.find((m) => m.id === settings.copilotModel);
    const token = settings.githubToken.trim();
    const tokenLooksWrong = token.length > 0 && !PAT_PREFIXES.some((p) => token.startsWith(p));

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 6 }}>
            <PageHeader
                title="Settings & Preferences"
                subtitle="Configure your AI model selection, GitHub Personal Access Token (PAT), and execution environment."
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
                    Settings saved successfully! These preferences will apply to your test generation jobs.
                </Alert>
            </Snackbar>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                {/* 1. AI Model Selection Card */}
                <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex' }}>
                            <Cpu size={20} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
                                Default AI Model
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Choose the LLM used for multi-agent test case generation
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

                {/* 2. GitHub Personal Access Token (PAT) Card */}
                <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                        value={settings.githubToken}
                        onChange={(e) => setSettingsState((prev) => ({ ...prev, githubToken: e.target.value }))}
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

                    {/* Token Status & Security Guarantee */}
                    <Card variant="outlined" sx={{ bgcolor: 'action.hover', borderStyle: 'dashed', mt: 'auto' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    PAT Status
                                </Typography>
                                {token ? (
                                    <Chip size="small" color="success" icon={<ShieldCheck size={12} />} label="Configured & Saved" sx={{ height: 20, fontSize: '0.7rem' }} />
                                ) : (
                                    <Chip size="small" variant="outlined" label="Not Set (Uses System Default)" sx={{ height: 20, fontSize: '0.7rem' }} />
                                )}
                            </Box>

                            {token ? (
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1, fontSize: '0.85rem' }}>
                                    {token.slice(0, 4)}••••••••{token.slice(-4)}
                                </Typography>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1 }}>
                                    No custom PAT configured. System environment default PAT will be used for Copilot.
                                </Typography>
                            )}

                            {/* State what the platform actually does with the token. It is not
                                written to the database, but it IS written to the job workspace,
                                which the artifacts API can currently read back. */}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>
                                    Held in browser local storage and written to the job workspace
                                    (mode 0600) for the run. It is never written to the database, but
                                    it is not deleted after the job and the artifacts API can read it
                                    back. Use a short-lived, minimally-scoped PAT.
                                </span>
                            </Typography>
                        </CardContent>
                    </Card>
                </Paper>

                {/* 3. Execution Environment Overview Card */}
                <Box sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'secondary.main', color: 'secondary.contrastText', display: 'flex' }}>
                                <Server size={20} />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
                                    Platform Environment & Execution Settings
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Backend runtime information and active execution strategy
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 2.5 }} />

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                            {/* These three read from /health. Until it resolves — or if it
                                fails — say so rather than showing a default as though it
                                were the live value. */}
                            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Executor Mode
                                </Typography>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                                    {health?.executor ?? (loading ? '—' : 'Unknown')}
                                </Typography>
                            </Box>
                            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Generation Engine
                                </Typography>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                                    {health?.engine ?? (loading ? '—' : 'Unknown')}
                                </Typography>
                            </Box>
                            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Orchestrator API Status
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    {loading ? (
                                        <Chip size="small" variant="outlined" label="Checking…" />
                                    ) : health ? (
                                        <Chip size="small" color="success" label="Connected" />
                                    ) : (
                                        <Chip size="small" color="error" label="Unreachable" />
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
            </Box>

            {/* Save & Reset Action Bar */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<RotateCcw size={16} />}
                    onClick={handleReset}
                >
                    Reset Defaults
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<Save size={18} />}
                    onClick={handleSave}
                    sx={{ px: 4, fontWeight: 700 }}
                >
                    Save Settings
                </Button>
            </Box>
        </Box>
    );
}
