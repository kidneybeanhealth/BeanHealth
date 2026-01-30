import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface SavedDiagnosis {
    id: string;
    name: string;
    doctor_id: string;
    hospital_id: string;
}

interface ManageDiagnosesModalProps {
    doctorId: string;
    hospitalId: string;
    onClose: () => void;
}

const ManageDiagnosesModal: React.FC<ManageDiagnosesModalProps> = ({ doctorId, hospitalId, onClose }) => {
    const [savedDiagnoses, setSavedDiagnoses] = useState<SavedDiagnosis[]>([]);
    const [newDiagnosisName, setNewDiagnosisName] = useState('');
    const [editingDiagnosis, setEditingDiagnosis] = useState<SavedDiagnosis | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch saved diagnoses
    useEffect(() => {
        const fetchDiagnoses = async () => {
            try {
                const { data, error } = await supabase
                    .from('hospital_doctor_diagnoses' as any)
                    .select('*')
                    .eq('doctor_id', doctorId)
                    .order('name', { ascending: true });

                if (error) throw error;
                setSavedDiagnoses(data || []);
            } catch (err) {
                console.error('Error fetching saved diagnoses:', err);
                toast.error('Failed to load saved diagnoses');
            } finally {
                setLoading(false);
            }
        };
        fetchDiagnoses();
    }, [doctorId]);

    const handleSaveDiagnosis = async () => {
        if (!newDiagnosisName.trim()) return;
        setIsSaving(true);
        try {
            if (editingDiagnosis) {
                // Update existing diagnosis
                const { error } = await supabase
                    .from('hospital_doctor_diagnoses' as any)
                    .update({ name: newDiagnosisName.toUpperCase() } as any)
                    .eq('id', editingDiagnosis.id);
                if (error) throw error;
                toast.success('Diagnosis updated!');
                setSavedDiagnoses(savedDiagnoses.map(d => d.id === editingDiagnosis.id ? { ...d, name: newDiagnosisName.toUpperCase() } : d));
            } else {
                // Add new diagnosis
                const { data, error } = await supabase
                    .from('hospital_doctor_diagnoses' as any)
                    .insert({ name: newDiagnosisName.toUpperCase(), doctor_id: doctorId, hospital_id: hospitalId } as any)
                    .select()
                    .single();
                if (error) throw error;
                toast.success('Diagnosis added!');
                setSavedDiagnoses([...savedDiagnoses, data as any]);
            }
            setNewDiagnosisName('');
            setEditingDiagnosis(null);
        } catch (err: any) {
            console.error('Error saving diagnosis:', err);
            toast.error(err.message || 'Failed to save diagnosis');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDiagnosis = async (id: string) => {
        try {
            const { error } = await supabase
                .from('hospital_doctor_diagnoses' as any)
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Diagnosis removed!');
            setSavedDiagnoses(savedDiagnoses.filter(d => d.id !== id));
        } catch (err) {
            console.error('Error deleting diagnosis:', err);
            toast.error('Failed to delete diagnosis');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Manage Saved Diagnoses</h3>
                        <p className="text-sm text-gray-500">Quickly select from your commonly used diagnoses</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Add/Edit Form */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="text-sm font-semibold text-gray-700 mb-3">
                        {editingDiagnosis ? 'Edit Diagnosis' : 'Add New Diagnosis'}
                    </div>
                    <div className="flex gap-3">
                        <textarea
                            placeholder="Diagnosis name (e.g., TYPE 2 DIABETES MELLITUS)"
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm uppercase min-h-[44px]"
                            value={newDiagnosisName}
                            onChange={e => setNewDiagnosisName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSaveDiagnosis())}
                            rows={2}
                        />
                        <button
                            onClick={handleSaveDiagnosis}
                            disabled={isSaving || !newDiagnosisName.trim()}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed self-end h-[44px]"
                        >
                            {isSaving ? '...' : editingDiagnosis ? 'Update' : 'Add'}
                        </button>
                    </div>
                    {editingDiagnosis && (
                        <button
                            onClick={() => { setEditingDiagnosis(null); setNewDiagnosisName(''); }}
                            className="text-xs text-emerald-600 hover:underline mt-2"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : savedDiagnoses.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-sm">No saved diagnoses yet</p>
                            <p className="text-gray-400 text-xs mt-1">Add your common diagnoses above</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {savedDiagnoses.map(diag => (
                                <div
                                    key={diag.id}
                                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100 transition-colors group"
                                >
                                    <span className="font-medium text-gray-900 text-sm">{diag.name}</span>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingDiagnosis(diag); setNewDiagnosisName(diag.name); }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDiagnosis(diag.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageDiagnosesModal;
