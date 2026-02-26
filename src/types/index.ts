export type View = 'dashboard' | 'records' | 'upload' | 'messages' | 'billing' | 'doctors';

export type UserRole = 'patient' | 'doctor' | 'admin' | 'enterprise';

export type AuthView = 'chooser' | 'patient-login' | 'doctor-login' | 'admin-login' | 'enterprise-login';

export type DoctorPortalView = 'dashboard' | 'messages';

export type SubscriptionTier = 'FreeTrial' | 'Paid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  patientId?: string; // User-friendly patient ID (e.g., P-20231217-XXXX)
  patient_id?: string; // Database field name
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
  hospital_id?: string; // Enterprise: which hospital this user belongs to
  created_at?: string;
  updated_at?: string;
  referralCode?: string;
  referral_code?: string; // Database field name
  // Terms and Conditions acceptance fields
  termsAccepted?: boolean;
  terms_accepted?: boolean; // Database field name
  termsAcceptedAt?: string;
  terms_accepted_at?: string; // Database field name
  termsVersion?: string;
  terms_version?: string; // Database field name
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
  audioDuration?: number; // Duration in seconds for voice messages
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

// Core lab test type codes (system defaults)
export type SystemLabTestType = 'creatinine' | 'egfr' | 'bun' | 'potassium' | 'hemoglobin' | 'bicarbonate' | 'acr';

// Extended to support custom lab types (can be any string code)
export type LabTestType = SystemLabTestType | string;

// Custom Lab Type interface (admin-managed)
export interface CustomLabType {
  id: string;
  name: string;                          // Display name (e.g., "Phosphorus")
  code: string;                          // Internal code (e.g., "phosphorus")
  unit: string;                          // Unit of measurement
  referenceRangeMin?: number;
  reference_range_min?: number;          // Database field
  referenceRangeMax?: number;
  reference_range_max?: number;          // Database field
  category: 'system' | 'custom';         // System = built-in, custom = admin-created
  description?: string;
  isUniversal: boolean;                  // If true, available to all patients
  is_universal?: boolean;                // Database field
  enabled: boolean;
  displayOrder?: number;
  display_order?: number;                // Database field
  createdBy?: string;
  created_by?: string;                   // Database field
  createdAt?: string;
  created_at?: string;                   // Database field
  updatedAt?: string;
  updated_at?: string;                   // Database field
}

// Patient-specific lab type assignment
export interface PatientLabTypeAssignment {
  id: string;
  patientId: string;
  patient_id?: string;                   // Database field
  labTypeId: string;
  lab_type_id?: string;                  // Database field
  assignedBy?: string;
  assigned_by?: string;                  // Database field
  createdAt?: string;
  created_at?: string;                   // Database field
}

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

// ============================================
// ENHANCED MEDICATION TYPES
// ============================================

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'every_other_day'
  | 'weekly'
  | 'as_needed';

export interface EnhancedMedication {
  id: string;
  patientId: string;
  patient_id?: string; // Database field
  name: string;
  dosage: string;
  dosageUnit: string; // mg, ml, mcg, units
  dosage_unit?: string; // Database field
  frequency: MedicationFrequency;
  scheduledTimes: string[]; // e.g., ["08:00", "20:00"] for twice daily
  scheduled_times?: string[]; // Database field
  instructions?: string;
  category?: string; // e.g., "Blood Pressure", "Diabetes"
  startDate: string;
  start_date?: string; // Database field
  endDate?: string;
  end_date?: string; // Database field
  isActive: boolean;
  is_active?: boolean; // Database field
  isCustom?: boolean; // Whether user added custom medication
  is_custom?: boolean; // Database field
  reminderEnabled: boolean;
  reminder_enabled?: boolean; // Database field
  // Source tracking
  source?: 'manual' | 'ai_extracted' | 'doctor_prescribed';
  addedByDoctorId?: string;
  added_by_doctor_id?: string; // Database field
  sourceRecordId?: string; // Link to the medical record this was extracted from
  source_record_id?: string; // Database field
  createdAt?: string;
  created_at?: string; // Database field
  updatedAt?: string;
  updated_at?: string; // Database field
}

// AI extracted medication from medical records
export interface ExtractedMedication {
  name: string;
  dosage: string;
  unit: string;
  frequency?: string;
  instructions?: string;
}

export interface MedicationAdherenceEntry {
  id: string;
  medicationId: string;
  medication_id?: string; // Database field
  patientId: string;
  patient_id?: string; // Database field
  scheduledDate: string; // YYYY-MM-DD
  scheduled_date?: string; // Database field
  scheduledTime: string; // HH:mm
  scheduled_time?: string; // Database field
  taken: boolean;
  takenAt?: string; // ISO timestamp
  taken_at?: string; // Database field
  skipped: boolean;
  skipReason?: string;
  skip_reason?: string; // Database field
  createdAt?: string;
  created_at?: string; // Database field
}

// ============================================
// CASE DETAILS TYPES
// ============================================

export interface CaseDetails {
  id: string;
  patientId: string;
  patient_id?: string; // Database field
  primaryCondition: string;
  primary_condition?: string; // Database field
  latestComplaint: string;
  latest_complaint?: string; // Database field
  complaintDate?: string;
  complaint_date?: string; // Database field
  medicalHistory: string[];
  medical_history?: string[]; // Database field
  createdAt?: string;
  created_at?: string; // Database field
  updatedAt?: string;
  updated_at?: string; // Database field
}
