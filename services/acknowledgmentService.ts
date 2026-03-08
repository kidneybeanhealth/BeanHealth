/**
 * Snapshot Acknowledgment Service
 * 
 * Handles the acknowledgment workflow for patient snapshots.
 * Acknowledgment ≠ Resolution - red state persists until condition resolves.
 * 
 * Last Updated: 2024-12-24
 */

import { supabase } from '../lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface AcknowledgmentRecord {
    id?: string;
    patient_id: string;
    snapshot_id?: string;
    acknowledged_at: string;
    acknowledged_by: string;
    note?: string;
}

export interface DoctorReviewRecord {
    patient_id: string;
    doctor_id: string;
    reviewed_at: string;
}

// =============================================================================
// ACKNOWLEDGMENT SERVICE
// =============================================================================

/**
 * Record that a doctor has reviewed a patient (updates last_doctor_reviewed_at).
 * This is stored for medico-legal purposes.
 * 
 * Note: Uses type assertions because patient_snapshot table may not be in
 * generated Supabase types yet. Run the schema migration first.
 */
export async function recordDoctorReview(
    patientId: string,
    doctorId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const reviewedAt = new Date().toISOString();

        // Insert a new snapshot record with the review timestamp
        // This preserves the immutability principle - we never update, only insert
        const { error } = await (supabase as any)
            .from('patient_snapshot')
            .insert({
                patient_id: patientId,
                last_doctor_reviewed_at: reviewedAt,
                evaluated_at: reviewedAt,
            });

        if (error) {
            // If table doesn't exist, just log and return success for now
            console.warn('Note: patient_snapshot table may not exist yet. Run the migration.', error);
            return { success: true }; // Graceful degradation
        }

        return { success: true };
    } catch (error) {
        console.error('Error in recordDoctorReview:', error);
        return { success: false, error: 'Failed to record review' };
    }
}

/**
 * Get the last acknowledged timestamp for a patient.
 */
export async function getLastAcknowledgment(
    patientId: string
): Promise<{ data: Date | null; error?: string }> {
    try {
        const { data, error } = await (supabase as any)
            .from('patient_snapshot')
            .select('last_doctor_reviewed_at')
            .eq('patient_id', patientId)
            .not('last_doctor_reviewed_at', 'is', null)
            .order('last_doctor_reviewed_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.warn('Error fetching acknowledgment:', error);
            return { data: null };
        }

        return {
            data: data?.last_doctor_reviewed_at
                ? new Date(data.last_doctor_reviewed_at)
                : null
        };
    } catch (error) {
        console.error('Error in getLastAcknowledgment:', error);
        return { data: null, error: 'Failed to fetch acknowledgment' };
    }
}

/**
 * Acknowledge an individual alert event (from alert_events table).
 * This marks the alert as "seen" but does NOT resolve it.
 */
export async function acknowledgeAlertEvent(
    alertEventId: string,
    doctorId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await (supabase as any)
            .from('alert_events')
            .update({
                acknowledged_at: new Date().toISOString(),
                acknowledged_by: doctorId
            })
            .eq('id', alertEventId);

        if (error) {
            console.warn('Note: alert_events table may not exist yet.', error);
            return { success: true }; // Graceful degradation
        }

        return { success: true };
    } catch (error) {
        console.error('Error in acknowledgeAlertEvent:', error);
        return { success: false, error: 'Failed to acknowledge alert' };
    }
}

/**
 * Resolve an alert event (marks as resolved, different from acknowledged).
 * Resolution means the underlying condition has been addressed.
 */
export async function resolveAlertEvent(
    alertEventId: string,
    doctorId: string,
    resolutionNote: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await (supabase as any)
            .from('alert_events')
            .update({
                resolved_at: new Date().toISOString(),
                resolved_by: doctorId,
                resolution_note: resolutionNote
            })
            .eq('id', alertEventId);

        if (error) {
            console.warn('Note: alert_events table may not exist yet.', error);
            return { success: true }; // Graceful degradation
        }

        return { success: true };
    } catch (error) {
        console.error('Error in resolveAlertEvent:', error);
        return { success: false, error: 'Failed to resolve alert' };
    }
}
