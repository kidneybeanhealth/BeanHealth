import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedMedication, LabTestType } from '../types';
import { DoctorNotesService, DoctorNote, NoteType } from '../services/doctorNotesService';
import { PatientLabThresholdsService } from '../services/patientLabThresholdsService';
import { VisitHistoryService } from '../services/visitHistoryService';
import { LabResultsService } from '../services/labResultsService';
import { useAuth } from '../contexts/AuthContext';

interface NephrologistScratchpadProps {
    patientId: string;
    onNoteSaved?: () => void;
    readOnly?: boolean;
}

// Lab types to show in threshold editor
const LAB_TYPES: { type: LabTestType; label: string; unit: string }[] = [
    { type: 'creatinine', label: 'Creatinine', unit: 'mg/dL' },
    { type: 'egfr', label: 'eGFR', unit: 'mL/min' },
    { type: 'potassium', label: 'Potassium', unit: 'mEq/L' },
    { type: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL' },
    { type: 'bicarbonate', label: 'Bicarbonate', unit: 'mEq/L' },
];

interface ThresholdData {
    min: number;
    max: number;
    isCustom: boolean;
    reason?: string;
    currentValue?: number;
    status?: string;
}

const NephrologistScratchpad: React.FC<NephrologistScratchpadProps> = ({
    patientId,
    onNoteSaved,
    readOnly = false,
}) => {
    const { user } = useAuth();
    const [noteContent, setNoteContent] = useState('');
    const [isVisibleToPatient, setIsVisibleToPatient] = useState(false);
    const [notes, setNotes] = useState<DoctorNote[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Lab thresholds state
    const [thresholds, setThresholds] = useState<Record<string, ThresholdData>>({});
    const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
    const [editMin, setEditMin] = useState('');
    const [editMax, setEditMax] = useState('');
    const [editReason, setEditReason] = useState('');

    // Note history expansion
    const [showAllNotes, setShowAllNotes] = useState(false);

    // Collapsible state
    const [isExpanded, setIsExpanded] = useState(true);

    // Fetch notes
    const fetchNotes = useCallback(async () => {
        setIsLoadingNotes(true);
        try {
            const notesData = await DoctorNotesService.getNotes(patientId);
            setNotes(notesData);
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setIsLoadingNotes(false);
        }
    }, [patientId]);

    // Fetch thresholds and current lab values
    const fetchThresholds = useCallback(async () => {
        try {
            const [effectiveThresholds, latestLabs] = await Promise.all([
                PatientLabThresholdsService.getAllEffectiveThresholds(patientId),
                LabResultsService.getLatestResults(patientId),
            ]);

            const thresholdData: Record<string, ThresholdData> = {};

            for (const labType of LAB_TYPES) {
                const threshold = effectiveThresholds[labType.type];
                const latestLab = latestLabs[labType.type];

                let status = 'unknown';
                if (latestLab && threshold) {
                    if (latestLab.value < threshold.min || latestLab.value > threshold.max) {
                        status = 'abnormal';
                    } else {
                        status = 'normal';
                    }
                }

                thresholdData[labType.type] = {
                    min: threshold?.min ?? 0,
                    max: threshold?.max ?? 100,
                    isCustom: threshold?.isCustom ?? false,
                    reason: threshold?.reason,
                    currentValue: latestLab?.value,
                    status,
                };
            }

            setThresholds(thresholdData);
        } catch (error) {
            console.error('Error fetching thresholds:', error);
        }
    }, [patientId]);

    useEffect(() => {
        fetchNotes();
        fetchThresholds();
    }, [fetchNotes, fetchThresholds]);

    // Save new note
    const handleSaveNote = async () => {
        if (!noteContent.trim() || !user?.id) return;

        setIsSaving(true);
        try {
            await DoctorNotesService.addNote(
                patientId,
                user.id,
                noteContent.trim(),
                isVisibleToPatient,
                'quick_note'
            );

            setNoteContent('');
            setIsVisibleToPatient(false);
            await fetchNotes();
            onNoteSaved?.();
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Start editing threshold
    const handleEditThreshold = (labType: string) => {
        const threshold = thresholds[labType];
        setEditingThreshold(labType);
        setEditMin(threshold?.min?.toString() || '');
        setEditMax(threshold?.max?.toString() || '');
        setEditReason(threshold?.reason || '');
    };

    // Save threshold
    const handleSaveThreshold = async () => {
        if (!editingThreshold || !user?.id) return;

        try {
            await PatientLabThresholdsService.setThreshold(
                patientId,
                user.id,
                editingThreshold as LabTestType,
                editMin ? parseFloat(editMin) : null,
                editMax ? parseFloat(editMax) : null,
                editReason || undefined
            );

            setEditingThreshold(null);
            await fetchThresholds();
        } catch (error) {
            console.error('Error saving threshold:', error);
        }
    };

    // Reset threshold to default
    const handleResetThreshold = async (labType: string) => {
        if (!user?.id) return;

        try {
            await PatientLabThresholdsService.deleteThreshold(patientId, labType as LabTestType);
            await fetchThresholds();
        } catch (error) {
            console.error('Error resetting threshold:', error);
        }
    };

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const displayedNotes = showAllNotes ? notes : notes.slice(0, 3);

    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
            {/* Collapsible Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">📝</span>
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Nephrologist Scratchpad
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Quick notes & personalized lab thresholds
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {notes.length > 0 && (
                        <span className="text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">
                            {notes.length} note{notes.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-6 space-y-6 border-t border-indigo-100 dark:border-indigo-900/30">
                    {/* Quick Note Section - Only show for doctors (not read-only) */}
                    {!readOnly && (
                        <>
                            {/* Save Note Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveNote}
                                    disabled={!noteContent.trim() || isSaving}
                                    className="px-4 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg transition-colors"
                                >
                                    {isSaving ? 'Saving...' : 'Save Note'}
                                </button>
                            </div>
                            {/* Quick Note Section */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                    Quick Note
                                </label>
                                <textarea
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder="Add clinical observations, follow-up reminders, or any notes about this patient..."
                                    className="w-full p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    rows={3}
                                />
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isVisibleToPatient}
                                        onChange={(e) => setIsVisibleToPatient(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Visible to patient
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        (Patient can see this note in their portal)
                                    </span>
                                </label>
                            </div>
                        </>
                    )}

                    {/* Lab Thresholds Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                ⚙️ Lab Thresholds (Personalized)
                            </label>
                            {!readOnly && (
                                <span className="text-xs text-gray-400">
                                    Click ✏️ to customize ranges for this patient
                                </span>
                            )}
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Lab Type</th>
                                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Range</th>
                                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Current</th>
                                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                                        {!readOnly && <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {LAB_TYPES.map((lab) => {
                                        const threshold = thresholds[lab.type];
                                        const isEditing = editingThreshold === lab.type;

                                        return (
                                            <tr key={lab.type} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                                                <td className="px-4 py-2.5">
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {lab.label}
                                                    </span>
                                                    {threshold?.isCustom && (
                                                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                                            Custom
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                value={editMin}
                                                                onChange={(e) => setEditMin(e.target.value)}
                                                                className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                                placeholder="Min"
                                                                step="0.1"
                                                            />
                                                            <span className="text-gray-400">-</span>
                                                            <input
                                                                type="number"
                                                                value={editMax}
                                                                onChange={(e) => setEditMax(e.target.value)}
                                                                className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                                placeholder="Max"
                                                                step="0.1"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-300">
                                                            {threshold?.min} - {threshold?.max} {lab.unit}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                        {threshold?.currentValue?.toFixed(1) ?? '--'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    {threshold?.status === 'normal' && (
                                                        <span className="text-green-600 dark:text-green-400">🟢 Normal</span>
                                                    )}
                                                    {threshold?.status === 'abnormal' && (
                                                        <span className="text-red-600 dark:text-red-400">🔴 Abnormal</span>
                                                    )}
                                                    {threshold?.status === 'unknown' && (
                                                        <span className="text-gray-400">--</span>
                                                    )}
                                                </td>
                                                {!readOnly && (
                                                    <td className="px-4 py-2.5 text-right">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={handleSaveThreshold}
                                                                    className="px-2 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingThreshold(null)}
                                                                    className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleEditThreshold(lab.type)}
                                                                    className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                                    title="Edit threshold"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                {threshold?.isCustom && (
                                                                    <button
                                                                        onClick={() => handleResetThreshold(lab.type)}
                                                                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                                                        title="Reset to default"
                                                                    >
                                                                        ↩️
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Reason input when editing */}
                        {!readOnly && editingThreshold && (
                            <div className="mt-2">
                                <input
                                    type="text"
                                    value={editReason}
                                    onChange={(e) => setEditReason(e.target.value)}
                                    placeholder="Reason for custom range (optional, e.g., 'Patient's baseline is higher')"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                                />
                            </div>
                        )}
                    </div>

                    {/* Note History Section */}
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                📋 Note History ({notes.length})
                            </label>
                            {notes.length > 3 && (
                                <button
                                    onClick={() => setShowAllNotes(!showAllNotes)}
                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    {showAllNotes ? 'Show Less' : `View All (${notes.length})`}
                                </button>
                            )}
                        </div>

                        {isLoadingNotes ? (
                            <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : notes.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">
                                No notes yet. Add your first note above.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {displayedNotes.map((note) => (
                                    <div
                                        key={note.id}
                                        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                    {formatDate(note.createdAt)}
                                                </span>
                                                {note.isVisibleToPatient && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                        👁️ Patient visible
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                                {note.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NephrologistScratchpad;
