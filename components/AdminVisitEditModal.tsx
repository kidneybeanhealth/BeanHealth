import React, { useState, useEffect } from 'react';
import { VisitRecord, VisitMedication, MedicationChangeStatus } from '../types/visitHistory';
import { VisitHistoryService } from '../services/visitHistoryService';
import { VisitMedicationService } from '../services/visitMedicationService';
import { useAuth } from '../contexts/AuthContext';

interface AdminVisitEditModalProps {
    visit: VisitRecord | null;
    patientId: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    isCreating?: boolean; // True when creating a new visit
}

const AdminVisitEditModal: React.FC<AdminVisitEditModalProps> = ({
    visit,
    patientId,
    isOpen,
    onClose,
    onSave,
    isCreating = false,
}) => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [medications, setMedications] = useState<VisitMedication[]>([]);
    const [createdVisitId, setCreatedVisitId] = useState<string | null>(null);

    // Form state
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [complaint, setComplaint] = useState('');
    const [observations, setObservations] = useState('');
    const [dietRecommendation, setDietRecommendation] = useState('');
    const [notes, setNotes] = useState('');

    // New medication form
    const [showAddMed, setShowAddMed] = useState(false);
    const [newMed, setNewMed] = useState({
        name: '',
        dosage: '',
        dosageUnit: 'MG',
        composition: '',
        frequency: '0-0-1 :: DAILY',
        timing: 'AFTER FOOD - DINNER',
        duration: '1 MONTH',
        status: 'unchanged' as MedicationChangeStatus,
    });

    useEffect(() => {
        if (isOpen) {
            if (isCreating) {
                // Reset form for new visit
                setVisitDate(new Date().toISOString().split('T')[0]);
                setComplaint('');
                setObservations('');
                setDietRecommendation('');
                setNotes('');
                setMedications([]);
                setCreatedVisitId(null);
            } else if (visit) {
                loadVisitData();
            }
        }
    }, [isOpen, visit, isCreating]);

    const loadVisitData = async () => {
        if (!visit) return;

        setIsLoading(true);
        setVisitDate(visit.visitDate);
        setComplaint(visit.complaint || '');
        setObservations('');
        setDietRecommendation(visit.dietRecommendation || '');
        setNotes(visit.notes || '');

        try {
            const meds = await VisitMedicationService.getVisitMedications(visit.id);
            setMedications(meds);
        } catch (error) {
            console.error('Error loading medications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (isCreating) {
                // Create new visit - use admin user ID as doctor (or could require doctor selection)
                const adminUserId = user?.id || '';
                if (!adminUserId) {
                    throw new Error('No admin user ID available');
                }

                const newVisit = await VisitHistoryService.createVisit(
                    patientId,
                    adminUserId, // Admin creates the visit
                    {
                        visitDate,
                        complaint,
                        observations,
                        dietRecommendation,
                        notes,
                    }
                );

                // Add medications to the new visit
                if (createdVisitId || newVisit?.id) {
                    for (const med of medications) {
                        await VisitMedicationService.addMedicationToVisit(newVisit?.id || createdVisitId!, {
                            medicationName: med.medicationName,
                            dosage: med.dosage,
                            dosageUnit: med.dosageUnit,
                            frequency: med.frequency,
                            composition: med.composition,
                            timing: med.timing,
                            duration: med.duration,
                            status: med.status,
                            source: 'manual',
                        });
                    }
                }
            } else if (visit) {
                await VisitHistoryService.updateVisit(visit.id, {
                    complaint,
                    observations,
                    dietRecommendation,
                    notes,
                });
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving visit:', error);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSyncFromDashboard = async () => {
        const targetVisitId = visit?.id || createdVisitId;
        if (!targetVisitId) {
            alert('Please save the visit first before syncing medications');
            return;
        }

        setIsSyncing(true);
        try {
            const result = await VisitMedicationService.syncMedicationsFromDashboard(targetVisitId, patientId);
            alert(`Synced ${result.added} medications from patient dashboard. ${result.skipped} skipped.`);

            const meds = await VisitMedicationService.getVisitMedications(targetVisitId);
            setMedications(meds);
        } catch (error) {
            console.error('Error syncing medications:', error);
            alert('Failed to sync medications from dashboard');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAddMedication = async () => {
        if (!newMed.name.trim()) return;

        const targetVisitId = visit?.id || createdVisitId;

        if (targetVisitId) {
            // Add to existing/created visit
            try {
                await VisitMedicationService.addMedicationToVisit(targetVisitId, {
                    medicationName: newMed.name,
                    dosage: newMed.dosage,
                    dosageUnit: newMed.dosageUnit,
                    frequency: newMed.frequency,
                    composition: newMed.composition,
                    timing: newMed.timing,
                    duration: newMed.duration,
                    status: newMed.status,
                    source: 'manual',
                });

                const meds = await VisitMedicationService.getVisitMedications(targetVisitId);
                setMedications(meds);
            } catch (error) {
                console.error('Error adding medication:', error);
                alert('Failed to add medication');
                return;
            }
        } else {
            // Add to local state for new visit (will be saved when visit is saved)
            const tempMed: VisitMedication = {
                id: `temp-${Date.now()}`,
                visitId: '',
                medicationName: newMed.name,
                dosage: newMed.dosage,
                dosageUnit: newMed.dosageUnit,
                frequency: newMed.frequency,
                composition: newMed.composition,
                timing: newMed.timing,
                duration: newMed.duration,
                status: newMed.status,
                source: 'manual',
                createdAt: new Date().toISOString(),
            };
            setMedications([...medications, tempMed]);
        }

        // Reset form
        setNewMed({
            name: '',
            dosage: '',
            dosageUnit: 'MG',
            composition: '',
            frequency: '0-0-1 :: DAILY',
            timing: 'AFTER FOOD - DINNER',
            duration: '1 MONTH',
            status: 'unchanged',
        });
        setShowAddMed(false);
    };

    const handleDeleteMedication = async (medId: string) => {
        if (!confirm('Remove this medication from the visit?')) return;

        if (medId.startsWith('temp-')) {
            // Local medication
            setMedications(medications.filter(m => m.id !== medId));
        } else {
            try {
                await VisitMedicationService.deleteVisitMedication(medId);
                setMedications(medications.filter(m => m.id !== medId));
            } catch (error) {
                console.error('Error deleting medication:', error);
                alert('Failed to remove medication');
            }
        }
    };

    const getStatusColor = (status: MedicationChangeStatus) => {
        switch (status) {
            case 'added': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
            case 'removed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            case 'dosage_increased': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
            case 'dosage_decreased': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    if (!isOpen) return null;
    if (!isCreating && !visit) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {isCreating ? '📝 Create New Visit Record' : '✏️ Edit Visit Record'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isCreating
                                ? 'Add a new visit for this patient'
                                : `Visit #${visit?.visitNumber} • ${new Date(visit?.visitDate || '').toLocaleDateString('en-US', {
                                    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
                                })}`
                            }
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                            <span className="ml-3 text-sm text-gray-500">Loading visit data...</span>
                        </div>
                    ) : (
                        <>
                            {/* Visit Details Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Visit Details
                                </h3>

                                {isCreating && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Visit Date
                                        </label>
                                        <input
                                            type="date"
                                            value={visitDate}
                                            onChange={(e) => setVisitDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Chief Complaint
                                    </label>
                                    <textarea
                                        value={complaint}
                                        onChange={(e) => setComplaint(e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="Patient's main complaint..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Diet Recommendation
                                    </label>
                                    <input
                                        type="text"
                                        value={dietRecommendation}
                                        onChange={(e) => setDietRecommendation(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="Dietary recommendations..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Notes
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="Additional notes..."
                                    />
                                </div>
                            </div>

                            {/* Medications Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        💊 MEDICATIONS FOR THIS VISIT
                                    </h3>
                                    <div className="flex gap-2">
                                        {!isCreating && (
                                            <button
                                                onClick={handleSyncFromDashboard}
                                                disabled={isSyncing}
                                                className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {isSyncing ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
                                                        Syncing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        Sync from Dashboard
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowAddMed(true)}
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            + Add Manually
                                        </button>
                                    </div>
                                </div>

                                {/* Medication List */}
                                {medications.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                        <span className="text-3xl mb-2 block">💊</span>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            No medications linked to this visit yet.
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            Click "+ Add Manually" to add medications.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {medications.map((med) => (
                                            <div
                                                key={med.id}
                                                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(med.status)}`}>
                                                                {med.status.replace('_', ' ')}
                                                            </span>
                                                            <span className="font-bold text-gray-900 dark:text-white text-lg">
                                                                {med.medicationName}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                            <div>
                                                                <span className="text-gray-500 dark:text-gray-400">Dosage:</span>
                                                                <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                                                    {med.dosage} {med.dosageUnit}
                                                                </span>
                                                            </div>
                                                            {med.composition && (
                                                                <div>
                                                                    <span className="text-gray-500 dark:text-gray-400">Composition:</span>
                                                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                                                        {med.composition}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-gray-500 dark:text-gray-400">Frequency:</span>
                                                                <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                                                    {med.frequency}
                                                                </span>
                                                            </div>
                                                            {med.timing && (
                                                                <div>
                                                                    <span className="text-gray-500 dark:text-gray-400">Timing:</span>
                                                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                                                        {med.timing}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {med.duration && (
                                                                <div>
                                                                    <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                                                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                                                        {med.duration}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteMedication(med.id)}
                                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Medication Form - Enhanced */}
                                {showAddMed && (
                                    <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-900/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-green-700 dark:text-green-300 uppercase">
                                                Add Medication
                                            </h4>
                                            <button
                                                onClick={() => setShowAddMed(false)}
                                                className="text-gray-400 hover:text-gray-600 text-xl"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Medicine Name */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                MEDICINE NAME *
                                            </label>
                                            <input
                                                type="text"
                                                value={newMed.name}
                                                onChange={(e) => setNewMed({ ...newMed, name: e.target.value.toUpperCase() })}
                                                placeholder="e.g., TAB.NOVASTAT"
                                                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 uppercase font-medium"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Dosage */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    DOSAGE *
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newMed.dosage}
                                                        onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                                                        placeholder="e.g., 10"
                                                        className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                                                    />
                                                    <select
                                                        value={newMed.dosageUnit}
                                                        onChange={(e) => setNewMed({ ...newMed, dosageUnit: e.target.value })}
                                                        className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                                                    >
                                                        <option value="MG">MG</option>
                                                        <option value="MCG">MCG</option>
                                                        <option value="G">G</option>
                                                        <option value="ML">ML</option>
                                                        <option value="IU">IU</option>
                                                        <option value="UNITS">UNITS</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Composition */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    COMPOSITION
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newMed.composition}
                                                    onChange={(e) => setNewMed({ ...newMed, composition: e.target.value.toUpperCase() })}
                                                    placeholder="e.g., ROSUVASTATIN - 10MG"
                                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Frequency */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    FREQUENCY *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newMed.frequency}
                                                    onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value.toUpperCase() })}
                                                    placeholder="e.g., 0-0-1 :: DAILY"
                                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 uppercase"
                                                />
                                            </div>

                                            {/* Timing */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    TIMING
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newMed.timing}
                                                    onChange={(e) => setNewMed({ ...newMed, timing: e.target.value.toUpperCase() })}
                                                    placeholder="e.g., AFTER FOOD - DINNER"
                                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Duration */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    DURATION
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newMed.duration}
                                                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value.toUpperCase() })}
                                                    placeholder="e.g., 1 MONTH"
                                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 uppercase"
                                                />
                                            </div>

                                            {/* Status */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                    STATUS
                                                </label>
                                                <select
                                                    value={newMed.status}
                                                    onChange={(e) => setNewMed({ ...newMed, status: e.target.value as MedicationChangeStatus })}
                                                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                                                >
                                                    <option value="unchanged">Unchanged</option>
                                                    <option value="added">Added</option>
                                                    <option value="removed">Removed</option>
                                                    <option value="dosage_increased">Dosage Increased</option>
                                                    <option value="dosage_decreased">Dosage Decreased</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleAddMedication}
                                            disabled={!newMed.name.trim()}
                                            className="w-full py-3 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            Add Medication
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                            </>
                        ) : (
                            isCreating ? 'Create Visit' : 'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminVisitEditModal;
