/**
 * Patient App Service
 * Handles MR ID lookup, vitals, intakes, urine outputs, medications, and prescriptions
 * for the hospital patient app (no Supabase Auth — uses MR ID session)
 */
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────
export interface HospitalPatient {
  id: string;
  hospital_id: string;
  name: string;
  age: number | null;
  gender: string | null;
  father_husband_name: string | null;
  place: string | null;
  phone: string | null;
  mr_number: string | null;
  token_number: string | null;
  beanhealth_id: string | null;
  app_access_enabled?: boolean;
  created_at: string;
}

export interface PatientDoctor {
  id: string;
  name: string;
  specialty: string | null;
}

export interface PatientHospital {
  id: string;
  hospital_name: string;
  address: string | null;
  display_name: string | null;
}

export interface PatientSessionData {
  patient: HospitalPatient;
  hospital: PatientHospital | null;
  doctor: PatientDoctor | null;
  latestVisitDate: string | null;
  department: string | null;
}

export interface DailyVitals {
  id?: string;
  patient_id: string;
  hospital_id: string;
  recorded_date: string;
  bp_systole: number | null;
  bp_diastole: number | null;
  blood_glucose: number | null;
  blood_glucose_type: 'fasting' | 'post_meal' | 'random' | null;
  weight: number | null;
}

export interface UrineOutput {
  id: string;
  patient_id: string;
  amount_ml: number;
  recorded_at: string;
  notes: string | null;
}

export interface DailyIntakes {
  id?: string;
  patient_id: string;
  hospital_id: string;
  recorded_date: string;
  salt_intake_gm: number | null;
  fluid_intake_ml: number | null;
}

export interface PrescriptionMed {
  name: string;
  dosage_value?: string;
  number: string;
  dose: string;
  morning: string;
  noon: string;
  evening: string;
  night: string;
  morningTime?: string;
  noonTime?: string;
  eveningTime?: string;
  nightTime?: string;
  morningAmPm?: string;
  noonAmPm?: string;
  eveningAmPm?: string;
  nightAmPm?: string;
  foodTiming: string;
  drugType?: string;
}

export interface PatientPrescription {
  id: string;
  hospital_id: string;
  doctor_id: string;
  patient_id: string;
  medications: PrescriptionMed[];
  notes: string | null;
  token_number: string | null;
  status: 'pending' | 'dispensed' | 'cancelled';
  created_at: string;
  next_review_date: string | null;
  dispensed_days: number | null;
  dispensed_at: string | null;
  dispensed_by: string | null;
  doctor?: { name: string; specialty: string | null };
  metadata?: {
    saltIntake?: string;
    fluidIntake?: string;
    diagnosis?: string;
  };
}

// ── Session Helpers ──────────────────────────────────────
const SESSION_KEY = 'pa_session';

export class PatientAppService {

