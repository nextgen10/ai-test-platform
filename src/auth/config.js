/**
 * Microsoft Entra ID (Azure AD) configuration.
 *
 * Sign-in is opt-in. `VITE_AUTH_ENABLED=false` — the default — leaves every
 * route open and the nav showing a local identity, which is how the platform
 * runs against an orchestrator with `AUTH_MODE=disabled`. Turning it on without
 * a client id would put a login page in front of an app that can never sign
 * anyone in, so the flag is only honoured when the ids are actually present.
 */

import { withBasePath } from '@/lib/base-path';

const clientId = (import.meta.env.VITE_AZURE_CLIENT_ID || '').trim();
const tenantId = (import.meta.env.VITE_AZURE_TENANT_ID || '').trim();
const flag = String(import.meta.env.VITE_AUTH_ENABLED || '').toLowerCase() === 'true';

export const AUTH_CONFIGURED = Boolean(clientId && tenantId);
export const AUTH_ENABLED = flag && AUTH_CONFIGURED;

/** True when someone asked for auth but did not finish configuring it. */
export const AUTH_MISCONFIGURED = flag && !AUTH_CONFIGURED;

/** Scopes for the orchestrator API, if it is protected by its own app registration. */
export const API_SCOPES = (import.meta.env.VITE_AZURE_API_SCOPES || '')
    .split(/[\s,]+/)
    .filter(Boolean);

export const msalConfig = {
    auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: `${window.location.origin}${withBasePath('/')}`,
        postLogoutRedirectUri: `${window.location.origin}${withBasePath('/')}`,
        navigateToLoginRequestUrl: true,
    },
    cache: {
        // sessionStorage keeps a token out of other tabs and clears it when the
        // browser closes, which is the right trade for an internal console.
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
};

/** What the interactive sign-in asks for. */
export const loginRequest = {
    scopes: API_SCOPES.length > 0 ? API_SCOPES : ['User.Read'],
};

/** What the silent token refresh asks for, before each API call. */
export const tokenRequest = {
    scopes: API_SCOPES.length > 0 ? API_SCOPES : ['User.Read'],
};
