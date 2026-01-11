import { supabase } from '../lib/supabase';

export interface ClinicDoctor {
    id: string;
    name: string;
    email: string;
    specialty: string;
    createdAt: string;
    clinicId: string;
}

export interface ClinicPatient {
    id: string;
    name: string;
    email: string;
    phone: string;
    gender: string;
    age: number;
    lastVisit: string;
    diagnosis: string;
}

export const ClinicService = {
    // 1. REGISTER CLINIC (Multi-tenancy Root)
    async registerClinic(profile: { name: string; email: string; location: string }): Promise<string> {
        // Check if clinic exists by email
        const { data: existing } = await supabase.from('clinics').select('id').eq('email', profile.email).maybeSingle();

        if (existing) {
            return existing.id;
        }

        // Create new clinic
        const { data, error } = await supabase.from('clinics').insert({
            name: profile.name,
            email: profile.email,
            location: profile.location
        }).select().single();

        if (error) throw error;
        return data.id;
    },

    // 2. Fetch doctors SCOPED to Clinic
    async getDoctors(clinicId: string): Promise<ClinicDoctor[]> {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email, specialty, created_at, clinic_id')
            .eq('role', 'doctor')
            .eq('clinic_id', clinicId) // Scoped!
            .order('name');

        if (error) {
            console.error('Error fetching doctors:', error);
            return [];
        }

        return (data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            email: d.email,
            specialty: d.specialty || 'General',
            createdAt: d.created_at,
            clinicId: d.clinic_id
        }));
    },

    // 3. Add Doctor SCOPED to Clinic
    async addDoctor(doctor: Omit<ClinicDoctor, 'id' | 'createdAt' | 'clinicId'>, clinicId: string): Promise<ClinicDoctor> {

        // 1. Check if user exists (Global Check - maybe they already have an account?)
        // For now, we assume we just creating a new user for this clinic. 
        // If email conflicts, we might need to handle it.

        const { data, error } = await supabase
            .from('users')
            .insert({
                name: doctor.name,
                email: doctor.email,
                specialty: doctor.specialty,
                role: 'doctor',
                clinic_id: clinicId // Link to Clinic
            } as any)
            .select()
            .single();

        if (error) throw error;

        const d = data as any;
        return {
            id: d.id,
            name: d.name,
            email: d.email,
            specialty: d.specialty,
            createdAt: d.created_at,
            clinicId: d.clinic_id
        };
    },

    // 4. Delete Doctor
    async deleteDoctor(id: string): Promise<void> {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
    },

    // 5. Get Patients Scoped to Doctor (and implicitly Clinic via Doctor)
    async getPatientsForDoctor(doctorId: string): Promise<ClinicPatient[]> {
        const { data, error } = await supabase
            .from('patient_doctor_relationships')
            .select(`
        patient:users (
          id, name, email, phone, gender, date_of_birth, condition
        ),
        created_at
      `)
            .eq('doctor_id', doctorId);

        if (error) {
            console.error('Error fetching patients:', error);
            return [];
        }

        return (data || []).map((item: any) => ({
            id: item.patient.id,
            name: item.patient.name,
            email: item.patient.email,
            phone: item.patient.phone || '',
            gender: item.patient.gender,
            age: calculateAge(item.patient.date_of_birth),
            lastVisit: item.created_at.split('T')[0],
            diagnosis: item.patient.condition || 'CKD Stage 3'
        }));
    },

    // 6. Add Patient Scoped to Clinic (via Doctor)
    async addPatient(
        patient: { name: string; email: string; phone: string; gender: string; age: number },
        doctorId: string,
        clinicId: string
    ): Promise<void> {

        // Check if patient exists
        let patientId: string;
        const { data: existing } = await supabase.from('users').select('id').eq('email', patient.email).maybeSingle();

        if (existing) {
            patientId = (existing as any).id;
            // Optionally update their clinic_id if they are joining this clinic? 
            // For shared patients, maybe not. But user asked for separation.
            // We'll update clinic_id for now to bring them into the fold.
            await supabase.from('users').update({ clinic_id: clinicId }).eq('id', patientId);
        } else {
            // Create new patient linked to clinic
            const { data: newPatient, error: createError } = await supabase
                .from('users')
                .insert({
                    name: patient.name,
                    email: patient.email,
                    phone: patient.phone,
                    gender: patient.gender === 'M' ? 'male' : 'female',
                    role: 'patient',
                    clinic_id: clinicId, // Link to Clinic
                    date_of_birth: calculateDobFromAge(patient.age),
                    condition: 'CKD Stage 3'
                } as any)
                .select()
                .single();

            if (createError) throw createError;
            patientId = (newPatient as any).id;
        }

        // Link to Doctor with Clinic Context
        const { error: linkError } = await supabase
            .from('patient_doctor_relationships')
            .insert({
                patient_id: patientId,
                doctor_id: doctorId,
                clinic_id: clinicId
            } as any);

        if (linkError) {
            if (linkError.code === '23505') {
                // Unique violation means already linked
            } else {
                throw linkError;
            }
        }
    }
};

function calculateAge(dob: string) {
    if (!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function calculateDobFromAge(age: number) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - age);
    return d.toISOString().split('T')[0];
}
