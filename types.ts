export type View = 'dashboard' | 'records' | 'upload' | 'messages' | 'billing' | 'doctors';

export type UserRole = 'patient' | 'doctor';

export type AuthView = 'chooser' | 'patient-login' | 'doctor-login';

export type DoctorPortalView = 'dashboard' | 'messages';

export type SubscriptionTier = 'FreeTrial' | 'Paid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  avatar_url?: string; // Database field name
  specialty?: string;
  dateOfBirth?: string;
  date_of_birth?: string; // Database field name
  condition?: string;
  subscriptionTier?: SubscriptionTier;
  subscription_tier?: string; // Database field name
  urgentCredits?: number;
  urgent_credits?: number; // Database field name
  trialEndsAt?: string;
  trial_ends_at?: string; // Database field name
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Vital {
  value: string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'borderline' | 'abnormal' | 'critical'; // CKD status indicator
}

export interface Vitals {
  bloodPressure: Vital;
  heartRate: Vital;
  temperature: Vital;
  glucose?: Vital;
  spo2?: Vital; // NEW: SpO2 (oxygen saturation)
  weight?: Vital; // NEW: Weight tracking for fluid status
}


export interface VitalsRecord {
  date: string;
  vitals: Vitals;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
}

export interface MedicalRecord {
  id: string;
  patientId?: string; // Optional for existing records, required for new ones
  date: string;
  type: string;
  summary: string;
  doctor: string;
  category: string; // User-defined category
  fileUrl?: string; // URL to the file in a secure storage (e.g., GCS)
}

export interface Doctor extends User {
  role: 'doctor';
  specialty: string;
}

export interface ChatMessage {
  id: string;
  senderId: string; // Can be patient's ID or doctor's ID
  recipientId: string;
  timestamp: string;
  text?: string;
  audioUrl?: string;
  isRead?: boolean;
  isUrgent?: boolean;
  // File upload support
  fileUrl?: string;
  fileName?: string;
  fileType?: 'pdf' | 'image' | 'audio';
  fileSize?: number;
  mimeType?: string;
}

export interface Patient extends User {
  role: 'patient';
  dateOfBirth: string;
  condition: string;
  vitals: Vitals;
  vitalsHistory: VitalsRecord[];
  medications: Medication[];
  records: MedicalRecord[];
  doctors: Doctor[];
  chatMessages: ChatMessage[];
  subscriptionTier: SubscriptionTier;
  urgentCredits: number;
  trialEndsAt?: string; // ISO Date string
  notes?: string;
}

// Prescription related types
export interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  timing?: string; // e.g., "Morning", "After meals", etc.
}

export type PrescriptionStatus = 'active' | 'completed' | 'cancelled';

export interface Prescription {
  id: string;
  doctorId: string;
  doctor_id?: string; // Database field name
  patientId: string;
  patient_id?: string; // Database field name
  medications: PrescriptionMedication[];
  notes?: string;
  status: PrescriptionStatus;
  createdAt: string;
  created_at?: string; // Database field name
  updatedAt?: string;
  updated_at?: string; // Database field name
  // Populated fields (from joins)
  doctorName?: string;
  patientName?: string;
  doctorSpecialty?: string;
}

// ============================================
// CKD-SPECIFIC TYPES
// ============================================

export type CKDStage = '1' | '2' | '3a' | '3b' | '4' | '5';

export type VitalStatus = 'normal' | 'borderline' | 'abnormal' | 'critical';

export type LabTestType = 'creatinine' | 'egfr' | 'bun' | 'potassium' | 'hemoglobin' | 'bicarbonate' | 'acr';

export interface FluidIntake {
  id: string;
  patientId: string;
  patient_id?: string; // Database field
  amountMl: number;
  amount_ml?: number; // Database field
  fluidType: string;
  fluid_type?: string; // Database field
  recordedAt: string;
  recorded_at?: string; // Database field
  notes?: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  patient_id?: string; // Database field
  testType: LabTestType;
  test_type?: LabTestType; // Database field
  value: number;
  unit: string;
  referenceRangeMin?: number;
  reference_range_min?: number; // Database field
  referenceRangeMax?: number;
  reference_range_max?: number; // Database field
  status: VitalStatus;
  testDate: string;
  test_date?: string; // Database field
  labName?: string;
  lab_name?: string; // Database field
  notes?: string;
  createdAt?: string;
  created_at?: string; // Database field
}

export interface UpcomingTest {
  id: string;
  patientId: string;
  patient_id?: string; // Database field
  testName: string;
  test_name?: string; // Database field
  scheduledDate: string;
  scheduled_date?: string; // Database field
  location?: string;
  doctorName?: string;
  doctor_name?: string; // Database field
  notes?: string;
  completed: boolean;
  completedAt?: string;
  completed_at?: string; // Database field
  createdAt?: string;
  created_at?: string; // Database field
  updatedAt?: string;
  updated_at?: string; // Database field
}

// Extended User interface with CKD fields
export interface CKDPatientProfile {
  age?: number;
  ckdStage?: CKDStage;
  ckd_stage?: CKDStage; // Database field
  comorbidities?: string[];
  baselineWeight?: number;
  baseline_weight?: number; // Database field
  dailyFluidTarget?: number; // in ml
  daily_fluid_target?: number; // Database field
}

// Comorbidity options (pre-populated)
export const HIGH_PRIORITY_COMORBIDITIES = [
  'Hypertension',
  'Type 2 Diabetes Mellitus',
  'Cardiovascular disease',
  'Heart Failure',
  'Coronary Artery Disease',
  'Dyslipidemia',
  'Anemia of CKD',
  'Metabolic acidosis',
  'Obesity',
  'Proteinuria',
  'History of Acute Kidney Injury (AKI)',
] as const;

export const MEDICATION_RELATED_COMORBIDITIES = [
  'Use of ACE inhibitors / ARBs',
  'Use of MRAs (spironolactone, eplerenone)',
  'NSAID use',
  'Diuretics (loop / thiazide)',
  'SGLT2 inhibitors',
] as const;

export const OPTIONAL_COMORBIDITIES = [
  'Peripheral vascular disease',
  'Stroke',
  'Chronic liver disease',
  'COPD',
  'Hypothyroidism',
  'Autoimmune kidney disorders (IgA nephropathy, lupus nephritis)',
] as const;