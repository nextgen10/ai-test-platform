'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  IconButton,
  Tooltip,
  Paper,
  Alert,
  Skeleton,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search,
  Bot,
  Workflow as WorkflowIcon,
  Layers,
  FileCode2,
  Play,
  ExternalLink,
  Eye,
  Plus,
  Trash2,
  Pencil,
  FlaskConical,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hubApi, type HubCatalog, type HubEntityType, type HubWorkflow } from '@/lib/hub-api';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import AgentTestDialog, { type HubAgentSummary } from '@/components/AgentTestDialog';

type TabKey = 'agents' | 'workflows' | 'skills' | 'prompts';

const TAB_KEYS: TabKey[] = ['agents', 'workflows', 'skills', 'prompts'];

/** Singular entity type for a tab, for the CRUD calls. */
const ENTITY_OF: Record<TabKey, HubEntityType> = {
  agents: 'agent',
  workflows: 'workflow',
  skills: 'skill',
  prompts: 'prompt',
};

const FILE_HINT: Record<HubEntityType, string> = {
  agent: '<id>.agent.md',
  workflow: '<id>.workflow.yaml',
  skill: '<id>/SKILL.md',
  prompt: '<id>.prompt.md',
};

/** Language for the preview fence, so YAML is not shown as Markdown. */
const PREVIEW_LANG: Record<HubEntityType, string> = {
  agent: 'markdown',
  workflow: 'yaml',
  skill: 'markdown',
  prompt: 'markdown',
};

export default function RegistryPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      }
    >
      <RegistryContent />
    </Suspense>
  );
}

