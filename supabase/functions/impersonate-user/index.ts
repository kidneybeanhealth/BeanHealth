// Supabase Edge Function for Admin User Impersonation
// Deploy with: supabase functions deploy impersonate-user

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get the authorization header from the request
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        // Create a Supabase client with the user's JWT to verify they are admin
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!

        // Client with user's JWT - for verifying admin status
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader },
            },
        })

        // Verify the caller is authenticated
        const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser()
        if (authError || !callerUser) {
            throw new Error('Unauthorized: Invalid token')
        }

        // Check if caller is an admin
        const { data: callerProfile, error: profileError } = await supabaseUser
            .from('users')
            .select('role')
            .eq('id', callerUser.id)
            .single()

        if (profileError || callerProfile?.role !== 'admin') {
            throw new Error('Forbidden: Admin access required')
        }

        // Get the target user ID from request body
        const { targetUserId } = await req.json()
        if (!targetUserId) {
            throw new Error('Missing targetUserId in request body')
        }

        // Create admin client with service role key
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })

        // Get the target user's email
        const { data: targetUser, error: targetError } = await supabaseAdmin
            .from('users')
            .select('email, name, role')
            .eq('id', targetUserId)
            .single()

        if (targetError || !targetUser) {
            throw new Error('Target user not found')
        }

        // Generate a magic link for the target user (this creates a session token)
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: targetUser.email,
            options: {
                redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/`,
            },
        })

        if (linkError || !linkData) {
            console.error('Error generating link:', linkError)
            throw new Error('Failed to generate impersonation session')
        }

        // Extract the token from the magic link
        // The link contains a token that can be used to sign in
        const token = linkData.properties?.hashed_token
        const emailRedirectTo = linkData.properties?.email_redirect_to

        // For impersonation, we'll use a different approach:
        // Create a one-time password (OTP) that the frontend can use
        // Actually, let's use the admin.createUser approach with a temporary password

        // Better approach: Get user by ID and generate a session directly
        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

        if (getUserError || !authUser) {
            throw new Error('Failed to get target user auth data')
        }

        // Generate a direct session for the user using admin API
        // Note: Supabase doesn't have a direct "generate session" API for impersonation
        // We'll use the magic link token approach - the frontend will exchange this for a session

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Impersonation link generated',
                targetUser: {
                    id: targetUserId,
                    email: targetUser.email,
                    name: targetUser.name,
                    role: targetUser.role,
                },
                // The magic link contains a hashed token
                // Frontend can use this to complete the sign-in
                actionLink: linkData.properties?.action_link,
                // Also provide token for OTP-style verification
                token: token,
                emailRedirectTo: emailRedirectTo,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Impersonation error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: error instanceof Error && error.message.includes('Forbidden') ? 403 :
                    error instanceof Error && error.message.includes('Unauthorized') ? 401 : 400,
            }
        )
    }
})
