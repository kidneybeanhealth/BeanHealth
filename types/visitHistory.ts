// Visit History Types
// Used for displaying past visit data to doctors

import { LabTestType, LabResult, EnhancedMedication } from './index';

// Status of medication changes between visits
export type MedicationChangeStatus = 'added' | 'removed' | 'dosage_increased' | 'dosage_decreased' | 'unchanged';

// Snapshot of a medication at a specific visit
export interface MedicationSnapshot {
    id: string;
    name: string;
    dosage: string;
    dosageUnit: string;
    frequency: string;
    status: MedicationChangeStatus;
    previousDosage?: string; // For dosage changes
    previousDosageUnit?: string;
    instructions?: string;
}

// A single visit record
export interface VisitRecord {
    id: string;
    visitDate: string;
    visitNumber: number; // 1 = oldest, 3 = most recent
    color: string; // For UI consistency
    colorClass: string; // Tailwind classes
    complaint: string;
    medications: MedicationSnapshot[];
    dietRecommendation: string;
    dietFollowed: boolean | null; // null = unknown
    labResults: LabResult[];
    abnormalLabs: LabResult[]; // Labs outside normal range
    prescribedBy: string;
    notes?: string;
}

// A single data point for lab trend graphs
export interface LabTrendPoint {
    date: string;
    value: number;
    visitIndex: number; // 0, 1, 2 for visit 1, 2, 3
    status: 'normal' | 'borderline' | 'abnormal' | 'critical';
}

// Lab trend data for a specific test type
export interface LabTrendData {
    testType: LabTestType;
    displayName: string;
    dataPoints: LabTrendPoint[];
    unit: string;
    referenceMin: number;
    referenceMax: number;
    color: string; // Line color in graph
}

// Visit colors configuration
export const VISIT_COLORS = {
    visit1: {
        primary: '#60A5FA', // Blue
        light: 'rgba(96, 165, 250, 0.1)',
        border: 'border-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    },
    visit2: {
        primary: '#F59E0B', // Amber
        light: 'rgba(245, 158, 11, 0.1)',
        border: 'border-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    },
    visit3: {
        primary: '#10B981', // Emerald
        light: 'rgba(16, 185, 129, 0.1)',
        border: 'border-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    },
} as const;

// Doctor action for current visit
export interface DoctorVisitAction {
    complaint: string;
    medicationActions: MedicationAction[];
    dietRecommendation: string;
    labOrders: string[];
    notes: string;
}

export interface MedicationAction {
    type: 'add' | 'modify' | 'stop';
    medicationId?: string; // For modify/stop
    medicationName: string;
    newDosage?: string;
    newDosageUnit?: string;
    newFrequency?: string;
    reason?: string;
}

// Props for components
export interface PatientVisitHistoryViewProps {
    patientId: string;
    patientMedications: EnhancedMedication[];
    onVisitSaved?: () => void;
}

export interface VisitCardProps {
    visit: VisitRecord;
    showConnectionArrow?: boolean;
}

export interface LabTrendGraphProps {
    trends: LabTrendData[];
    visits: VisitRecord[];
}

export interface DoctorActionPanelProps {
    patientId: string;
    currentMedications: EnhancedMedication[];
    onSave: (action: DoctorVisitAction) => void;
    isSaving: boolean;
}