function RegistryContent() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabKey>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalog, setCatalog] = useState<HubCatalog>({
    agents: [],
    workflows: [],
    skills: [],
    prompts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewItem, setPreviewItem] =
    useState<{ id: string; title: string; content: string; type: HubEntityType } | null>(null);

  // One dialog serves both create and edit; `editingId` decides which.
  const [editorOpen, setEditorOpen] = useState(false);
  const [entityType, setEntityType] = useState<HubEntityType>('agent');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState('');
  const [entityContent, setEntityContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [testAgent, setTestAgent] = useState<HubAgentSummary | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<{ id: string; name: string; type: HubEntityType } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && (TAB_KEYS as string[]).includes(tabParam)) {
      setTab(tabParam as TabKey);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await hubApi.catalog());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTryInChat = (config: {
    agentId?: string;
    workflowId?: string;
    skillId?: string;
    promptId?: string;
  }) => {
    const params = new URLSearchParams();
    if (config.agentId) params.set('agent', config.agentId);
    if (config.workflowId) params.set('workflow', config.workflowId);
    if (config.skillId) params.set('skill', config.skillId);
    if (config.promptId) params.set('prompt', config.promptId);
    router.push(`/chat?${params.toString()}`);
  };

  // ------------------------------------------------------------ editor

  /** Start from the hub's own `_template` file rather than a blank box. */
  const loadTemplate = async (type: HubEntityType) => {
    setLoadingTemplate(true);
    try {
      const { content } = await hubApi.getTemplate(type);
      setEntityContent(content);
    } catch {
      setEntityContent('');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const openCreate = async (type: HubEntityType) => {
    setEntityType(type);
    setEditingId(null);
    setEntityId('');
    setEditorError(null);
    setEditorOpen(true);
    await loadTemplate(type);
  };

  const openEdit = (type: HubEntityType, id: string, content: string) => {
    setEntityType(type);
    setEditingId(id);
    setEntityId(id);
    setEntityContent(content);
    setEditorError(null);
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    const id = entityId.trim();
    if (!id || !entityContent.trim()) {
      setEditorError('Give it an identifier and some content.');
      return;
    }
    setSubmitting(true);
    setEditorError(null);
    try {
      const isEdit = editingId !== null;
      const calls: Record<HubEntityType, (i: string, c: string) => Promise<unknown>> = isEdit
        ? {
            agent: hubApi.updateAgent,
            workflow: hubApi.updateWorkflow,
            skill: hubApi.updateSkill,
            prompt: hubApi.updatePrompt,
          }
        : {
            agent: hubApi.createAgent,
            workflow: hubApi.createWorkflow,
            skill: hubApi.createSkill,
            prompt: hubApi.createPrompt,
          };
      await calls[entityType](id, entityContent);
      setEditorOpen(false);
      setEntityId('');
      setEntityContent('');
      setEditingId(null);
      await loadData();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Could not save it');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const calls: Record<HubEntityType, (id: string) => Promise<unknown>> = {
        agent: hubApi.deleteAgent,
        workflow: hubApi.deleteWorkflow,
        skill: hubApi.deleteSkill,
        prompt: hubApi.deletePrompt,
      };
      await calls[deleteTarget.type](deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete it');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ------------------------------------------------------------ filtering

  const query = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    const matches = (...fields: (string | undefined)[]) =>
      !query || fields.some((f) => (f ?? '').toLowerCase().includes(query));
    return {
      agents: catalog.agents.filter((a) => matches(a.name, a.description, a.id)),
      workflows: catalog.workflows.filter((w) => matches(w.name, w.description, w.id)),
      skills: catalog.skills.filter((s) => matches(s.name, s.description, s.id)),
      prompts: catalog.prompts.filter((p) => matches(p.name, p.description, p.id)),
    };
  }, [catalog, query]);

  const counts: Record<TabKey, number> = {
    agents: catalog.agents.length,
    workflows: catalog.workflows.length,
    skills: catalog.skills.length,
    prompts: catalog.prompts.length,
  };

  const cardSx = (hoverColor: string) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: 2.5,
    bgcolor: isLight ? '#ffffff' : '#11161d',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: hoverColor,
      boxShadow: `0 6px 18px ${alpha(hoverColor, 0.15)}`,
    },
  });

  const rowActions = (type: HubEntityType, id: string, name: string, content: string) => (
    <>
      <Tooltip title={`View ${FILE_HINT[type]}`}>
        <IconButton
          size="small"
          onClick={() => setPreviewItem({ id, title: name, content, type })}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
        >
          <Eye size={15} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit definition">
        <IconButton
          size="small"
          onClick={() => openEdit(type, id, content)}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
        >
          <Pencil size={15} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={() => setDeleteTarget({ id, name, type })}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
        >
          <Trash2 size={15} />
        </IconButton>
      </Tooltip>
    </>
  );

  const emptyState = (label: string) => (
    <Paper
      variant="outlined"
      sx={{ p: 6, textAlign: 'center', borderRadius: 2.5, borderStyle: 'dashed' }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
        {query ? `No ${label} match “${searchQuery.trim()}”` : `No ${label} yet`}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {query
          ? 'Try a different search, or clear it to see everything.'
          : 'Onboard one and it becomes available in the Agent Console straight away.'}
      </Typography>
      {query ? (
        <Button size="small" onClick={() => setSearchQuery('')}>
          Clear search
        </Button>
      ) : (
        <Button
          size="small"
          variant="contained"
          startIcon={<Plus size={15} />}
          onClick={() => openCreate(ENTITY_OF[tab])}
        >
          Onboard {ENTITY_OF[tab]}
        </Button>
      )}
    </Paper>
  );

  const loadingGrid = (
    <Grid container spacing={2.5}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2.5 }} />
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{ minHeight: 'calc(100vh - 60px)', bgcolor: isLight ? '#f8fafc' : '#0a0d12', py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 4,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Bot size={28} color={theme.palette.primary.main} />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Agent Hub Registry
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 640 }}>
              Every onboarded agent, multi-agent workflow, domain skill, and prompt template.
              Anything you add here is immediately available in the Agent Console and as a job.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Reload from disk">
              <span>
                <IconButton
                  onClick={loadData}
                  disabled={loading}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                >
                  <RefreshCw size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Plus size={16} />}
              onClick={() => openCreate(ENTITY_OF[tab])}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                px: 2.5,
                py: 1,
                boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              Onboard {ENTITY_OF[tab]}
            </Button>
          </Box>
        </Box>

        {/* Filter bar */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            sx={{
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: '0.86rem',
                textTransform: 'none',
                minHeight: 40,
                borderRadius: 1.5,
              },
            }}
          >
            <Tab value="agents" label={`Agents (${counts.agents})`} icon={<Bot size={15} />} iconPosition="start" />
            <Tab value="workflows" label={`Workflows (${counts.workflows})`} icon={<WorkflowIcon size={15} />} iconPosition="start" />
            <Tab value="skills" label={`Skills (${counts.skills})`} icon={<Layers size={15} />} iconPosition="start" />
            <Tab value="prompts" label={`Prompts (${counts.prompts})`} icon={<FileCode2 size={15} />} iconPosition="start" />
          </Tabs>

          <TextField
            size="small"
            placeholder={`Search ${tab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color={isLight ? '#64748b' : '#94a3b8'} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: { xs: '100%', sm: 260 }, '& input': { fontSize: '0.84rem' } }}
          />
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          loadingGrid
        ) : (
          <>
            {/* Agents */}
            {tab === 'agents' &&
              (filtered.agents.length === 0 ? (
                emptyState('agents')
              ) : (
                <Grid container spacing={2.5}>
                  {filtered.agents.map((agent) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={agent.id}>
                      <Card variant="outlined" sx={cardSx(theme.palette.primary.main)}>
                        <CardContent sx={{ flex: 1, p: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <Box
                                sx={{
                                  p: 0.75,
                                  borderRadius: 1.5,
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  color: 'primary.main',
                                  flexShrink: 0,
                                }}
                              >
                                <Bot size={18} />
                              </Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.95rem' }} noWrap>
                                {agent.name}
                              </Typography>
                            </Box>
                            <Chip
                              label={agent.id}
                              size="small"
                              sx={{ fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace', flexShrink: 0 }}
                            />
                          </Box>

                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.5, mb: 2, minHeight: 40 }}
                          >
                            {agent.description || 'Specialized Copilot agent reasoning profile.'}
                          </Typography>

                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(agent.tools ?? []).map((t, idx) => (
                              <Chip
                                key={idx}
                                label={`tool: ${t}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.68rem', height: 20 }}
                              />
                            ))}
                            <Chip
                              label={agent.file}
                              size="small"
                              sx={{ fontSize: '0.68rem', height: 20, bgcolor: 'action.hover' }}
                            />
                          </Box>
                        </CardContent>

                        <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            startIcon={<FlaskConical size={13} />}
                            onClick={() =>
                              setTestAgent({
                                id: agent.id,
                                name: agent.name,
                                description: agent.description,
                                input_artifact: agent.input_artifact,
                                output_artifact: agent.output_artifact,
                              })
                            }
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            Test
                          </Button>
                          <Tooltip title="Open pre-configured in the Agent Console">
                            <IconButton
                              size="small"
                              onClick={() => handleTryInChat({ agentId: agent.id })}
                              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                            >
                              <Play size={15} />
                            </IconButton>
                          </Tooltip>
                          {rowActions('agent', agent.id, agent.name, agent.content)}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ))}

            {/* Workflows */}
            {tab === 'workflows' &&
              (filtered.workflows.length === 0 ? (
                emptyState('workflows')
              ) : (
                <Grid container spacing={2.5}>
                  {filtered.workflows.map((wf: HubWorkflow) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={wf.id}>
                      <Card variant="outlined" sx={cardSx('#3b82f6')}>
                        <CardContent sx={{ flex: 1, p: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', flexShrink: 0 }}>
                                <WorkflowIcon size={18} />
                              </Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.95rem' }} noWrap>
                                {wf.name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                              {wf.has_custom_ui && (
                                <Chip label="Custom UI" size="small" color="primary" sx={{ fontSize: '0.68rem', fontWeight: 700, height: 20 }} />
                              )}
                              {wf.available === false && (
                                <Chip label="Unavailable" size="small" color="warning" sx={{ fontSize: '0.68rem', fontWeight: 700, height: 20 }} />
                              )}
                            </Box>
                          </Box>

                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.5, mb: 2, minHeight: 40 }}
                          >
                            {wf.description}
                          </Typography>

                          {wf.available === false && wf.unavailable_reason && (
                            <Alert
                              severity="warning"
                              icon={<AlertTriangle size={16} />}
                              sx={{ mb: 1.5, py: 0.25, fontSize: '0.76rem', borderRadius: 1.5 }}
                            >
                              {wf.unavailable_reason}
                            </Alert>
                          )}

                          <Box sx={{ mb: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                              Agent pipeline{wf.approval_gate ? ' · pauses for approval' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {wf.agents.map((ag, idx) => (
                                <Chip
                                  key={idx}
                                  label={`${idx + 1}. ${ag.id}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: 22 }}
                                />
                              ))}
                            </Box>
                          </Box>
                        </CardContent>

                        <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                          {wf.has_custom_ui && wf.custom_ui_route ? (
                            <Button
                              fullWidth
                              variant="contained"
                              size="small"
                              startIcon={<ExternalLink size={13} />}
                              onClick={() => router.push(wf.custom_ui_route!)}
                              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                            >
                              Open UI
                            </Button>
                          ) : (
                            <Button
                              fullWidth
                              variant="contained"
                              size="small"
                              disabled={wf.available === false}
                              startIcon={<Play size={13} fill="currentColor" />}
                              onClick={() => handleTryInChat({ workflowId: wf.id })}
                              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                            >
                              Run workflow
                            </Button>
                          )}
                          {rowActions('workflow', wf.id, wf.name, wf.content)}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ))}

            {/* Skills */}
            {tab === 'skills' &&
              (filtered.skills.length === 0 ? (
                emptyState('skills')
              ) : (
                <Grid container spacing={2.5}>
                  {filtered.skills.map((sk) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sk.id}>
                      <Card variant="outlined" sx={cardSx('#10b981')}>
                        <CardContent sx={{ flex: 1, p: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, minWidth: 0 }}>
                            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', flexShrink: 0 }}>
                              <Layers size={18} />
                            </Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.95rem' }} noWrap>
                              {sk.name}
                            </Typography>
                          </Box>

                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.5, mb: 2, minHeight: 40 }}
                          >
                            {sk.description || 'Instruction bundle loaded by the CLI via --skill-path.'}
                          </Typography>

                          <Chip label={sk.path} size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: 'action.hover' }} />
                        </CardContent>

                        <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            startIcon={<Play size={13} fill="currentColor" />}
                            onClick={() => handleTryInChat({ skillId: sk.id })}
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            Load in Console
                          </Button>
                          {rowActions('skill', sk.id, sk.name, sk.content)}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ))}

            {/* Prompts */}
            {tab === 'prompts' &&
              (filtered.prompts.length === 0 ? (
                emptyState('prompts')
              ) : (
                <Grid container spacing={2.5}>
                  {filtered.prompts.map((pr) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={pr.id}>
                      <Card variant="outlined" sx={cardSx('#f59e0b')}>
                        <CardContent sx={{ flex: 1, p: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, minWidth: 0 }}>
                            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', flexShrink: 0 }}>
                              <FileCode2 size={18} />
                            </Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.95rem' }} noWrap>
                              {pr.name}
                            </Typography>
                          </Box>

                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.5, mb: 2, minHeight: 40 }}
                          >
                            {pr.description || 'Pre-configured prompt template with structured focus areas.'}
                          </Typography>

                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {pr.tags?.map((t, idx) => (
                              <Chip key={idx} label={t} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 20 }} />
                            ))}
                          </Box>
                        </CardContent>

                        <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            startIcon={<Play size={13} fill="currentColor" />}
                            onClick={() => handleTryInChat({ promptId: pr.id })}
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            Apply in Console
                          </Button>
                          {rowActions('prompt', pr.id, pr.name, pr.content)}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ))}
          </>
        )}
      </Container>

      {/* Preview */}
      <Dialog
        open={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, maxHeight: '80vh' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{previewItem?.title}</span>
          <Chip label={previewItem ? FILE_HINT[previewItem.type] : ''} size="small" color="primary" sx={{ fontWeight: 700 }} />
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {previewItem && (
            <MarkdownRenderer
              content={'```' + PREVIEW_LANG[previewItem.type] + '\n' + previewItem.content + '\n```'}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {previewItem && (
            <Button
              onClick={() => {
                openEdit(previewItem.type, previewItem.id, previewItem.content);
                setPreviewItem(null);
              }}
              startIcon={<Pencil size={15} />}
            >
              Edit
            </Button>
          )}
          <Button onClick={() => setPreviewItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create / edit */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingId ? `Edit ${entityType}: ${editingId}` : `Onboard a new ${entityType}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {editorError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
              {editorError}
            </Alert>
          )}

          {!editingId && (
            <Tabs
              value={entityType}
              onChange={(_, v: HubEntityType) => {
                setEntityType(v);
                loadTemplate(v);
              }}
              sx={{ mb: 2.5, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}
            >
              <Tab value="agent" label="Agent" />
              <Tab value="workflow" label="Workflow" />
              <Tab value="skill" label="Skill" />
              <Tab value="prompt" label="Prompt" />
            </Tabs>
          )}

          <TextField
            fullWidth
            label="Identifier"
            placeholder="e.g. security-auditor"
            value={entityId}
            disabled={editingId !== null}
            onChange={(e) => setEntityId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            helperText={`Lower-case letters, digits and hyphens. Saved as agent-hub/${entityType}s/${FILE_HINT[entityType]}`}
            sx={{ mb: 2.5 }}
          />

          <TextField
            fullWidth
            multiline
            minRows={14}
            maxRows={24}
            label={entityType === 'workflow' ? 'YAML definition' : 'Markdown definition'}
            value={loadingTemplate ? 'Loading the template…' : entityContent}
            disabled={loadingTemplate}
            onChange={(e) => setEntityContent(e.target.value)}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
            helperText={
              entityType === 'workflow'
                ? 'Every agent listed under `agents` must already exist, and `id` must match the identifier above.'
                : 'Starts from the hub template. Replace the placeholder text with your own.'
            }
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditorOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || loadingTemplate}
            sx={{ fontWeight: 700 }}
          >
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create & register'}
          </Button>
        </DialogActions>
      </Dialog>

      <AgentTestDialog
        agent={testAgent}
        open={Boolean(testAgent)}
        onClose={() => setTestAgent(null)}
      />

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete {deleteTarget?.type}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.9rem' }}>
            <strong>{deleteTarget?.name}</strong> will be removed from the hub. Any workflow that
            references it will stop working until you fix or remove that reference.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
