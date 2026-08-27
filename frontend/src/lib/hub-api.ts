/**
 * Agent Hub Registry API client.
 */

import { API_BASE } from './api';

// ------------------------------------------------------------------ types

export interface HubAgent {
    id: string;
    type: 'agent';
    name: string;
    description: string;
    tools: string[];
    content: string;
    body: string;
    file: string;
    /** Declared in the agent's own frontmatter, so it describes itself. */
    role: string;
    stage: string;
    input_artifact: string;
    output_artifact: string;
}

export interface HubSkill {
    id: string;
    type: 'skill';
    name: string;
    description: string;
    content: string;
    body: string;
    path: string;
    version: string;
}

export interface HubPrompt {
    id: string;
    type: 'prompt';
    name: string;
    description: string;
    tags: string[];
    content: string;
    body: string;
    file: string;
}

export interface HubWorkflow {
    id: string;
    type: 'workflow';
    name: string;
    description: string;
    version: string;
    skill: string | null;
    has_custom_ui: boolean;
    custom_ui_route: string | null;
    agents: { id: string; stage: string; optional: boolean; description?: string }[];
    tags: string[];
    file: string;
    /** The raw YAML, so the Registry previews what the author actually wrote. */
    content: string;
    /** `bespoke` = a hand-written pipeline; `generic` = the declarative engine. */
    runner: 'bespoke' | 'generic';
    /** Whether the workflow pauses for a human partway through. */
    approval_gate: boolean;
    available: boolean;
    unavailable_reason?: string;
    category?: string;
    icon?: string;
}

export interface HubCatalog {
    agents: HubAgent[];
    skills: HubSkill[];
    prompts: HubPrompt[];
    workflows: HubWorkflow[];
}

export type HubEntityType = 'agent' | 'skill' | 'prompt' | 'workflow';

// ------------------------------------------------------------------- helpers

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            if (body?.detail) {
                if (Array.isArray(body.detail)) {
                    detail = body.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
                } else if (typeof body.detail === 'string') {
                    detail = body.detail;
                } else {
                    detail = JSON.stringify(body.detail);
                }
            }
        } catch { /* non-JSON error body */ }
        throw new Error(detail);
    }
    return response.json() as Promise<T>;
}

// ------------------------------------------------------------------- API

export const hubApi = {
    // Catalog
    catalog: () => request<HubCatalog>('/hub/catalog'),

    // Agents
    listAgents: () => request<HubAgent[]>('/hub/agents'),
    getAgent: (id: string) => request<HubAgent>(`/hub/agents/${id}`),
    createAgent: (id: string, content: string) =>
        request<HubAgent>('/hub/agents', { method: 'POST', body: JSON.stringify({ id, content }) }),
    updateAgent: (id: string, content: string) =>
        request<HubAgent>(`/hub/agents/${id}`, { method: 'PUT', body: JSON.stringify({ id, content }) }),
    deleteAgent: (id: string) =>
        request<{ deleted: string }>(`/hub/agents/${id}`, { method: 'DELETE' }),

    // Skills
    listSkills: () => request<HubSkill[]>('/hub/skills'),
    getSkill: (id: string) => request<HubSkill>(`/hub/skills/${id}`),
    createSkill: (id: string, content: string) =>
        request<HubSkill>('/hub/skills', { method: 'POST', body: JSON.stringify({ id, content }) }),
    updateSkill: (id: string, content: string) =>
        request<HubSkill>(`/hub/skills/${id}`, { method: 'PUT', body: JSON.stringify({ id, content }) }),
    deleteSkill: (id: string) =>
        request<{ deleted: string }>(`/hub/skills/${id}`, { method: 'DELETE' }),

    // Prompts
    listPrompts: () => request<HubPrompt[]>('/hub/prompts'),
    getPrompt: (id: string) => request<HubPrompt>(`/hub/prompts/${id}`),
    createPrompt: (id: string, content: string) =>
        request<HubPrompt>('/hub/prompts', { method: 'POST', body: JSON.stringify({ id, content }) }),
    updatePrompt: (id: string, content: string) =>
        request<HubPrompt>(`/hub/prompts/${id}`, { method: 'PUT', body: JSON.stringify({ id, content }) }),
    deletePrompt: (id: string) =>
        request<{ deleted: string }>(`/hub/prompts/${id}`, { method: 'DELETE' }),

    // Workflows
    listWorkflows: () => request<HubWorkflow[]>('/hub/workflows'),
    getWorkflow: (id: string) => request<HubWorkflow>(`/hub/workflows/${id}`),
    createWorkflow: (id: string, content: string) =>
        request<HubWorkflow>('/hub/workflows', { method: 'POST', body: JSON.stringify({ id, content }) }),
    updateWorkflow: (id: string, content: string) =>
        request<HubWorkflow>(`/hub/workflows/${id}`, { method: 'PUT', body: JSON.stringify({ id, content }) }),
    deleteWorkflow: (id: string) =>
        request<{ deleted: string }>(`/hub/workflows/${id}`, { method: 'DELETE' }),

    // Models
    listModels: () => request<{ id: string; name: string; provider: string }[]>('/hub/models'),

    /** Starter content for a new entity, from the hub's own _template files. */
    getTemplate: (entityType: HubEntityType) =>
        request<{ type: string; content: string }>(`/hub/templates/${entityType}`),
};
