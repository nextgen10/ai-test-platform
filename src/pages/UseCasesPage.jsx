import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Play, Plus, Workflow as WorkflowIcon } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { Alert, Button, Chip, Paper, Skeleton } from '@/components/ui/primitives';
import { hubApi } from '@/lib/hub-api';

/**
 * Every registered use case.
 *
 * This page is generated from the workflow registry: adding a
 * `.workflow.yaml` to `agent-hub/workflows/` puts a card here, and setting
 * `has_custom_ui: true` points that card at the workflow's own page.
 */
export default function UseCasesPage() {
    const navigate = useNavigate();

    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        hubApi
            .listWorkflows()
            .then(setWorkflows)
            .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the use cases'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="mx-auto w-full max-w-[1200px] py-2">
            <PageHeader
                title="Use Cases"
                subtitle="Every registered multi-agent workflow. Run one here, or open its dedicated interface."
                actions={
                    <Button variant="outlined" onClick={() => navigate('/registry?tab=workflows')}>
                        <Plus size={16} />
                        Onboard a workflow
                    </Button>
                }
            />

            {error && (
                <Alert severity="error" className="mt-6">
                    {error}
                </Alert>
            )}

            {loading ? (
                <div className="mt-2 grid gap-6 md:grid-cols-2">
                    {[0, 1, 2].map((index) => (
                        <Skeleton key={index} variant="rect" height={230} />
                    ))}
                </div>
            ) : workflows.length === 0 ? (
                <Paper flat className="mt-6 border-dashed p-12 text-center">
                    <p className="ui-subtitle1 mb-1">No workflows registered yet</p>
                    <p className="ui-body2 mb-4 text-subtle">
                        Drop a <code>.workflow.yaml</code> into <code>agent-hub/workflows/</code>, or onboard
                        one from the Registry.
                    </p>
                    <Button variant="contained" onClick={() => navigate('/registry?tab=workflows')}>
                        Open the Registry
                    </Button>
                </Paper>
            ) : (
                <div className="mt-2 grid gap-6 md:grid-cols-2">
                    {workflows.map((wf) => (
                        <Paper
                            key={wf.id}
                            flat
                            className="flex h-full flex-col transition-colors hover:bg-surface-hover"
                        >
                            <div className="flex-1 p-6">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <WorkflowIcon size={18} className="text-brand" />
                                    <h2 className="text-[1.05rem] font-medium">{wf.name}</h2>
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

                                <p className="ui-body2 mb-4 text-subtle">{wf.description}</p>

                                {wf.available === false && wf.unavailable_reason && (
                                    <Alert
                                        severity="warning"
                                        icon={<AlertTriangle size={16} />}
                                        className="mb-4 py-1 text-[0.78rem]"
                                    >
                                        {wf.unavailable_reason}
                                    </Alert>
                                )}

                                <p className="ui-caption mb-1.5 block font-medium text-subtle">
                                    {wf.agents.length} stage{wf.agents.length === 1 ? '' : 's'}
                                    {wf.approval_gate ? ' · pauses for your approval' : ''}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {wf.agents.map((agent, index) => (
                                        <Chip
                                            key={`${agent.id}-${index}`}
                                            variant="outlined"
                                            className="h-[22px] text-[0.7rem]"
                                        >
                                            {`${index + 1}. ${agent.stage}`}
                                        </Chip>
                                    ))}
                                </div>
                            </div>

                            <div className="px-6 pb-6">
                                {wf.has_custom_ui && wf.custom_ui_route ? (
                                    <Button
                                        variant="contained"
                                        className="w-full"
                                        onClick={() => navigate(wf.custom_ui_route)}
                                    >
                                        <ExternalLink size={16} />
                                        Open {wf.name}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        className="w-full"
                                        disabled={wf.available === false}
                                        onClick={() => navigate(`/chat?workflow=${encodeURIComponent(wf.id)}`)}
                                    >
                                        <Play size={16} />
                                        Run in the Agent Console
                                    </Button>
                                )}
                            </div>
                        </Paper>
                    ))}
                </div>
            )}
        </div>
    );
}
