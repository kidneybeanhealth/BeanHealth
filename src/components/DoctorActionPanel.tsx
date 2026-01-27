import React, { useState, useMemo } from 'react';
import { DoctorActionPanelProps, MedicationAction, DoctorVisitAction } from '../types/visitHistory';
import { ALL_PRESET_MEDICATIONS } from '../utils/presetMedications';

const DoctorActionPanel: React.FC<DoctorActionPanelProps> = ({
    patientId,
    currentMedications,
    onSave,
    isSaving,
}) => {
    const [complaint, setComplaint] = useState('');
    const [dietRecommendation, setDietRecommendation] = useState('');
    const [notes, setNotes] = useState('');
    const [medicationActions, setMedicationActions] = useState<MedicationAction[]>([]);

    // Medication form state
    const [showAddMed, setShowAddMed] = useState(false);
    const [medSearchQuery, setMedSearchQuery] = useState('');
    const [showMedDropdown, setShowMedDropdown] = useState(false);
    const [newMed, setNewMed] = useState({
        name: '',
        dosage: '',
        unit: 'mg',
        frequency: 'once daily',
    });

    // Modify medication state
    const [showModifyMed, setShowModifyMed] = useState(false);
    const [selectedMedToModify, setSelectedMedToModify] = useState<string | null>(null);
    const [modifyDosage, setModifyDosage] = useState('');

    // Filter medications for dropdown
    const filteredMedications = useMemo(() => {
        if (!medSearchQuery.trim()) return ALL_PRESET_MEDICATIONS.slice(0, 8);
        const query = medSearchQuery.toLowerCase();
        return ALL_PRESET_MEDICATIONS.filter(med =>
            med.name.toLowerCase().includes(query) ||
            med.category.toLowerCase().includes(query)
        ).slice(0, 8);
    }, [medSearchQuery]);

    const handleAddMedication = () => {
        if (!newMed.name || !newMed.dosage) return;

        setMedicationActions(prev => [...prev, {
            type: 'add',
            medicationName: newMed.name,
            newDosage: newMed.dosage,
            newDosageUnit: newMed.unit,
            newFrequency: newMed.frequency,
        }]);

        setNewMed({ name: '', dosage: '', unit: 'mg', frequency: 'once daily' });
        setShowAddMed(false);
        setMedSearchQuery('');
    };

    const handleModifyMedication = () => {
        if (!selectedMedToModify || !modifyDosage) return;

        const med = currentMedications.find(m => m.id === selectedMedToModify);
        if (!med) return;

        setMedicationActions(prev => [...prev, {
            type: 'modify',
            medicationId: med.id,
            medicationName: med.name,
            newDosage: modifyDosage,
            newDosageUnit: med.dosageUnit,
        }]);

        setSelectedMedToModify(null);
        setModifyDosage('');
        setShowModifyMed(false);
    };

    const handleStopMedication = (medId: string) => {
        const med = currentMedications.find(m => m.id === medId);
        if (!med) return;

        setMedicationActions(prev => [...prev, {
            type: 'stop',
            medicationId: med.id,
            medicationName: med.name,
        }]);
    };

    const removeMedicationAction = (index: number) => {
        setMedicationActions(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        const action: DoctorVisitAction = {
            complaint,
            medicationActions,
            dietRecommendation,
            labOrders: [],
            notes,
        };
        onSave(action);
    };

    const hasChanges = complaint || dietRecommendation || notes || medicationActions.length > 0;

    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-100 dark:border-emerald-900/30">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    📝 Current Visit - Doctor Actions
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Record observations and prescribe treatments for this visit
                </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
                {/* Complaint */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        New Complaint / Observation
                    </label>
                    <textarea
                        value={complaint}
                        onChange={(e) => setComplaint(e.target.value)}
                        placeholder="Enter patient's current complaint or observation..."
                        className="w-full p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        rows={2}
                    />
                </div>

                {/* Medication Actions */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        Medication Changes
                    </label>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        <button
                            onClick={() => setShowAddMed(!showAddMed)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showAddMed
                                    ? 'bg-green-600 text-white'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                }`}
                        >
                            + Add Medication
                        </button>
                        <button
                            onClick={() => setShowModifyMed(!showModifyMed)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showModifyMed
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                }`}
                        >
                            ↑↓ Change Dosage
                        </button>
                    </div>

                    {/* Add Medication Form */}
                    {showAddMed && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-900/30 mb-3">
                            <div className="relative mb-2">
                                <input
                                    type="text"
                                    placeholder="Search medications..."
                                    value={medSearchQuery || newMed.name}
                                    onChange={(e) => {
                                        setMedSearchQuery(e.target.value);
                                        setNewMed(prev => ({ ...prev, name: e.target.value }));
                                        setShowMedDropdown(true);
                                    }}
                                    onFocus={() => setShowMedDropdown(true)}
                                    className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                {showMedDropdown && filteredMedications.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                        {filteredMedications.map((med, idx) => (
                                            <button
                                                key={idx}
                                                className="w-full px-3 py-2 text-left hover:bg-green-50 dark:hover:bg-green-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                                onClick={() => {
                                                    setNewMed({
                                                        name: med.name,
                                                        dosage: med.defaultDosage,
                                                        unit: med.defaultUnit,
                                                        frequency: med.defaultFrequency.replace('_', ' '),
                                                    });
                                                    setMedSearchQuery('');
                                                    setShowMedDropdown(false);
                                                }}
                                            >
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{med.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {med.category} • {med.defaultDosage}{med.defaultUnit}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Dosage"
                                    value={newMed.dosage}
                                    onChange={(e) => setNewMed(prev => ({ ...prev, dosage: e.target.value }))}
                                    className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <select
                                    value={newMed.unit}
                                    onChange={(e) => setNewMed(prev => ({ ...prev, unit: e.target.value }))}
                                    className="w-16 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                    <option value="mg">mg</option>
                                    <option value="g">g</option>
                                    <option value="ml">ml</option>
                                    <option value="mcg">mcg</option>
                                </select>
                                <button
                                    onClick={handleAddMedication}
                                    disabled={!newMed.name || !newMed.dosage}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modify Dosage Form */}
                    {showModifyMed && currentMedications.length > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30 mb-3">
                            <div className="flex gap-2">
                                <select
                                    value={selectedMedToModify || ''}
                                    onChange={(e) => setSelectedMedToModify(e.target.value || null)}
                                    className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select medication...</option>
                                    {currentMedications.filter(m => m.isActive).map(med => (
                                        <option key={med.id} value={med.id}>
                                            {med.name} ({med.dosage} {med.dosageUnit})
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="New dosage"
                                    value={modifyDosage}
                                    onChange={(e) => setModifyDosage(e.target.value)}
                                    className="w-24 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={handleModifyMedication}
                                    disabled={!selectedMedToModify || !modifyDosage}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 rounded-lg"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Stop Medication Quick Actions */}
                    {currentMedications.filter(m => m.isActive).length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick stop:</p>
                            <div className="flex flex-wrap gap-1">
                                {currentMedications.filter(m => m.isActive).slice(0, 5).map(med => (
                                    <button
                                        key={med.id}
                                        onClick={() => handleStopMedication(med.id)}
                                        disabled={medicationActions.some(a => a.medicationId === med.id && a.type === 'stop')}
                                        className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        ✕ {med.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Actions */}
                    {medicationActions.length > 0 && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                Pending Changes ({medicationActions.length})
                            </p>
                            <div className="space-y-1">
                                {medicationActions.map((action, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${action.type === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                action.type === 'stop' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                                    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                            }`}
                                    >
                                        <span>
                                            {action.type === 'add' && '+ Add '}
                                            {action.type === 'stop' && '− Stop '}
                                            {action.type === 'modify' && '↑ Change '}
                                            <strong>{action.medicationName}</strong>
                                            {action.newDosage && ` → ${action.newDosage} ${action.newDosageUnit || ''}`}
                                        </span>
                                        <button
                                            onClick={() => removeMedicationAction(idx)}
                                            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Diet Recommendation */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        Diet Recommendation
                    </label>
                    <input
                        type="text"
                        value={dietRecommendation}
                        onChange={(e) => setDietRecommendation(e.target.value)}
                        placeholder="e.g., Low sodium, potassium restricted..."
                        className="w-full p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        Additional Notes
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional notes for this visit..."
                        className="w-full p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        rows={2}
                    />
                </div>

                {/* Submit */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={handleSubmit}
                        disabled={!hasChanges || isSaving}
                        className="w-full py-3 px-4 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Saving...
                            </>
                        ) : (
                            <>
                                💾 Save Current Visit
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DoctorActionPanel;
