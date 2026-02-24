import { supabase } from '../lib/supabase';
import { CaseDetails } from '../types';

// Helper to convert database fields to camelCase
const mapCaseDetailsFromDB = (data: any): CaseDetails => ({
    id: data.id,
    patientId: data.patient_id,
    primaryCondition: data.primary_condition || '',
    latestComplaint: data.latest_complaint || '',
    complaintDate: data.complaint_date,
    medicalHistory: data.medical_history || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
});

export const CaseDetailsService = {
    /**
     * Get case details for a patient
     */
    async getCaseDetails(patientId: string): Promise<CaseDetails | null> {
        const { data, error } = await supabase
            .from('patient_case_details')
            .select('*')
            .eq('patient_id', patientId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No record found - return null
                return null;
            }
            console.error('Error fetching case details:', error);
            throw error;
        }

        return mapCaseDetailsFromDB(data);
    },

    /**
     * Create or update case details (upsert)
     */
    async upsertCaseDetails(
        patientId: string,
        details: Partial<Omit<CaseDetails, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>>
    ): Promise<CaseDetails> {
        const updateData: any = {
            patient_id: patientId,
        };

        if (details.primaryCondition !== undefined) {
            updateData.primary_condition = details.primaryCondition;
        }
        if (details.latestComplaint !== undefined) {
            updateData.latest_complaint = details.latestComplaint;
            updateData.complaint_date = new Date().toISOString().split('T')[0];
        }
        if (details.medicalHistory !== undefined) {
            updateData.medical_history = details.medicalHistory;
        }

        const { data, error } = await supabase
            .from('patient_case_details')
            .upsert(updateData, {
                onConflict: 'patient_id',
            })
            .select()
            .single();

        if (error) {
            console.error('Error upserting case details:', error);
            throw error;
        }

        return mapCaseDetailsFromDB(data);
    },

    /**
     * Update primary condition
     */
    async updatePrimaryCondition(patientId: string, condition: string): Promise<CaseDetails> {
        return this.upsertCaseDetails(patientId, { primaryCondition: condition });
    },

    /**
     * Update latest complaint
     */
    async updateLatestComplaint(patientId: string, complaint: string): Promise<CaseDetails> {
        return this.upsertCaseDetails(patientId, { latestComplaint: complaint });
    },

    /**
     * Add item to medical history
     */
    async addMedicalHistoryItem(patientId: string, item: string): Promise<CaseDetails> {
        // First get current history
        const current = await this.getCaseDetails(patientId);
        const currentHistory = current?.medicalHistory || [];

        // Add new item if not already present
        if (!currentHistory.includes(item)) {
            const newHistory = [...currentHistory, item];
            return this.upsertCaseDetails(patientId, { medicalHistory: newHistory });
        }

        return current!;
    },

    /**
     * Remove item from medical history
     */
    async removeMedicalHistoryItem(patientId: string, item: string): Promise<CaseDetails> {
        const current = await this.getCaseDetails(patientId);
        const currentHistory = current?.medicalHistory || [];

        const newHistory = currentHistory.filter(h => h !== item);
        return this.upsertCaseDetails(patientId, { medicalHistory: newHistory });
    },

    /**
     * Update medical history completely
     */
    async updateMedicalHistory(patientId: string, history: string[]): Promise<CaseDetails> {
        return this.upsertCaseDetails(patientId, { medicalHistory: history });
    },

    /**
     * Get case details for doctor view (used in DoctorPatientView)
     */
    async getCaseDetailsForDoctor(patientId: string): Promise<{
        caseDetails: CaseDetails | null;
        recentRecords: { date: string; type: string; summary: string }[];
    }> {
        // Get case details
        const caseDetails = await this.getCaseDetails(patientId);

        // Get recent medical records for context
        const { data: records, error: recordsError } = await supabase
            .from('medical_records')
            .select('date, type, summary')
            .eq('patient_id', patientId)
            .order('date', { ascending: false })
            .limit(5);

        if (recordsError) {
            console.error('Error fetching recent records:', recordsError);
        }

        return {
            caseDetails,
            recentRecords: records || [],
        };
    },

    /**
     * Extract and auto-populate case details from medical records
     * This can be called after a new medical record is uploaded
     */
    async autoPopulateFromRecord(
        patientId: string,
        recordSummary: any
    ): Promise<void> {
        try {
            // Parse the summary if it's a string
            let summaryObj = recordSummary;
            if (typeof recordSummary === 'string') {
                try {
                    summaryObj = JSON.parse(recordSummary);
                } catch {
                    // Not JSON, use as-is
                    return;
                }
            }

            const updates: Partial<Omit<CaseDetails, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>> = {};

            // Extract complaint/reason for visit
            if (summaryObj['Current Issue/Reason for Visit']) {
                const complaint = Array.isArray(summaryObj['Current Issue/Reason for Visit'])
                    ? summaryObj['Current Issue/Reason for Visit'].join('; ')
                    : summaryObj['Current Issue/Reason for Visit'];
                updates.latestComplaint = complaint;
            }

            // Extract medical history
            if (summaryObj['Medical History']) {
                const history = Array.isArray(summaryObj['Medical History'])
                    ? summaryObj['Medical History']
                    : [summaryObj['Medical History']];

                // Merge with existing history
                const current = await this.getCaseDetails(patientId);
                const existingHistory = current?.medicalHistory || [];
                const uniqueHistory = [...new Set([...existingHistory, ...history])];
                updates.medicalHistory = uniqueHistory;
            }

            if (Object.keys(updates).length > 0) {
                await this.upsertCaseDetails(patientId, updates);
                console.log('Auto-populated case details from medical record');
            }
        } catch (error) {
            console.error('Error auto-populating case details:', error);
        }
    },
};
