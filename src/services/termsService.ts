/**
 * Terms and Conditions Service
 * 
 * Handles all operations related to Terms and Conditions acceptance
 * for patients using the BeanHealth app.
 */

import { supabase } from '../lib/supabase';

const CURRENT_TERMS_VERSION = '1.0';

// Type for terms-related user data
interface TermsUserData {
    terms_accepted?: boolean;
    terms_accepted_at?: string;
    terms_version?: string;
}

export class TermsService {
    /**
     * Check if a user has accepted the current version of terms
     */
    static async hasAcceptedTerms(userId: string): Promise<boolean> {
        try {
            console.log('[TermsService] Checking terms acceptance for user:', userId);

            const { data, error } = await supabase
                .from('users')
                .select('terms_accepted, terms_version')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[TermsService] Error checking terms acceptance:', error);
                // If there's an error (like column doesn't exist yet), assume not accepted
                // This handles the transition period before migration is run
                return false;
            }

            // Cast data to our terms type
            const termsData = data as unknown as TermsUserData;

            // Check if user has accepted the current version
            const hasAccepted = termsData?.terms_accepted === true && 
                               termsData?.terms_version === CURRENT_TERMS_VERSION;

            console.log('[TermsService] Terms accepted:', hasAccepted);
            return hasAccepted;
        } catch (error) {
            console.error('[TermsService] Error in hasAcceptedTerms:', error);
            return false;
        }
    }

    /**
     * Accept terms and conditions for a user
     */
    static async acceptTerms(userId: string): Promise<boolean> {
        try {
            console.log('[TermsService] Accepting terms for user:', userId);

            // Try using RPC first (if migration has been run)
            try {
                const { error: rpcError } = await (supabase as any).rpc('accept_terms', {
                    user_id: userId,
                    version: CURRENT_TERMS_VERSION
                });

                if (!rpcError) {
                    console.log('[TermsService] Terms accepted via RPC');
                    return true;
                }

                // If RPC fails, fall back to direct update
                console.log('[TermsService] RPC not available, using direct update');
            } catch (rpcErr) {
                console.log('[TermsService] RPC not available, using direct update');
            }

            // Direct update fallback
            const { error } = await (supabase as any)
                .from('users')
                .update({
                    terms_accepted: true,
                    terms_accepted_at: new Date().toISOString(),
                    terms_version: CURRENT_TERMS_VERSION,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                console.error('[TermsService] Error accepting terms:', error);
                throw error;
            }

            console.log('[TermsService] Terms accepted successfully');
            return true;
        } catch (error) {
            console.error('[TermsService] Error in acceptTerms:', error);
            throw error;
        }
    }

    /**
     * Get the current terms version
     */
    static getCurrentVersion(): string {
        return CURRENT_TERMS_VERSION;
    }

    /**
     * Check if a user needs to accept new terms (version mismatch)
     */
    static async needsToAcceptNewTerms(userId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('terms_accepted, terms_version')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[TermsService] Error checking terms version:', error);
                return true; // If error, assume they need to accept
            }

            // Cast data to our terms type
            const termsData = data as unknown as TermsUserData;

            // User needs to accept if:
            // 1. They haven't accepted at all
            // 2. They accepted an older version
            if (!termsData?.terms_accepted) return true;
            if (termsData?.terms_version !== CURRENT_TERMS_VERSION) return true;

            return false;
        } catch (error) {
            console.error('[TermsService] Error in needsToAcceptNewTerms:', error);
            return true;
        }
    }

    /**
     * Get terms acceptance details for a user
     */
    static async getTermsDetails(userId: string): Promise<{
        accepted: boolean;
        acceptedAt: string | null;
        version: string | null;
    }> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('terms_accepted, terms_accepted_at, terms_version')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[TermsService] Error getting terms details:', error);
                return { accepted: false, acceptedAt: null, version: null };
            }

            // Cast data to our terms type
            const termsData = data as unknown as TermsUserData;

            return {
                accepted: termsData?.terms_accepted || false,
                acceptedAt: termsData?.terms_accepted_at || null,
                version: termsData?.terms_version || null
            };
        } catch (error) {
            console.error('[TermsService] Error in getTermsDetails:', error);
            return { accepted: false, acceptedAt: null, version: null };
        }
    }
}

export default TermsService;
