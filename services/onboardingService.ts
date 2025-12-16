import { supabase } from '../lib/supabase';
import { OnboardingData } from '../components/OnboardingModal';

export interface CompleteOnboardingResponse {
    patientId: string;
    doctorName?: string;
}

export class OnboardingService {
    /**
     * Check if user has completed onboarding
     */
    static async checkOnboardingStatus(userId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('onboarding_completed, full_name')
                .eq('id', userId)
                .single();

            if (error) throw error;
            if (!data) return false;

            // Check if both flag is true AND they have a name
            return (data as any).onboarding_completed === true && !!(data as any).full_name;
        } catch (error) {
            console.error('Error checking onboarding status:', error);
            return false;
        }
    }

    /**
     * Complete user onboarding
     */
    static async completeOnboarding(
        userId: string,
        onboardingData: OnboardingData
    ): Promise<CompleteOnboardingResponse> {
        try {
            console.log('[OnboardingService] Starting onboarding for user:', userId);
            console.log('[OnboardingService] Onboarding data:', onboardingData);

            // 1. Generate patient ID (will be replaced with actual function later)
            const patientId = await this.generatePatientId();
            console.log('[OnboardingService] Generated patient ID:', patientId);

            // 2. Link to doctor FIRST if referral code provided
            let doctorName: string | undefined;
            if (onboardingData.referralCode && onboardingData.referralCode.trim()) {
                try {
                    console.log('[OnboardingService] Validating referral code:', onboardingData.referralCode);
                    doctorName = await this.linkToDoctor(userId, onboardingData.referralCode);
                    console.log('[OnboardingService] Successfully linked to doctor:', doctorName);
                } catch (error: any) {
                    console.error('[OnboardingService] Referral code linking failed:', error);
                    // Throw error so user knows referral code is invalid
                    throw new Error(error?.message || 'Invalid referral code. Please check and try again.');
                }
            }

            // 3. Update user profile
            const updateData = {
                full_name: onboardingData.fullName,
                age: onboardingData.age,
                gender: onboardingData.gender,
                patient_id: patientId,
                onboarding_completed: true,
                updated_at: new Date().toISOString()
            };
            // Using new columns not yet in generated types
            const { error: updateError } = await (supabase as any)
                .from('users')
                .update(updateData)
                .eq('id', userId);

            if (updateError) {
                console.error('[OnboardingService] Profile update error:', updateError);
                // Check if columns don't exist
                if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
                    throw new Error('Database schema not set up. Please run patient_onboarding_schema.sql in Supabase SQL Editor.');
                }
                throw updateError;
            }

            console.log('[OnboardingService] Onboarding completed successfully');

            return {
                patientId,
                doctorName
            };
        } catch (error: any) {
            console.error('[OnboardingService] Error completing onboarding:', error);
            // Re-throw with more specific message if available
            throw new Error(error?.message || 'Failed to complete onboarding. Please try again.');
        }
    }

    /**
     * Generate unique patient ID
     * TODO: Replace with actual database function call
     */
    private static async generatePatientId(): Promise<string> {
        // Temporary implementation - will be replaced with actual SQL function
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

        // Get count of patients created today (temporary - real version uses sequence table)
        const { count, error } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', today.toISOString().slice(0, 10) + 'T00:00:00')
            .not('patient_id', 'is', null);

        if (error) {
            console.error('Error counting patients:', error);
        }

        const sequence = (count || 0) + 1;
        const sequenceStr = sequence.toString().padStart(4, '0');

        return `P-${dateStr}-${sequenceStr}`;
    }

    /**
     * Link patient to doctor using referral code
     */
    private static async linkToDoctor(
        patientId: string,
        referralCode: string
    ): Promise<string | undefined> {
        try {
            // 1. Find doctor by referral code
            const { data: doctor, error: doctorError } = await supabase
                .from('users')
                .select('id, full_name, name, specialty, referral_code')
                .eq('referral_code', referralCode.toUpperCase())
                .eq('role', 'doctor')
                .single() as any;

            if (doctorError || !doctor) {
                console.error('Doctor lookup error:', doctorError);
                throw new Error('Invalid referral code');
            }

            // 2. Create patient-doctor relationship
            const { error: relationshipError } = await supabase
                .from('patient_doctor_relationships')
                .insert({
                    patient_id: patientId,
                    doctor_id: doctor.id,
                    status: 'active',
                    notes: `Linked via referral code ${referralCode}`
                } as any);

            if (relationshipError) throw relationshipError;

            // 3. Return doctor name
            const doctorName = doctor.full_name || doctor.name || 'Unknown Doctor';
            const specialty = doctor.specialty ? ` (${doctor.specialty})` : '';
            return `Dr. ${doctorName}${specialty}`;
        } catch (error) {
            console.error('Error linking to doctor:', error);
            throw error;
        }
    }

    /**
     * Validate referral code format
     */
    static validateReferralCode(code: string): boolean {
        // Format: DR-XXXX-XXXX (e.g., DR-NEPH-A7K2)
        const regex = /^DR-[A-Z]{4}-[A-Z0-9]{4}$/;
        return regex.test(code.toUpperCase());
    }
}
