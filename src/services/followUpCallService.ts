import { supabase } from '../lib/supabase';

export type FollowUpOutcome =
    | 'confirmed'
    | 'reschedule_requested'
    | 'no_answer'
    | 'refused'
    | 'hospitalised';

export interface FollowUpCall {
    id: string;
    review_id: string;
    hospital_id: string;
    patient_id: string;
    called_by_name: string;
    called_at: string;
    outcome: FollowUpOutcome;
    notes: string;
    created_at: string;
}

export const OUTCOME_META: Record<
    FollowUpOutcome,
    { label: string; color: string; bg: string; border: string; icon: string }
> = {
    confirmed: {
        label: 'Confirmed',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: '✓',
    },
    reschedule_requested: {
        label: 'Reschedule Requested',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: '↗',
    },
    no_answer: {
        label: 'No Answer',
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        border: 'border-gray-200',
        icon: '✕',
    },
    refused: {
        label: 'Refused',
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: '✕',
    },
    hospitalised: {
        label: 'Hospitalised',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: '⚕',
    },
};

export class FollowUpCallService {
    /**
     * Log a follow-up call for a specific review.
     */
    static async logCall(data: {
        reviewId: string;
        hospitalId: string;
        patientId: string;
        calledByName: string;
        outcome: FollowUpOutcome;
        notes: string;
    }): Promise<FollowUpCall> {
        const { data: row, error } = await (supabase as any)
            .from('patient_follow_up_calls')
            .insert({
                review_id: data.reviewId,
                hospital_id: data.hospitalId,
                patient_id: data.patientId,
                called_by_name: data.calledByName,
                outcome: data.outcome,
                notes: data.notes,
            })
            .select('*')
            .single();

        if (error) throw error;
        return row as FollowUpCall;
    }

    /**
     * Get all calls for a single review, ordered oldest → newest.
     */
    static async getCallsForReview(reviewId: string): Promise<FollowUpCall[]> {
        const { data, error } = await (supabase as any)
            .from('patient_follow_up_calls')
            .select('*')
            .eq('review_id', reviewId)
            .order('called_at', { ascending: true });

        if (error) throw error;
        return (data || []) as FollowUpCall[];
    }

    /**
     * Bulk-fetch the most recent call for each of the given review IDs.
     * Returns a map: reviewId → FollowUpCall (or undefined if never called).
     * Uses a single query — no N+1.
     */
    static async getLastCallForEachReview(
        reviewIds: string[]
    ): Promise<Record<string, FollowUpCall>> {
        if (reviewIds.length === 0) return {};

        const { data, error } = await (supabase as any)
            .from('patient_follow_up_calls')
            .select('*')
            .in('review_id', reviewIds)
            .order('called_at', { ascending: false });

        if (error) throw error;

        const map: Record<string, FollowUpCall> = {};
        for (const row of (data || []) as FollowUpCall[]) {
            // First occurrence per review_id is the latest (ordered DESC)
            if (!map[row.review_id]) {
                map[row.review_id] = row;
            }
        }
        return map;
    }

    /**
     * Get all calls for a list of patient IDs (used by doctor's Follow-up view).
     * Returns a map: patientId → FollowUpCall[] (all calls, oldest first per patient).
     */
    static async getAllCallsForPatients(
        patientIds: string[]
    ): Promise<Record<string, FollowUpCall[]>> {
        if (patientIds.length === 0) return {};

        const { data, error } = await (supabase as any)
            .from('patient_follow_up_calls')
            .select('*')
            .in('patient_id', patientIds)
            .order('called_at', { ascending: false });

        if (error) throw error;

        const map: Record<string, FollowUpCall[]> = {};
        for (const row of (data || []) as FollowUpCall[]) {
            if (!map[row.patient_id]) map[row.patient_id] = [];
            map[row.patient_id].push(row);
        }
        return map;
    }

    /**
     * Delete a call log entry (for data corrections).
     */
    static async deleteCall(callId: string): Promise<void> {
        const { error } = await (supabase as any)
            .from('patient_follow_up_calls')
            .delete()
            .eq('id', callId);

        if (error) throw error;
    }
}
