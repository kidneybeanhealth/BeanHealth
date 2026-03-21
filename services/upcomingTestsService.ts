// Upcoming Tests Service
// Handles all database operations for upcoming medical tests

import { supabase } from '../lib/supabase';
import { UpcomingTest } from '../types';

export class UpcomingTestsService {
    /**
     * Add a new upcoming test
     */
    static async addUpcomingTest(
        patientId: string,
        testName: string,
        scheduledDate: string,
        location?: string,
        doctorName?: string,
        notes?: string
    ): Promise<UpcomingTest> {
        const { data, error } = await supabase
            .from('upcoming_tests')
            .insert({
                patient_id: patientId,
                test_name: testName,
                scheduled_date: scheduledDate,
                location: location,
                doctor_name: doctorName,
                notes: notes,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding upcoming test:', error);
            throw new Error(`Failed to add upcoming test: ${error.message}`);
        }

        return this.mapToUpcomingTest(data);
    }

    /**
     * Get all upcoming tests for a patient
     */
    static async getUpcomingTests(patientId: string, includeCompleted: boolean = false): Promise<UpcomingTest[]> {
        let query = supabase
            .from('upcoming_tests')
            .select('*')
            .eq('patient_id', patientId)
            .order('scheduled_date', { ascending: true });

        if (!includeCompleted) {
            query = query.eq('completed', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching upcoming tests:', error);
            throw new Error(`Failed to fetch upcoming tests: ${error.message}`);
        }

        return data?.map(this.mapToUpcomingTest) || [];
    }

    /**
     * Mark a test as completed
     */
    static async markTestComplete(testId: string): Promise<UpcomingTest> {
        const { data, error } = await supabase
            .from('upcoming_tests')
            .update({
                completed: true,
                completed_at: new Date().toISOString()
            })
            .eq('id', testId)
            .select()
            .single();

        if (error) {
            console.error('Error marking test as complete:', error);
            throw new Error(`Failed to mark test as complete: ${error.message}`);
        }

        return this.mapToUpcomingTest(data);
    }

    /**
     * Mark a test as incomplete
     */
    static async markTestIncomplete(testId: string): Promise<UpcomingTest> {
        const { data, error } = await supabase
            .from('upcoming_tests')
            .update({
                completed: false,
                completed_at: null
            })
            .eq('id', testId)
            .select()
            .single();

        if (error) {
            console.error('Error marking test as incomplete:', error);
            throw new Error(`Failed to mark test as incomplete: ${error.message}`);
        }

        return this.mapToUpcomingTest(data);
    }

    /**
     * Update an upcoming test
     */
    static async updateUpcomingTest(
        testId: string,
        updates: Partial<UpcomingTest>
    ): Promise<UpcomingTest> {
        const { data, error } = await supabase
            .from('upcoming_tests')
            .update({
                test_name: updates.testName,
                scheduled_date: updates.scheduledDate,
                location: updates.location,
                doctor_name: updates.doctorName,
                notes: updates.notes
            })
            .eq('id', testId)
            .select()
            .single();

        if (error) {
            console.error('Error updating upcoming test:', error);
            throw new Error(`Failed to update upcoming test: ${error.message}`);
        }

        return this.mapToUpcomingTest(data);
    }

    /**
     * Delete an upcoming test
     */
    static async deleteUpcomingTest(testId: string): Promise<void> {
        const { error } = await supabase
            .from('upcoming_tests')
            .delete()
            .eq('id', testId);

        if (error) {
            console.error('Error deleting upcoming test:', error);
            throw new Error(`Failed to delete upcoming test: ${error.message}`);
        }
    }

    /**
     * Get tests scheduled in the next N days
     */
    static async getTestsInNextDays(patientId: string, days: number = 30): Promise<UpcomingTest[]> {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const { data, error } = await supabase
            .from('upcoming_tests')
            .select('*')
            .eq('patient_id', patientId)
            .eq('completed', false)
            .gte('scheduled_date', today.toISOString().split('T')[0])
            .lte('scheduled_date', futureDate.toISOString().split('T')[0])
            .order('scheduled_date', { ascending: true });

        if (error) {
            console.error('Error fetching tests in next days:', error);
            return [];
        }

        return data?.map(this.mapToUpcomingTest) || [];
    }

    /**
     * Get overdue tests (scheduled before today and not completed)
     */
    static async getOverdueTests(patientId: string): Promise<UpcomingTest[]> {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('upcoming_tests')
            .select('*')
            .eq('patient_id', patientId)
            .eq('completed', false)
            .lt('scheduled_date', today)
            .order('scheduled_date', { ascending: true });

        if (error) {
            console.error('Error fetching overdue tests:', error);
            return [];
        }

        return data?.map(this.mapToUpcomingTest) || [];
    }

    /**
     * Map database record to UpcomingTest interface
     */
    private static mapToUpcomingTest(data: any): UpcomingTest {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            testName: data.test_name,
            test_name: data.test_name,
            scheduledDate: data.scheduled_date,
            scheduled_date: data.scheduled_date,
            location: data.location,
            doctorName: data.doctor_name,
            doctor_name: data.doctor_name,
            notes: data.notes,
            completed: data.completed,
            completedAt: data.completed_at,
            completed_at: data.completed_at,
            createdAt: data.created_at,
            created_at: data.created_at,
            updatedAt: data.updated_at,
            updated_at: data.updated_at
        };
    }

    /**
     * Common test names for auto-complete
     */
    static readonly COMMON_TESTS = [
        'Comprehensive Metabolic Panel',
        'Renal Function Test',
        'Kidney Ultrasound',
        'Complete Blood Count (CBC)',
        'Urinalysis',
        'Urine Albumin-to-Creatinine Ratio (ACR)',
        'CT Scan - Kidneys',
        'MRI - Abd',
        'Kidney Biopsy',
        '24-Hour Urine Collection',
        'Electrolyte Panel',
        'Lipid Panel',
        'HbA1c Test',
        'PTH (Parathyroid Hormone)',
        'Vitamin D Level'
    ];
}
