// Patient Lab Thresholds Service
// Manages patient-specific normal ranges for lab values

import { supabase } from '../lib/supabase';
import { LabTestType } from '../types';

export interface PatientLabThreshold {
    id: string;
    patientId: string;
    patient_id?: string;
    doctorId: string;
    doctor_id?: string;
    labType: LabTestType;
    lab_type?: LabTestType;
    customMin: number | null;
    custom_min?: number | null;
    customMax: number | null;
    custom_max?: number | null;
    reason?: string;
    createdAt: string;
    created_at?: string;
    updatedAt: string;
    updated_at?: string;
}

// Default reference ranges (used when no custom threshold exists)
const DEFAULT_RANGES: Record<string, { min: number; max: number }> = {
    creatinine: { min: 0.7, max: 1.3 },
    egfr: { min: 60, max: 120 },
    bun: { min: 7, max: 20 },
    potassium: { min: 3.5, max: 5.0 },
    hemoglobin: { min: 12.0, max: 16.0 },
    bicarbonate: { min: 22, max: 29 },
    acr: { min: 0, max: 30 },
};

export class PatientLabThresholdsService {
    /**
     * Set or update a threshold for a specific lab type
     */
    static async setThreshold(
        patientId: string,
        doctorId: string,
        labType: LabTestType,
        customMin: number | null,
        customMax: number | null,
        reason?: string
    ): Promise<PatientLabThreshold> {
        const { data, error } = await supabase
            .from('patient_lab_thresholds')
            .upsert({
                patient_id: patientId,
                doctor_id: doctorId,
                lab_type: labType,
                custom_min: customMin,
                custom_max: customMax,
                reason,
            }, {
                onConflict: 'patient_id,lab_type',
            })
            .select()
            .single();

        if (error) {
            console.error('Error setting threshold:', error);
            throw new Error(`Failed to set threshold: ${error.message}`);
        }

        return this.mapThreshold(data);
    }

    /**
     * Get all custom thresholds for a patient
     */
    static async getThresholds(patientId: string): Promise<PatientLabThreshold[]> {
        const { data, error } = await supabase
            .from('patient_lab_thresholds')
            .select('*')
            .eq('patient_id', patientId);

        if (error) {
            console.error('Error fetching thresholds:', error);
            throw new Error(`Failed to fetch thresholds: ${error.message}`);
        }

        return (data || []).map(this.mapThreshold);
    }

    /**
     * Get a specific threshold for a lab type
     */
    static async getThreshold(patientId: string, labType: LabTestType): Promise<PatientLabThreshold | null> {
        const { data, error } = await supabase
            .from('patient_lab_thresholds')
            .select('*')
            .eq('patient_id', patientId)
            .eq('lab_type', labType)
            .maybeSingle();

        if (error) {
            console.error('Error fetching threshold:', error);
            return null;
        }

        return data ? this.mapThreshold(data) : null;
    }

    /**
     * Delete a threshold (reverts to default)
     */
    static async deleteThreshold(patientId: string, labType: LabTestType): Promise<void> {
        const { error } = await supabase
            .from('patient_lab_thresholds')
            .delete()
            .eq('patient_id', patientId)
            .eq('lab_type', labType);

        if (error) {
            console.error('Error deleting threshold:', error);
            throw new Error(`Failed to delete threshold: ${error.message}`);
        }
    }

    /**
     * Get effective threshold (custom if exists, otherwise default)
     */
    static async getEffectiveThreshold(
        patientId: string,
        labType: LabTestType
    ): Promise<{ min: number; max: number; isCustom: boolean; reason?: string }> {
        const customThreshold = await this.getThreshold(patientId, labType);

        if (customThreshold && (customThreshold.customMin !== null || customThreshold.customMax !== null)) {
            const defaults = DEFAULT_RANGES[labType] || { min: 0, max: 100 };
            return {
                min: customThreshold.customMin ?? defaults.min,
                max: customThreshold.customMax ?? defaults.max,
                isCustom: true,
                reason: customThreshold.reason,
            };
        }

        const defaults = DEFAULT_RANGES[labType] || { min: 0, max: 100 };
        return {
            min: defaults.min,
            max: defaults.max,
            isCustom: false,
        };
    }

    /**
     * Get all effective thresholds for a patient (with isCustom flags)
     */
    static async getAllEffectiveThresholds(
        patientId: string
    ): Promise<Record<LabTestType, { min: number; max: number; isCustom: boolean; reason?: string }>> {
        const customThresholds = await this.getThresholds(patientId);
        const customMap = new Map(customThresholds.map(t => [t.labType, t]));

        const result: Record<string, { min: number; max: number; isCustom: boolean; reason?: string }> = {};

        for (const [labType, defaults] of Object.entries(DEFAULT_RANGES)) {
            const custom = customMap.get(labType as LabTestType);
            if (custom && (custom.customMin !== null || custom.customMax !== null)) {
                result[labType] = {
                    min: custom.customMin ?? defaults.min,
                    max: custom.customMax ?? defaults.max,
                    isCustom: true,
                    reason: custom.reason,
                };
            } else {
                result[labType] = {
                    min: defaults.min,
                    max: defaults.max,
                    isCustom: false,
                };
            }
        }

        return result as Record<LabTestType, { min: number; max: number; isCustom: boolean; reason?: string }>;
    }

    /**
     * Get default range for a lab type
     */
    static getDefaultRange(labType: LabTestType): { min: number; max: number } {
        return DEFAULT_RANGES[labType] || { min: 0, max: 100 };
    }

    /**
     * Map database record to interface
     */
    private static mapThreshold(data: any): PatientLabThreshold {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            doctorId: data.doctor_id,
            doctor_id: data.doctor_id,
            labType: data.lab_type,
            lab_type: data.lab_type,
            customMin: data.custom_min !== null ? parseFloat(data.custom_min) : null,
            custom_min: data.custom_min !== null ? parseFloat(data.custom_min) : null,
            customMax: data.custom_max !== null ? parseFloat(data.custom_max) : null,
            custom_max: data.custom_max !== null ? parseFloat(data.custom_max) : null,
            reason: data.reason,
            createdAt: data.created_at,
            created_at: data.created_at,
            updatedAt: data.updated_at,
            updated_at: data.updated_at,
        };
    }
}
