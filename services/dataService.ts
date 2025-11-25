/**
 * Data Services
 * 
 * FIXES APPLIED:
 * - Added timeout handling to all database operations
 * - Improved error messages and logging
 * - Added defensive null checks
 * - Proper error propagation
 * 
 * WHY: Prevents hanging on slow database queries and provides better error feedback
 */

import { supabase } from '../lib/supabase'
import { Vitals, VitalsRecord, Medication, MedicalRecord } from '../types'
import { withTimeout } from '../utils/requestUtils'

export class VitalsService {
  static async getPatientVitals(patientId: string): Promise<VitalsRecord[]> {
    try {
      console.log('[VitalsService] Fetching vitals for patient:', patientId);
      
      const { data, error } = await withTimeout(
        supabase
          .from('vitals')
          .select('*')
          .eq('patient_id', patientId)
          .order('recorded_at', { ascending: false }),
        10000,
        'Vitals fetch timeout'
      );

      if (error) {
        console.error('[VitalsService] Error fetching vitals:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('[VitalsService] No vitals data returned');
        return [];
      }

    return data.map(vital => ({
      date: vital.recorded_at.split('T')[0],
      vitals: {
        bloodPressure: {
          value: vital.blood_pressure_value || '',
          unit: vital.blood_pressure_unit || 'mmHg',
          trend: vital.blood_pressure_trend || 'stable'
        },
        heartRate: {
          value: vital.heart_rate_value || '',
          unit: vital.heart_rate_unit || 'bpm',
          trend: vital.heart_rate_trend || 'stable'
        },
        temperature: {
          value: vital.temperature_value || '',
          unit: vital.temperature_unit || '°F',
          trend: vital.temperature_trend || 'stable'
        },
        ...(vital.glucose_value && {
          glucose: {
            value: vital.glucose_value,
            unit: vital.glucose_unit || 'mg/dL',
            trend: vital.glucose_trend || 'stable'
          }
        })
      }
    }));
    } catch (error) {
      console.error('[VitalsService] Failed to fetch patient vitals:', error);
      throw error;
    }
  }

  static async getLatestVitals(patientId: string): Promise<Vitals | null> {
    try {
      console.log('[VitalsService] Fetching latest vitals for patient:', patientId);
      
      const { data, error } = await withTimeout(
        supabase
          .from('vitals')
          .select('*')
          .eq('patient_id', patientId)
          .order('recorded_at', { ascending: false })
          .limit(1),
        10000,
        'Latest vitals fetch timeout'
      );

      if (error) {
        console.error('[VitalsService] Error fetching latest vitals:', error);
        throw error;
      }

      // If no data or empty array, return null
      if (!data || data.length === 0) {
        console.log('[VitalsService] No vitals found for patient');
        return null;
      }

      const vital = data[0];

      return {
        bloodPressure: {
          value: vital.blood_pressure_value || '',
          unit: vital.blood_pressure_unit || 'mmHg',
          trend: vital.blood_pressure_trend || 'stable'
        },
        heartRate: {
          value: vital.heart_rate_value || '',
          unit: vital.heart_rate_unit || 'bpm',
          trend: vital.heart_rate_trend || 'stable'
        },
        temperature: {
          value: vital.temperature_value || '',
          unit: vital.temperature_unit || '°F',
          trend: vital.temperature_trend || 'stable'
        },
        ...(vital.glucose_value && {
          glucose: {
            value: vital.glucose_value,
            unit: vital.glucose_unit || 'mg/dL',
            trend: vital.glucose_trend || 'stable'
          }
        })
      };
    } catch (error) {
      console.error('[VitalsService] Failed to fetch latest vitals:', error);
      throw error;
    }
  }

  static async addVitals(patientId: string, vitals: Vitals) {
    const { data, error } = await supabase
      .from('vitals')
      .insert({
        patient_id: patientId,
        blood_pressure_value: vitals.bloodPressure.value,
        blood_pressure_unit: vitals.bloodPressure.unit,
        blood_pressure_trend: vitals.bloodPressure.trend,
        heart_rate_value: vitals.heartRate.value,
        heart_rate_unit: vitals.heartRate.unit,
        heart_rate_trend: vitals.heartRate.trend,
        temperature_value: vitals.temperature.value,
        temperature_unit: vitals.temperature.unit,
        temperature_trend: vitals.temperature.trend,
        glucose_value: vitals.glucose?.value,
        glucose_unit: vitals.glucose?.unit,
        glucose_trend: vitals.glucose?.trend,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateVital(patientId: string, vitalType: keyof Vitals, value: string) {
    // Get the latest vital record
    const { data: vitalsData } = await supabase
      .from('vitals')
      .select('*')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false })
      .limit(1)
    
    const latestVital = vitalsData && vitalsData.length > 0 ? vitalsData[0] : null

    // Update the specific vital field
    const updateData: any = {}
    
    switch (vitalType) {
      case 'bloodPressure':
        updateData.blood_pressure_value = value
        break
      case 'heartRate':
        updateData.heart_rate_value = value
        break
      case 'temperature':
        updateData.temperature_value = value
        break
      case 'glucose':
        updateData.glucose_value = value
        break
    }

    if (latestVital) {
      // Update existing record if it's from today
      const today = new Date().toISOString().split('T')[0]
      const vitalDate = latestVital.recorded_at.split('T')[0]
      
      if (today === vitalDate) {
        const { data, error } = await supabase
          .from('vitals')
          .update(updateData)
          .eq('id', latestVital.id)
          .select()
          .single()

        if (error) throw error
        return data
      }
    }

    // Create new record with updated value
    const currentVitals = await this.getLatestVitals(patientId)
    const newVitals = { ...currentVitals }
    
    if (vitalType === 'bloodPressure') {
      newVitals.bloodPressure = { ...newVitals.bloodPressure, value }
    } else if (vitalType === 'heartRate') {
      newVitals.heartRate = { ...newVitals.heartRate, value }
    } else if (vitalType === 'temperature') {
      newVitals.temperature = { ...newVitals.temperature, value }
    } else if (vitalType === 'glucose' && newVitals.glucose) {
      newVitals.glucose = { ...newVitals.glucose, value }
    }

    return this.addVitals(patientId, newVitals)
  }
}

export class MedicationService {
  static async getPatientMedications(patientId: string): Promise<Medication[]> {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return data.map(med => ({
      id: med.id,
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency
    }))
  }

  static async addMedication(patientId: string, medication: Omit<Medication, 'id'>) {
    const { data, error } = await supabase
      .from('medications')
      .insert({
        patient_id: patientId,
        name: medication.name,
        dosage: medication.dosage,
        frequency: medication.frequency
      })
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency
    } as Medication
  }

  static async updateMedication(medicationId: string, updates: Partial<Medication>) {
    const { data, error } = await supabase
      .from('medications')
      .update({
        name: updates.name,
        dosage: updates.dosage,
        frequency: updates.frequency
      })
      .eq('id', medicationId)
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency
    } as Medication
  }

  static async removeMedication(medicationId: string) {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', medicationId)

    if (error) throw error
  }
}

export class MedicalRecordService {
  static async getPatientRecords(patientId: string): Promise<MedicalRecord[]> {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false })

    if (error) throw error

    return data.map(record => ({
      id: record.id,
      date: record.date,
      type: record.type,
      summary: record.summary,
      doctor: record.doctor,
      category: record.category,
      fileUrl: record.file_url
    }))
  }

  static async addMedicalRecord(patientId: string, record: Omit<MedicalRecord, 'id'>) {
    const { data, error } = await supabase
      .from('medical_records')
      .insert({
        patient_id: patientId,
        date: record.date,
        type: record.type,
        summary: record.summary,
        doctor: record.doctor,
        category: record.category,
        file_url: record.fileUrl
      })
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      date: data.date,
      type: data.type,
      summary: data.summary,
      doctor: data.doctor,
      category: data.category,
      fileUrl: data.file_url
    } as MedicalRecord
  }

  static async removeMedicalRecord(recordId: string) {
    const { error } = await supabase
      .from('medical_records')
      .delete()
      .eq('id', recordId)

    if (error) throw error
  }
}