// Prescription-related TypeScript interfaces

export interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing?: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  doctorSpecialty?: string;
  patientName: string;
  patientAge?: number;
  medications: PrescriptionMedication[];
  notes?: string;
  status: 'active' | 'completed' | 'expired';
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionFormData {
  medications: PrescriptionMedication[];
  notes?: string;
}

export interface PrescriptionPDFData {
  prescription: Prescription;
  doctorRegistrationNo?: string;
  clinicName?: string;
  clinicAddress?: string;
}
