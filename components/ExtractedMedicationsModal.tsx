import React, { useState } from 'react';
import { EnhancedMedication, ExtractedMedication } from '../types';
import { MedicationService } from '../services/medicationService';

interface ExtractedMedicationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    extractedMedications: ExtractedMedication[];
    sourceRecordId: string;
    sourceRecordType: string;
    sourceRecordDate: string;
    patientId: string;
    onMedicationsAdded?: (added: EnhancedMedication[], skipped: string[]) => void;
}

const ExtractedMedicationsModal: React.FC<ExtractedMedicationsModalProps> = ({
    isOpen,
    onClose,
    extractedMedications,
    sourceRecordId,
    sourceRecordType,
    sourceRecordDate,
    patientId,
    onMedicationsAdded,
}) => {
    const [selectedMeds, setSelectedMeds] = useState<Set<number>>(
        new Set(extractedMedications.map((_, i) => i))
    );
    const [isAdding, setIsAdding] = useState(false);
    const [preparedMeds, setPreparedMeds] = useState(() =>
        MedicationService.prepareExtractedMedications(extractedMedications, sourceRecordId)
    );

    if (!isOpen) return null;

    const toggleMedication = (index: number) => {
        const newSelected = new Set(selectedMeds);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedMeds(newSelected);
    };

    const handleAddSelected = async () => {
        setIsAdding(true);
        try {
            const medsToAdd = preparedMeds.filter((_, i) => selectedMeds.has(i));
            const result = await MedicationService.addExtractedMedications(
                patientId,
                medsToAdd,
                sourceRecordId
            );

            if (onMedicationsAdded) {
                onMedicationsAdded(result.added, result.skipped);
            }

            onClose();
        } catch (error) {
            console.error('Error adding medications:', error);
            alert('Failed to add medications. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                💊 Medications Detected
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                From: {sourceRecordType} ({new Date(sourceRecordDate).toLocaleDateString()})
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <span className="text-gray-500 dark:text-gray-400">✕</span>
                        </button>
                    </div>
                </div>

                {/* Medications List */}
                <div className="p-4 overflow-y-auto max-h-[50vh]">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Select the medications you want to add to your tracker:
                    </p>
                    <div className="space-y-3">
                        {preparedMeds.map((med, index) => (
                            <div
                                key={index}
                                onClick={() => toggleMedication(index)}
                                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedMeds.has(index)
                                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 ${selectedMeds.has(index)
                                        ? 'border-rose-500 bg-rose-500'
                                        : 'border-gray-300 dark:border-gray-600'
                                        }`}>
                                        {selectedMeds.has(index) && (
                                            <span className="text-white text-sm">✓</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {med.name}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {med.dosage} {med.dosageUnit} • {med.frequency?.replace('_', ' ')}
                                        </p>
                                        {med.instructions && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                                {med.instructions}
                                            </p>
                                        )}
                                        {med.category && (
                                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
                                                {med.category}
                                            </span>
                                        )}
                                        {!med.isCustom && (
                                            <span className="inline-block ml-1 mt-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                                ✓ Matched to preset
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedMeds.size} of {preparedMeds.length} selected
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleAddSelected}
                                disabled={selectedMeds.size === 0 || isAdding}
                                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isAdding ? 'Adding...' : `Add ${selectedMeds.size} Medication${selectedMeds.size !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtractedMedicationsModal;
