import { supabase } from '../lib/supabase';
import { MedicalRecord } from '../types';

export class MedicalRecordsService {
  static async createMedicalRecord(record: Omit<MedicalRecord, 'id'> & { patientId: string }): Promise<MedicalRecord> {
    const { data, error } = await supabase
      .from('medical_records')
      .insert({
        patient_id: record.patientId,
        date: record.date,
        type: record.type,
        summary: record.summary,
        doctor: record.doctor,
        category: record.category,
        file_url: record.fileUrl,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating medical record:', error);
      throw error;
    }

    return {
      id: data.id,
      patientId: data.patient_id,
      date: data.date,
      type: data.type,
      summary: data.summary,
      doctor: data.doctor,
      category: data.category,
      fileUrl: data.file_url,
    };
  }

  static async getMedicalRecordsByPatientId(patientId: string): Promise<MedicalRecord[]> {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching medical records:', error);
      throw error;
    }

    return data.map(record => ({
      id: record.id,
      patientId: record.patient_id,
      date: record.date,
      type: record.type,
      summary: record.summary,
      doctor: record.doctor,
      category: record.category,
      fileUrl: record.file_url,
    }));
  }

  static async deleteMedicalRecord(recordId: string): Promise<string | null> {
    // First, get the record to retrieve the file URL
    const { data: record, error: fetchError } = await supabase
      .from('medical_records')
      .select('file_url')
      .eq('id', recordId)
      .single();

    if (fetchError) {
      console.error('Error fetching medical record for deletion:', fetchError);
      throw fetchError;
    }

    // Delete the record from the database
    const { error: deleteError } = await supabase
      .from('medical_records')
      .delete()
      .eq('id', recordId);

    if (deleteError) {
      console.error('Error deleting medical record:', deleteError);
      throw deleteError;
    }

    // Return the file URL so the caller can delete the file from storage
    return record?.file_url || null;
  }

  static async updateMedicalRecord(recordId: string, updates: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const { data, error } = await supabase
      .from('medical_records')
      .update({
        date: updates.date,
        type: updates.type,
        summary: updates.summary,
        doctor: updates.doctor,
        category: updates.category,
        file_url: updates.fileUrl,
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) {
      console.error('Error updating medical record:', error);
      throw error;
    }

    return {
      id: data.id,
      patientId: data.patient_id,
      date: data.date,
      type: data.type,
      summary: data.summary,
      doctor: data.doctor,
      category: data.category,
      fileUrl: data.file_url,
    };
  }
}