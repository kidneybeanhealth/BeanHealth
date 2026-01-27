import { supabase } from '../lib/supabase';
import { EnhancedMedication, MedicationAdherenceEntry, MedicationFrequency, ExtractedMedication } from '../types';
import { ALL_PRESET_MEDICATIONS } from '../utils/presetMedications';

// Helper to convert database fields to camelCase
const mapMedicationFromDB = (data: any): EnhancedMedication => ({
    id: data.id,
    patientId: data.patient_id,
    name: data.name,
    dosage: data.dosage,
    dosageUnit: data.dosage_unit,
    frequency: data.frequency as MedicationFrequency,
    scheduledTimes: data.scheduled_times || [],
    instructions: data.instructions,
    category: data.category,
    startDate: data.start_date,
    endDate: data.end_date,
    isActive: data.is_active,
    isCustom: data.is_custom,
    reminderEnabled: data.reminder_enabled,
    source: data.source || 'manual',
    addedByDoctorId: data.added_by_doctor_id,
    sourceRecordId: data.source_record_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
});

const mapAdherenceFromDB = (data: any): MedicationAdherenceEntry => ({
    id: data.id,
    medicationId: data.medication_id,
    patientId: data.patient_id,
    scheduledDate: data.scheduled_date,
    scheduledTime: data.scheduled_time,
    taken: data.taken,
    takenAt: data.taken_at,
    skipped: data.skipped,
    skipReason: data.skip_reason,
    createdAt: data.created_at,
});

