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

            // Check if both flag is true AND they have a name
            return data?.onboarding_completed === true && !!data?.full_name;
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
            // 1. Generate patient ID (will be replaced with actual function later)
            const patientId = await this.generatePatientId();

            // 2. Update user profile
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    full_name: onboardingData.fullName,
                    age: onboardingData.age,
                    gender: onboardingData.gender,
                    patient_id: patientId,
                    onboarding_completed: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // 3. Link to doctor if referral code provided
            let doctorName: string | undefined;
            if (onboardingData.referralCode) {
                try {
                    doctorName = await this.linkToDoctor(userId, onboardingData.referralCode);
                } catch (error) {
                    console.error('Referral code linking failed:', error);
                    // Don't fail the whole onboarding if doctor linking fails
                }
            }

            return {
                patientId,
                doctorName
            };
        } catch (error) {
            console.error('Error completing onboarding:', error);
            throw new Error('Failed to complete onboarding. Please try again.');
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
                .select('id, name, specialty, referral_code')
                .eq('referral_code', referralCode.toUpperCase())
                .eq('role', 'doctor')
                .single();

            if (doctorError || !doctor) {
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
                });

            if (relationshipError) throw relationshipError;

            // 3. Return doctor name
            const specialty = doctor.specialty ? ` (${doctor.specialty})` : '';
            return `Dr. ${doctor.name}${specialty}`;
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
