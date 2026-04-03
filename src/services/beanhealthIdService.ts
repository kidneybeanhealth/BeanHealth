/**
 * BeanHealth ID Service
 * 
 * Handles unified patient identity across the BeanHealth ecosystem.
 * Provides phone-based patient lookup and cross-hospital linking.
 * 
 * Note: Uses 'as any' type casts for new tables (patient_hospital_links)
 * until Supabase types are regenerated after migration.
 */

import { supabase } from '../lib/supabase';

export interface PatientLink {
    id: string;
    hospitalId: string;
    hospitalName: string;
    localMrNumber?: string;
    linkedAt: string;
    consentGiven: boolean;
}

export interface UnifiedPatient {
    id: string;
    name: string;
    email: string;
    beanhealthId: string;
    linkedHospitals: PatientLink[];
}

export interface LinkResult {
    success: boolean;
    userId?: string;
    beanhealthId?: string;
    error?: string;
}

export const BeanhealthIdService = {
    /**
     * Get user's BeanHealth ID
     */
    async getBeanhealthId(userId: string): Promise<string | null> {
        const { data, error } = await (supabase
            .from('users') as any)
            .select('beanhealth_id')
            .eq('id', userId)
            .single();

        if (error || !data) return null;
        return data.beanhealth_id;
    },

    /**
     * Find existing patient by phone number
     * Used during hospital registration to link walk-ins to app users
     */
    async findPatientByPhone(phone: string): Promise<{
        id: string;
        name: string;
        email: string;
        beanhealthId: string;
    } | null> {
        // First check if any hospital_patients with this phone is linked to a user
        const { data: hospitalPatient } = await (supabase
            .from('hospital_patients') as any)
            .select('linked_user_id')
            .eq('phone', phone)
            .not('linked_user_id', 'is', null)
            .limit(1)
            .single();

        if (hospitalPatient?.linked_user_id) {
            const { data: user } = await (supabase
                .from('users') as any)
                .select('id, name, email, beanhealth_id')
                .eq('id', hospitalPatient.linked_user_id)
                .single();

            if (user) {
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    beanhealthId: user.beanhealth_id
                };
            }
        }

        return null;
    },

    /**
     * Link a hospital patient to an app user
     */
    async linkPatientToUser(
        hospitalPatientId: string,
        userId: string,
        hospitalId: string,
        localMrNumber?: string
    ): Promise<LinkResult> {
        try {
            // Update hospital_patients with linked_user_id
            const { error: updateError } = await (supabase
                .from('hospital_patients') as any)
                .update({ linked_user_id: userId })
                .eq('id', hospitalPatientId);

            if (updateError) throw updateError;

            // Create patient_hospital_links entry
            const { error: linkError } = await (supabase
                .from('patient_hospital_links') as any)
                .upsert({
                    user_id: userId,
                    hospital_id: hospitalId,
                    hospital_patient_id: hospitalPatientId,
                    local_mr_number: localMrNumber,
                    linked_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,hospital_id'
                });

            if (linkError) throw linkError;

            // Get the user's BeanHealth ID
            const beanhealthId = await this.getBeanhealthId(userId);

            return {
                success: true,
                userId,
                beanhealthId: beanhealthId || undefined
            };
        } catch (error: any) {
            console.error('Link patient error:', error);
            return {
                success: false,
                error: error.message || 'Failed to link patient'
            };
        }
    },

    /**
     * Get all hospitals a patient is linked to
     */
    async getLinkedHospitals(userId: string): Promise<PatientLink[]> {
        const { data, error } = await (supabase
            .from('patient_hospital_links') as any)
            .select(`
        id,
        hospital_id,
        local_mr_number,
        linked_at,
        consent_given,
        hospital:users!patient_hospital_links_hospital_id_fkey(name)
      `)
            .eq('user_id', userId);

        if (error || !data) return [];

        return data.map((link: any) => ({
            id: link.id,
            hospitalId: link.hospital_id,
            hospitalName: link.hospital?.name || 'Unknown Hospital',
            localMrNumber: link.local_mr_number,
            linkedAt: link.linked_at,
            consentGiven: link.consent_given
        }));
    },

    /**
     * Get unified patient profile with all linked hospitals
     */
    async getUnifiedProfile(userId: string): Promise<UnifiedPatient | null> {
        const { data: user, error } = await (supabase
            .from('users') as any)
            .select('id, name, email, beanhealth_id')
            .eq('id', userId)
            .single();

        if (error || !user) return null;

        const linkedHospitals = await this.getLinkedHospitals(userId);

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            beanhealthId: user.beanhealth_id,
            linkedHospitals
        };
    },

    /**
     * Update consent for data sharing with a hospital
     */
    async updateConsent(linkId: string, consentGiven: boolean): Promise<boolean> {
        const { error } = await (supabase
            .from('patient_hospital_links') as any)
            .update({
                consent_given: consentGiven,
                consent_given_at: consentGiven ? new Date().toISOString() : null
            })
            .eq('id', linkId);

        return !error;
    },

    /**
     * Get all patients linked to a hospital
     * Used by hospital dashboards to see which patients have app accounts
     */
    async getHospitalLinkedPatients(hospitalId: string): Promise<{
        patientId: string;
        patientName: string;
        beanhealthId: string;
        localMrNumber?: string;
        consentGiven: boolean;
    }[]> {
        const { data, error } = await (supabase
            .from('patient_hospital_links') as any)
            .select(`
        local_mr_number,
        consent_given,
        user:users!patient_hospital_links_user_id_fkey(id, name, beanhealth_id)
      `)
            .eq('hospital_id', hospitalId);

        if (error || !data) return [];

        return data.map((link: any) => ({
            patientId: link.user?.id,
            patientName: link.user?.name || 'Unknown',
            beanhealthId: link.user?.beanhealth_id || '',
            localMrNumber: link.local_mr_number,
            consentGiven: link.consent_given
        }));
    }
};

export default BeanhealthIdService;
