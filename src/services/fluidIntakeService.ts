// Fluid Intake Service
// Handles all database operations for fluid intake tracking

import { supabase } from '../lib/supabase';
import { FluidIntake } from '../types';

export class FluidIntakeService {
    /**
     * Add a new fluid intake entry
     */
    static async addFluidIntake(
        patientId: string,
        amountMl: number,
        fluidType: string = 'water',
        notes?: string
    ): Promise<FluidIntake> {
        const { data, error } = await supabase
            .from('fluid_intake')
            .insert({
                patient_id: patientId,
                amount_ml: amountMl,
                fluid_type: fluidType,
                notes: notes,
                recorded_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding fluid intake:', error);
            throw new Error(`Failed to add fluid intake: ${error.message}`);
        }

        return this.mapToFluidIntake(data);
    }

    /**
     * Get today's total fluid intake
     */
    static async getTodayIntake(patientId: string): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('fluid_intake')
            .select('amount_ml')
            .eq('patient_id', patientId)
            .gte('recorded_at', today.toISOString());

        if (error) {
            console.error('Error fetching today\'s intake:', error);
            throw new Error(`Failed to fetch today's intake: ${error.message}`);
        }

        if (!data || data.length === 0) {
            return 0;
        }

        return data.reduce((total, entry) => total + entry.amount_ml, 0);
    }

    /**
     * Get fluid intake entries for today
     */
    static async getTodayEntries(patientId: string): Promise<FluidIntake[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('fluid_intake')
            .select('*')
            .eq('patient_id', patientId)
            .gte('recorded_at', today.toISOString())
            .order('recorded_at', { ascending: false });

        if (error) {
            console.error('Error fetching today\'s entries:', error);
            throw new Error(`Failed to fetch today's entries: ${error.message}`);
        }

        return data?.map(this.mapToFluidIntake) || [];
    }

    /**
     * Get fluid intake history for specified number of days
     */
    static async getIntakeHistory(patientId: string, days: number = 7): Promise<FluidIntake[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('fluid_intake')
            .select('*')
            .eq('patient_id', patientId)
            .gte('recorded_at', startDate.toISOString())
            .order('recorded_at', { ascending: false });

        if (error) {
            console.error('Error fetching intake history:', error);
            throw new Error(`Failed to fetch intake history: ${error.message}`);
        }

        return data?.map(this.mapToFluidIntake) || [];
    }

    /**
     * Delete a fluid intake entry
     */
    static async deleteFluidIntake(id: string): Promise<void> {
        const { error } = await supabase
            .from('fluid_intake')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting fluid intake:', error);
            throw new Error(`Failed to delete fluid intake: ${error.message}`);
        }
    }

    /**
     * Update daily fluid target for a patient
     */
    static async updateDailyTarget(patientId: string, targetMl: number): Promise<void> {
        const { error } = await supabase
            .from('users')
            .update({ daily_fluid_target: targetMl })
            .eq('id', patientId);

        if (error) {
            console.error('Error updating daily target:', error);
            throw new Error(`Failed to update daily target: ${error.message}`);
        }
    }

    /**
     * Get daily fluid target for a patient
     */
    static async getDailyTarget(patientId: string): Promise<number> {
        const { data, error } = await supabase
            .from('users')
            .select('daily_fluid_target')
            .eq('id', patientId)
            .single();

        if (error) {
            console.error('Error fetching daily target:', error);
            return 1500; // Default to 1.5L
        }

        return data?.daily_fluid_target || 1500;
    }

    /**
     * Get daily intake totals for the past N days (for charting)
     */
    static async getDailyTotals(patientId: string, days: number = 7): Promise<{ date: string; total: number }[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('fluid_intake')
            .select('amount_ml, recorded_at')
            .eq('patient_id', patientId)
            .gte('recorded_at', startDate.toISOString());

        if (error) {
            console.error('Error fetching daily totals:', error);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Group by date
        const totals = new Map<string, number>();
        data.forEach(entry => {
            const date = new Date(entry.recorded_at).toISOString().split('T')[0];
            totals.set(date, (totals.get(date) || 0) + entry.amount_ml);
        });

        // Convert to array and sort by date
        return Array.from(totals.entries())
            .map(([date, total]) => ({ date, total }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Map database record to FluidIntake interface
     */
    private static mapToFluidIntake(data: any): FluidIntake {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            amountMl: data.amount_ml,
            amount_ml: data.amount_ml,
            fluidType: data.fluid_type,
            fluid_type: data.fluid_type,
            recordedAt: data.recorded_at,
            recorded_at: data.recorded_at,
            notes: data.notes
        };
    }
}
