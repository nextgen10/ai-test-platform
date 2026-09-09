import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle, Bot, ExternalLink, Eye, FileCode2, FlaskConical, Layers, Pencil, Play, Plus,
    RefreshCw, Search, Trash2, Workflow as WorkflowIcon,
} from 'lucide-react';

import AgentTestDialog from '@/components/AgentTestDialog';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { cx } from '@/components/ui/cx';
import { Alert, Button, Chip, IconButton, Paper, Skeleton, Tooltip } from '@/components/ui/primitives';
import { TextArea, TextField } from '@/components/ui/inputs';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { Tabs } from '@/components/ui/tabs';
import { hubApi } from '@/lib/hub-api';

const TAB_KEYS = ['agents', 'workflows', 'skills', 'prompts'];

/** Singular entity type for a tab, for the CRUD calls. */
const ENTITY_OF = {
    agents: 'agent',
    workflows: 'workflow',
    skills: 'skill',
    prompts: 'prompt',
};

const FILE_HINT = {
    agent: '<id>.agent.md',
    workflow: '<id>.workflow.yaml',
    skill: '<id>/SKILL.md',
    prompt: '<id>.prompt.md',
};

/** Language for the preview fence, so YAML is not shown as Markdown. */
const PREVIEW_LANG = {
    agent: 'markdown',
    workflow: 'yaml',
    skill: 'markdown',
    prompt: 'markdown',
};

