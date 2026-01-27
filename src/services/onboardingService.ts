/**
 * Unified Onboarding Service
 * 
 * Handles onboarding for ALL user types (patients, doctors, admins).
 * Uses the `onboarding_completed` database field to track completion status.
 * 
 * This version ensures ALL user data is properly updated during onboarding.
 */

import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

export interface OnboardingData {
    fullName: string;
    age?: number;
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    referralCode?: string;
    dateOfBirth?: string;
    condition?: string;
    specialty?: string;
    role?: UserRole;
}

export interface CompleteOnboardingResponse {
    patientId?: string;
    doctorName?: string;
    referralCode?: string; // For doctors
}

interface UserOnboardingStatus {
    onboarding_completed: boolean | null;
    name: string | null;
    role: string | null;
}

interface DoctorInfo {
    id: string;
    full_name: string | null;
    name: string | null;
    specialty: string | null;
    referral_code: string | null;
}

interface DoctorReferralCode {
    referral_code: string | null;
}

export class OnboardingService {
    /**
     * Check if user has completed onboarding
     * IMPORTANT: Uses ONLY the onboarding_completed field for definitive status
     */
    static async checkOnboardingStatus(userId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('onboarding_completed')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[OnboardingService] Error checking onboarding status:', error);
                // If user doesn't exist, they need onboarding
                if (error.code === 'PGRST116') return false;
                throw error;
            }

            if (!data) return false;

            const userData = data as UserOnboardingStatus;

            // ONLY check the onboarding_completed flag - no fallbacks
            // This ensures ALL users go through onboarding if the flag is not true
            return userData.onboarding_completed === true;
        } catch (error) {
            console.error('[OnboardingService] Error checking onboarding status:', error);
            return false;
        }
    }

    /**
     * Complete user onboarding - works for all user roles
     * UPDATES ALL RELEVANT FIELDS to ensure fresh, clean data
     */
    static async completeOnboarding(
        userId: string,
        onboardingData: OnboardingData
    ): Promise<CompleteOnboardingResponse> {
        try {
            console.log('[OnboardingService] Starting fresh onboarding for user:', userId);
            console.log('[OnboardingService] Onboarding data:', onboardingData);

            const role = onboardingData.role || 'patient';
            const response: CompleteOnboardingResponse = {};

            // 1. Generate patient ID for patients
            let patientId: string | undefined;
            if (role === 'patient') {
                patientId = await this.generatePatientId();
                response.patientId = patientId;
                console.log('[OnboardingService] Generated patient ID:', patientId);
            }

            // 2. Link to doctor if referral code provided (for patients)
            if (role === 'patient' && onboardingData.referralCode?.trim()) {
                try {
                    console.log('[OnboardingService] Validating referral code:', onboardingData.referralCode);
                    const doctorName = await this.linkToDoctor(userId, onboardingData.referralCode);
                    response.doctorName = doctorName;
                    console.log('[OnboardingService] Successfully linked to doctor:', doctorName);
                } catch (error: any) {
                    console.error('[OnboardingService] Referral code linking failed:', error);
                    throw new Error(error?.message || 'Invalid referral code. Please check and try again.');
                }
            }

            // 3. Build COMPLETE update data - refresh ALL relevant fields
            const updateData: Record<string, any> = {
                // Core profile fields
                name: onboardingData.fullName.trim(),
                full_name: onboardingData.fullName.trim(), // Also update full_name for compatibility
                gender: onboardingData.gender,

                // Onboarding flag
                onboarding_completed: true,

                // Timestamps
                updated_at: new Date().toISOString()
            };

            // Patient-specific fields
            if (role === 'patient') {
                updateData.patient_id = patientId;
                updateData.role = 'patient'; // Ensure role is set

                if (onboardingData.dateOfBirth) {
                    updateData.date_of_birth = onboardingData.dateOfBirth;
                }
                if (onboardingData.condition) {
                    updateData.condition = onboardingData.condition.trim();
                }
            }

            // Doctor-specific fields
            if (role === 'doctor') {
                updateData.role = 'doctor'; // Ensure role is set

                if (onboardingData.specialty) {
                    updateData.specialty = onboardingData.specialty.trim();
                }
                // Note: Referral code is auto-generated by database trigger
            }

            // Admin-specific fields
            if (role === 'admin') {
                updateData.role = 'admin'; // Ensure role is set
            }

            console.log('[OnboardingService] Updating user with data:', updateData);

            // 4. Update user profile with ALL fields
            const { error: updateError } = await (supabase as any)
                .from('users')
                .update(updateData)
                .eq('id', userId);

            if (updateError) {
                console.error('[OnboardingService] Profile update error:', updateError);
                throw new Error('Failed to update profile: ' + (updateError.message || 'Unknown error'));
            }

            // 5. Get doctor's referral code if they're a doctor
            if (role === 'doctor') {
                // Wait a moment for trigger to generate referral code
                await new Promise(resolve => setTimeout(resolve, 500));

                const { data: doctorData, error: doctorError } = await supabase
                    .from('users')
                    .select('referral_code')
                    .eq('id', userId)
                    .single();

                if (!doctorError && doctorData) {
                    const doctorCodeData = doctorData as unknown as DoctorReferralCode;
                    if (doctorCodeData.referral_code) {
                        response.referralCode = doctorCodeData.referral_code;
                    }
                }
            }

            console.log('[OnboardingService] ✅ Onboarding completed successfully');
            console.log('[OnboardingService] Response:', response);

            return response;
        } catch (error: any) {
            console.error('[OnboardingService] Error completing onboarding:', error);
            throw new Error(error?.message || 'Failed to complete onboarding. Please try again.');
        }
    }

    /**
     * Generate unique patient ID
     */
    private static async generatePatientId(): Promise<string> {
        try {
            // Try to use the database function first
            const { data, error } = await supabase.rpc('generate_patient_id');
            if (!error && data) {
                return data as string;
            }
        } catch (err) {
            console.log('[OnboardingService] Database function not available, using fallback');
        }

        // Fallback: Generate locally
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `P-${dateStr}-${randomStr}`;
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
                .single();

            if (doctorError || !doctor) {
                console.error('[OnboardingService] Doctor lookup error:', doctorError);
                throw new Error('Invalid referral code. Please check and try again.');
            }

            const doctorInfo = doctor as unknown as DoctorInfo;

            // 2. Check if relationship already exists
            const { data: existingRelation } = await supabase
                .from('patient_doctor_relationships')
                .select('id')
                .eq('patient_id', patientId)
                .eq('doctor_id', doctorInfo.id)
                .single();

            // 3. Create patient-doctor relationship if it doesn't exist
            if (!existingRelation) {
                const { error: relationshipError } = await (supabase as any)
                    .from('patient_doctor_relationships')
                    .insert({
                        patient_id: patientId,
                        doctor_id: doctorInfo.id
                    });

                if (relationshipError) {
                    // Ignore duplicate key errors
                    if (relationshipError.code !== '23505') {
                        console.error('[OnboardingService] Relationship insert error:', relationshipError);
                        throw relationshipError;
                    }
                }
            }

            // 4. Return doctor name
            const doctorName = doctorInfo.full_name || doctorInfo.name || 'Unknown Doctor';
            const specialty = doctorInfo.specialty ? ` (${doctorInfo.specialty})` : '';
            return `Dr. ${doctorName}${specialty}`;
        } catch (error) {
            console.error('[OnboardingService] Error linking to doctor:', error);
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
