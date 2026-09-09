/**
 * Agent Hub Registry API client.
 */

import { del, get, post, put } from './http';

export const hubApi = {
    // Catalog
    catalog: () => get('/hub/catalog'),

    // Agents
    listAgents: () => get('/hub/agents'),
    getAgent: (id) => get(`/hub/agents/${id}`),
    createAgent: (id, content) => post('/hub/agents', { id, content }),
    updateAgent: (id, content) => put(`/hub/agents/${id}`, { id, content }),
    deleteAgent: (id) => del(`/hub/agents/${id}`),

    // Skills
    listSkills: () => get('/hub/skills'),
    getSkill: (id) => get(`/hub/skills/${id}`),
    createSkill: (id, content) => post('/hub/skills', { id, content }),
    updateSkill: (id, content) => put(`/hub/skills/${id}`, { id, content }),
    deleteSkill: (id) => del(`/hub/skills/${id}`),

    // Prompts
    listPrompts: () => get('/hub/prompts'),
    getPrompt: (id) => get(`/hub/prompts/${id}`),
    createPrompt: (id, content) => post('/hub/prompts', { id, content }),
    updatePrompt: (id, content) => put(`/hub/prompts/${id}`, { id, content }),
    deletePrompt: (id) => del(`/hub/prompts/${id}`),

    // Workflows
    listWorkflows: () => get('/hub/workflows'),
    getWorkflow: (id) => get(`/hub/workflows/${id}`),
    createWorkflow: (id, content) => post('/hub/workflows', { id, content }),
    updateWorkflow: (id, content) => put(`/hub/workflows/${id}`, { id, content }),
    deleteWorkflow: (id) => del(`/hub/workflows/${id}`),

    // Models
    listModels: () => get('/hub/models'),

    /** Starter content for a new entity, from the hub's own _template files. */
    getTemplate: (entityType) => get(`/hub/templates/${entityType}`),
};
