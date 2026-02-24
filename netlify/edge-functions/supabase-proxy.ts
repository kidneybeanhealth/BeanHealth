import type { Context } from "https://edge.netlify.com";

/**
 * Netlify Edge Function: Supabase API Proxy
 * 
 * Proxies all requests from /supabase-proxy/* to the Supabase backend.
 * This bypasses ISP-level blocking of *.supabase.co (e.g., Jio in India).
 * 
 * The edge function properly forwards:
 * - All HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS)
 * - Request headers (including Authorization, apikey, Content-Type)
 * - Request body (for POST/PUT/PATCH)
 * - Query parameters
 */

const SUPABASE_URL = "https://ektevcxubbtuxnaapyam.supabase.co";

export default async (request: Request, context: Context) => {
    const url = new URL(request.url);

    // Strip the /supabase-proxy prefix to get the actual Supabase path
    const supabasePath = url.pathname.replace(/^\/supabase-proxy/, '');
    const targetUrl = `${SUPABASE_URL}${supabasePath}${url.search}`;

    // Forward all headers except Host (which should be the Supabase host)
    const headers = new Headers(request.headers);
    headers.set('Host', new URL(SUPABASE_URL).host);
    // Remove Netlify-specific headers that could confuse Supabase
    headers.delete('x-forwarded-host');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers') || '*',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    try {
        // Forward the request to Supabase
        const response = await fetch(targetUrl, {
            method: request.method,
            headers,
            body: request.body,
        });

        // Create response with CORS headers
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        // Remove any headers that might cause issues
        responseHeaders.delete('content-encoding');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error: any) {
        console.error('[Supabase Proxy] Error:', error.message);
        return new Response(
            JSON.stringify({ error: 'Proxy error', message: error.message }),
            {
                status: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }
};
