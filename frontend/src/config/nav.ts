/**
 * Navigation for Analytic Genie.
 */

export interface NavItem {
    id: string;
    label: string;
    path: string;
    available: boolean;
}

export const navItems: NavItem[] = [
    { id: 'home', label: 'Home', path: '/', available: true },
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', available: true },
    { id: 'generate', label: 'Generate', path: '/generate', available: true },
    { id: 'jobs', label: 'Jobs', path: '/jobs', available: true },
    { id: 'docs', label: 'Docs', path: '/docs', available: true },
    { id: 'settings', label: 'Settings', path: '/settings', available: true },
];
