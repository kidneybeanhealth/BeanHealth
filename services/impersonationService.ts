/**
 * Impersonation Service
 * 
 * Manages admin user impersonation functionality:
 * - Start impersonation (store admin session, switch to target user)
 * - End impersonation (restore admin session)
 * - Check impersonation state
 */

import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

const ADMIN_SESSION_KEY = 'beanhealth.admin.session'
const IMPERSONATION_STATE_KEY = 'beanhealth.impersonation.state'

interface ImpersonationState {
    isImpersonating: boolean
    adminUserId: string
    adminEmail: string
    adminName: string
    targetUserId: string
    targetEmail: string
    targetName: string
    targetRole: string
    startedAt: string
}

export const ImpersonationService = {
    /**
     * Check if currently impersonating another user
     */
    isImpersonating(): boolean {
        const state = localStorage.getItem(IMPERSONATION_STATE_KEY)
        return state ? JSON.parse(state).isImpersonating : false
    },

    /**
     * Get the current impersonation state
     */
    getState(): ImpersonationState | null {
        const state = localStorage.getItem(IMPERSONATION_STATE_KEY)
        return state ? JSON.parse(state) : null
    },

    /**
     * Start impersonating a target user
     * This calls the Edge Function to get an impersonation token
     */
    async startImpersonation(
        targetUserId: string,
        adminUserId: string,
        adminEmail: string,
        adminName: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // First, store the current admin session
            const { data: { session: currentSession } } = await supabase.auth.getSession()

            if (!currentSession) {
                return { success: false, error: 'No active session to store' }
            }

            // Store admin session for later restoration
            localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
                access_token: currentSession.access_token,
                refresh_token: currentSession.refresh_token,
                expires_at: currentSession.expires_at,
                user: currentSession.user,
            }))

            // Call the Edge Function to get impersonation credentials
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
            const functionsUrl = `${supabaseUrl}/functions/v1/impersonate-user`

            const response = await fetch(functionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify({ targetUserId }),
            })

            const result = await response.json()

            if (!result.success) {
                // Clean up stored session if impersonation fails
                localStorage.removeItem(ADMIN_SESSION_KEY)
                return { success: false, error: result.error || 'Impersonation failed' }
            }

            // Store impersonation state before switching sessions
            const impersonationState: ImpersonationState = {
                isImpersonating: true,
                adminUserId,
                adminEmail,
                adminName,
                targetUserId: result.targetUser.id,
                targetEmail: result.targetUser.email,
                targetName: result.targetUser.name,
                targetRole: result.targetUser.role,
                startedAt: new Date().toISOString(),
            }
            localStorage.setItem(IMPERSONATION_STATE_KEY, JSON.stringify(impersonationState))

            // Use the action link from the magic link to sign in as the target user
            // The action link contains a token that we need to verify
            if (result.actionLink) {
                // Extract the token from the action link URL
                const url = new URL(result.actionLink)
                const token = url.searchParams.get('token')
                const type = url.searchParams.get('type')

                if (token && type === 'magiclink') {
                    // Verify the OTP token to sign in as the target user
                    const { data, error: verifyError } = await supabase.auth.verifyOtp({
                        token_hash: token,
                        type: 'magiclink',
                    })

                    if (verifyError) {
                        console.error('OTP verification error:', verifyError)
                        // Try alternative approach - sign out and redirect
                        localStorage.removeItem(IMPERSONATION_STATE_KEY)
                        localStorage.removeItem(ADMIN_SESSION_KEY)
                        return { success: false, error: 'Failed to verify impersonation token' }
                    }

                    if (data.session) {
                        // Successfully switched to target user
                        return { success: true }
                    }
                }
            }

            // If we couldn't verify the OTP, we need to redirect to the magic link
            // This will sign the admin out and in as the target user
            if (result.actionLink) {
                window.location.href = result.actionLink
                return { success: true }
            }

            return { success: false, error: 'No valid impersonation method available' }
        } catch (error) {
            console.error('Impersonation error:', error)
            // Clean up on error
            localStorage.removeItem(ADMIN_SESSION_KEY)
            localStorage.removeItem(IMPERSONATION_STATE_KEY)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    },

    /**
     * End impersonation and restore admin session
     */
    async endImpersonation(): Promise<{ success: boolean; error?: string }> {
        try {
            const storedSession = localStorage.getItem(ADMIN_SESSION_KEY)

            if (!storedSession) {
                return { success: false, error: 'No admin session found to restore' }
            }

            const adminSession = JSON.parse(storedSession) as Session

            // Sign out current (impersonated) user
            await supabase.auth.signOut()

            // Restore admin session
            const { error: setSessionError } = await supabase.auth.setSession({
                access_token: adminSession.access_token,
                refresh_token: adminSession.refresh_token,
            })

            if (setSessionError) {
                console.error('Error restoring admin session:', setSessionError)
                // If restore fails, redirect to login
                localStorage.removeItem(ADMIN_SESSION_KEY)
                localStorage.removeItem(IMPERSONATION_STATE_KEY)
                window.location.href = '/'
                return { success: false, error: 'Session expired, please login again' }
            }

            // Clear impersonation state
            localStorage.removeItem(ADMIN_SESSION_KEY)
            localStorage.removeItem(IMPERSONATION_STATE_KEY)

            // Reload the page to refresh all state
            window.location.reload()

            return { success: true }
        } catch (error) {
            console.error('End impersonation error:', error)
            // Force cleanup and redirect
            localStorage.removeItem(ADMIN_SESSION_KEY)
            localStorage.removeItem(IMPERSONATION_STATE_KEY)
            window.location.href = '/'
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    },

    /**
     * Clear impersonation state (for use after page reload)
     */
    clearState(): void {
        localStorage.removeItem(ADMIN_SESSION_KEY)
        localStorage.removeItem(IMPERSONATION_STATE_KEY)
    },
}
