import React from 'react';
import { TrendStatus } from '../services/snapshotLogicService';

interface LabData {
    label: string;
    trend: TrendStatus;
    values: { date: string; value: number }[];
    unit: string;
    referenceMin: number;
    referenceMax: number;
}

interface LabDrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    labs: LabData[];
}

const LabDrilldownModal: React.FC<LabDrilldownModalProps> = ({ isOpen, onClose, labs }) => {
    if (!isOpen) return null;

    const formatDate = (dateStr: string) => {
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

    const getValueColor = (value: number, min: number, max: number) => {
        if (value < min || value > max) {
            return 'text-red-600 dark:text-red-400 font-semibold';
        }
        return 'text-green-600 dark:text-green-400';
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>🔬</span>
                            Lab Details
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Recent lab values with reference ranges
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
                    {/* Safety Disclaimer */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                            <span className="text-sm">⚠️</span>
                            <span>
                                <strong>Note:</strong> Reference ranges may vary by patient context (age, comorbidities, medications).
                                Values outside range warrant review, not automatic intervention.
                            </span>
                        </p>
                    </div>

                    {/* Lab Cards */}
                    {labs.map((lab, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 dark:text-white">{lab.label}</h3>
                                <span className={`text-xs px-2 py-1 rounded-full ${lab.trend.status === 'Needs attention'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : lab.trend.status === 'Within expected range'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                    }`}>
                                    {lab.trend.status === 'Within expected range' ? 'In range' : lab.trend.status}
                                </span>
                            </div>

                            {/* Reference Range */}
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                                Reference range: {lab.referenceMin} - {lab.referenceMax} {lab.unit}
                            </p>

                            {/* Value History */}
                            {lab.values.length > 0 ? (
                                <div className="space-y-1">
                                    {lab.values.slice(-3).reverse().map((v, i) => (
                                        <div key={i} className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-gray-600 last:border-0">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                                {formatDate(v.date)}
                                            </span>
                                            <span className={`text-sm font-medium ${getValueColor(v.value, lab.referenceMin, lab.referenceMax)}`}>
                                                {v.value} {lab.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">No recent data available</p>
                            )}
                        </div>
                    ))}

                    {labs.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">No lab data available</p>
                        </div>
                    )}
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

export default LabDrilldownModal;
