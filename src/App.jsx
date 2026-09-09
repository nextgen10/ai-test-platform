import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './auth/RequireAuth';
import { Spinner } from './components/ui/primitives';

// Every route is split out: the landing page, the console and the registry each
// pull in a different slice of the app, and a first visit should not download
// all three.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'));
const RegistryPage = lazy(() => import('./pages/RegistryPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AutomationPage = lazy(() => import('./pages/AutomationPage'));
const UseCasesPage = lazy(() => import('./pages/UseCasesPage'));
const WorkflowBuilderPage = lazy(() => import('./pages/WorkflowBuilderPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteFallback() {
    return (
        <div className="flex min-h-[40vh] grow flex-col items-center justify-center gap-4">
            <Spinner size={40} />
            <p className="ui-body2 font-medium text-subtle">Loading Agent HUB Platform…</p>
        </div>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
                <Routes>
                    {/* Sign-in sits outside the shell: it must render for someone
                        the app cannot yet identify. */}
                    <Route path="/login" element={<LoginPage />} />

                    <Route
                        element={
                            <RequireAuth>
                                <AppShell />
                            </RequireAuth>
                        }
                    >
                        <Route index element={<LandingPage />} />
                        <Route path="chat" element={<ChatPage />} />
                        <Route path="dashboard" element={<DashboardPage />} />
                        <Route path="jobs" element={<JobsPage />} />
                        <Route path="jobs/:id" element={<JobDetailPage />} />
                        <Route path="registry" element={<RegistryPage />} />
                        <Route path="generate" element={<GeneratePage />} />
                        <Route path="docs" element={<DocsPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="automation" element={<AutomationPage />} />
                        <Route path="use-cases" element={<UseCasesPage />} />
                        <Route path="use-cases/workflow-builder" element={<WorkflowBuilderPage />} />

                        {/* Routes that were folded into a tab of another page.
                            Kept so existing bookmarks land somewhere sensible. */}
                        <Route path="agents" element={<Navigate to="/registry?tab=agents" replace />} />
                        <Route path="skills" element={<Navigate to="/registry?tab=skills" replace />} />
                        <Route path="evaluation" element={<Navigate to="/docs?tab=evaluation" replace />} />

                        <Route path="*" element={<NotFoundPage />} />
                    </Route>
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
}
