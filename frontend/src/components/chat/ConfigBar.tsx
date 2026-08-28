'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  useTheme,
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
  FileCode2,
  Workflow as WorkflowIcon,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { hubApi, type HubCatalog } from '@/lib/hub-api';
import { api } from '@/lib/api';
import { getSessionGithubToken, setSessionGithubToken } from '@/lib/settings';
import { useRouter } from 'next/navigation';

interface PlatformInfo {
  engine: string;
  server_token_configured: boolean;
}

export const ConfigBar: React.FC = () => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const router = useRouter();
  const { config, updateConfig } = useChatContext();

  const [catalog, setCatalog] = useState<HubCatalog | null>(null);
  const [models, setModels] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tokenInput, setTokenInput] = useState(getSessionGithubToken());

  useEffect(() => {
    hubApi.catalog().then(setCatalog).catch(console.error);
    hubApi.listModels().then(setModels).catch(console.error);
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
    borderRadius: 1.5,
    bgcolor: isLight ? '#ffffff' : '#161b22',
  };

  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
        bgcolor: isLight ? '#f8fafc' : '#0d1117',
        px: { xs: 1.5, sm: 2.5 },
        py: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.5 },
          flexWrap: 'wrap',
        }}
      >
        {/* Agent */}
        <FormControl size="small" sx={{ minWidth: { xs: 130, sm: 160 } }}>
          <InputLabel id="agent-select-label" sx={{ fontSize: '0.82rem' }}>
            Agent
          </InputLabel>
          <Select
            labelId="agent-select-label"
            value={config.agentId || ''}
            label="Agent"
            onChange={(e) => {
              const val = e.target.value || null;
              updateConfig({ agentId: val, ...(val ? { workflowId: null } : {}) });
            }}
            disabled={runMode}
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
                  <span>{ag.name}</span>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Workflow */}
        <FormControl size="small" sx={{ minWidth: { xs: 130, sm: 180 } }}>
          <InputLabel id="workflow-select-label" sx={{ fontSize: '0.82rem' }}>
            Workflow
          </InputLabel>
          <Select
            labelId="workflow-select-label"
            value={config.workflowId || ''}
            label="Workflow"
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                updateConfig({ workflowId: null });
                return;
              }
              const wf = catalog?.workflows.find((w) => w.id === id);
              if (wf?.has_custom_ui && wf.custom_ui_route) {
                router.push(wf.custom_ui_route);
                return;
              }
              updateConfig({ workflowId: id });
            }}
            sx={selectSx}
          >
            <MenuItem value="">
              <em>None — chat with the agent</em>
            </MenuItem>
            {(catalog?.workflows ?? []).map((wf) => (
              <MenuItem key={wf.id} value={wf.id} disabled={wf.available === false}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WorkflowIcon size={14} color="#3b82f6" />
                  <ListItemText
                    primary={wf.name}
                    secondary={wf.available === false ? 'Unavailable' : undefined}
                    primaryTypographyProps={{ fontSize: '0.85rem' }}
                    secondaryTypographyProps={{ fontSize: '0.7rem' }}
                  />
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Model */}
        <FormControl size="small" sx={{ minWidth: { xs: 130, sm: 160 } }}>
          <InputLabel id="model-select-label" sx={{ fontSize: '0.82rem' }}>
            Copilot Model
          </InputLabel>
          <Select
            labelId="model-select-label"
            value={config.model || ''}
            label="Copilot Model"
            onChange={(e) => updateConfig({ model: e.target.value || null })}
            sx={selectSx}
          >
            <MenuItem value="">
              {/* Which model that is belongs to the CLI, so don't name one here. */}
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
          </Select>
        </FormControl>

        {/* Engine — per request, never server state */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel id="engine-select-label" sx={{ fontSize: '0.82rem' }}>
            Engine
          </InputLabel>
          <Select
            labelId="engine-select-label"
            value={config.engine || ''}
            label="Engine"
            onChange={(e) =>
              updateConfig({ engine: (e.target.value as 'mock' | 'copilot') || null })
            }
            sx={selectSx}
          >
            <MenuItem value="">
              <em>Platform ({platform?.engine ?? '…'})</em>
            </MenuItem>
            <MenuItem value="copilot">Copilot (live)</MenuItem>
            <MenuItem value="mock">Mock (offline)</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          {effectiveEngine === 'mock' && (
            <Tooltip title="Responses are deterministic stand-ins, not real generation.">
              <Chip
                label="Mock"
                size="small"
                sx={{ fontSize: '0.68rem', height: 22, fontWeight: 700 }}
              />
            </Tooltip>
          )}

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
            sx={{ fontSize: '0.75rem', textTransform: 'none', px: 1, color: 'text.secondary' }}
          >
            More Options
          </Button>
        </Box>
      </Box>

      {/* A workflow runs as a job, which is worth saying before someone types. */}
      {selectedWorkflow && (
        <Box sx={{ pt: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            <strong>{selectedWorkflow.name}</strong> runs as a job through{' '}
            {selectedWorkflow.agents.length} agent
            {selectedWorkflow.agents.length === 1 ? '' : 's'}
            {selectedWorkflow.approval_gate ? ', pausing for your approval partway' : ''}.
            Your message is a job brief, not a chat turn. Send opens the job page.
          </Typography>
        </Box>
      )}

      {/* Advanced: skill, prompt template, per-session token */}
      <Collapse in={showAdvanced}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pt: 1.25,
            mt: 1,
            borderTop: '1px dashed',
            borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="skill-select-label" sx={{ fontSize: '0.82rem' }}>
              Skill Context
            </InputLabel>
            <Select
              labelId="skill-select-label"
              value={config.skillId || ''}
              label="Skill Context"
              onChange={(e) => updateConfig({ skillId: e.target.value || null })}
              disabled={runMode}
              sx={selectSx}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {catalog?.skills.map((sk) => (
                <MenuItem key={sk.id} value={sk.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Layers size={14} color="#10b981" />
                    <span>{sk.name}</span>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="prompt-select-label" sx={{ fontSize: '0.82rem' }}>
              Prompt Template
            </InputLabel>
            <Select
              labelId="prompt-select-label"
              value={config.promptId || ''}
              label="Prompt Template"
              onChange={(e) => updateConfig({ promptId: e.target.value || null })}
              disabled={runMode}
              sx={selectSx}
            >
              <MenuItem value="">
                <em>None (Free-form)</em>
              </MenuItem>
              {catalog?.prompts.map((pr) => (
                <MenuItem key={pr.id} value={pr.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileCode2 size={14} color="#f59e0b" />
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
            <TextField
              size="small"
              label="GitHub token (this session only)"
              type="password"
              placeholder="github_pat_..."
              helperText="Held in memory; cleared when you reload."
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setSessionGithubToken(e.target.value);
              }}
              sx={{
                flex: 1,
                minWidth: 240,
                '& input': { fontSize: '0.82rem' },
                '& label': { fontSize: '0.82rem' },
                bgcolor: isLight ? '#ffffff' : '#161b22',
              }}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
