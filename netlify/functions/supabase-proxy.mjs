/**
 * Netlify Serverless Function: Supabase API Proxy
 * 
 * Proxies all requests from /supabase-proxy/* to the Supabase backend.
 * Netlify redirect routes /supabase-proxy/* to this function.
 * The original path comes via x-nf-original-uri or the Referer header.
 * This bypasses ISP-level blocking of *.supabase.co (e.g., Jio in India).
 */

const SUPABASE_URL = "https://ektevcxubbtuxnaapyam.supabase.co";

export default async (req, context) => {
    const url = new URL(req.url);

    // Get the original path from Netlify's header or from the URL itself
    // When redirected via netlify.toml, x-nf-original-uri has the original path
    const originalUri = req.headers.get('x-nf-original-uri') || url.pathname;
    const supabasePath = originalUri.replace(/^\/supabase-proxy/, '') || '/';
    const targetUrl = `${SUPABASE_URL}${supabasePath}${url.search}`;

    console.log(`[Proxy] ${req.method} ${originalUri} → ${targetUrl}`);

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
        // Build headers - forward only relevant ones
        const headers = new Headers();
        const forwardHeaders = [
            'content-type', 'authorization', 'apikey', 'x-client-info',
            'accept', 'accept-language', 'prefer', 'x-supabase-api-version'
        ];

        for (const key of forwardHeaders) {
            const value = req.headers.get(key);
            if (value) headers.set(key, value);
        }

        // Build fetch options
        const fetchOptions = {
            method: req.method,
            headers,
        };

        // Only include body for methods that have one
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = await req.text();
        }

        // Forward the request to Supabase
        const response = await fetch(targetUrl, fetchOptions);

        // Read the response body
        const responseBody = await response.text();

        // Build response with CORS headers
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(responseBody, {
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
