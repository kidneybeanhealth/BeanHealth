import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

const HOSPITAL_SAVED_DRUGS_TABLE = 'hospital_saved_drugs';
const HOSPITAL_SAVED_DIAGNOSES_TABLE = 'hospital_saved_diagnoses';

const normalizeName = (value: string) => value.trim().toUpperCase();

export interface HospitalSavedDrug {
    id: string;
    hospital_id: string;
    name: string;
    normalized_name?: string;
    drug_type?: string | null;
    default_timing?: string | null;
    dosages?: string[];
    created_by_doctor_id?: string | null;
    updated_by_doctor_id?: string | null;
}

export interface HospitalSavedDiagnosis {
    id: string;
    hospital_id: string;
    name: string;
    normalized_name?: string;
    created_by_doctor_id?: string | null;
    updated_by_doctor_id?: string | null;
}

export interface UpsertHospitalDrugInput {
    hospitalId: string;
    doctorId?: string;
    id?: string;
    name: string;
    drugType?: string;
    defaultTiming?: string;
    dosages?: string[];
}

export interface UpsertHospitalDiagnosisInput {
    hospitalId: string;
    doctorId?: string;
    id?: string;
    name: string;
}

export const fetchHospitalSavedDrugs = async (hospitalId: string): Promise<HospitalSavedDrug[]> => {
    const { data, error } = await withTimeout<any>(
        (supabase
            .from(HOSPITAL_SAVED_DRUGS_TABLE as any)
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('name', { ascending: true }) as any),
        10000,
        'Timed out while loading shared hospital drugs'
    );

    if (error) {
        throw error;
    }

    return (data || []) as HospitalSavedDrug[];
};

export const upsertHospitalSavedDrug = async (input: UpsertHospitalDrugInput): Promise<HospitalSavedDrug> => {
    const normalizedName = normalizeName(input.name);
    const parsedDosages = Array.from(
        new Set(
            (input.dosages || [])
                .map((dose) => normalizeName(dose))
                .filter(Boolean)
        )
    );

    if (input.id) {
        const drugsTable: any = supabase.from(HOSPITAL_SAVED_DRUGS_TABLE as any);
        const { data, error } = await withTimeout<any>(
            (drugsTable
                .update({
                    name: normalizedName,
                    normalized_name: normalizedName,
                    drug_type: input.drugType || null,
                    default_timing: input.defaultTiming || null,
                    dosages: parsedDosages,
                    updated_by_doctor_id: input.doctorId || null,
                    updated_at: new Date().toISOString(),
                } as any)
                .eq('id', input.id)
                .eq('hospital_id', input.hospitalId)
                .select('*') as any)
                .single(),
            10000,
            'Timed out while updating shared hospital drug'
        );

        if (error) {
            throw error;
        }

        return data as HospitalSavedDrug;
    }

    const { data, error } = await withTimeout<any>(
        (supabase
            .from(HOSPITAL_SAVED_DRUGS_TABLE as any)
            .insert({
                hospital_id: input.hospitalId,
                name: normalizedName,
                normalized_name: normalizedName,
                drug_type: input.drugType || null,
                default_timing: input.defaultTiming || null,
                dosages: parsedDosages,
                created_by_doctor_id: input.doctorId || null,
                updated_by_doctor_id: input.doctorId || null,
            } as any)
            .select('*') as any)
            .single(),
        10000,
        'Timed out while creating shared hospital drug'
    );

    if (error) {
        throw error;
    }

    return data as HospitalSavedDrug;
};

export const deleteHospitalSavedDrug = async (hospitalId: string, id: string): Promise<void> => {
    const { error } = await withTimeout<any>(
        (supabase
            .from(HOSPITAL_SAVED_DRUGS_TABLE as any)
            .delete()
            .eq('id', id)
            .eq('hospital_id', hospitalId) as any),
        10000,
        'Timed out while deleting shared hospital drug'
    );

    if (error) {
        throw error;
    }
};

export const fetchHospitalSavedDiagnoses = async (hospitalId: string): Promise<HospitalSavedDiagnosis[]> => {
    const { data, error } = await withTimeout<any>(
        (supabase
            .from(HOSPITAL_SAVED_DIAGNOSES_TABLE as any)
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('name', { ascending: true }) as any),
        10000,
        'Timed out while loading shared hospital diagnoses'
    );

    if (error) {
        throw error;
    }

    return (data || []) as HospitalSavedDiagnosis[];
};

export const upsertHospitalSavedDiagnosis = async (input: UpsertHospitalDiagnosisInput): Promise<HospitalSavedDiagnosis> => {
    const normalizedName = normalizeName(input.name);

    if (input.id) {
        const diagnosesTable: any = supabase.from(HOSPITAL_SAVED_DIAGNOSES_TABLE as any);
        const { data, error } = await withTimeout<any>(
            (diagnosesTable
                .update({
                    name: normalizedName,
                    normalized_name: normalizedName,
                    updated_by_doctor_id: input.doctorId || null,
                    updated_at: new Date().toISOString(),
                } as any)
                .eq('id', input.id)
                .eq('hospital_id', input.hospitalId)
                .select('*') as any)
                .single(),
            10000,
            'Timed out while updating shared hospital diagnosis'
        );

        if (error) {
            throw error;
        }

        return data as HospitalSavedDiagnosis;
    }

    const { data, error } = await withTimeout<any>(
        (supabase
            .from(HOSPITAL_SAVED_DIAGNOSES_TABLE as any)
            .insert({
                hospital_id: input.hospitalId,
                name: normalizedName,
                normalized_name: normalizedName,
                created_by_doctor_id: input.doctorId || null,
                updated_by_doctor_id: input.doctorId || null,
            } as any)
            .select('*') as any)
            .single(),
        10000,
        'Timed out while creating shared hospital diagnosis'
    );

    if (error) {
        throw error;
    }

    return data as HospitalSavedDiagnosis;
};

export const deleteHospitalSavedDiagnosis = async (hospitalId: string, id: string): Promise<void> => {
    const { error } = await withTimeout<any>(
        (supabase
            .from(HOSPITAL_SAVED_DIAGNOSES_TABLE as any)
            .delete()
            .eq('id', id)
            .eq('hospital_id', hospitalId) as any),
        10000,
        'Timed out while deleting shared hospital diagnosis'
    );

    if (error) {
        throw error;
    }
};
