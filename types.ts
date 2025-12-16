export type View = 'dashboard' | 'records' | 'upload' | 'messages' | 'billing';

export type UserRole = 'patient' | 'doctor';

export type AuthView = 'chooser' | 'patient-login' | 'doctor-login';

export type DoctorPortalView = 'dashboard' | 'messages';

export type SubscriptionTier = 'FreeTrial' | 'Paid';

export type CKDStage = 'Stage 1' | 'Stage 2' | 'Stage 3' | 'Stage 4' | 'Stage 5';

export type Comorbidity = 'Diabetes Mellitus (DM)' | 'Hypertension (HTN)' | 'Other';

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
  
  // Referral system fields
  referral_code?: string; // Doctor's unique referral code (DOC-XXXXXX)
  referralCode?: string; // Camel case version
  patient_uid?: string; // Patient's sequential ID (BH-PAT-0001)
  patientUid?: string; // Camel case version
  consent_accepted?: boolean; // Patient consent for data sharing
  consentAccepted?: boolean; // Camel case version
  referring_doctor_id?: string; // Doctor who referred the patient
  referringDoctorId?: string; // Camel case version
  
  // CKD specific fields
  diagnosis_year?: number; // Year of CKD diagnosis
  diagnosisYear?: number; // Camel case version
  ckd_stage?: CKDStage; // Current CKD stage
  ckdStage?: CKDStage; // Camel case version
  comorbidities?: string[]; // Array of comorbidities
}

export interface Vital {
  value: string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface Vitals {
  bloodPressure: Vital;
  heartRate: Vital;
  temperature: Vital;
  glucose?: Vital;
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
    referral_code: string; // Required for doctors
    referralCode: string;
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
  
  // Referral system - required for patients
  patient_uid: string; // Sequential ID (BH-PAT-0001)
  patientUid: string;
  consent_accepted: boolean; // Must accept consent to register
  consentAccepted: boolean;
  referring_doctor_id: string; // Required - doctor who referred them
  referringDoctorId: string;
  
  // Medical information (optional)
  diagnosis_year?: number;
  diagnosisYear?: number;
  ckd_stage?: CKDStage;
  ckdStage?: CKDStage;
  comorbidities?: string[];
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