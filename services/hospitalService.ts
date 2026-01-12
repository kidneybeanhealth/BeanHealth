import { supabase, Database } from '../lib/supabase';
import { Hospital, HospitalPatient, HospitalQueue } from '../types';

type HospitalInsert = Database['public']['Tables']['hospitals']['Insert'];
type HospitalUpdate = Database['public']['Tables']['hospitals']['Update'];
type HospitalPatientInsert = Database['public']['Tables']['hospital_patients']['Insert'];
type HospitalQueueInsert = Database['public']['Tables']['hospital_queues']['Insert'];
type HospitalQueueUpdate = Database['public']['Tables']['hospital_queues']['Update'];

export const HospitalService = {
    async getHospitalByUserId(userId: string): Promise<Hospital | null> {
        const { data, error } = await (supabase
            .from('hospitals') as any)
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        if (!data) return null;

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            address: data.address,
            phone: data.phone,
            email: data.email,
            licenseNumber: data.license_number,
            detailsCompleted: data.details_completed,
            createdAt: data.created_at
        };
    },

    async createHospital(hospital: Partial<Hospital>): Promise<Hospital> {
        const { data, error } = await (supabase
            .from('hospitals') as any)
            .insert({
                user_id: hospital.userId,
                name: hospital.name,
                address: hospital.address,
                phone: hospital.phone,
                email: hospital.email,
                license_number: hospital.licenseNumber,
                details_completed: true
            })
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to create hospital record');

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            address: data.address,
            phone: data.phone,
            email: data.email,
            licenseNumber: data.license_number,
            detailsCompleted: data.details_completed,
            createdAt: data.created_at
        };
    },

    async updateHospital(id: string, updates: Partial<Hospital>): Promise<void> {
        const { error } = await (supabase
            .from('hospitals') as any)
            .update({
                name: updates.name,
                address: updates.address,
                phone: updates.phone,
                email: updates.email,
                license_number: updates.licenseNumber,
                details_completed: updates.detailsCompleted
            })
            .eq('id', id);

        if (error) throw error;
    },

    async addPatient(hospitalId: string, name: string, age: number, tokenNumber: string): Promise<HospitalPatient> {
        const { data, error } = await (supabase
            .from('hospital_patients') as any)
            .insert({
                hospital_id: hospitalId,
                name,
                age,
                token_number: tokenNumber
            })
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to add patient');

        return {
            id: data.id,
            hospitalId: data.hospital_id,
            name: data.name,
            age: data.age,
            tokenNumber: data.token_number,
            createdAt: data.created_at
        };
    },

    async getDoctors(hospitalId: string) {
        const { data, error } = await (supabase
            .from('users') as any)
            .select('id, name, specialty')
            .eq('role', 'doctor')
            .eq('hospital_id', hospitalId);

        if (error) throw error;
        return data || [];
    },

    async assignPatientToDoctor(hospitalId: string, patientId: string, doctorId: string, queueNumber: number): Promise<HospitalQueue> {
        const { data, error } = await (supabase
            .from('hospital_queues') as any)
            .insert({
                hospital_id: hospitalId,
                patient_id: patientId,
                doctor_id: doctorId,
                queue_number: queueNumber,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data as any;
    },

    async getQueueByHospital(hospitalId: string, status?: string): Promise<HospitalQueue[]> {
        // We cast chain to any to avoid type errors on join syntax
        let query = (supabase
            .from('hospital_queues') as any)
            .select(`
                *,
                hospital_patients!patient_id (name, age, token_number),
                users!doctor_id (name)
            `)
            .eq('hospital_id', hospitalId);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data) return [];

        return (data as any[]).map(item => {
            // Handle potentially array-wrapped joins
            const patient = Array.isArray(item.hospital_patients) ? item.hospital_patients[0] : item.hospital_patients;
            const doctor = Array.isArray(item.users) ? item.users[0] : item.users;

            return {
                id: item.id,
                hospitalId: item.hospital_id,
                patientId: item.patient_id,
                doctorId: item.doctor_id,
                queueNumber: item.queue_number,
                status: item.status,
                prescriptionNotes: item.prescription_notes,
                prescribedAt: item.prescribed_at,
                createdAt: item.created_at,
                patientName: patient?.name || 'Unknown Patient',
                age: patient?.age,
                tokenNumber: patient?.token_number,
                doctorName: doctor?.name
            };
        });
    },

    async updateQueueStatus(id: string, status: 'pending' | 'working' | 'done'): Promise<void> {
        const { error } = await (supabase
            .from('hospital_queues') as any)
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },

    async savePrescription(queueId: string, notes: string): Promise<void> {
        const { error } = await (supabase
            .from('hospital_queues') as any)
            .update({
                prescription_notes: notes,
                prescribed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', queueId);

        if (error) throw error;
    },

    async getDoctorQueue(doctorId: string): Promise<HospitalQueue[]> {
        const { data, error } = await (supabase
            .from('hospital_queues') as any)
            .select(`
                *,
                hospital_patients!patient_id (name, age, token_number)
            `)
            .eq('doctor_id', doctorId)
            .in('status', ['pending', 'working']);

        if (error) throw error;
        if (!data) return [];

        return (data as any[]).map(item => {
            const patient = Array.isArray(item.hospital_patients) ? item.hospital_patients[0] : item.hospital_patients;

            return {
                id: item.id,
                hospitalId: item.hospital_id,
                patientId: item.patient_id,
                doctorId: item.doctor_id,
                queueNumber: item.queue_number,
                status: item.status,
                prescriptionNotes: item.prescription_notes,
                prescribedAt: item.prescribed_at,
                createdAt: item.created_at,
                patientName: patient?.name || 'Unknown Patient',
                age: patient?.age,
                tokenNumber: patient?.token_number
            };
        });
    }
};
