// Doctor Notes Service
// CRUD operations for quick notes from doctors about patients

import { supabase } from '../lib/supabase';

export type NoteType = 'quick_note' | 'clinical_observation' | 'follow_up';

export interface DoctorNote {
    id: string;
    patientId: string;
    patient_id?: string;
    doctorId: string;
    doctor_id?: string;
    content: string;
    isVisibleToPatient: boolean;
    is_visible_to_patient?: boolean;
    noteType: NoteType;
    note_type?: NoteType;
    createdAt: string;
    created_at?: string;
    updatedAt: string;
    updated_at?: string;
    // Joined fields
    doctorName?: string;
}

export class DoctorNotesService {
    /**
     * Add a new note
     */
    static async addNote(
        patientId: string,
        doctorId: string,
        content: string,
        isVisibleToPatient: boolean = false,
        noteType: NoteType = 'quick_note'
    ): Promise<DoctorNote> {
        const { data, error } = await supabase
            .from('doctor_notes')
            .insert({
                patient_id: patientId,
                doctor_id: doctorId,
                content,
                is_visible_to_patient: isVisibleToPatient,
                note_type: noteType,
            })
            .select(`
                *,
                users:doctor_id (name)
            `)
            .single();

        if (error) {
            console.error('Error adding note:', error);
            throw new Error(`Failed to add note: ${error.message}`);
        }

        return this.mapNote(data);
    }

    /**
     * Get all notes for a patient (doctor view)
     */
    static async getNotes(patientId: string): Promise<DoctorNote[]> {
        const { data, error } = await supabase
            .from('doctor_notes')
            .select(`
                *,
                users:doctor_id (name)
            `)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notes:', error);
            throw new Error(`Failed to fetch notes: ${error.message}`);
        }

        return (data || []).map(this.mapNote);
    }

    /**
     * Get notes visible to patient (patient portal)
     */
    static async getPatientVisibleNotes(patientId: string): Promise<DoctorNote[]> {
        const { data, error } = await supabase
            .from('doctor_notes')
            .select(`
                *,
                users:doctor_id (name)
            `)
            .eq('patient_id', patientId)
            .eq('is_visible_to_patient', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching patient notes:', error);
            throw new Error(`Failed to fetch notes: ${error.message}`);
        }

        return (data || []).map(this.mapNote);
    }

    /**
     * Update a note
     */
    static async updateNote(
        noteId: string,
        updates: { content?: string; isVisibleToPatient?: boolean; noteType?: NoteType }
    ): Promise<DoctorNote> {
        const updateData: any = {};
        if (updates.content !== undefined) updateData.content = updates.content;
        if (updates.isVisibleToPatient !== undefined) updateData.is_visible_to_patient = updates.isVisibleToPatient;
        if (updates.noteType !== undefined) updateData.note_type = updates.noteType;

        const { data, error } = await supabase
            .from('doctor_notes')
            .update(updateData)
            .eq('id', noteId)
            .select(`
                *,
                users:doctor_id (name)
            `)
            .single();

        if (error) {
            console.error('Error updating note:', error);
            throw new Error(`Failed to update note: ${error.message}`);
        }

        return this.mapNote(data);
    }

    /**
     * Delete a note
     */
    static async deleteNote(noteId: string): Promise<void> {
        const { error } = await supabase
            .from('doctor_notes')
            .delete()
            .eq('id', noteId);

        if (error) {
            console.error('Error deleting note:', error);
            throw new Error(`Failed to delete note: ${error.message}`);
        }
    }

    /**
     * Map database record to interface
     */
    private static mapNote(data: any): DoctorNote {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            doctorId: data.doctor_id,
            doctor_id: data.doctor_id,
            content: data.content,
            isVisibleToPatient: data.is_visible_to_patient,
            is_visible_to_patient: data.is_visible_to_patient,
            noteType: data.note_type,
            note_type: data.note_type,
            createdAt: data.created_at,
            created_at: data.created_at,
            updatedAt: data.updated_at,
            updated_at: data.updated_at,
            doctorName: data.users?.name || 'Unknown Doctor',
        };
    }
}
