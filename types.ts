export type View = 'dashboard' | 'records' | 'upload' | 'messages' | 'billing';

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