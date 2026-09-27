import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * feedback.html — the page the patient-feedback QR actually receives.
 *
 * Link previews (WhatsApp, SMS, Telegram) never run JavaScript: they read the
 * raw HTML the server returns. As a single-page app, every address returned the
 * same index.html, so /f/KKC previewed as "BeanHealth - Comprehensive healthcare
 * management platform", indistinguishable from the home page. vercel.json now
 * sends /f/* here instead, and this file is index.html with its own title and
 * Open Graph tags. It is DERIVED from the built index.html rather than kept as a
 * second copy, so the two can never drift apart.
 *
 * It also leaves out the service-worker registration and the manifest. A
 * patient scanning a hospital poster uses this form once; registering the
 * worker made their phone download the whole app, about 11.6 MB, in the
 * background on mobile data. And a phone that had once visited beanhealth.in
 * opened its stale offline copy — which predated this route — and was sent to
 * the home page. See navigateFallbackDenylist below for the other half.
 */
const FEEDBACK_TITLE = 'How was your visit? · Patient feedback';
const FEEDBACK_DESC = 'Tell the hospital how your visit went. Takes under a minute — no app, no login.';

function feedbackPageHtml(): Plugin {
  return {
    name: 'beanhealth-feedback-page-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') {
        this.error('feedback.html: built index.html not found, cannot derive the feedback page');
        return;
      }
      const og = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="BeanHealth" />`,
        `<meta property="og:title" content="${FEEDBACK_TITLE}" />`,
        `<meta property="og:description" content="${FEEDBACK_DESC}" />`,
        `<meta name="twitter:card" content="summary" />`,
        `<meta name="twitter:title" content="${FEEDBACK_TITLE}" />`,
        `<meta name="twitter:description" content="${FEEDBACK_DESC}" />`,
      ].join('\n    ');
      let html = String(index.source);
      const before = html;
      html = html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${FEEDBACK_TITLE}</title>`)
        .replace(/<meta\s+name="description"[\s\S]*?\/?>/, `<meta name="description" content="${FEEDBACK_DESC}" />`)
        .replace(/\s*<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '')
        .replace(/\s*<link rel="manifest"[^>]*>/g, '')
        .replace('</head>', `    ${og}\n  </head>`);
      if (html === before || !html.includes(FEEDBACK_TITLE)) {
        this.error('feedback.html: could not rewrite the page head');
        return;
      }
      this.emitFile({ type: 'asset', fileName: 'feedback.html', source: html });
    },
  };
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    feedbackPageHtml(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'logo.png'],
      manifest: {
        name: 'BeanHealth',
        short_name: 'BeanHealth',
        description: 'Continuous. Connected. Complete. - Healthcare Management Platform',
        theme_color: '#3A2524',
        background_color: '#FBFCF8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Never answer a feedback-form navigation from the offline copy. A copy
        // saved before a route existed sends the patient to the home page; the
        // form is small and always wanted fresh, so it always comes from the
        // network (vercel.json serves it as feedback.html).
        navigateFallbackDenylist: [/^\/f\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  // Build config for production SPA routing with code splitting
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['react-hot-toast', 'lucide-react']
        }
      }
    }
  }
});
