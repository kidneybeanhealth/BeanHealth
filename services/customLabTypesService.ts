/**
 * Custom Lab Types Service
 * Handles CRUD operations for admin-managed lab test types
 */

import { supabase } from '../lib/supabase';
import { CustomLabType, PatientLabTypeAssignment } from '../types';

export class CustomLabTypesService {
    /**
     * Map database record to CustomLabType interface
     */
    private static mapToCustomLabType(data: any): CustomLabType {
        return {
            id: data.id,
            name: data.name,
            code: data.code,
            unit: data.unit,
            referenceRangeMin: data.reference_range_min ? parseFloat(data.reference_range_min) : undefined,
            reference_range_min: data.reference_range_min ? parseFloat(data.reference_range_min) : undefined,
            referenceRangeMax: data.reference_range_max ? parseFloat(data.reference_range_max) : undefined,
            reference_range_max: data.reference_range_max ? parseFloat(data.reference_range_max) : undefined,
            category: data.category,
            description: data.description,
            isUniversal: data.is_universal,
            is_universal: data.is_universal,
            enabled: data.enabled,
            displayOrder: data.display_order,
            display_order: data.display_order,
            createdBy: data.created_by,
            created_by: data.created_by,
            createdAt: data.created_at,
            created_at: data.created_at,
            updatedAt: data.updated_at,
            updated_at: data.updated_at,
        };
    }

    /**
     * Get all enabled lab types (for admin view or universal types)
     */
    static async getAllLabTypes(includeDisabled: boolean = false): Promise<CustomLabType[]> {
        let query = supabase
            .from('custom_lab_types')
            .select('*')
            .order('display_order', { ascending: true })
            .order('name', { ascending: true });

        if (!includeDisabled) {
            query = query.eq('enabled', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching lab types:', error);
            throw new Error(`Failed to fetch lab types: ${error.message}`);
        }

        return data?.map(this.mapToCustomLabType) || [];
    }

    /**
     * Get lab types available for a specific patient
     * Returns universal types + patient-specific assigned types
     */
    static async getLabTypesForPatient(patientId: string): Promise<CustomLabType[]> {
        // Get all universal types
        const { data: universalTypes, error: universalError } = await supabase
            .from('custom_lab_types')
            .select('*')
            .eq('enabled', true)
            .eq('is_universal', true)
            .order('display_order', { ascending: true });

        if (universalError) {
            console.error('Error fetching universal lab types:', universalError);
            throw new Error(`Failed to fetch lab types: ${universalError.message}`);
        }

        // Get patient-specific assignments
        const { data: assignments, error: assignError } = await supabase
            .from('patient_lab_type_assignments')
            .select('lab_type_id, custom_lab_types(*)')
            .eq('patient_id', patientId);

        if (assignError) {
            console.error('Error fetching lab type assignments:', assignError);
            // Continue with universal types only
        }

        // Combine and deduplicate
        const types: CustomLabType[] = (universalTypes || []).map(this.mapToCustomLabType);

        if (assignments) {
            for (const assignment of assignments) {
                if (assignment.custom_lab_types && !(types.find(t => t.id === (assignment.custom_lab_types as any).id))) {
                    types.push(this.mapToCustomLabType(assignment.custom_lab_types));
                }
            }
        }

        // Sort by display order
        types.sort((a, b) => (a.displayOrder || 100) - (b.displayOrder || 100));

        return types;
    }

    /**
     * Get a single lab type by ID
     */
    static async getLabTypeById(id: string): Promise<CustomLabType | null> {
        const { data, error } = await supabase
            .from('custom_lab_types')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching lab type:', error);
            return null;
        }

        return data ? this.mapToCustomLabType(data) : null;
    }

