/**
 * Netlify Serverless Function v2: Supabase API Proxy
 * 
 * Proxies all requests from /supabase-proxy/* to the Supabase backend.
 * Uses path-based routing via config.path for reliable POST/PUT/PATCH handling.
 * This bypasses ISP-level blocking of *.supabase.co (e.g., Jio in India).
 */

const SUPABASE_URL = "https://ektevcxubbtuxnaapyam.supabase.co";

export default async (req) => {
    const url = new URL(req.url);

    // Strip the /supabase-proxy prefix to get the Supabase path
    const supabasePath = url.pathname.replace(/^\/supabase-proxy/, '');
    const targetUrl = `${SUPABASE_URL}${supabasePath}${url.search}`;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') || '*',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    try {
        // Build headers - forward everything except host-related headers
        const headers = new Headers();
        for (const [key, value] of req.headers.entries()) {
            // Skip headers that should not be forwarded
            if (['host', 'x-forwarded-host', 'x-forwarded-for', 'x-nf-request-id',
                'x-nf-client-connection-ip', 'x-nf-account-id'].includes(key.toLowerCase())) {
                continue;
            }
            headers.set(key, value);
        }
        // Set the correct Host for Supabase
        headers.set('Host', 'ektevcxubbtuxnaapyam.supabase.co');

        // Forward the request to Supabase
        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: req.body,
            duplex: 'half', // Required for streaming request bodies
        });

        // Build response with CORS headers
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.delete('content-encoding'); // Prevent double-encoding

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error('[Supabase Proxy] Error:', error.message);
        return new Response(
            JSON.stringify({ error: 'Proxy error', message: error.message }),
            {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            }
        );
    }
};

// Netlify Functions v2 path-based routing
export const config = {
    path: "/supabase-proxy/*",
    preferStatic: true,
};
