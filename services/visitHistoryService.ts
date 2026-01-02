// Visit History Service - Updated
// Now uses dedicated patient_visits table instead of aggregating from prescriptions
// Includes full history access via getAllPatientVisits()

import { supabase } from '../lib/supabase';
import { LabResult, LabTestType } from '../types';
import {
    VisitRecord,
    LabTrendData,
    LabTrendPoint,
    VISIT_COLORS,
} from '../types/visitHistory';

// Lab test display names
const LAB_DISPLAY_NAMES: Record<string, string> = {
    creatinine: 'Creatinine',
    egfr: 'eGFR',
    bun: 'BUN',
    potassium: 'Potassium',
    hemoglobin: 'Hemoglobin',
    bicarbonate: 'Bicarbonate',
    acr: 'ACR',
};

// Lab line colors for graph
const LAB_LINE_COLORS: Record<string, string> = {
    creatinine: '#EF4444',
    egfr: '#3B82F6',
    bun: '#8B5CF6',
    potassium: '#F59E0B',
    hemoglobin: '#EC4899',
    bicarbonate: '#06B6D4',
    acr: '#84CC16',
};

// Reference ranges
const REFERENCE_RANGES: Record<string, { min: number; max: number }> = {
    creatinine: { min: 0.7, max: 1.3 },
    egfr: { min: 60, max: 120 },
    bun: { min: 7, max: 20 },
    potassium: { min: 3.5, max: 5.0 },
    hemoglobin: { min: 12.0, max: 16.0 },
    bicarbonate: { min: 22, max: 29 },
    acr: { min: 0, max: 30 },
};

// Interface for scratchpad-style visit
export interface PatientVisit {
    id: string;
    patientId: string;
    patient_id?: string;
    doctorId: string;
    doctor_id?: string;
    visitDate: string;
    visit_date?: string;
    complaint: string;
    observations: string;
    dietRecommendation: string;
    diet_recommendation?: string;
    notes: string;
    isVisibleToPatient: boolean;
    is_visible_to_patient?: boolean;
    createdAt: string;
    created_at?: string;
    doctorName?: string;
}

export class VisitHistoryService {
    /**
     * Get patient visits from the patient_visits table
     * Falls back to prescription-derived visits if table is empty
     */
    static async getPatientVisits(patientId: string, limit: number = 3): Promise<VisitRecord[]> {
        console.log('[VisitHistoryService] Fetching visits for patient:', patientId);

        // Try to fetch from patient_visits table first
        const { data: storedVisits, error: visitError } = await supabase
            .from('patient_visits')
            .select(`
                *,
                doctor:doctor_id (name)
            `)
            .eq('patient_id', patientId)
            .order('visit_date', { ascending: false })
            .limit(limit);

        if (!visitError && storedVisits && storedVisits.length > 0) {
            console.log('[VisitHistoryService] Found stored visits:', storedVisits.length);
            return this.mapStoredVisitsToRecords(storedVisits, patientId, limit);
        }

        // Fallback: derive from prescriptions (for backwards compatibility)
        console.log('[VisitHistoryService] No stored visits, falling back to prescription-derived');
        return this.getVisitsFromPrescriptions(patientId, limit);
    }

    /**
     * Get ALL patient visits (for View All modal)
     */
    static async getAllPatientVisits(patientId: string): Promise<VisitRecord[]> {
        console.log('[VisitHistoryService] Fetching ALL visits for patient:', patientId);

        const { data: storedVisits, error } = await supabase
            .from('patient_visits')
            .select(`
                *,
                doctor:doctor_id (name)
            `)
            .eq('patient_id', patientId)
            .order('visit_date', { ascending: false });

        if (error) {
            console.error('Error fetching all visits:', error);
            return [];
        }

        if (!storedVisits || storedVisits.length === 0) {
            // Fallback to prescriptions
            return this.getVisitsFromPrescriptions(patientId, 100);
        }

        return this.mapStoredVisitsToRecords(storedVisits, patientId, storedVisits.length);
    }

