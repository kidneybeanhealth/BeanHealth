import { supabase } from '../lib/supabase'
import { User } from '../types'

export class PatientAdditionService {
  // Remove patient from doctor's roster
  static async removePatientFromDoctor(patientId: string, doctorId: string): Promise<void> {
    const { error } = await supabase
      .from('patient_doctor_relationships')
      .delete()
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)

    if (error) throw error
  }

  // Get doctor's patients
  static async getDoctorPatients(doctorId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('patient_doctor_relationships')
      .select(`
        patient:users!patient_doctor_relationships_patient_id_fkey(*)
      `)
      .eq('doctor_id', doctorId)

    if (error) throw error

    return (data as any[]).map(relationship => {
      const user = relationship.patient as any
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        patientId: user.patient_id, // User-friendly patient ID (e.g., P-20231217-XXXX)
        patient_id: user.patient_id,
        avatarUrl: null, // No longer use external avatar URLs
        avatar_url: null,
        specialty: user.specialty,
        dateOfBirth: user.date_of_birth,
        date_of_birth: user.date_of_birth,
        condition: user.condition,
        subscriptionTier: user.subscription_tier,
        subscription_tier: user.subscription_tier,
        urgentCredits: user.urgent_credits,
        urgent_credits: user.urgent_credits,
        trialEndsAt: user.trial_ends_at,
        trial_ends_at: user.trial_ends_at,
        notes: user.notes,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    })
  }

  // Get patient's doctors (active relationships only)
  static async getPatientDoctors(patientId: string): Promise<User[]> {
    console.log('[PatientAdditionService] Fetching doctors for patient:', patientId);

    // Step 1: Get relationships
    const { data: relationships, error: relError } = await supabase
      .from('patient_doctor_relationships')
      .select('*')
      .eq('patient_id', patientId)

    if (relError) {
      console.error('[PatientAdditionService] Error fetching relationships:', relError);
      throw relError;
    }

    if (!relationships || relationships.length === 0) {
      return [];
    }

    const doctorIds = (relationships as any[]).map(rel => rel.doctor_id);

    // Step 2: Get doctor details
    const { data: doctorsData, error: docError } = await supabase
      .from('users')
      .select('*')
      .in('id', doctorIds)
      .eq('role', 'doctor')

    if (docError) {
      console.error('[PatientAdditionService] Error fetching doctor details:', docError);
      throw docError;
    }

    return (doctorsData as any[]).map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: null, // No longer use external avatar URLs
      avatar_url: null,
      specialty: user.specialty,
      dateOfBirth: user.date_of_birth,
      date_of_birth: user.date_of_birth,
      condition: user.condition,
      subscriptionTier: user.subscription_tier,
      subscription_tier: user.subscription_tier,
      urgentCredits: user.urgent_credits,
      urgent_credits: user.urgent_credits,
      trialEndsAt: user.trial_ends_at,
      trial_ends_at: user.trial_ends_at,
      notes: user.notes,
      created_at: user.created_at,
      updated_at: user.updated_at
    })) as User[];
  }
}