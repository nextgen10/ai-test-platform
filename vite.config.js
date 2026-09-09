import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the Agent HUB Platform frontend.
 *
 * The browser only ever talks to this origin. In development the proxy below
 * stands in for the orchestrator; in production the same `/api/v1` prefix is
 * served by whatever fronts the built assets (nginx, ingress, a sidecar), so
 * the client code never needs to know the upstream address.
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiTarget = env.API_TARGET || 'http://127.0.0.1:8100';
    // Domino notebook sessions mount the UI under a proxy path; empty locally.
    const base = env.VITE_BASE_PATH || '/';

    return {
        base,
        plugins: [react()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            port: Number(env.PORT || 3100),
            host: true,
            proxy: {
                '/api/v1': {
                    target: apiTarget,
                    changeOrigin: true,
                    // Credentials are stripped rather than forwarded: a cookie or
                    // Authorization header arriving here came from something other
                    // than this app, and passing it upstream would be a confused
                    // deputy, not a feature.
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq) => {
                            proxyReq.removeHeader('cookie');
                            proxyReq.removeHeader('authorization');
                        });
                    },
                },
            },
        },
        preview: { port: Number(env.PORT || 3100), host: true },
        build: {
            outDir: 'dist',
            sourcemap: false,
            chunkSizeWarningLimit: 1200,
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ['react', 'react-dom', 'react-router-dom'],
                        mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
                        msal: ['@azure/msal-browser', '@azure/msal-react'],
                        xlsx: ['xlsx'],
                    },
                },
            },
        },
    };
});