    /**
     * Get a lab type by its code
     */
    static async getLabTypeByCode(code: string): Promise<CustomLabType | null> {
        const { data, error } = await supabase
            .from('custom_lab_types')
            .select('*')
            .eq('code', code)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // Not found is ok
                console.error('Error fetching lab type by code:', error);
            }
            return null;
        }

        return data ? this.mapToCustomLabType(data) : null;
    }

    /**
     * Create a new lab type (admin only)
     */
    static async createLabType(
        labType: Omit<CustomLabType, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<CustomLabType> {
        const { data, error } = await supabase
            .from('custom_lab_types')
            .insert({
                name: labType.name,
                code: labType.code.toLowerCase().replace(/\s+/g, '_'),
                unit: labType.unit,
                reference_range_min: labType.referenceRangeMin,
                reference_range_max: labType.referenceRangeMax,
                category: 'custom',
                description: labType.description,
                is_universal: labType.isUniversal ?? true,
                enabled: labType.enabled ?? true,
                display_order: labType.displayOrder || 100,
                created_by: labType.createdBy,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating lab type:', error);
            throw new Error(`Failed to create lab type: ${error.message}`);
        }

        return this.mapToCustomLabType(data);
    }

    /**
     * Update an existing lab type (admin only)
     */
    static async updateLabType(
        id: string,
        updates: Partial<CustomLabType>
    ): Promise<CustomLabType> {
        const updateData: any = {};

        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.code !== undefined) updateData.code = updates.code.toLowerCase().replace(/\s+/g, '_');
        if (updates.unit !== undefined) updateData.unit = updates.unit;
        if (updates.referenceRangeMin !== undefined) updateData.reference_range_min = updates.referenceRangeMin;
        if (updates.referenceRangeMax !== undefined) updateData.reference_range_max = updates.referenceRangeMax;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.isUniversal !== undefined) updateData.is_universal = updates.isUniversal;
        if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
        if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

        const { data, error } = await supabase
            .from('custom_lab_types')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating lab type:', error);
            throw new Error(`Failed to update lab type: ${error.message}`);
        }

        return this.mapToCustomLabType(data);
    }

    /**
     * Soft delete a lab type (admin only)
     * Sets enabled = false instead of actual deletion
     */
    static async deleteLabType(id: string): Promise<void> {
        const { error } = await supabase
            .from('custom_lab_types')
            .update({ enabled: false })
            .eq('id', id);

        if (error) {
            console.error('Error deleting lab type:', error);
            throw new Error(`Failed to delete lab type: ${error.message}`);
        }
    }

    /**
     * Permanently delete a lab type (admin only)
     * Use with caution - this deletes all associated lab results
     */
    static async permanentlyDeleteLabType(id: string): Promise<void> {
        const { error } = await supabase
            .from('custom_lab_types')
            .delete()
            .eq('id', id)
            .eq('category', 'custom'); // Can only delete custom types

        if (error) {
            console.error('Error permanently deleting lab type:', error);
            throw new Error(`Failed to permanently delete lab type: ${error.message}`);
        }
    }

    /**
     * Assign a lab type to a specific patient
     */
    static async assignToPatient(
        labTypeId: string,
        patientId: string,
        assignedBy: string
    ): Promise<PatientLabTypeAssignment> {
        const { data, error } = await supabase
            .from('patient_lab_type_assignments')
            .insert({
                lab_type_id: labTypeId,
                patient_id: patientId,
                assigned_by: assignedBy,
            })
            .select()
            .single();

        if (error) {
            console.error('Error assigning lab type to patient:', error);
            throw new Error(`Failed to assign lab type: ${error.message}`);
        }

        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            labTypeId: data.lab_type_id,
            lab_type_id: data.lab_type_id,
            assignedBy: data.assigned_by,
            assigned_by: data.assigned_by,
            createdAt: data.created_at,
            created_at: data.created_at,
        };
    }

    /**
     * Remove a lab type assignment from a patient
     */
    static async removeFromPatient(labTypeId: string, patientId: string): Promise<void> {
        const { error } = await supabase
            .from('patient_lab_type_assignments')
            .delete()
            .eq('lab_type_id', labTypeId)
            .eq('patient_id', patientId);

        if (error) {
            console.error('Error removing lab type assignment:', error);
            throw new Error(`Failed to remove assignment: ${error.message}`);
        }
    }

    /**
     * Get all assignments for a lab type (to see which patients have it)
     */
    static async getAssignmentsForLabType(labTypeId: string): Promise<PatientLabTypeAssignment[]> {
        const { data, error } = await supabase
            .from('patient_lab_type_assignments')
            .select('*, users!patient_id(name, email)')
            .eq('lab_type_id', labTypeId);

        if (error) {
            console.error('Error fetching assignments:', error);
            throw new Error(`Failed to fetch assignments: ${error.message}`);
        }

        return data?.map((item: any) => ({
            id: item.id,
            patientId: item.patient_id,
            patient_id: item.patient_id,
            labTypeId: item.lab_type_id,
            lab_type_id: item.lab_type_id,
            assignedBy: item.assigned_by,
            assigned_by: item.assigned_by,
            createdAt: item.created_at,
            created_at: item.created_at,
            patientName: item.users?.name,
            patientEmail: item.users?.email,
        })) || [];
    }

    /**
     * Get all patients for bulk assignment
     */
    static async getAllPatients(): Promise<{ id: string; name: string; email: string }[]> {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('role', 'patient')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching patients:', error);
            return [];
        }

        return data || [];
    }
}
