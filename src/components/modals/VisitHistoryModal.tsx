import React, { useState, useEffect } from 'react';
import { VisitRecord } from '../../types/visitHistory';
import { VisitHistoryService } from '../../services/visitHistoryService';
import VisitCard from '../VisitCard';

interface VisitHistoryModalProps {
    patientId: string;
    isOpen: boolean;
    onClose: () => void;
}

const VisitHistoryModal: React.FC<VisitHistoryModalProps> = ({
    patientId,
    isOpen,
    onClose,
}) => {
    const [visits, setVisits] = useState<VisitRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        if (isOpen) {
            fetchAllVisits();
        }
    }, [isOpen, patientId]);

    const fetchAllVisits = async () => {
        setIsLoading(true);
        try {
            const [allVisits, count] = await Promise.all([
                VisitHistoryService.getAllPatientVisits(patientId),
                VisitHistoryService.getVisitCount(patientId),
            ]);
            setVisits(allVisits);
            setTotalCount(count);
        } catch (error) {
            console.error('Error fetching all visits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter visits by search query
    const filteredVisits = visits.filter(visit => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            visit.complaint?.toLowerCase().includes(query) ||
            visit.notes?.toLowerCase().includes(query) ||
            visit.visitDate.includes(query) ||
            visit.prescribedBy?.toLowerCase().includes(query)
        );
    });

    // Format date for display
    const formatFullDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (!isOpen) return null;

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
                <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            📋 Complete Visit History
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {totalCount} total visits recorded
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

                {/* Search Bar */}
                <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by date, complaint, notes, or doctor..."
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {searchQuery && (
                        <p className="text-xs text-gray-500 mt-2">
                            Showing {filteredVisits.length} of {visits.length} visits
                        </p>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                                Loading visit history...
                            </span>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-4xl mb-4 block">📋</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {searchQuery ? 'No visits match your search.' : 'No visits recorded yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filteredVisits.map((visit, index) => (
                                <div key={visit.id} className="relative">
                                    {/* Date header */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: visit.color }}
                                        />
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            {formatFullDate(visit.visitDate)}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            Visit #{visit.visitNumber}
                                        </span>
                                    </div>

                                    {/* Visit details */}
                                    <div className={`ml-6 p-4 rounded-xl border-l-4 ${visit.colorClass}`}>
                                        <div className="space-y-3">
                                            {/* Complaint */}
                                            <div>
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                    Chief Complaint
                                                </span>
                                                <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">
                                                    {visit.complaint || 'Not specified'}
                                                </p>
                                            </div>

                                            {/* Doctor */}
                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                <span>
                                                    👨‍⚕️ {visit.prescribedBy}
                                                </span>
                                                {visit.abnormalLabs.length > 0 && (
                                                    <span className="text-red-600 dark:text-red-400">
                                                        ⚠️ {visit.abnormalLabs.length} abnormal lab{visit.abnormalLabs.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Lab Results Summary */}
                                            {visit.labResults.length > 0 && (
                                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                        Lab Results
                                                    </span>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {visit.labResults.map((lab) => (
                                                            <span
                                                                key={lab.id}
                                                                className={`px-2 py-1 text-xs rounded-full ${lab.status === 'abnormal' || lab.status === 'critical'
                                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                                    }`}
                                                            >
                                                                {lab.testType}: {lab.value} {lab.unit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {visit.notes && (
                                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                        Notes
                                                    </span>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                                                        {visit.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Connection line */}
                                    {index < filteredVisits.length - 1 && (
                                        <div className="absolute left-[5px] top-[20px] bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-700" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VisitHistoryModal;
