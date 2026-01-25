// Visit Medication Service
// Handles linking medications to specific patient visits
// Includes Gemini AI integration for auto-extraction

import { supabase } from '../lib/supabase';
import { VisitMedication, MedicationChangeStatus, MedicationSnapshot } from '../types/visitHistory';
import { MedicationService } from './medicationService';

export class VisitMedicationService {
    /**
     * Get all medications for a specific visit
     */
    static async getVisitMedications(visitId: string): Promise<VisitMedication[]> {
        const { data, error } = await supabase
            .from('visit_medications')
            .select('*')
            .eq('visit_id', visitId)
            .order('medication_name');

        if (error) {
            console.error('Error fetching visit medications:', error);
            return [];
        }

        return (data || []).map(this.mapVisitMedication);
    }

    /**
     * Get medications for multiple visits (batch)
     */
    static async getMedicationsForVisits(visitIds: string[]): Promise<Map<string, VisitMedication[]>> {
        if (visitIds.length === 0) return new Map();

        const { data, error } = await supabase
            .from('visit_medications')
            .select('*')
            .in('visit_id', visitIds)
            .order('medication_name');

        if (error) {
            console.error('Error fetching visit medications batch:', error);
            return new Map();
        }

        // Group by visit_id
        const visitMedsMap = new Map<string, VisitMedication[]>();
        for (const med of data || []) {
            const visitId = med.visit_id;
            if (!visitMedsMap.has(visitId)) {
                visitMedsMap.set(visitId, []);
            }
            visitMedsMap.get(visitId)!.push(this.mapVisitMedication(med));
        }

        return visitMedsMap;
    }

    /**
     * Add a medication to a visit
     */
    static async addMedicationToVisit(
        visitId: string,
        medication: Omit<VisitMedication, 'id' | 'visitId' | 'createdAt'>
    ): Promise<VisitMedication> {
        const { data, error } = await supabase
            .from('visit_medications')
            .insert({
                visit_id: visitId,
                medication_name: medication.medicationName,
                dosage: medication.dosage,
                dosage_unit: medication.dosageUnit,
                frequency: medication.frequency,
                status: medication.status,
                previous_dosage: medication.previousDosage,
                previous_dosage_unit: medication.previousDosageUnit,
                instructions: medication.instructions,
                composition: medication.composition,
                timing: medication.timing,
                duration: medication.duration,
                source: medication.source,
                source_medication_id: medication.sourceMedicationId,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to add medication: ${error.message}`);
        }

        return this.mapVisitMedication(data);
    }

    /**
     * Update a visit medication
     */
    static async updateVisitMedication(
        medicationId: string,
        updates: Partial<Omit<VisitMedication, 'id' | 'visitId' | 'createdAt'>>
    ): Promise<VisitMedication> {
        const updateData: any = {};
        if (updates.medicationName !== undefined) updateData.medication_name = updates.medicationName;
        if (updates.dosage !== undefined) updateData.dosage = updates.dosage;
        if (updates.dosageUnit !== undefined) updateData.dosage_unit = updates.dosageUnit;
        if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.previousDosage !== undefined) updateData.previous_dosage = updates.previousDosage;
        if (updates.previousDosageUnit !== undefined) updateData.previous_dosage_unit = updates.previousDosageUnit;
        if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
        if (updates.composition !== undefined) updateData.composition = updates.composition;
        if (updates.timing !== undefined) updateData.timing = updates.timing;
        if (updates.duration !== undefined) updateData.duration = updates.duration;

        const { data, error } = await supabase
            .from('visit_medications')
            .update(updateData)
            .eq('id', medicationId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update medication: ${error.message}`);
        }

        return this.mapVisitMedication(data);
    }

    /**
     * Delete a medication from a visit
     */
    static async deleteVisitMedication(medicationId: string): Promise<void> {
        const { error } = await supabase
            .from('visit_medications')
            .delete()
            .eq('id', medicationId);

        if (error) {
            throw new Error(`Failed to delete medication: ${error.message}`);
        }
    }

    /**
     * Sync medications from patient's current dashboard to a visit
     * This pulls from enhanced_medications table
     */
    static async syncMedicationsFromDashboard(
        visitId: string,
        patientId: string
    ): Promise<{ added: number; skipped: number }> {
        // Get current active medications from patient dashboard
        const medications = await MedicationService.getMedications(patientId, true);

        // Get existing visit medications to avoid duplicates
        const existingMeds = await this.getVisitMedications(visitId);
        const existingNames = new Set(existingMeds.map(m => m.medicationName.toLowerCase()));

        let added = 0;
        let skipped = 0;

        for (const med of medications) {
            if (existingNames.has(med.name.toLowerCase())) {
                skipped++;
                continue;
            }

            try {
                await this.addMedicationToVisit(visitId, {
                    medicationName: med.name,
                    dosage: med.dosage,
                    dosageUnit: med.dosageUnit,
                    frequency: med.frequency,
                    status: 'unchanged',
                    instructions: med.instructions,
                    source: 'synced',
                    sourceMedicationId: med.id,
                });
                added++;
            } catch (err) {
                console.error(`Failed to sync medication ${med.name}:`, err);
                skipped++;
            }
        }

        return { added, skipped };
    }

    /**
     * Use Gemini AI to extract medications (placeholder for AI integration)
     * This would analyze uploaded documents or summarize patient records
     */
    static async extractMedicationsWithAI(
        visitId: string,
        patientId: string
    ): Promise<{ success: boolean; medications: VisitMedication[]; error?: string }> {
        try {
            // For now, fall back to syncing from dashboard
            // In a full implementation, this would:
            // 1. Gather patient's medical records
            // 2. Send to Gemini for analysis
            // 3. Parse extracted medications
            // 4. Add to visit

            const result = await this.syncMedicationsFromDashboard(visitId, patientId);
            const medications = await this.getVisitMedications(visitId);

            return {
                success: true,
                medications,
            };
        } catch (error: any) {
            return {
                success: false,
                medications: [],
                error: error.message || 'AI extraction failed',
            };
        }
    }

    /**
     * Convert visit medications to MedicationSnapshot format for display
     */
    static toMedicationSnapshots(medications: VisitMedication[]): MedicationSnapshot[] {
        return medications.map(med => ({
            id: med.id,
            name: med.medicationName,
            dosage: med.dosage,
            dosageUnit: med.dosageUnit,
            frequency: med.frequency,
            status: med.status,
            previousDosage: med.previousDosage,
            previousDosageUnit: med.previousDosageUnit,
            instructions: med.instructions,
        }));
    }

    /**
     * Map database record to VisitMedication
     */
    private static mapVisitMedication(data: any): VisitMedication {
        return {
            id: data.id,
            visitId: data.visit_id,
            medicationName: data.medication_name,
            dosage: data.dosage || '',
            dosageUnit: data.dosage_unit || '',
            frequency: data.frequency || '',
            status: (data.status as MedicationChangeStatus) || 'unchanged',
            previousDosage: data.previous_dosage,
            previousDosageUnit: data.previous_dosage_unit,
            instructions: data.instructions,
            composition: data.composition,
            timing: data.timing,
            duration: data.duration,
            source: data.source || 'manual',
            sourceMedicationId: data.source_medication_id,
            createdAt: data.created_at,
        };
    }
}
