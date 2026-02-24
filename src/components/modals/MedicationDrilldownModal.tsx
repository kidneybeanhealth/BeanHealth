import React from 'react';
import { EnhancedMedication } from '../../types';
import { RENAL_RISK_MEDICATIONS } from '../../services/snapshotLogicService';

interface MedicationDrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    medications: EnhancedMedication[];
}

const MedicationDrilldownModal: React.FC<MedicationDrilldownModalProps> = ({
    isOpen,
    onClose,
    medications
}) => {
    if (!isOpen) return null;

    // Check if a medication is a renal-risk medication
    const isRenalRisk = (medName: string): boolean => {
        const nameLower = medName.toLowerCase();
        return RENAL_RISK_MEDICATIONS.some(risk => nameLower.includes(risk));
    };

    // Check if medication was recently changed (within 30 days)
    const isRecentChange = (med: EnhancedMedication): boolean => {
        if (!med.createdAt && !med.startDate) return false;
        const startDate = new Date(med.createdAt || med.startDate || '');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return startDate >= thirtyDaysAgo;
    };

    // Group medications by renal risk status
    const renalRiskMeds = medications.filter(m => isRenalRisk(m.name));
    const otherMeds = medications.filter(m => !isRenalRisk(m.name));

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Not recorded';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    const MedicationCard = ({ med }: { med: EnhancedMedication }) => {
        const isRisk = isRenalRisk(med.name);
        const isNew = isRecentChange(med);

        return (
            <div className={`rounded-xl p-3 border ${isRisk
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                }`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {med.name}
                            </h4>
                            {isNew && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-medium rounded">
                                    NEW
                                </span>
                            )}
                            {isRisk && (
                                <span
                                    className="group relative cursor-help"
                                    title="Renal-risk = requires renal attention, not necessarily unsafe"
                                >
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-medium rounded flex items-center gap-1">
                                        ⚠️ Renal-risk
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </span>
                                    {/* Tooltip */}
                                    <span className="absolute bottom-full left-0 mb-1 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        Requires renal attention, not necessarily unsafe. Review in context of patient's kidney function.
                                    </span>
                                </span>
                            )}
                        </div>
                        {med.dosage && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                {med.dosage} {med.frequency ? `• ${med.frequency}` : ''}
                            </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                            Started: {formatDate(med.startDate || med.createdAt)}
                        </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${med.isActive !== false
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                        }`}>
                        {med.isActive !== false ? 'Active' : 'Stopped'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>💊</span>
                            Medication Details
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {medications.length} active medications
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
                    {/* Renal-risk medications section */}
                    {renalRiskMeds.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span>⚠️</span>
                                Renal-Risk Medications ({renalRiskMeds.length})
                            </h3>
                            <div className="space-y-2">
                                {renalRiskMeds.map((med, i) => (
                                    <MedicationCard key={med.id || i} med={med} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other medications section */}
                    {otherMeds.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Other Medications ({otherMeds.length})
                            </h3>
                            <div className="space-y-2">
                                {otherMeds.map((med, i) => (
                                    <MedicationCard key={med.id || i} med={med} />
                                ))}
                            </div>
                        </div>
                    )}

                    {medications.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">No medications on record</p>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            <strong>NEW</strong> = Added in last 30 days •
                            <strong> Renal-risk</strong> = Requires attention in CKD context
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MedicationDrilldownModal;
