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
     * Add a lab result with dynamic test type support
     * Accepts any test type string (not just predefined LabTestType)
     * Uses provided reference ranges or default status calculation
     */
    static async addLabResultDynamic(
        patientId: string,
        testType: string,          // Can be any string now
        value: number,
        unit: string,
        testDate: string,
        referenceMin?: number,
        referenceMax?: number,
        labName?: string,
        notes?: string
    ): Promise<LabResult> {
        // Determine reference ranges - use provided or lookup defaults
        let refMin = referenceMin;
        let refMax = referenceMax;

        if (refMin === undefined || refMax === undefined) {
            const defaultRange = this.getReferenceRangeDynamic(testType);
            refMin = refMin ?? defaultRange.refMin;
            refMax = refMax ?? defaultRange.refMax;
        }

        // Calculate status with special handling for known test types
        let status: VitalStatus;
        const lowerType = testType.toLowerCase();

        if (lowerType === 'potassium') {
            status = getPotassiumStatus(value).status;
        } else if (lowerType === 'hemoglobin') {
            status = getHemoglobinStatus(value).status;
        } else if (lowerType === 'bicarbonate') {
            status = getBicarbonateStatus(value).status;
        } else if (lowerType === 'acr') {
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
            console.error('Error adding dynamic lab result:', error);
            throw new Error(`Failed to add lab result: ${error.message}`);
        }

        console.log(`🔬 Lab result saved: ${testType} = ${value} ${unit}`);
        return this.mapToLabResult(data);
    }

    /**
     * Bulk add lab results from AI extraction
     * Returns array of successfully added results
     */
    static async addLabResultsBulk(
        patientId: string,
        labResults: Array<{
            testType: string;
            value: number;
            unit: string;
            referenceMin?: number;
            referenceMax?: number;
            testDate?: string;
        }>,
        defaultDate: string
    ): Promise<LabResult[]> {
        const savedResults: LabResult[] = [];

        for (const lab of labResults) {
            try {
                const result = await this.addLabResultDynamic(
                    patientId,
                    lab.testType,
                    lab.value,
                    lab.unit,
                    lab.testDate || defaultDate,
                    lab.referenceMin,
                    lab.referenceMax
                );
                savedResults.push(result);
            } catch (error) {
                console.error(`Failed to save lab ${lab.testType}:`, error);
                // Continue with other labs even if one fails
            }
        }

        console.log(`✅ Saved ${savedResults.length}/${labResults.length} lab results`);
        return savedResults;
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
     * Get reference range for any test type (supports dynamic/custom types)
     */
    private static getReferenceRangeDynamic(testType: string): { refMin: number; refMax: number } {
        // Extended ranges including common lab tests
        const ranges: Record<string, { refMin: number; refMax: number }> = {
            // Core CKD tests
            creatinine: { refMin: 0.7, refMax: 1.3 },
            egfr: { refMin: 60, refMax: 120 },
            bun: { refMin: 7, refMax: 20 },
            potassium: { refMin: 3.5, refMax: 5.0 },
            hemoglobin: { refMin: 12.0, refMax: 16.0 },
            bicarbonate: { refMin: 22, refMax: 29 },
            acr: { refMin: 0, refMax: 30 },
            // Electrolytes
            sodium: { refMin: 136, refMax: 145 },
            chloride: { refMin: 98, refMax: 106 },
            calcium: { refMin: 8.5, refMax: 10.5 },
            phosphorus: { refMin: 2.5, refMax: 4.5 },
            magnesium: { refMin: 1.7, refMax: 2.2 },
            // Blood counts
            wbc: { refMin: 4.5, refMax: 11.0 },
            rbc: { refMin: 4.5, refMax: 5.5 },
            hematocrit: { refMin: 38.3, refMax: 48.6 },
            platelets: { refMin: 150, refMax: 400 },
            // Diabetes
            glucose: { refMin: 70, refMax: 100 },
            hba1c: { refMin: 4.0, refMax: 5.6 },
            // Lipids
            total_cholesterol: { refMin: 0, refMax: 200 },
            ldl: { refMin: 0, refMax: 100 },
            hdl: { refMin: 40, refMax: 60 },
            triglycerides: { refMin: 0, refMax: 150 },
            // Liver
            alt: { refMin: 7, refMax: 56 },
            ast: { refMin: 10, refMax: 40 },
            albumin: { refMin: 3.4, refMax: 5.4 },
            bilirubin: { refMin: 0.1, refMax: 1.2 },
            alp: { refMin: 44, refMax: 147 },
            // Thyroid
            tsh: { refMin: 0.4, refMax: 4.0 },
            t4: { refMin: 4.5, refMax: 11.2 },
            t3: { refMin: 100, refMax: 200 },
            // Vitamins
            vitamin_d: { refMin: 30, refMax: 100 },
            vitamin_b12: { refMin: 200, refMax: 900 },
            iron: { refMin: 60, refMax: 170 },
            ferritin: { refMin: 12, refMax: 300 },
            folate: { refMin: 2.7, refMax: 17.0 },
            // Other
            uric_acid: { refMin: 2.5, refMax: 7.0 },
            crp: { refMin: 0, refMax: 3.0 },
            esr: { refMin: 0, refMax: 20 },
        };

        const lowerType = testType.toLowerCase();
        return ranges[lowerType] || { refMin: 0, refMax: 100 };
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
