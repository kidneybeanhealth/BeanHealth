// Lab Results Service
// Handles all database operations for lab results tracking

import { supabase } from '../lib/supabase';
import { LabResult, LabTestType, VitalStatus } from '../types';
import { getLabResultStatus, getPotassiumStatus, getHemoglobinStatus, getBicarbonateStatus, getACRStatus } from '../utils/ckdUtils';

export class LabResultsService {
    /**
     * Add a new lab result
     */
    static async addLabResult(
        patientId: string,
        testType: LabTestType,
        value: number,
        unit: string,
        testDate: string,
        labName?: string,
        notes?: string
    ): Promise<LabResult> {
        // Get reference ranges for the test type
        const { refMin, refMax } = this.getReferenceRange(testType);

        // Calculate status based on test type
        let status: VitalStatus;
        if (testType === 'potassium') {
            status = getPotassiumStatus(value).status;
        } else if (testType === 'hemoglobin') {
            status = getHemoglobinStatus(value).status;
        } else if (testType === 'bicarbonate') {
            status = getBicarbonateStatus(value).status;
        } else if (testType === 'acr') {
            status = getACRStatus(value).status;
        } else {
            status = getLabResultStatus(value, refMin, refMax);
        }

        const { data, error } = await supabase
            .from('lab_results')
            .insert({
                patient_id: patientId,
                test_type: testType,
                value: value,
                unit: unit,
                reference_range_min: refMin,
                reference_range_max: refMax,
                status: status,
                test_date: testDate,
                lab_name: labName,
                notes: notes
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding lab result:', error);
            throw new Error(`Failed to add lab result: ${error.message}`);
        }

        return this.mapToLabResult(data);
    }

    /**
     * Get all lab results for a patient, optionally filtered by test type
     */
    static async getLabResults(patientId: string, testType?: LabTestType): Promise<LabResult[]> {
        let query = supabase
            .from('lab_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('test_date', { ascending: false });

        if (testType) {
            query = query.eq('test_type', testType);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching lab results:', error);
            throw new Error(`Failed to fetch lab results: ${error.message}`);
        }

        return data?.map(this.mapToLabResult) || [];
    }

    /**
     * Get latest result for each test type
     */
    static async getLatestResults(patientId: string): Promise<Record<LabTestType, LabResult | null>> {
        const testTypes: LabTestType[] = ['creatinine', 'egfr', 'bun', 'potassium', 'hemoglobin', 'bicarbonate', 'acr'];
        const results: Record<LabTestType, LabResult | null> = {
            creatinine: null,
            egfr: null,
            bun: null,
            potassium: null,
            hemoglobin: null,
            bicarbonate: null,
            acr: null
        };

        await Promise.all(
            testTypes.map(async (testType) => {
                const { data, error } = await supabase
                    .from('lab_results')
                    .select('*')
                    .eq('patient_id', patientId)
                    .eq('test_type', testType)
                    .order('test_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!error && data) {
                    results[testType] = this.mapToLabResult(data);
                }
            })
        );

        return results;
    }

    /**
     * Delete a lab result
     */
    static async deleteLabResult(id: string): Promise<void> {
        const { error } = await supabase
            .from('lab_results')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting lab result:', error);
            throw new Error(`Failed to delete lab result: ${error.message}`);
        }
    }

    /**
     * Update a lab result
     */
    static async updateLabResult(
        id: string,
        updates: Partial<LabResult>
    ): Promise<LabResult> {
        const { data, error } = await supabase
            .from('lab_results')
            .update({
                value: updates.value,
                unit: updates.unit,
                test_date: updates.testDate,
                lab_name: updates.labName,
                notes: updates.notes,
                status: updates.status
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating lab result:', error);
            throw new Error(`Failed to update lab result: ${error.message}`);
        }

        return this.mapToLabResult(data);
    }

    /**
     * Get trend data for a specific test type (for charting)
     */
    static async getTrendData(
        patientId: string,
        testType: LabTestType,
        limit: number = 10
    ): Promise<{ date: string; value: number }[]> {
        const { data, error } = await supabase
            .from('lab_results')
            .select('test_date, value')
            .eq('patient_id', patientId)
            .eq('test_type', testType)
            .order('test_date', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('Error fetching trend data:', error);
            return [];
        }

        return data?.map(item => ({
            date: item.test_date,
            value: item.value
        })) || [];
    }

    /**
     * Get reference range for a test type
     */
    private static getReferenceRange(testType: LabTestType): { refMin: number; refMax: number } {
        const ranges: Record<LabTestType, { refMin: number; refMax: number }> = {
            creatinine: { refMin: 0.7, refMax: 1.3 }, // mg/dL
            egfr: { refMin: 60, refMax: 120 }, // ml/min/1.73m²
            bun: { refMin: 7, refMax: 20 }, // mg/dL
            potassium: { refMin: 3.5, refMax: 5.0 }, // mmol/L
            hemoglobin: { refMin: 12.0, refMax: 16.0 }, // g/dL
            bicarbonate: { refMin: 22, refMax: 29 }, // mmol/L
            acr: { refMin: 0, refMax: 30 } // mg/g
        };

        return ranges[testType] || { refMin: 0, refMax: 100 };
    }

    /**
     * Map database record to LabResult interface
     */
    private static mapToLabResult(data: any): LabResult {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            testType: data.test_type,
            test_type: data.test_type,
            value: parseFloat(data.value),
            unit: data.unit,
            referenceRangeMin: data.reference_range_min ? parseFloat(data.reference_range_min) : undefined,
            reference_range_min: data.reference_range_min ? parseFloat(data.reference_range_min) : undefined,
            referenceRangeMax: data.reference_range_max ? parseFloat(data.reference_range_max) : undefined,
            reference_range_max: data.reference_range_max ? parseFloat(data.reference_range_max) : undefined,
            status: data.status,
            testDate: data.test_date,
            test_date: data.test_date,
            labName: data.lab_name,
            lab_name: data.lab_name,
            notes: data.notes,
            createdAt: data.created_at,
            created_at: data.created_at
        };
    }
}
