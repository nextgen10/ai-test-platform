/**
 * Navigation configuration for the Agent Hub platform.
 *
 * Core platform views are fixed. Bespoke use cases are *not*: they are derived
 * from the workflow registry, so onboarding a workflow with `has_custom_ui:
 * true` puts it in the navigation without touching this file.
 */

import type { HubWorkflow } from '@/lib/hub-api';

export interface NavItem {
    id: string;
    label: string;
    path: string;
    available: boolean;
}

export interface UseCaseItem {
    id: string;
    label: string;
    path: string;
    description: string;
    badge?: string;
    icon?: string;
    hasCustomUi: boolean;
    available: boolean;
    unavailableReason?: string;
}

/** Core platform navigation. */
export const coreNavItems: NavItem[] = [
    { id: 'chat', label: 'Agent Console', path: '/chat', available: true },
    { id: 'registry', label: 'Registry', path: '/registry', available: true },
    { id: 'use-cases', label: 'Use Cases', path: '/use-cases', available: true },
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', available: true },
    { id: 'jobs', label: 'Jobs', path: '/jobs', available: true },
    { id: 'automation', label: 'Automation', path: '/automation', available: true },
    { id: 'docs', label: 'Docs', path: '/docs', available: true },
    { id: 'settings', label: 'Settings', path: '/settings', available: true },
];

/**
 * Turn registry workflows into navigable use cases.
 *
 * A workflow with a custom UI links to its own page; anything else opens
 * pre-configured in the Agent Console.
 */
export function mapWorkflowsToUseCases(workflows: HubWorkflow[]): UseCaseItem[] {
    return workflows.map((wf) => ({
        id: wf.id,
        label: wf.name,
        path:
            wf.has_custom_ui && wf.custom_ui_route
                ? wf.custom_ui_route
                : `/chat?workflow=${encodeURIComponent(wf.id)}`,
        description: wf.description,
        badge: wf.has_custom_ui ? 'Custom UI' : 'Agent Console',
        icon: wf.icon ?? (wf.has_custom_ui ? 'flask-conical' : 'workflow'),
        hasCustomUi: Boolean(wf.has_custom_ui),
        available: wf.available !== false,
        unavailableReason: wf.unavailable_reason,
    }));
}

/** Default export for backward compatibility */
export const navItems: NavItem[] = coreNavItems;