export const MedicationService = {
    // ============================================
    // MEDICATION CRUD
    // ============================================

    /**
     * Get all medications for a patient
     */
    async getMedications(patientId: string, activeOnly: boolean = true): Promise<EnhancedMedication[]> {
        let query = supabase
            .from('patient_medications')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching medications:', error);
            throw error;
        }

        return (data || []).map(mapMedicationFromDB);
    },

    /**
     * Add a new medication
     */
    async addMedication(
        patientId: string,
        medication: Omit<EnhancedMedication, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
    ): Promise<EnhancedMedication> {
        const { data, error } = await supabase
            .from('patient_medications')
            .insert({
                patient_id: patientId,
                name: medication.name,
                dosage: medication.dosage,
                dosage_unit: medication.dosageUnit,
                frequency: medication.frequency,
                scheduled_times: medication.scheduledTimes,
                instructions: medication.instructions,
                category: medication.category,
                start_date: medication.startDate,
                end_date: medication.endDate,
                is_active: medication.isActive,
                is_custom: medication.isCustom,
                reminder_enabled: medication.reminderEnabled,
                source: medication.source || 'manual',
                added_by_doctor_id: medication.addedByDoctorId,
                source_record_id: medication.sourceRecordId,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding medication:', error);
            throw error;
        }

        return mapMedicationFromDB(data);
    },

    /**
     * Update a medication
     */
    async updateMedication(
        medicationId: string,
        updates: Partial<Omit<EnhancedMedication, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>>
    ): Promise<EnhancedMedication> {
        const updateData: any = {};

        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.dosage !== undefined) updateData.dosage = updates.dosage;
        if (updates.dosageUnit !== undefined) updateData.dosage_unit = updates.dosageUnit;
        if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
        if (updates.scheduledTimes !== undefined) updateData.scheduled_times = updates.scheduledTimes;
        if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
        if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
        if (updates.reminderEnabled !== undefined) updateData.reminder_enabled = updates.reminderEnabled;

        const { data, error } = await supabase
            .from('patient_medications')
            .update(updateData)
            .eq('id', medicationId)
            .select()
            .single();

        if (error) {
            console.error('Error updating medication:', error);
            throw error;
        }

        return mapMedicationFromDB(data);
    },

    /**
     * Delete a medication (hard delete)
     */
    async deleteMedication(medicationId: string): Promise<void> {
        const { error } = await supabase
            .from('patient_medications')
            .delete()
            .eq('id', medicationId);

        if (error) {
            console.error('Error deleting medication:', error);
            throw error;
        }
    },

    /**
     * Deactivate a medication (soft delete)
     */
    async deactivateMedication(medicationId: string): Promise<void> {
        const { error } = await supabase
            .from('patient_medications')
            .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
            .eq('id', medicationId);

        if (error) {
            console.error('Error deactivating medication:', error);
            throw error;
        }
    },

    // ============================================
    // ADHERENCE TRACKING
    // ============================================

    /**
     * Get today's medication schedule
     */
    async getTodaysSchedule(patientId: string): Promise<{
        medication: EnhancedMedication;
        scheduledTime: string;
        adherence: MedicationAdherenceEntry | null;
    }[]> {
        const today = new Date().toISOString().split('T')[0];

        // Get active medications
        const medications = await this.getMedications(patientId, true);

        // Get today's adherence records
        const { data: adherenceData, error: adherenceError } = await supabase
            .from('medication_adherence')
            .select('*')
            .eq('patient_id', patientId)
            .eq('scheduled_date', today);

        if (adherenceError) {
            console.error('Error fetching adherence:', adherenceError);
        }

        const adherenceMap = new Map<string, MedicationAdherenceEntry>();
        (adherenceData || []).forEach(a => {
            const key = `${a.medication_id}_${a.scheduled_time}`;
            adherenceMap.set(key, mapAdherenceFromDB(a));
        });

        // Build schedule
        const schedule: {
            medication: EnhancedMedication;
            scheduledTime: string;
            adherence: MedicationAdherenceEntry | null;
        }[] = [];

        for (const medication of medications) {
            // Skip 'as_needed' medications in schedule
            if (medication.frequency === 'as_needed') continue;

            for (const time of medication.scheduledTimes) {
                const key = `${medication.id}_${time}:00`;
                schedule.push({
                    medication,
                    scheduledTime: time,
                    adherence: adherenceMap.get(key) || null,
                });
            }
        }

        // Sort by time
        schedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

        return schedule;
    },

    /**
     * Log medication adherence (taken or skipped)
     */
    async logAdherence(
        medicationId: string,
        patientId: string,
        date: string,
        time: string,
        taken: boolean,
        skipReason?: string
    ): Promise<MedicationAdherenceEntry> {
        const { data, error } = await supabase
            .from('medication_adherence')
            .upsert({
                medication_id: medicationId,
                patient_id: patientId,
                scheduled_date: date,
                scheduled_time: time + ':00', // Ensure HH:mm:ss format
                taken: taken,
                taken_at: taken ? new Date().toISOString() : null,
                skipped: !taken,
                skip_reason: !taken ? skipReason : null,
            }, {
                onConflict: 'medication_id,scheduled_date,scheduled_time'
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging adherence:', error);
            throw error;
        }

        return mapAdherenceFromDB(data);
    },

    /**
     * Get adherence statistics for a patient
     */
    async getAdherenceStats(
        patientId: string,
        startDate: string,
        endDate: string
    ): Promise<{
        totalDoses: number;
        takenDoses: number;
        skippedDoses: number;
        adherencePercentage: number;
        byMedication: { [medicationId: string]: { taken: number; skipped: number; total: number } };
    }> {
        const { data, error } = await supabase
            .from('medication_adherence')
            .select('*')
            .eq('patient_id', patientId)
            .gte('scheduled_date', startDate)
            .lte('scheduled_date', endDate);

        if (error) {
            console.error('Error fetching adherence stats:', error);
            throw error;
        }

        const records = data || [];
        const byMedication: { [medicationId: string]: { taken: number; skipped: number; total: number } } = {};

        let takenDoses = 0;
        let skippedDoses = 0;

        for (const record of records) {
            const medId = record.medication_id;
            if (!byMedication[medId]) {
                byMedication[medId] = { taken: 0, skipped: 0, total: 0 };
            }

            byMedication[medId].total++;
            if (record.taken) {
                takenDoses++;
                byMedication[medId].taken++;
            } else if (record.skipped) {
                skippedDoses++;
                byMedication[medId].skipped++;
            }
        }

        const totalDoses = records.length;
        const adherencePercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

        return {
            totalDoses,
            takenDoses,
            skippedDoses,
            adherencePercentage,
            byMedication,
        };
    },

    /**
     * Get adherence history for a specific medication
     */
    async getMedicationAdherenceHistory(
        medicationId: string,
        days: number = 7
    ): Promise<MedicationAdherenceEntry[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('medication_adherence')
            .select('*')
            .eq('medication_id', medicationId)
            .gte('scheduled_date', startDate.toISOString().split('T')[0])
            .lte('scheduled_date', endDate.toISOString().split('T')[0])
            .order('scheduled_date', { ascending: false })
            .order('scheduled_time', { ascending: false });

        if (error) {
            console.error('Error fetching adherence history:', error);
            throw error;
        }

        return (data || []).map(mapAdherenceFromDB);
    },

    // ============================================
    // REMINDERS (Browser Notification API)
    // ============================================

    /**
     * Request notification permission
     */
    async requestNotificationPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    },

    /**
     * Schedule a medication reminder notification
     */
    scheduleReminder(medication: EnhancedMedication, scheduledTime: string): void {
        if (!medication.reminderEnabled) return;

        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const now = new Date();
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);

        // If the time has passed today, don't schedule
        if (reminderTime <= now) return;

        const timeout = reminderTime.getTime() - now.getTime();

        setTimeout(() => {
            if (Notification.permission === 'granted') {
                new Notification('💊 Medication Reminder', {
                    body: `Time to take ${medication.name} (${medication.dosage} ${medication.dosageUnit})`,
                    icon: '/pill-icon.png',
                    tag: `medication-${medication.id}-${scheduledTime}`,
                    requireInteraction: true,
                });
            }
        }, timeout);
    },

    /**
     * Schedule all reminders for today
     */
    async scheduleAllRemindersForToday(patientId: string): Promise<void> {
        const hasPermission = await this.requestNotificationPermission();
        if (!hasPermission) return;

        const schedule = await this.getTodaysSchedule(patientId);

        for (const item of schedule) {
            if (!item.adherence?.taken) {
                this.scheduleReminder(item.medication, item.scheduledTime);
            }
        }

        console.log(`Scheduled ${schedule.length} medication reminders for today`);
    },

    // ============================================
    // DOCTOR PRESCRIPTIONS & AI EXTRACTION
    // ============================================

    /**
     * Add medication as a doctor for a patient
     */
    async addMedicationAsDoctor(
        doctorId: string,
        patientId: string,
        medication: Omit<EnhancedMedication, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
    ): Promise<EnhancedMedication> {
        return this.addMedication(patientId, {
            ...medication,
            source: 'doctor_prescribed',
            addedByDoctorId: doctorId,
        });
    },

    /**
     * Get medications by source record
     */
    async getMedicationsByRecord(recordId: string): Promise<EnhancedMedication[]> {
        const { data, error } = await supabase
            .from('patient_medications')
            .select('*')
            .eq('source_record_id', recordId);

        if (error) {
            console.error('Error fetching medications by record:', error);
            throw error;
        }

        return (data || []).map(mapMedicationFromDB);
    },

    /**
     * Check if medication already exists for patient (by name)
     */
    async medicationExists(patientId: string, medicationName: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('patient_medications')
            .select('id')
            .eq('patient_id', patientId)
            .ilike('name', medicationName)
            .eq('is_active', true)
            .limit(1);

        if (error) {
            console.error('Error checking medication existence:', error);
            return false;
        }

        return (data?.length || 0) > 0;
    },

    /**
     * Match extracted medication to preset or create custom
     */
    matchToPreset(extracted: ExtractedMedication): Partial<EnhancedMedication> {
        // Try to find a matching preset
        const normalizedName = extracted.name.toLowerCase().trim();
        const preset = ALL_PRESET_MEDICATIONS.find(p =>
            p.name.toLowerCase() === normalizedName ||
            p.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(p.name.toLowerCase())
        );

        if (preset) {
            return {
                name: preset.name,
                dosage: extracted.dosage || preset.defaultDosage,
                dosageUnit: extracted.unit || preset.defaultUnit,
                category: preset.category,
                isCustom: false,
            };
        }

        // No preset match, create as custom
        return {
            name: extracted.name,
            dosage: extracted.dosage,
            dosageUnit: extracted.unit || 'mg',
            isCustom: true,
        };
    },

    /**
     * Convert extracted medications to EnhancedMedication format
     * Returns medications that can be reviewed before adding
     */
    prepareExtractedMedications(
        extractedMeds: ExtractedMedication[],
        sourceRecordId: string
    ): Partial<EnhancedMedication>[] {
        return extractedMeds.map(extracted => {
            const matched = this.matchToPreset(extracted);

            // Map frequency if provided
            let frequency: MedicationFrequency = 'once_daily';
            if (extracted.frequency) {
                const freqLower = extracted.frequency.toLowerCase();
                if (freqLower.includes('twice') || freqLower.includes('bid') || freqLower.includes('2x')) {
                    frequency = 'twice_daily';
                } else if (freqLower.includes('three') || freqLower.includes('tid') || freqLower.includes('3x')) {
                    frequency = 'three_times_daily';
                } else if (freqLower.includes('four') || freqLower.includes('qid') || freqLower.includes('4x')) {
                    frequency = 'four_times_daily';
                } else if (freqLower.includes('need') || freqLower.includes('prn')) {
                    frequency = 'as_needed';
                } else if (freqLower.includes('week')) {
                    frequency = 'weekly';
                }
            }

            return {
                ...matched,
                frequency,
                instructions: extracted.instructions,
                source: 'ai_extracted' as const,
                sourceRecordId,
                isActive: true,
                reminderEnabled: true,
                startDate: new Date().toISOString().split('T')[0],
            };
        });
    },

    /**
     * Add multiple AI-extracted medications (after user review)
     */
    async addExtractedMedications(
        patientId: string,
        medications: Partial<EnhancedMedication>[],
        sourceRecordId: string
    ): Promise<{ added: EnhancedMedication[]; skipped: string[] }> {
        const added: EnhancedMedication[] = [];
        const skipped: string[] = [];

        for (const med of medications) {
            if (!med.name) continue;

            // Check if medication already exists
            const exists = await this.medicationExists(patientId, med.name);
            if (exists) {
                skipped.push(med.name);
                continue;
            }

            try {
                const newMed = await this.addMedication(patientId, {
                    name: med.name,
                    dosage: med.dosage || '',
                    dosageUnit: med.dosageUnit || 'mg',
                    frequency: med.frequency || 'once_daily',
                    scheduledTimes: ['08:00'],
                    instructions: med.instructions,
                    category: med.category,
                    startDate: med.startDate,
                    isActive: true,
                    isCustom: med.isCustom ?? true,
                    reminderEnabled: true,
                    source: 'ai_extracted',
                    sourceRecordId,
                });
                added.push(newMed);
            } catch (error) {
                console.error(`Error adding medication ${med.name}:`, error);
                skipped.push(med.name);
            }
        }

        return { added, skipped };
    },
};
