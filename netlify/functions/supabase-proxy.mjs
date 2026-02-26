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

        // Forward range header for paginated queries
        const rangeHeader = req.headers.get('range');
        if (rangeHeader) headers.set('range', rangeHeader);

        // Forward x-upsert for Supabase storage upserts
        const upsertHeader = req.headers.get('x-upsert');
        if (upsertHeader) headers.set('x-upsert', upsertHeader);

        // Forward cache-control
        const cacheHeader = req.headers.get('cache-control');
        if (cacheHeader) headers.set('cache-control', cacheHeader);

        // Build fetch options
        const fetchOptions = {
            method: req.method,
            headers,
        };

        // Include body for all methods that can carry one
        // NOTE: DELETE is included because Supabase/PostgREST uses it for batch deletes
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const body = await req.text();
            if (body) fetchOptions.body = body;
        }

        // Forward the request to Supabase
        const response = await fetch(targetUrl, fetchOptions);

        // Read the response body
        const responseBody = await response.text();

        // Build response headers — forward Supabase range/content-range for pagination
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, X-Total-Count');

        const contentRange = response.headers.get('content-range');
        if (contentRange) responseHeaders.set('Content-Range', contentRange);

        const totalCount = response.headers.get('x-total-count');
        if (totalCount) responseHeaders.set('X-Total-Count', totalCount);

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