    /**
     * Get total visit count for pagination info
     */
    static async getVisitCount(patientId: string): Promise<number> {
        const { count, error } = await supabase
            .from('patient_visits')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', patientId);

        if (error) {
            console.error('Error getting visit count:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * Create a new visit record
     */
    static async createVisit(
        patientId: string,
        doctorId: string,
        data: {
            visitDate?: string;
            complaint?: string;
            observations?: string;
            dietRecommendation?: string;
            notes?: string;
            isVisibleToPatient?: boolean;
        }
    ): Promise<PatientVisit> {
        const { data: visit, error } = await supabase
            .from('patient_visits')
            .insert({
                patient_id: patientId,
                doctor_id: doctorId,
                visit_date: data.visitDate || new Date().toISOString().split('T')[0],
                complaint: data.complaint || '',
                observations: data.observations || '',
                diet_recommendation: data.dietRecommendation || '',
                notes: data.notes || '',
                is_visible_to_patient: data.isVisibleToPatient ?? true,
            })
            .select(`
                *,
                doctor:doctor_id (name)
            `)
            .single();

        if (error) {
            console.error('Error creating visit:', error);
            throw new Error(`Failed to create visit: ${error.message}`);
        }

        return this.mapPatientVisit(visit);
    }

    /**
     * Update an existing visit
     */
    static async updateVisit(
        visitId: string,
        updates: Partial<{
            complaint: string;
            observations: string;
            dietRecommendation: string;
            notes: string;
            isVisibleToPatient: boolean;
        }>
    ): Promise<PatientVisit> {
        const updateData: any = {};
        if (updates.complaint !== undefined) updateData.complaint = updates.complaint;
        if (updates.observations !== undefined) updateData.observations = updates.observations;
        if (updates.dietRecommendation !== undefined) updateData.diet_recommendation = updates.dietRecommendation;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.isVisibleToPatient !== undefined) updateData.is_visible_to_patient = updates.isVisibleToPatient;

        const { data, error } = await supabase
            .from('patient_visits')
            .update(updateData)
            .eq('id', visitId)
            .select(`
                *,
                doctor:doctor_id (name)
            `)
            .single();

        if (error) {
            console.error('Error updating visit:', error);
            throw new Error(`Failed to update visit: ${error.message}`);
        }

        return this.mapPatientVisit(data);
    }

    /**
     * Map stored visits to VisitRecord format for display
     */
    private static async mapStoredVisitsToRecords(
        storedVisits: any[],
        patientId: string,
        limit: number
    ): Promise<VisitRecord[]> {
        const visits: VisitRecord[] = [];
        const colorKeys: Array<keyof typeof VISIT_COLORS> = ['visit1', 'visit2', 'visit3'];

        // Fetch lab results for all visit dates
        const { data: labResults } = await supabase
            .from('lab_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('test_date', { ascending: false });

        // Reverse for chronological display (oldest first)
        const reversedVisits = [...storedVisits].reverse();

        for (let i = 0; i < Math.min(reversedVisits.length, limit); i++) {
            const visit = reversedVisits[i];
            const visitDate = visit.visit_date;
            const colorKey = colorKeys[i % 3] || 'visit1';
            const colors = VISIT_COLORS[colorKey];

            // Get labs within 7 days of visit
            const visitLabs = (labResults || []).filter(lab => {
                const labDate = new Date(lab.test_date);
                const vDate = new Date(visitDate);
                const diffDays = Math.abs((labDate.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
            }).map(this.mapLabResult);

            const abnormalLabs = visitLabs.filter(lab =>
                lab.status === 'abnormal' || lab.status === 'critical'
            );

            visits.push({
                id: visit.id,
                visitDate,
                visitNumber: i + 1,
                color: colors.primary,
                colorClass: colors.bg + ' ' + colors.border,
                complaint: visit.complaint || 'Follow-up visit',
                medications: [], // No longer tracking medications in visits
                dietRecommendation: visit.diet_recommendation || 'Not specified',
                dietFollowed: null,
                labResults: visitLabs,
                abnormalLabs,
                prescribedBy: visit.doctor?.name || 'Unknown',
                notes: visit.notes,
            });
        }

        return visits;
    }

    /**
     * Fallback: Get visits from prescriptions (backwards compatibility)
     */
    private static async getVisitsFromPrescriptions(patientId: string, limit: number): Promise<VisitRecord[]> {
        const visits: VisitRecord[] = [];

        const { data: prescriptions, error: rxError } = await supabase
            .from('prescriptions')
            .select(`
                *,
                users:doctor_id (name)
            `)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (rxError || !prescriptions || prescriptions.length === 0) {
            // Try lab results as visit markers
            return this.getVisitsFromLabResults(patientId, limit);
        }

        const { data: labResults } = await supabase
            .from('lab_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('test_date', { ascending: false });

        const { data: caseDetails } = await supabase
            .from('patient_case_details')
            .select('*')
            .eq('patient_id', patientId)
            .single();

        const colorKeys: Array<keyof typeof VISIT_COLORS> = ['visit3', 'visit2', 'visit1'];

        for (let i = 0; i < Math.min(prescriptions.length, limit); i++) {
            const rx = prescriptions[i] as any;
            const visitDate = new Date(rx.created_at).toISOString().split('T')[0];
            const colorKey = colorKeys[i] || 'visit1';
            const colors = VISIT_COLORS[colorKey];

            const visitLabs = (labResults || []).filter(lab => {
                const labDate = new Date(lab.test_date);
                const rxDate = new Date(rx.created_at);
                const diffDays = Math.abs((labDate.getTime() - rxDate.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
            }).map(this.mapLabResult);

            const abnormalLabs = visitLabs.filter(lab =>
                lab.status === 'abnormal' || lab.status === 'critical'
            );

            visits.push({
                id: rx.id,
                visitDate,
                visitNumber: limit - i,
                color: colors.primary,
                colorClass: colors.bg + ' ' + colors.border,
                complaint: caseDetails?.latest_complaint || 'Follow-up visit',
                medications: [],
                dietRecommendation: 'Not specified',
                dietFollowed: null,
                labResults: visitLabs,
                abnormalLabs,
                prescribedBy: rx.users?.name || 'Unknown',
                notes: rx.notes,
            });
        }

        return visits.reverse();
    }

    /**
     * Get visits from lab result dates
     */
    private static async getVisitsFromLabResults(patientId: string, limit: number): Promise<VisitRecord[]> {
        const visits: VisitRecord[] = [];

        const { data: labResults } = await supabase
            .from('lab_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('test_date', { ascending: false });

        if (!labResults || labResults.length === 0) return [];

        const { data: caseDetails } = await supabase
            .from('patient_case_details')
            .select('*')
            .eq('patient_id', patientId)
            .single();

        const uniqueDates = [...new Set(labResults.map(lab => lab.test_date))].slice(0, limit);
        const colorKeys: Array<keyof typeof VISIT_COLORS> = ['visit3', 'visit2', 'visit1'];

        for (let i = 0; i < uniqueDates.length; i++) {
            const visitDate = uniqueDates[i];
            const colorKey = colorKeys[i] || 'visit1';
            const colors = VISIT_COLORS[colorKey];

            const visitLabs = labResults
                .filter(lab => lab.test_date === visitDate)
                .map(this.mapLabResult);

            const abnormalLabs = visitLabs.filter(lab =>
                lab.status === 'abnormal' || lab.status === 'critical'
            );

            visits.push({
                id: `lab-visit-${visitDate}`,
                visitDate,
                visitNumber: uniqueDates.length - i,
                color: colors.primary,
                colorClass: colors.bg + ' ' + colors.border,
                complaint: caseDetails?.latest_complaint || 'Lab work visit',
                medications: [],
                dietRecommendation: 'Not specified',
                dietFollowed: null,
                labResults: visitLabs,
                abnormalLabs,
                prescribedBy: 'Unknown',
                notes: 'Visit derived from lab results',
            });
        }

        return visits.reverse();
    }

    /**
     * Get lab trend data across all visits
     */
    static async getLabTrendsAcrossVisits(
        patientId: string,
        visits: VisitRecord[]
    ): Promise<LabTrendData[]> {
        const trends: LabTrendData[] = [];
        const testTypes: LabTestType[] = ['creatinine', 'egfr', 'bun', 'potassium', 'hemoglobin', 'bicarbonate'];

        const { data: allLabs, error } = await supabase
            .from('lab_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('test_date', { ascending: true });

        if (error) {
            console.error('Error fetching lab trends:', error);
            return [];
        }

        for (const testType of testTypes) {
            const labsForType = (allLabs || []).filter(lab => lab.test_type === testType);

            if (labsForType.length === 0) continue;

            const dataPoints: LabTrendPoint[] = labsForType.map(lab => {
                const visitIndex = visits.findIndex(v => {
                    const labDate = new Date(lab.test_date);
                    const visitDate = new Date(v.visitDate);
                    const diffDays = Math.abs((labDate.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays <= 7;
                });

                return {
                    date: lab.test_date,
                    value: parseFloat(lab.value),
                    visitIndex: visitIndex >= 0 ? visitIndex : -1,
                    status: lab.status as 'normal' | 'borderline' | 'abnormal' | 'critical',
                };
            });

            const range = REFERENCE_RANGES[testType] || { min: 0, max: 100 };

            trends.push({
                testType,
                displayName: LAB_DISPLAY_NAMES[testType] || testType,
                dataPoints,
                unit: labsForType[0]?.unit || '',
                referenceMin: range.min,
                referenceMax: range.max,
                color: LAB_LINE_COLORS[testType] || '#6B7280',
            });
        }

        return trends;
    }

    /**
     * Map database record to PatientVisit
     */
    private static mapPatientVisit(data: any): PatientVisit {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            doctorId: data.doctor_id,
            doctor_id: data.doctor_id,
            visitDate: data.visit_date,
            visit_date: data.visit_date,
            complaint: data.complaint || '',
            observations: data.observations || '',
            dietRecommendation: data.diet_recommendation || '',
            diet_recommendation: data.diet_recommendation,
            notes: data.notes || '',
            isVisibleToPatient: data.is_visible_to_patient,
            is_visible_to_patient: data.is_visible_to_patient,
            createdAt: data.created_at,
            created_at: data.created_at,
            doctorName: data.doctor?.name || 'Unknown Doctor',
        };
    }

    /**
     * Map database lab result to typed LabResult
     */
    private static mapLabResult(data: any): LabResult {
        return {
            id: data.id,
            patientId: data.patient_id,
            testType: data.test_type,
            value: parseFloat(data.value),
            unit: data.unit,
            referenceRangeMin: data.reference_range_min,
            referenceRangeMax: data.reference_range_max,
            status: data.status,
            testDate: data.test_date,
            labName: data.lab_name,
            notes: data.notes,
            createdAt: data.created_at,
        };
    }
}
