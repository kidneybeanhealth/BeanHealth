/**
 * Patient App Context
 * Manages state for the MR ID-based patient app
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  PatientAppService,
  PatientSessionData,
  DailyVitals,
  DailyIntakes,
  UrineOutput,
  PatientPrescription,
  PrescriptionMed,
} from '../services/patientAppService';

interface PatientAppState {
  // Session
  session: PatientSessionData | null;
  isLoading: boolean;
  error: string | null;

  // Data
  vitals: DailyVitals | null;
  intakes: DailyIntakes | null;
  urineOutputs: UrineOutput[];
  medications: PrescriptionMed[];
  prescriptions: PatientPrescription[];
  currentPrescription: PatientPrescription | null;

  // Prescribed intakes (from doctor's prescription metadata)
  prescribedSalt: string | null;
  prescribedFluid: string | null;

  // Actions
  login: (mrId: string) => Promise<string | null>;
  logout: () => void;
  refreshVitals: () => Promise<void>;
  saveVitals: (vitals: Partial<DailyVitals>) => Promise<boolean>;
  refreshIntakes: () => Promise<void>;
  saveIntakes: (intakes: Partial<DailyIntakes>) => Promise<boolean>;
  refreshUrineOutputs: () => Promise<void>;
  addUrineOutput: (amountMl: number, notes?: string) => Promise<boolean>;
  deleteUrineOutput: (id: string) => Promise<boolean>;
  refreshMedications: () => Promise<void>;
  refreshPrescriptions: () => Promise<void>;

  // Helpers
  today: string;
}

const PatientAppContext = createContext<PatientAppState | null>(null);

export const usePatientApp = () => {
  const ctx = useContext(PatientAppContext);
  if (!ctx) throw new Error('usePatientApp must be inside PatientAppProvider');
  return ctx;
};

const getToday = () => new Date().toISOString().split('T')[0];

export const PatientAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<PatientSessionData | null>(() => PatientAppService.getSession());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vitals, setVitals] = useState<DailyVitals | null>(null);
  const [intakes, setIntakes] = useState<DailyIntakes | null>(null);
  const [urineOutputs, setUrineOutputs] = useState<UrineOutput[]>([]);
  const [medications, setMedications] = useState<PrescriptionMed[]>([]);
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [currentPrescription, setCurrentPrescription] = useState<PatientPrescription | null>(null);
  const [prescribedSalt, setPrescribedSalt] = useState<string | null>(null);
  const [prescribedFluid, setPrescribedFluid] = useState<string | null>(null);

  const today = getToday();

  // ── Login ──────────────────────────────────────────────
  const login = useCallback(async (mrId: string): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await PatientAppService.lookupByMRID(mrId);
      if (result.error) {
        setError(result.error);
        return result.error;
      }
      setSession(result.data);
      return null;
    } catch (e: any) {
      const msg = e.message || 'Login failed';
      setError(msg);
      return msg;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────
  const logout = useCallback(() => {
    PatientAppService.clearSession();
    setSession(null);
    setVitals(null);
    setIntakes(null);
    setUrineOutputs([]);
    setMedications([]);
    setPrescriptions([]);
    setCurrentPrescription(null);
    setPrescribedSalt(null);
    setPrescribedFluid(null);
  }, []);

  // Revalidate persisted session in case access was revoked from dashboard toggles.
  useEffect(() => {
    if (!session?.patient?.mr_number) return;

    let isActive = true;
    const validateSessionAccess = async () => {
      const result = await PatientAppService.lookupByMRID(session.patient.mr_number as string, {
        persistSession: false,
      });

      if (!isActive) return;

      if (result.error || !result.data || result.data.patient.id !== session.patient.id) {
        PatientAppService.clearSession();
        setSession(null);
        setError(result.error || 'Patient App access is disabled for this account.');
      }
    };

    validateSessionAccess();

    return () => {
      isActive = false;
    };
  }, [session?.patient?.id, session?.patient?.mr_number]);

  // ── Vitals ─────────────────────────────────────────────
  const refreshVitals = useCallback(async () => {
    if (!session?.patient.id) return;
    const data = await PatientAppService.getDailyVitals(session.patient.id, today);
    setVitals(data);
  }, [session?.patient.id, today]);

  const saveVitals = useCallback(async (updates: Partial<DailyVitals>): Promise<boolean> => {
    if (!session?.patient.id) return false;
    const merged: Omit<DailyVitals, 'id'> = {
      patient_id: session.patient.id,
      hospital_id: session.patient.hospital_id,
      recorded_date: today,
      bp_systole: updates.bp_systole ?? vitals?.bp_systole ?? null,
      bp_diastole: updates.bp_diastole ?? vitals?.bp_diastole ?? null,
      blood_glucose: updates.blood_glucose ?? vitals?.blood_glucose ?? null,
      blood_glucose_type: updates.blood_glucose_type ?? vitals?.blood_glucose_type ?? null,
      weight: updates.weight ?? vitals?.weight ?? null,
    };
    const ok = await PatientAppService.saveDailyVitals(merged);
    if (ok) {
      setVitals(prev => ({ ...prev, ...merged } as DailyVitals));
    }
    return ok;
  }, [session, today, vitals]);

  // ── Intakes ────────────────────────────────────────────
  const refreshIntakes = useCallback(async () => {
    if (!session?.patient.id) return;
    const data = await PatientAppService.getDailyIntakes(session.patient.id, today);
    setIntakes(data);
  }, [session?.patient.id, today]);

  const saveIntakes = useCallback(async (updates: Partial<DailyIntakes>): Promise<boolean> => {
    if (!session?.patient.id) return false;
    const merged: Omit<DailyIntakes, 'id'> = {
      patient_id: session.patient.id,
      hospital_id: session.patient.hospital_id,
      recorded_date: today,
      salt_intake_gm: updates.salt_intake_gm ?? intakes?.salt_intake_gm ?? null,
      fluid_intake_ml: updates.fluid_intake_ml ?? intakes?.fluid_intake_ml ?? null,
    };
    const ok = await PatientAppService.saveDailyIntakes(merged);
    if (ok) {
      setIntakes(prev => ({ ...prev, ...merged } as DailyIntakes));
    }
    return ok;
  }, [session, today, intakes]);

  // ── Urine Outputs ──────────────────────────────────────
  const refreshUrineOutputs = useCallback(async () => {
    if (!session?.patient.id) return;
    const data = await PatientAppService.getUrineOutputs(session.patient.id, today);
    setUrineOutputs(data);
  }, [session?.patient.id, today]);

  const addUrineOutput = useCallback(async (amountMl: number, notes?: string): Promise<boolean> => {
    if (!session?.patient.id) return false;
    const entry = await PatientAppService.addUrineOutput(
      session.patient.id, session.patient.hospital_id, amountMl, notes
    );
    if (entry) {
      setUrineOutputs(prev => [entry, ...prev]);
      return true;
    }
    return false;
  }, [session]);

  const deleteUrineOutput = useCallback(async (id: string): Promise<boolean> => {
    const ok = await PatientAppService.deleteUrineOutput(id);
    if (ok) {
      setUrineOutputs(prev => prev.filter(u => u.id !== id));
    }
    return ok;
  }, []);

  // ── Medications ────────────────────────────────────────
  const refreshMedications = useCallback(async () => {
    if (!session?.patient.id) return;
    const { medications: meds, prescription } = await PatientAppService.getLatestMedications(session.patient.id);
    setMedications(meds);
    setCurrentPrescription(prescription);

    // Extract prescribed intakes from metadata
    if (prescription?.metadata) {
      setPrescribedSalt(prescription.metadata.saltIntake || null);
      setPrescribedFluid(prescription.metadata.fluidIntake || null);
    }
  }, [session?.patient.id]);

  // ── Prescriptions ──────────────────────────────────────
  const refreshPrescriptions = useCallback(async () => {
    if (!session?.patient.id) return;
    const data = await PatientAppService.getPatientPrescriptions(session.patient.id);
    setPrescriptions(data);
  }, [session?.patient.id]);

  // ── Initial data load when session exists ──────────────
  useEffect(() => {
    if (session?.patient.id) {
      refreshVitals();
      refreshIntakes();
      refreshUrineOutputs();
      refreshMedications();
      refreshPrescriptions();
    }
  }, [session?.patient.id]);

  return (
    <PatientAppContext.Provider
      value={{
        session,
        isLoading,
        error,
        vitals,
        intakes,
        urineOutputs,
        medications,
        prescriptions,
        currentPrescription,
        prescribedSalt,
        prescribedFluid,
        login,
        logout,
        refreshVitals,
        saveVitals,
        refreshIntakes,
        saveIntakes,
        refreshUrineOutputs,
        addUrineOutput,
        deleteUrineOutput,
        refreshMedications,
        refreshPrescriptions,
        today,
      }}
    >
      {children}
    </PatientAppContext.Provider>
  );
};
