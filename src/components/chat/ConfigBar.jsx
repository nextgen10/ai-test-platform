import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Tooltip,
    useTheme,
    alpha,
    TextField,
    Collapse,
    Button,
    Chip,
    Typography,
    ListItemText,
} from '@mui/material';
import {
    Bot,
    Layers,
    Cpu,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    FileCode2,
    Workflow as WorkflowIcon,
    RotateCcw,
    ShieldCheck,
} from 'lucide-react';

import { useChatContext } from '@/contexts/ChatContext';
import { hubApi } from '@/lib/hub-api';
import { api } from '@/lib/api';
import { getSessionGithubToken, setSessionGithubToken } from '@/lib/settings';
import { selectMenuProps } from '@/theme/mui-theme';
import { displayAgentName } from '@/lib/agent-name';

/**
 * The console's run configuration — MUI Selects matching the Next ConfigBar.
 */
export function ConfigBar({ compact = false }) {
    const theme = useTheme();
    const isLight = theme.palette.mode === 'light';
    const navigate = useNavigate();
    const { config, updateConfig, catalog } = useChatContext();

    const [models, setModels] = useState([]);
    const [platform, setPlatform] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [tokenInput, setTokenInput] = useState(getSessionGithubToken());

    useEffect(() => {
        hubApi.listModels().then(setModels).catch(() => setModels([]));
        api.settings().then(setPlatform).catch(() => setPlatform(null));
    }, []);

    const handleResetConfig = () => {
        updateConfig({
            agentId: null,
            workflowId: null,
            skillId: null,
            promptId: null,
            model: null,
            engine: null,
        });
    };

    const hasActiveConfig =
        Boolean(config.agentId) ||
        Boolean(config.workflowId) ||
        Boolean(config.skillId) ||
        Boolean(config.promptId) ||
        Boolean(config.model) ||
        Boolean(config.engine);

    const selectedWorkflow = catalog?.workflows.find((w) => w.id === config.workflowId);
    const effectiveEngine = config.engine ?? platform?.engine ?? 'mock';
    const runMode = Boolean(config.workflowId);

    const selectSx = {
        fontSize: '0.82rem',
        borderRadius: 2,
        bgcolor: isLight ? '#ffffff' : '#2a2a2a',
        '& .MuiSelect-select': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
    };

    const selectFrame = (width) => ({
        width: { xs: '100%', sm: width },
        minWidth: { xs: 0, sm: width },
        maxWidth: { xs: '100%', sm: width },
        flex: { xs: '1 1 calc(50% - 8px)', sm: `0 0 ${width}px` },
        '& .MuiInputBase-root': { width: '100%' },
        '& .MuiInputLabel-shrink': {
            bgcolor: isLight ? '#ffffff' : '#2a2a2a',
        },
    });

    const workflowName = (id) => catalog?.workflows.find((w) => w.id === id)?.name ?? id;
    const agentName = (id) => {
        const found = catalog?.agents.find((a) => a.id === id);
        return displayAgentName(id, found?.name);
    };
    const modelName = (id) => models.find((m) => m.id === id)?.name ?? id;

    return (
        <Box
            sx={{
                borderBottom: '1px solid',
                borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
                bgcolor: isLight ? '#f9f9f7' : '#1c1c1c',
                px: { xs: 1.5, sm: 2.5 },
                pt: 1.5,
                pb: 1,
                flexShrink: 0,
                minWidth: 0,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1, sm: 1.5 },
                    flexWrap: 'wrap',
                    rowGap: 1,
                    minWidth: 0,
                }}
            >
                {!compact && (
                    <FormControl size="small" sx={selectFrame(168)}>
                        <InputLabel id="agent-select-label" sx={{ fontSize: '0.82rem' }}>
                            Agent
                        </InputLabel>
                        <Select
                            labelId="agent-select-label"
                            value={config.agentId || ''}
                            label="Agent"
                            fullWidth
                            onChange={(e) => {
                                const val = e.target.value || null;
                                updateConfig({ agentId: val, ...(val ? { workflowId: null } : {}) });
                            }}
                            disabled={runMode}
                            renderValue={(value) => (value ? agentName(String(value)) : '')}
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>Auto / Default</em>
                            </MenuItem>
                            {(catalog?.agents ?? [])
                                .filter((ag) => ag.id !== 'ocr-extractor')
                                .map((ag) => (
                                    <MenuItem key={ag.id} value={ag.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Bot size={14} color={theme.palette.primary.main} />
                                            <span>{displayAgentName(ag.id, ag.name)}</span>
                                        </Box>
                                    </MenuItem>
                                ))}
                            {config.agentId &&
                                !(catalog?.agents ?? []).some((ag) => ag.id === config.agentId) && (
                                    <MenuItem value={config.agentId}>{config.agentId}</MenuItem>
                                )}
                        </Select>
                    </FormControl>
                )}

                {!compact && (
                    <FormControl size="small" sx={selectFrame(240)}>
                        <InputLabel id="workflow-select-label" sx={{ fontSize: '0.82rem' }}>
                            Workflow
                        </InputLabel>
                        <Select
                            labelId="workflow-select-label"
                            value={config.workflowId || ''}
                            label="Workflow"
                            fullWidth
                            onChange={(e) => updateConfig({ workflowId: e.target.value || null })}
                            renderValue={(value) => (value ? workflowName(String(value)) : '')}
                            MenuProps={{
                                ...selectMenuProps,
                                slotProps: {
                                    paper: {
                                        sx: {
                                            ...selectMenuProps.slotProps.paper.sx,
                                            '& .MuiMenuItem-root': {
                                                whiteSpace: 'normal',
                                                alignItems: 'flex-start',
                                            },
                                        },
                                    },
                                },
                            }}
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>None — chat with the agent</em>
                            </MenuItem>
                            {(catalog?.workflows ?? []).map((wf) => (
                                <MenuItem
                                    key={wf.id}
                                    value={wf.id}
                                    disabled={wf.available === false}
                                    sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1 }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0, width: '100%' }}>
                                        <Box sx={{ mt: 0.35, flexShrink: 0 }}>
                                            <WorkflowIcon size={14} color="#00759e" />
                                        </Box>
                                        <ListItemText
                                            primary={wf.name}
                                            secondary={wf.available === false ? 'Unavailable' : undefined}
                                            primaryTypographyProps={{
                                                fontSize: '0.85rem',
                                                sx: { whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' },
                                            }}
                                            secondaryTypographyProps={{ fontSize: '0.7rem' }}
                                        />
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                <FormControl size="small" sx={selectFrame(176)}>
                    <InputLabel id="model-select-label" sx={{ fontSize: '0.82rem' }}>
                        Copilot Model
                    </InputLabel>
                    <Select
                        labelId="model-select-label"
                        value={config.model || ''}
                        label="Copilot Model"
                        fullWidth
                        onChange={(e) => updateConfig({ model: e.target.value || null })}
                        renderValue={(value) => (value ? modelName(String(value)) : '')}
                        sx={selectSx}
                    >
                        <MenuItem value="">
                            <em>Platform default</em>
                        </MenuItem>
                        {models.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Cpu size={14} />
                                    <span>{m.name}</span>
                                </Box>
                            </MenuItem>
                        ))}
                        {config.model && !models.some((m) => m.id === config.model) && (
                            <MenuItem value={config.model}>{config.model}</MenuItem>
                        )}
                    </Select>
                </FormControl>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <FormControl size="small" sx={selectFrame(148)}>
                        <InputLabel id="engine-select-label" sx={{ fontSize: '0.82rem' }}>
                            Engine
                        </InputLabel>
                        <Select
                            labelId="engine-select-label"
                            value={config.engine || ''}
                            label="Engine"
                            fullWidth
                            onChange={(e) => updateConfig({ engine: e.target.value || null })}
                            renderValue={(value) => {
                                if (value === 'copilot') return 'Copilot (live)';
                                if (value === 'mock') return 'Mock (offline)';
                                return platform?.engine ? `Platform (${platform.engine})` : 'Platform default';
                            }}
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>Platform ({platform?.engine ?? '…'})</em>
                            </MenuItem>
                            <MenuItem value="copilot">Copilot (live)</MenuItem>
                            <MenuItem value="mock">Mock (offline)</MenuItem>
                        </Select>
                    </FormControl>

                    {effectiveEngine === 'mock' ? (
                        <Tooltip title="Responses are deterministic stand-ins, not real generation.">
                            <Chip
                                label="Mock"
                                size="small"
                                color="warning"
                                sx={{ fontSize: '0.68rem', height: 22, fontWeight: 500, flexShrink: 0 }}
                            />
                        </Tooltip>
                    ) : (
                        <Tooltip title="Runs go through GitHub Copilot CLI.">
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                    flexShrink: 0,
                                    cursor: 'default',
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: isLight ? '#DA0000' : '#E8696F',
                                        animation: 'hubLive 1.8s cubic-bezier(0.38, 0.19, 0.32, 0.95) infinite',
                                        '@keyframes hubLive': {
                                            '0%': { boxShadow: `0 0 0 0 ${alpha(isLight ? '#DA0000' : '#E8696F', 0.7)}` },
                                            '70%': { boxShadow: `0 0 0 12px ${alpha(isLight ? '#DA0000' : '#E8696F', 0)}` },
                                            '100%': { boxShadow: `0 0 0 0 ${alpha(isLight ? '#DA0000' : '#E8696F', 0)}` },
                                        },
                                        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                                    }}
                                />
                                <Typography
                                    component="span"
                                    sx={{
                                        color: isLight ? '#5A5D5C' : '#cccabc',
                                        fontSize: '0.6875rem',
                                        letterSpacing: '0.1em',
                                        fontWeight: 500,
                                        lineHeight: 1,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Live
                                </Typography>
                            </Box>
                        </Tooltip>
                    )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0, minHeight: 32 }}>
                    {hasActiveConfig && (
                        <Tooltip title="Clear the agent, workflow, model and engine selection">
                            <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                startIcon={<RotateCcw size={13} />}
                                onClick={handleResetConfig}
                                sx={{ fontSize: '0.75rem', textTransform: 'none', px: 1 }}
                            >
                                Reset
                            </Button>
                        </Tooltip>
                    )}

                    <Button
                        size="small"
                        variant="text"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        endIcon={showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        sx={{ fontSize: '0.75rem', textTransform: 'none', px: 1, color: 'text.secondary', minWidth: 118 }}
                    >
                        More Options
                    </Button>
                </Box>
            </Box>

            {selectedWorkflow && (
                <Box sx={{ pt: 1, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        <strong>{selectedWorkflow.name}</strong> runs as a job through{' '}
                        {selectedWorkflow.agents.length} agent
                        {selectedWorkflow.agents.length === 1 ? '' : 's'}
                        {selectedWorkflow.approval_gate ? ', pausing for your approval partway' : ''}.
                        Your message is a job brief, not a chat turn. Send opens the job page.
                    </Typography>

                    {selectedWorkflow.has_custom_ui && selectedWorkflow.custom_ui_route && (
                        <Button
                            size="small"
                            variant="text"
                            endIcon={<ExternalLink size={12} />}
                            onClick={() => navigate(selectedWorkflow.custom_ui_route)}
                            sx={{ fontSize: '0.72rem', textTransform: 'none', px: 0.5, py: 0 }}
                        >
                            It also has a dedicated page
                        </Button>
                    )}
                </Box>
            )}

            <Collapse in={showAdvanced}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 1.5,
                        pt: 1.25,
                        mt: 1,
                        borderTop: '1px dashed',
                        borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                        flexWrap: 'wrap',
                    }}
                >
                    {compact && (
                        <FormControl size="small" sx={selectFrame(240)}>
                            <InputLabel id="workflow-job-label" sx={{ fontSize: '0.82rem' }}>
                                Workflow (job)
                            </InputLabel>
                            <Select
                                labelId="workflow-job-label"
                                value={config.workflowId || ''}
                                label="Workflow (job)"
                                fullWidth
                                onChange={(e) => updateConfig({ workflowId: e.target.value || null })}
                                renderValue={(value) => (value ? workflowName(String(value)) : '')}
                                MenuProps={selectMenuProps}
                                sx={selectSx}
                            >
                                <MenuItem value="">
                                    <em>None — run agents one at a time</em>
                                </MenuItem>
                                {(catalog?.workflows ?? []).map((wf) => (
                                    <MenuItem key={wf.id} value={wf.id} disabled={wf.available === false}>
                                        {wf.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl size="small" sx={selectFrame(168)}>
                        <InputLabel id="skill-select-label" sx={{ fontSize: '0.82rem' }}>
                            Skill Context
                        </InputLabel>
                        <Select
                            labelId="skill-select-label"
                            value={config.skillId || ''}
                            label="Skill Context"
                            fullWidth
                            onChange={(e) => updateConfig({ skillId: e.target.value || null })}
                            disabled={runMode}
                            renderValue={(value) =>
                                value ? (catalog?.skills.find((s) => s.id === value)?.name ?? String(value)) : ''
                            }
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {catalog?.skills.map((sk) => (
                                <MenuItem key={sk.id} value={sk.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Layers size={14} color="#469a6c" />
                                        <span>{sk.name}</span>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={selectFrame(180)}>
                        <InputLabel id="prompt-select-label" sx={{ fontSize: '0.82rem' }}>
                            Prompt Template
                        </InputLabel>
                        <Select
                            labelId="prompt-select-label"
                            value={config.promptId || ''}
                            label="Prompt Template"
                            fullWidth
                            onChange={(e) => updateConfig({ promptId: e.target.value || null })}
                            disabled={runMode}
                            renderValue={(value) =>
                                value ? (catalog?.prompts.find((p) => p.id === value)?.name ?? String(value)) : ''
                            }
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>None (Free-form)</em>
                            </MenuItem>
                            {catalog?.prompts.map((pr) => (
                                <MenuItem key={pr.id} value={pr.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <FileCode2 size={14} color="#e4a911" />
                                        <span>{pr.name}</span>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {platform?.server_token_configured ? (
                        <Chip
                            icon={<ShieldCheck size={14} />}
                            label="Using the server's Copilot credential"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.72rem' }}
                        />
                    ) : (
                        <Box sx={{ flex: 1, minWidth: 240 }}>
                            <Typography
                                variant="caption"
                                sx={{ display: 'block', mb: 0.75, color: 'text.secondary', lineHeight: 1.3 }}
                            >
                                Held in memory; cleared when you reload.
                            </Typography>
                            <TextField
                                size="small"
                                fullWidth
                                label="GitHub token (this session only)"
                                type="password"
                                placeholder="github_pat_..."
                                value={tokenInput}
                                onChange={(e) => {
                                    setTokenInput(e.target.value);
                                    setSessionGithubToken(e.target.value);
                                }}
                                sx={{
                                    '& input': { fontSize: '0.82rem' },
                                    '& label': { fontSize: '0.82rem' },
                                    bgcolor: isLight ? '#ffffff' : '#2a2a2a',
                                }}
                            />
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}
