import { supabase } from '../lib/supabase';
import { Prescription, PrescriptionMedication, PrescriptionStatus } from '../types';

export class PrescriptionService {
  /**
   * Create a new prescription
   */
  static async createPrescription(
    doctorId: string,
    patientId: string,
    medications: PrescriptionMedication[],
    notes?: string
  ): Promise<{ data: Prescription | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .insert([
          {
            doctor_id: doctorId,
            patient_id: patientId,
            medications: medications,
            notes: notes || null,
            status: 'active'
          }
        ])
        .select('*')
        .single();

      if (error) throw error;

      return { data: this.transformPrescription(data), error: null };
    } catch (error) {
      console.error('Error creating prescription:', error);
      return { data: null, error };
    }
  }

  /**
   * Get all prescriptions for a patient
   */
  static async getPatientPrescriptions(patientId: string): Promise<{ data: Prescription[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          doctor:doctor_id (
            id,
            name,
            specialty
          ),
          patient:patient_id (
            id,
            name
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const prescriptions = data?.map(p => this.transformPrescriptionWithDetails(p)) || [];
      return { data: prescriptions, error: null };
    } catch (error) {
      console.error('Error fetching patient prescriptions:', error);
      return { data: [], error };
    }
  }

  /**
   * Get all prescriptions created by a doctor
   */
  static async getDoctorPrescriptions(doctorId: string): Promise<{ data: Prescription[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          doctor:doctor_id (
            id,
            name,
            specialty
          ),
          patient:patient_id (
            id,
            name
          )
        `)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const prescriptions = data?.map(p => this.transformPrescriptionWithDetails(p)) || [];
      return { data: prescriptions, error: null };
    } catch (error) {
      console.error('Error fetching doctor prescriptions:', error);
      return { data: [], error };
    }
  }

  /**
   * Get prescriptions for a specific patient-doctor relationship
   */
  static async getPrescriptionsForPatient(
    doctorId: string,
    patientId: string
  ): Promise<{ data: Prescription[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          doctor:doctor_id (
            id,
            name,
            specialty
          ),
          patient:patient_id (
            id,
            name
          )
        `)
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const prescriptions = data?.map(p => this.transformPrescriptionWithDetails(p)) || [];
      return { data: prescriptions, error: null };
    } catch (error) {
      console.error('Error fetching prescriptions for patient:', error);
      return { data: [], error };
    }
  }

  /**
   * Get a single prescription by ID
   */
  static async getPrescriptionById(prescriptionId: string): Promise<{ data: Prescription | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          doctor:doctor_id (
            id,
            name,
            specialty
          ),
          patient:patient_id (
            id,
            name
          )
        `)
        .eq('id', prescriptionId)
        .single();

      if (error) throw error;

      return { data: this.transformPrescriptionWithDetails(data), error: null };
    } catch (error) {
      console.error('Error fetching prescription:', error);
      return { data: null, error };
    }
  }

  /**
   * Update prescription status
   */
  static async updatePrescriptionStatus(
    prescriptionId: string,
    status: PrescriptionStatus
  ): Promise<{ data: Prescription | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .update({ status })
        .eq('id', prescriptionId)
        .select('*')
        .single();

      if (error) throw error;

      return { data: this.transformPrescription(data), error: null };
    } catch (error) {
      console.error('Error updating prescription status:', error);
      return { data: null, error };
    }
  }

  /**
   * Update prescription notes
   */
  static async updatePrescriptionNotes(
    prescriptionId: string,
    notes: string
  ): Promise<{ data: Prescription | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .update({ notes })
        .eq('id', prescriptionId)
        .select('*')
        .single();

      if (error) throw error;

      return { data: this.transformPrescription(data), error: null };
    } catch (error) {
      console.error('Error updating prescription notes:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete a prescription
   */
  static async deletePrescription(prescriptionId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', prescriptionId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error deleting prescription:', error);
      return { error };
    }
  }

  /**
   * Transform database prescription to app format
   */
  private static transformPrescription(data: any): Prescription {
    return {
      id: data.id,
      doctorId: data.doctor_id,
      patientId: data.patient_id,
      medications: data.medications || [],
      notes: data.notes,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Transform prescription with doctor/patient details
   */
  private static transformPrescriptionWithDetails(data: any): Prescription {
    const prescription = this.transformPrescription(data);
    
    if (data.doctor) {
      prescription.doctorName = data.doctor.name;
      prescription.doctorSpecialty = data.doctor.specialty;
    }
    
    if (data.patient) {
      prescription.patientName = data.patient.name;
    }
    
    return prescription;
  }
}
