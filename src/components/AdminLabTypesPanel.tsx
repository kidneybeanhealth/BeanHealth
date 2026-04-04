/**
 * Admin Lab Types Panel
 * 
 * Allows admins to create, edit, and manage custom lab test types.
 * Features:
 * - List all lab types (system + custom)
 * - Create new custom lab types
 * - Edit existing lab types
 * - Set universal vs patient-specific availability
 * - Assign to specific patients
 */

import React, { useState, useEffect } from 'react';
import { CustomLabType, User } from '../types';
import { CustomLabTypesService } from '../services/customLabTypesService';

interface AdminLabTypesPanelProps {
    adminId: string;
}

interface LabTypeFormData {
    name: string;
    code: string;
    unit: string;
    referenceRangeMin: string;
    referenceRangeMax: string;
    description: string;
    isUniversal: boolean;
    displayOrder: string;
}

const emptyFormData: LabTypeFormData = {
    name: '',
    code: '',
    unit: '',
    referenceRangeMin: '',
    referenceRangeMax: '',
    description: '',
    isUniversal: true,
    displayOrder: '100',
};

const AdminLabTypesPanel: React.FC<AdminLabTypesPanelProps> = ({ adminId }) => {
    const [labTypes, setLabTypes] = useState<CustomLabType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingType, setEditingType] = useState<CustomLabType | null>(null);
    const [formData, setFormData] = useState<LabTypeFormData>(emptyFormData);
    const [patients, setPatients] = useState<{ id: string; name: string; email: string }[]>([]);
    const [assigningType, setAssigningType] = useState<CustomLabType | null>(null);
    const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadLabTypes();
        loadPatients();
    }, []);

    const loadLabTypes = async () => {
        setIsLoading(true);
        try {
            const types = await CustomLabTypesService.getAllLabTypes(true); // Include disabled
            setLabTypes(types);
        } catch (err) {
            setError('Failed to load lab types');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPatients = async () => {
        try {
            const pts = await CustomLabTypesService.getAllPatients();
            setPatients(pts);
        } catch (err) {
            console.error('Failed to load patients:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!formData.name.trim() || !formData.code.trim() || !formData.unit.trim()) {
            setError('Name, Code, and Unit are required');
            return;
        }

        try {
            const data = {
                name: formData.name.trim(),
                code: formData.code.toLowerCase().trim().replace(/\s+/g, '_'),
                unit: formData.unit.trim(),
                referenceRangeMin: formData.referenceRangeMin ? parseFloat(formData.referenceRangeMin) : undefined,
                referenceRangeMax: formData.referenceRangeMax ? parseFloat(formData.referenceRangeMax) : undefined,
                description: formData.description.trim(),
                isUniversal: formData.isUniversal,
                displayOrder: parseInt(formData.displayOrder) || 100,
                enabled: true,
                category: 'custom' as const,
                createdBy: adminId,
            };

            if (editingType) {
                await CustomLabTypesService.updateLabType(editingType.id, data);
                setSuccess(`Updated lab type: ${data.name}`);
            } else {
                await CustomLabTypesService.createLabType(data);
                setSuccess(`Created lab type: ${data.name}`);
            }

            setFormData(emptyFormData);
            setIsCreating(false);
            setEditingType(null);
            await loadLabTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to save lab type');
        }
    };

    const handleEdit = (labType: CustomLabType) => {
        setFormData({
            name: labType.name,
            code: labType.code,
            unit: labType.unit,
            referenceRangeMin: labType.referenceRangeMin?.toString() || '',
            referenceRangeMax: labType.referenceRangeMax?.toString() || '',
            description: labType.description || '',
            isUniversal: labType.isUniversal,
            displayOrder: labType.displayOrder?.toString() || '100',
        });
        setEditingType(labType);
        setIsCreating(true);
    };

    const handleDelete = async (labType: CustomLabType) => {
        if (labType.category === 'system') {
            setError('Cannot delete system lab types');
            return;
        }

        if (!confirm(`Are you sure you want to disable "${labType.name}"? This will hide it from patients.`)) {
            return;
        }

        try {
            await CustomLabTypesService.deleteLabType(labType.id);
            setSuccess(`Disabled lab type: ${labType.name}`);
            await loadLabTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to delete lab type');
        }
    };

    const handleRestore = async (labType: CustomLabType) => {
        try {
            await CustomLabTypesService.updateLabType(labType.id, { enabled: true });
            setSuccess(`Restored lab type: ${labType.name}`);
            await loadLabTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to restore lab type');
        }
    };

    const handleAssignPatients = async () => {
        if (!assigningType) return;

        try {
            // For now, we'll assign to selected patients
            for (const patientId of selectedPatients) {
                await CustomLabTypesService.assignToPatient(assigningType.id, patientId, adminId);
            }
            setSuccess(`Assigned ${assigningType.name} to ${selectedPatients.size} patients`);
            setAssigningType(null);
            setSelectedPatients(new Set());
        } catch (err: any) {
            setError(err.message || 'Failed to assign lab type');
        }
    };

    const cancelForm = () => {
        setFormData(emptyFormData);
        setIsCreating(false);
        setEditingType(null);
        setError(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Test Types</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage lab tests available for patients to track
                    </p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-[#7CB342] hover:bg-[#689F38] text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    >
                        <span className="text-lg">+</span>
                        Create Lab Type
                    </button>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-green-700 dark:text-green-300">
                    {success}
                </div>
            )}

            {/* Create/Edit Form */}
            {isCreating && (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {editingType ? 'Edit Lab Type' : 'Create New Lab Type'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Phosphorus"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Code *
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="e.g., phosphorus"
                                    disabled={editingType?.category === 'system'}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Unit *
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    placeholder="e.g., mg/dL"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Reference Min
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.referenceRangeMin}
                                    onChange={(e) => setFormData({ ...formData, referenceRangeMin: e.target.value })}
                                    placeholder="e.g., 2.5"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Reference Max
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.referenceRangeMax}
                                    onChange={(e) => setFormData({ ...formData, referenceRangeMax: e.target.value })}
                                    placeholder="e.g., 4.5"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description of this lab test..."
                                rows={2}
                                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Display Order
                                </label>
                                <input
                                    type="number"
                                    value={formData.displayOrder}
                                    onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7CB342] text-gray-900 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lower numbers appear first</p>
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isUniversal}
                                        onChange={(e) => setFormData({ ...formData, isUniversal: e.target.checked })}
                                        className="w-5 h-5 text-[#7CB342] border-gray-300 rounded focus:ring-[#7CB342]"
                                    />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Available to all patients
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-[#7CB342] hover:bg-[#689F38] text-white font-medium rounded-xl transition-colors"
                            >
                                {editingType ? 'Update Lab Type' : 'Create Lab Type'}
                            </button>
                            <button
                                type="button"
                                onClick={cancelForm}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lab Types List */}
            {isLoading ? (
                <div className="text-center py-12 text-gray-500">Loading lab types...</div>
            ) : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Unit</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Range</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {labTypes.map((labType) => (
                                <tr key={labType.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!labType.enabled ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 dark:text-white">{labType.name}</div>
                                        {labType.description && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{labType.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{labType.code}</code>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{labType.unit}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                        {labType.referenceRangeMin !== undefined && labType.referenceRangeMax !== undefined ? (
                                            `${labType.referenceRangeMin} - ${labType.referenceRangeMax}`
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${labType.category === 'system'
                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                            }`}>
                                            {labType.category === 'system' ? 'System' : 'Custom'}
                                        </span>
                                        {labType.isUniversal && (
                                            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                                Universal
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${labType.enabled
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                            }`}>
                                            {labType.enabled ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(labType)}
                                                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                                Edit
                                            </button>
                                            {!labType.isUniversal && (
                                                <button
                                                    onClick={() => setAssigningType(labType)}
                                                    className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                                                >
                                                    Assign
                                                </button>
                                            )}
                                            {labType.category === 'custom' && (
                                                labType.enabled ? (
                                                    <button
                                                        onClick={() => handleDelete(labType)}
                                                        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                                    >
                                                        Disable
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRestore(labType)}
                                                        className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                                    >
                                                        Restore
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Patient Assignment Modal */}
            {assigningType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Assign "{assigningType.name}" to Patients
                            </h3>
                            <button
                                onClick={() => {
                                    setAssigningType(null);
                                    setSelectedPatients(new Set());
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Select patients who should see this lab type
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                            {patients.map((patient) => (
                                <label key={patient.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedPatients.has(patient.id)}
                                        onChange={(e) => {
                                            const newSet = new Set(selectedPatients);
                                            if (e.target.checked) {
                                                newSet.add(patient.id);
                                            } else {
                                                newSet.delete(patient.id);
                                            }
                                            setSelectedPatients(newSet);
                                        }}
                                        className="w-4 h-4 text-[#7CB342] border-gray-300 rounded"
                                    />
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">{patient.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{patient.email}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleAssignPatients}
                                disabled={selectedPatients.size === 0}
                                className="flex-1 px-4 py-2 bg-[#7CB342] hover:bg-[#689F38] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Assign to {selectedPatients.size} patients
                            </button>
                            <button
                                onClick={() => {
                                    setAssigningType(null);
                                    setSelectedPatients(new Set());
                                }}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLabTypesPanel;
