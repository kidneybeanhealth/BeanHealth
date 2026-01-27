import React from 'react';
import { VisitCardProps, MedicationChangeStatus } from '../types/visitHistory';

// Icons for medication changes
const getMedicationChangeIcon = (status: MedicationChangeStatus) => {
    switch (status) {
        case 'added':
            return { icon: '+', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' };
        case 'removed':
            return { icon: '−', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
        case 'dosage_increased':
            return { icon: '↑', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' };
        case 'dosage_decreased':
            return { icon: '↓', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' };
        case 'unchanged':
        default:
            return { icon: '•', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
    }
};

const VisitCard: React.FC<VisitCardProps> = ({ visit, showConnectionArrow = false }) => {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div className="relative flex-1">
            {/* Connection Arrow */}
            {showConnectionArrow && (
                <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 z-10 hidden md:block">
                    <div className="flex items-center">
                        <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Card */}
            <div
                className={`rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg ${visit.colorClass}`}
                style={{ borderColor: visit.color }}
            >
                {/* Header */}
                <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: `${visit.color}20` }}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: visit.color }}
                        >
                            {visit.visitNumber}
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                            Visit {visit.visitNumber}
                        </span>
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {formatDate(visit.visitDate)}
                    </span>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 bg-white dark:bg-[#1e1e1e]">
                    {/* Complaint */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                            Chief Complaint
                        </h4>
                        <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                            {visit.complaint || 'No complaint recorded'}
                        </p>
                    </div>

                    {/* Medications */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Medications
                        </h4>
                        {visit.medications.length > 0 ? (
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {visit.medications.slice(0, 5).map((med) => {
                                    const change = getMedicationChangeIcon(med.status);
                                    const isChanged = med.status !== 'unchanged';

                                    return (
                                        <div
                                            key={med.id}
                                            className={`flex items-center gap-2 text-xs ${isChanged ? 'font-medium' : ''}`}
                                        >
                                            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${change.bg} ${change.color}`}>
                                                {change.icon}
                                            </span>
                                            <span className={`flex-1 truncate ${med.status === 'removed' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {med.name}
                                            </span>
                                            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {med.dosage} {med.dosageUnit}
                                            </span>
                                            {med.previousDosage && (
                                                <span className="text-[10px] text-gray-400 line-through whitespace-nowrap">
                                                    ({med.previousDosage})
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                                {visit.medications.length > 5 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        +{visit.medications.length - 5} more
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No medications</p>
                        )}
                    </div>

                    {/* Diet */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                            Diet Recommendation
                        </h4>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-800 dark:text-gray-200 flex-1 line-clamp-1">
                                {visit.dietRecommendation || 'Not specified'}
                            </p>
                            {visit.dietFollowed !== null && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${visit.dietFollowed
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    }`}>
                                    {visit.dietFollowed ? '✓ Followed' : '✗ Not followed'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Abnormal Labs */}
                    {visit.abnormalLabs.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">
                                ⚠ Abnormal Labs
                            </h4>
                            <div className="flex flex-wrap gap-1">
                                {visit.abnormalLabs.slice(0, 3).map((lab) => (
                                    <span
                                        key={lab.id}
                                        className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                    >
                                        {lab.testType}: {lab.value} {lab.unit}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Doctor */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Prescribed by: <span className="font-medium text-gray-700 dark:text-gray-300">{visit.prescribedBy}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisitCard;
