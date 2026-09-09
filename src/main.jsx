import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import AuthProvider from './auth/AuthProvider';
import ThemeProvider from './contexts/ThemeProvider';
import MuiThemeBridge from './contexts/MuiThemeBridge';
import { purgeLegacyStoredToken } from './lib/settings';
import { BASE_PATH } from './lib/base-path';
import './styles/globals.css';

// Older builds stored a GitHub PAT in localStorage. Anyone who used one still
// has it sitting there, so clear it before the app renders anything.
purgeLegacyStoredToken();

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter basename={BASE_PATH || undefined}>
            <ThemeProvider>
                <MuiThemeBridge>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </MuiThemeBridge>
            </ThemeProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