export default function RegistryPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [tab, setTab] = useState('agents');
    const [searchQuery, setSearchQuery] = useState('');
    const [catalog, setCatalog] = useState({ agents: [], workflows: [], skills: [], prompts: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [previewItem, setPreviewItem] = useState(null);

    // One dialog serves both create and edit; `editingId` decides which.
    const [editorOpen, setEditorOpen] = useState(false);
    const [entityType, setEntityType] = useState('agent');
    const [editingId, setEditingId] = useState(null);
    const [entityId, setEntityId] = useState('');
    const [entityContent, setEntityContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [editorError, setEditorError] = useState(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    const [testAgent, setTestAgent] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // `?tab=agents` is how the Dashboard, the nav and the old /agents and
    // /skills routes hand off to a particular section.
    const tabParam = searchParams.get('tab');
    useEffect(() => {
        if (tabParam && TAB_KEYS.includes(tabParam)) setTab(tabParam);
    }, [tabParam]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            setCatalog(await hubApi.catalog());
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the catalog');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleTryInChat = (config) => {
        const params = new URLSearchParams();
        if (config.agentId) params.set('agent', config.agentId);
        if (config.workflowId) params.set('workflow', config.workflowId);
        if (config.skillId) params.set('skill', config.skillId);
        if (config.promptId) params.set('prompt', config.promptId);
        navigate(`/chat?${params.toString()}`);
    };

    // ------------------------------------------------------------ editor

    /** Start from the hub's own `_template` file rather than a blank box. */
    const loadTemplate = async (type) => {
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

    const openCreate = async (type) => {
        setEntityType(type);
        setEditingId(null);
        setEntityId('');
        setEditorError(null);
        setEditorOpen(true);
        await loadTemplate(type);
    };

    const openEdit = (type, id, content) => {
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
            const calls = isEdit
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
        } catch (err) {
            setEditorError(err instanceof Error ? err.message : 'Could not save it');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const calls = {
                agent: hubApi.deleteAgent,
                workflow: hubApi.deleteWorkflow,
                skill: hubApi.deleteSkill,
                prompt: hubApi.deletePrompt,
            };
            await calls[deleteTarget.type](deleteTarget.id);
            setDeleteTarget(null);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete it');
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    // ------------------------------------------------------------ filtering

    const query = searchQuery.trim().toLowerCase();

    const filtered = useMemo(() => {
        const matches = (...fields) =>
            !query || fields.some((field) => (field ?? '').toLowerCase().includes(query));
        return {
            agents: catalog.agents.filter((a) => matches(a.name, a.description, a.id)),
            workflows: catalog.workflows.filter((w) => matches(w.name, w.description, w.id)),
            skills: catalog.skills.filter((s) => matches(s.name, s.description, s.id)),
            prompts: catalog.prompts.filter((p) => matches(p.name, p.description, p.id)),
        };
    }, [catalog, query]);

    const counts = {
        agents: catalog.agents.length,
        workflows: catalog.workflows.length,
        skills: catalog.skills.length,
        prompts: catalog.prompts.length,
    };

    const cardClass = 'flex h-full flex-col transition-colors hover:bg-surface-hover';

    const iconBadge = (children, tint, tone) => (
        <span className="shrink-0 rounded-ubs p-1.5" style={{ backgroundColor: tint, color: tone }}>
            {children}
        </span>
    );

    const rowActions = (type, id, name, content) => (
        <>
            <Tooltip title={`View ${FILE_HINT[type]}`}>
                <IconButton
                    size="small"
                    className="border border-hairline"
                    aria-label={`View ${name}`}
                    onClick={() => setPreviewItem({ id, title: name, content, type })}
                >
                    <Eye size={15} />
                </IconButton>
            </Tooltip>
            <Tooltip title="Edit definition">
                <IconButton
                    size="small"
                    className="border border-hairline"
                    aria-label={`Edit ${name}`}
                    onClick={() => openEdit(type, id, content)}
                >
                    <Pencil size={15} />
                </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
                <IconButton
                    size="small"
                    className="border border-hairline"
                    aria-label={`Delete ${name}`}
                    onClick={() => setDeleteTarget({ id, name, type })}
                >
                    <Trash2 size={15} />
                </IconButton>
            </Tooltip>
        </>
    );

    const emptyState = (label) => (
        <Paper flat className="border-dashed p-12 text-center">
            <p className="ui-subtitle1 mb-1">
                {query ? `No ${label} match “${searchQuery.trim()}”` : `No ${label} yet`}
            </p>
            <p className="ui-body2 mb-4 text-subtle">
                {query
                    ? 'Try a different search, or clear it to see everything.'
                    : 'Onboard one and it becomes available in the Agent Console straight away.'}
            </p>
            {query ? (
                <Button size="small" onClick={() => setSearchQuery('')}>
                    Clear search
                </Button>
            ) : (
                <Button size="small" variant="contained" onClick={() => openCreate(ENTITY_OF[tab])}>
                    <Plus size={15} />
                    Onboard {ENTITY_OF[tab]}
                </Button>
            )}
        </Paper>
    );

    const grid = 'grid gap-5 sm:grid-cols-2 md:grid-cols-3';

    return (
        <div className="min-h-[calc(100vh-60px)] w-full bg-elevated py-8">
            <div className="ui-container px-4">
                {/* Header */}
                <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <div className="mb-1 flex items-center gap-3">
                            <Bot size={28} className="text-brand" />
                            <h1 className="text-2xl font-medium">Agent HUB Platform Registry</h1>
                        </div>
                        <p className="ui-body2 max-w-[640px] text-subtle">
                            Every onboarded agent, multi-agent workflow, domain skill, and prompt template.
                            Anything you add here is immediately available in the Agent Console and as a job.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Tooltip title="Reload from disk">
                            <IconButton
                                className="border border-hairline"
                                aria-label="Reload catalog"
                                onClick={loadData}
                                disabled={loading}
                            >
                                <RefreshCw size={16} />
                            </IconButton>
                        </Tooltip>
                        <Button variant="contained" onClick={() => openCreate(ENTITY_OF[tab])}>
                            <Plus size={16} />
                            Onboard {ENTITY_OF[tab]}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <Paper
                    flat
                    className="mb-6 flex flex-col items-center justify-between gap-4 p-3 sm:flex-row"
                >
                    <Tabs
                        className="border-b-0"
                        value={tab}
                        onChange={setTab}
                        items={[
                            { value: 'agents', label: `Agents (${counts.agents})`, icon: <Bot size={15} /> },
                            { value: 'workflows', label: `Workflows (${counts.workflows})`, icon: <WorkflowIcon size={15} /> },
                            { value: 'skills', label: `Skills (${counts.skills})`, icon: <Layers size={15} /> },
                            { value: 'prompts', label: `Prompts (${counts.prompts})`, icon: <FileCode2 size={15} /> },
                        ]}
                    />

                    <div className="relative w-full sm:w-[260px]">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                        <input
                            className="ui-input pl-9 text-[0.84rem]"
                            placeholder={`Search ${tab}...`}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            aria-label={`Search ${tab}`}
                        />
                    </div>
                </Paper>

                {error && (
                    <Alert
                        severity="error"
                        className="mb-6"
                        action={
                            <IconButton size="small" aria-label="Dismiss" onClick={() => setError(null)}>
                                ×
                            </IconButton>
                        }
                    >
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <div className={grid}>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                            <Skeleton key={index} variant="rect" height={220} />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Agents */}
                        {tab === 'agents' &&
                            (filtered.agents.length === 0 ? (
                                emptyState('agents')
                            ) : (
                                <div className={grid}>
                                    {filtered.agents.map((agent) => (
                                        <Paper key={agent.id} flat className={cardClass}>
                                            <div className="flex-1 p-5">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {iconBadge(<Bot size={18} />, 'var(--col-primary-light)', 'var(--col-background-brand)')}
                                                        <p className="truncate text-[0.95rem] font-medium">{agent.name}</p>
                                                    </div>
                                                    <Chip className="shrink-0 font-mono text-[0.7rem] font-medium">
                                                        {agent.id}
                                                    </Chip>
                                                </div>

                                                <p className="mb-4 min-h-10 text-[0.84rem] leading-relaxed text-subtle">
                                                    {agent.description || 'Specialized Copilot agent reasoning profile.'}
                                                </p>

                                                <div className="flex flex-wrap gap-1">
                                                    {(agent.tools ?? []).map((tool, index) => (
                                                        <Chip key={index} variant="outlined" className="h-5 text-[0.68rem]">
                                                            {`tool: ${tool}`}
                                                        </Chip>
                                                    ))}
                                                    <Chip className="h-5 bg-surface-hover text-[0.68rem]">{agent.file}</Chip>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 p-4 pt-0">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    className="flex-1 text-[0.8rem]"
                                                    onClick={() =>
                                                        setTestAgent({
                                                            id: agent.id,
                                                            name: agent.name,
                                                            description: agent.description,
                                                            input_artifact: agent.input_artifact,
                                                            output_artifact: agent.output_artifact,
                                                        })
                                                    }
                                                >
                                                    <FlaskConical size={13} />
                                                    Test
                                                </Button>
                                                <Tooltip title="Open pre-configured in the Agent Console">
                                                    <IconButton
                                                        size="small"
                                                        className="border border-hairline"
                                                        aria-label={`Open ${agent.name} in the console`}
                                                        onClick={() => handleTryInChat({ agentId: agent.id })}
                                                    >
                                                        <Play size={15} />
                                                    </IconButton>
                                                </Tooltip>
                                                {rowActions('agent', agent.id, agent.name, agent.content)}
                                            </div>
                                        </Paper>
                                    ))}
                                </div>
                            ))}

                        {/* Workflows */}
                        {tab === 'workflows' &&
                            (filtered.workflows.length === 0 ? (
                                emptyState('workflows')
                            ) : (
                                <div className={grid}>
                                    {filtered.workflows.map((wf) => (
                                        <Paper key={wf.id} flat className={cardClass}>
                                            <div className="flex-1 p-5">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {iconBadge(<WorkflowIcon size={18} />, 'rgba(0, 117, 158, 0.1)', 'var(--acc-teal)')}
                                                        <p className="truncate text-[0.95rem] font-medium">{wf.name}</p>
                                                    </div>
                                                    <div className="flex shrink-0 gap-1">
                                                        {wf.has_custom_ui && (
                                                            <Chip color="primary" className="h-5 text-[0.68rem] font-medium">
                                                                Custom UI
                                                            </Chip>
                                                        )}
                                                        {wf.available === false && (
                                                            <Chip color="warning" className="h-5 text-[0.68rem] font-medium">
                                                                Unavailable
                                                            </Chip>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="mb-4 min-h-10 text-[0.84rem] leading-relaxed text-subtle">
                                                    {wf.description}
                                                </p>

                                                {wf.available === false && wf.unavailable_reason && (
                                                    <Alert
                                                        severity="warning"
                                                        icon={<AlertTriangle size={16} />}
                                                        className="mb-3 py-1 text-[0.76rem]"
                                                    >
                                                        {wf.unavailable_reason}
                                                    </Alert>
                                                )}

                                                <div className="mb-3">
                                                    <p className="ui-caption mb-1 block font-medium text-subtle">
                                                        Agent pipeline{wf.approval_gate ? ' · pauses for approval' : ''}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {wf.agents.map((stage, index) => (
                                                            <Chip
                                                                key={`${stage.id}-${index}`}
                                                                variant="outlined"
                                                                className="h-[22px] text-[0.7rem]"
                                                            >
                                                                {`${index + 1}. ${stage.id}`}
                                                            </Chip>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 p-4 pt-0">
                                                {wf.has_custom_ui && wf.custom_ui_route ? (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        className="flex-1 text-[0.8rem]"
                                                        onClick={() => navigate(wf.custom_ui_route)}
                                                    >
                                                        <ExternalLink size={13} />
                                                        Open UI
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        className="flex-1 text-[0.8rem]"
                                                        disabled={wf.available === false}
                                                        onClick={() => handleTryInChat({ workflowId: wf.id })}
                                                    >
                                                        <Play size={13} fill="currentColor" />
                                                        Run workflow
                                                    </Button>
                                                )}
                                                {rowActions('workflow', wf.id, wf.name, wf.content)}
                                            </div>
                                        </Paper>
                                    ))}
                                </div>
                            ))}

                        {/* Skills */}
                        {tab === 'skills' &&
                            (filtered.skills.length === 0 ? (
                                emptyState('skills')
                            ) : (
                                <div className={grid}>
                                    {filtered.skills.map((skill) => (
                                        <Paper key={skill.id} flat className={cardClass}>
                                            <div className="flex-1 p-5">
                                                <div className="mb-3 flex min-w-0 items-center gap-2">
                                                    {iconBadge(<Layers size={18} />, 'rgba(70, 154, 108, 0.1)', 'var(--acc-green)')}
                                                    <p className="truncate text-[0.95rem] font-medium">{skill.name}</p>
                                                </div>

                                                <p className="mb-4 min-h-10 text-[0.84rem] leading-relaxed text-subtle">
                                                    {skill.description || 'Instruction bundle loaded by the CLI via --skill-path.'}
                                                </p>

                                                <Chip className="h-5 bg-surface-hover text-[0.68rem]">{skill.path}</Chip>
                                            </div>

                                            <div className="flex gap-2 p-4 pt-0">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    className="flex-1 text-[0.8rem]"
                                                    onClick={() => handleTryInChat({ skillId: skill.id })}
                                                >
                                                    <Play size={13} fill="currentColor" />
                                                    Load in Console
                                                </Button>
                                                {rowActions('skill', skill.id, skill.name, skill.content)}
                                            </div>
                                        </Paper>
                                    ))}
                                </div>
                            ))}

                        {/* Prompts */}
                        {tab === 'prompts' &&
                            (filtered.prompts.length === 0 ? (
                                emptyState('prompts')
                            ) : (
                                <div className={grid}>
                                    {filtered.prompts.map((prompt) => (
                                        <Paper key={prompt.id} flat className={cardClass}>
                                            <div className="flex-1 p-5">
                                                <div className="mb-3 flex min-w-0 items-center gap-2">
                                                    {iconBadge(<FileCode2 size={18} />, 'rgba(228, 169, 17, 0.1)', 'var(--acc-gold)')}
                                                    <p className="truncate text-[0.95rem] font-medium">{prompt.name}</p>
                                                </div>

                                                <p className="mb-4 min-h-10 text-[0.84rem] leading-relaxed text-subtle">
                                                    {prompt.description ||
                                                        'Pre-configured prompt template with structured focus areas.'}
                                                </p>

                                                <div className="flex flex-wrap gap-1">
                                                    {prompt.tags?.map((tag, index) => (
                                                        <Chip key={index} variant="outlined" className="h-5 text-[0.68rem]">
                                                            {tag}
                                                        </Chip>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex gap-2 p-4 pt-0">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    className="flex-1 text-[0.8rem]"
                                                    onClick={() => handleTryInChat({ promptId: prompt.id })}
                                                >
                                                    <Play size={13} fill="currentColor" />
                                                    Apply in Console
                                                </Button>
                                                {rowActions('prompt', prompt.id, prompt.name, prompt.content)}
                                            </div>
                                        </Paper>
                                    ))}
                                </div>
                            ))}
                    </>
                )}
            </div>

            {/* Preview */}
            <Dialog open={Boolean(previewItem)} onClose={() => setPreviewItem(null)} maxWidth="md">
                <DialogTitle onClose={() => setPreviewItem(null)}>
                    <span className="flex items-center gap-3">
                        {previewItem?.title}
                        <Chip color="primary" className="font-medium">
                            {previewItem ? FILE_HINT[previewItem.type] : ''}
                        </Chip>
                    </span>
                </DialogTitle>
                <DialogContent>
                    {previewItem && (
                        <MarkdownRenderer
                            content={`\`\`\`${PREVIEW_LANG[previewItem.type]}\n${previewItem.content}\n\`\`\``}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    {previewItem && (
                        <Button
                            onClick={() => {
                                openEdit(previewItem.type, previewItem.id, previewItem.content);
                                setPreviewItem(null);
                            }}
                        >
                            <Pencil size={15} />
                            Edit
                        </Button>
                    )}
                    <Button onClick={() => setPreviewItem(null)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Create / edit */}
            <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md">
                <DialogTitle onClose={() => setEditorOpen(false)}>
                    {editingId ? `Edit ${entityType}: ${editingId}` : `Onboard a new ${entityType}`}
                </DialogTitle>
                <DialogContent>
                    {editorError && (
                        <Alert severity="error" className="mb-4">
                            {editorError}
                        </Alert>
                    )}

                    {!editingId && (
                        <Tabs
                            className="mb-5"
                            value={entityType}
                            onChange={(value) => {
                                setEntityType(value);
                                loadTemplate(value);
                            }}
                            items={[
                                { value: 'agent', label: 'Agent' },
                                { value: 'workflow', label: 'Workflow' },
                                { value: 'skill', label: 'Skill' },
                                { value: 'prompt', label: 'Prompt' },
                            ]}
                        />
                    )}

                    <TextField
                        className="mb-5"
                        label="Identifier"
                        placeholder="e.g. security-auditor"
                        value={entityId}
                        disabled={editingId !== null}
                        onChange={(event) =>
                            setEntityId(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                        }
                        helperText={`Lower-case letters, digits and hyphens. Saved as agent-hub/${entityType}s/${FILE_HINT[entityType]}`}
                    />

                    <TextArea
                        rows={16}
                        label={entityType === 'workflow' ? 'YAML definition' : 'Markdown definition'}
                        value={loadingTemplate ? 'Loading the template…' : entityContent}
                        disabled={loadingTemplate}
                        onChange={(event) => setEntityContent(event.target.value)}
                        inputClassName={cx('font-mono text-[0.82rem]')}
                        helperText={
                            entityType === 'workflow'
                                ? 'Every agent listed under `agents` must already exist, and `id` must match the identifier above.'
                                : 'Starts from the hub template. Replace the placeholder text with your own.'
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={submitting || loadingTemplate}>
                        {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create & register'}
                    </Button>
                </DialogActions>
            </Dialog>

            <AgentTestDialog agent={testAgent} open={Boolean(testAgent)} onClose={() => setTestAgent(null)} />

            {/* Delete confirmation */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs">
                <DialogTitle onClose={() => setDeleteTarget(null)}>Delete {deleteTarget?.type}?</DialogTitle>
                <DialogContent>
                    <p className="text-[0.9rem] text-subtle">
                        <strong>{deleteTarget?.name}</strong> will be removed from the hub. Any workflow that
                        references it will stop working until you fix or remove that reference.
                    </p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