  /** Store patient session in sessionStorage */
  static saveSession(data: PatientSessionData): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }

  /** Get stored session */
  static getSession(): PatientSessionData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Clear session (logout) */
  static clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ── MR ID Lookup ────────────────────────────────────────
  static async lookupByMRID(
    mrNumber: string,
    options?: { persistSession?: boolean }
  ): Promise<{
    data: PatientSessionData | null;
    error: string | null;
  }> {
    try {
      const normalized = mrNumber.trim();
      if (!normalized) return { data: null, error: 'Please enter an MR ID' };

      console.log('[PatientApp] Looking up MR:', JSON.stringify(normalized));

      // Use RPC to bypass RLS (SECURITY DEFINER function)
      const { data: result, error: rpcError } = await (supabase as any).rpc('patient_app_lookup_mr', {
        p_mr_number: normalized,
      });

      console.log('[PatientApp] RPC result:', { result, rpcError });

      if (rpcError) throw rpcError;
      if (!result || !result.patient) {
        return { data: null, error: 'No patient found with this MR ID. Please check the number and try again.' };
      }

      if (result.access_denied === true) {
        this.clearSession();
        return {
          data: null,
          error: 'Patient App access is currently disabled for this MR ID. Please contact reception or your doctor.',
        };
      }

      const patient = result.patient as HospitalPatient;

      // Backward compatible guard:
      // - Explicit false must always deny.
      // - Undefined is tolerated for legacy RPC payloads until DB migration is applied.
      if (patient.app_access_enabled === false) {
        this.clearSession();
        return {
          data: null,
          error: 'Patient App access is currently disabled for this MR ID. Please contact reception or your doctor.',
        };
      }

      const hospital = result.hospital as PatientHospital | null;
      const queue = result.queue as { created_at: string; doctor_id: string; doctor_name: string; specialty: string } | null;

      let doctor: PatientDoctor | null = null;
      let latestVisitDate: string | null = null;
      let department: string | null = null;

      if (queue) {
        latestVisitDate = queue.created_at;
        doctor = {
          id: queue.doctor_id,
          name: queue.doctor_name,
          specialty: queue.specialty,
        };
        department = queue.specialty || null;
      }

      const sessionData: PatientSessionData = {
        patient,
        hospital,
        doctor,
        latestVisitDate,
        department,
      };

      if (options?.persistSession !== false) {
        this.saveSession(sessionData);
      }
      return { data: sessionData, error: null };
    } catch (error: any) {
      console.error('MR ID lookup error:', error);
      return { data: null, error: error.message || 'Lookup failed' };
    }
  }


  // ── Vitals ──────────────────────────────────────────────
  static async getDailyVitals(patientId: string, date: string): Promise<DailyVitals | null> {
    try {
      const { data, error } = await supabase
        .from('hospital_patient_vitals' as any)
        .select('*')
        .eq('patient_id', patientId)
        .eq('recorded_date', date)
        .maybeSingle();

      if (error) throw error;
      return data as DailyVitals | null;
    } catch (error) {
      console.error('Error fetching daily vitals:', error);
      return null;
    }
  }

  static async saveDailyVitals(vitals: Omit<DailyVitals, 'id'>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('hospital_patient_vitals' as any)
        .upsert(
          {
            patient_id: vitals.patient_id,
            hospital_id: vitals.hospital_id,
            recorded_date: vitals.recorded_date,
            bp_systole: vitals.bp_systole,
            bp_diastole: vitals.bp_diastole,
            blood_glucose: vitals.blood_glucose,
            blood_glucose_type: vitals.blood_glucose_type,
            weight: vitals.weight,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'patient_id,recorded_date' }
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving vitals:', error);
      return false;
    }
  }

  static async getVitalsHistory(patientId: string, days: number = 30): Promise<DailyVitals[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const { data, error } = await supabase
        .from('hospital_patient_vitals' as any)
        .select('*')
        .eq('patient_id', patientId)
        .gte('recorded_date', sinceDate.toISOString().split('T')[0])
        .order('recorded_date', { ascending: true });

      if (error) throw error;
      return (data as DailyVitals[]) || [];
    } catch (error) {
      console.error('Error fetching vitals history:', error);
      return [];
    }
  }

  // ── Urine Output ───────────────────────────────────────
  static async getUrineOutputs(patientId: string, date: string): Promise<UrineOutput[]> {
    try {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data, error } = await supabase
        .from('hospital_patient_urine_outputs' as any)
        .select('*')
        .eq('patient_id', patientId)
        .gte('recorded_at', startOfDay)
        .lte('recorded_at', endOfDay)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      return (data as UrineOutput[]) || [];
    } catch (error) {
      console.error('Error fetching urine outputs:', error);
      return [];
    }
  }

  static async addUrineOutput(
    patientId: string,
    hospitalId: string,
    amountMl: number,
    notes?: string
  ): Promise<UrineOutput | null> {
    try {
      const { data, error } = await supabase
        .from('hospital_patient_urine_outputs' as any)
        .insert({
          patient_id: patientId,
          hospital_id: hospitalId,
          amount_ml: amountMl,
          recorded_at: new Date().toISOString(),
          notes: notes || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as UrineOutput;
    } catch (error) {
      console.error('Error adding urine output:', error);
      return null;
    }
  }

  static async deleteUrineOutput(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('hospital_patient_urine_outputs' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting urine output:', error);
      return false;
    }
  }

  // ── Intakes ────────────────────────────────────────────
  static async getDailyIntakes(patientId: string, date: string): Promise<DailyIntakes | null> {
    try {
      const { data, error } = await supabase
        .from('hospital_patient_intakes' as any)
        .select('*')
        .eq('patient_id', patientId)
        .eq('recorded_date', date)
        .maybeSingle();

      if (error) throw error;
      return data as DailyIntakes | null;
    } catch (error) {
      console.error('Error fetching daily intakes:', error);
      return null;
    }
  }

  static async saveDailyIntakes(intakes: Omit<DailyIntakes, 'id'>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('hospital_patient_intakes' as any)
        .upsert(
          {
            patient_id: intakes.patient_id,
            hospital_id: intakes.hospital_id,
            recorded_date: intakes.recorded_date,
            salt_intake_gm: intakes.salt_intake_gm,
            fluid_intake_ml: intakes.fluid_intake_ml,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'patient_id,recorded_date' }
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving intakes:', error);
      return false;
    }
  }

  static async getIntakesHistory(patientId: string, days: number = 30): Promise<DailyIntakes[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const { data, error } = await supabase
        .from('hospital_patient_intakes' as any)
        .select('*')
        .eq('patient_id', patientId)
        .gte('recorded_date', sinceDate.toISOString().split('T')[0])
        .order('recorded_date', { ascending: true });

      if (error) throw error;
      return (data as DailyIntakes[]) || [];
    } catch (error) {
      console.error('Error fetching intakes history:', error);
      return [];
    }
  }

  // ── Prescriptions ──────────────────────────────────────
  static async getPatientPrescriptions(patientId: string): Promise<PatientPrescription[]> {
    try {
      const { data, error } = await (supabase as any).rpc('patient_app_get_prescriptions', {
        p_patient_id: patientId,
      });

      if (error) throw error;
      return (data as PatientPrescription[]) || [];
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      return [];
    }
  }

  /** Get the latest dispensed prescription for medications display */
  static async getLatestMedications(patientId: string): Promise<{
    medications: PrescriptionMed[];
    prescription: PatientPrescription | null;
  }> {
    try {
      // Reuse the same RPC, then pick the latest dispensed/pending
      const all = await this.getPatientPrescriptions(patientId);
      const rx = all.find(p => p.status === 'dispensed' || p.status === 'pending') || null;

      if (!rx) return { medications: [], prescription: null };

      return {
        medications: rx.medications || [],
        prescription: rx,
      };
    } catch (error) {
      console.error('Error fetching latest medications:', error);
      return { medications: [], prescription: null };
    }
  }

  // ── Urine Output History (for trends) ──────────────────
  static async getUrineOutputHistory(patientId: string, days: number = 30): Promise<{
    date: string;
    total_ml: number;
  }[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const { data, error } = await supabase
        .from('hospital_patient_urine_outputs' as any)
        .select('amount_ml, recorded_at')
        .eq('patient_id', patientId)
        .gte('recorded_at', sinceDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      // Group by date and sum
      const dailyMap = new Map<string, number>();
      for (const entry of (data || []) as any[]) {
        const date = new Date(entry.recorded_at).toISOString().split('T')[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + entry.amount_ml);
      }

      return Array.from(dailyMap.entries()).map(([date, total_ml]) => ({
        date,
        total_ml,
      }));
    } catch (error) {
      console.error('Error fetching urine output history:', error);
      return [];
    }
  }
}
