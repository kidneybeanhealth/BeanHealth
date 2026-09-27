/**
 * BeanHealth Connect — entry point (connect.html).
 *
 * Served at connect.beanhealth.in, and at /connect on any host so preview
 * deployments can be tried before the subdomain exists. The router's basename
 * follows whichever of the two this page was opened at.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../index.css';
import { ConnectSessionProvider } from './session';
import ConnectApp from './ConnectApp';

const basename = window.location.pathname === '/connect' || window.location.pathname.startsWith('/connect/') ? '/connect' : '';

createRoot(document.getElementById('connect-root')!).render(
    <React.StrictMode>
        <BrowserRouter basename={basename}>
            <ConnectSessionProvider>
                <ConnectApp />
                <Toaster position="top-center" toastOptions={{ duration: 4000, style: { fontSize: 14 } }} />
            </ConnectSessionProvider>
        </BrowserRouter>
    </React.StrictMode>
);
