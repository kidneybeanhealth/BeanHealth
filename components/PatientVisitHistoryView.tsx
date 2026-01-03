import React, { useState, useEffect, useCallback } from 'react';
import { PatientVisitHistoryViewProps, VisitRecord, LabTrendData } from '../types/visitHistory';
import { VisitHistoryService } from '../services/visitHistoryService';
import { useAuth } from '../contexts/AuthContext';
import LabTrendGraph from './LabTrendGraph';
import VisitCard from './VisitCard';
import NephrologistScratchpad from './NephrologistScratchpad';
import VisitHistoryModal from './VisitHistoryModal';

const PatientVisitHistoryView: React.FC<PatientVisitHistoryViewProps> = ({
    patientId,
    patientMedications,
    onVisitSaved,
}) => {
    const { user } = useAuth();
    const [visits, setVisits] = useState<VisitRecord[]>([]);
    const [labTrends, setLabTrends] = useState<LabTrendData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [totalVisitCount, setTotalVisitCount] = useState(0);
    const [showAllVisitsModal, setShowAllVisitsModal] = useState(false);

    // Fetch visit history data
    const fetchVisitData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        console.log('[PatientVisitHistoryView] Fetching data for patientId:', patientId);

        try {
            // Fetch visits (last 3)
            const visitData = await VisitHistoryService.getPatientVisits(patientId, 3);
            console.log('[PatientVisitHistoryView] Visits returned:', visitData.length, visitData);
            setVisits(visitData);

            // Fetch total count for "View All" button
            const count = await VisitHistoryService.getVisitCount(patientId);
            setTotalVisitCount(count);

            // Fetch lab trends
            if (visitData.length > 0) {
                const trends = await VisitHistoryService.getLabTrendsAcrossVisits(patientId, visitData);
                console.log('[PatientVisitHistoryView] Trends returned:', trends.length);
                setLabTrends(trends);
            }
        } catch (err) {
            console.error('Error fetching visit history:', err);
            setError('Failed to load visit history');
        } finally {
            setIsLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchVisitData();
    }, [fetchVisitData]);

    // Handle note saved from scratchpad
    const handleNoteSaved = () => {
        // Refresh visit data when a new note is saved
        fetchVisitData();
        onVisitSaved?.();
    };

    return (
        <div className="space-y-6">
            {/* Collapsible Header */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">📋</span>
                        <h3 className="text-lg font-bold text-[#222222] dark:text-white">
                            Visit History
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Last {visits.length} of {totalVisitCount} visits • Trends
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {visits.length > 0 && (
                            <div className="flex -space-x-1">
                                {visits.map((v, idx) => (
                                    <span
                                        key={v.id}
                                        className="w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                                        style={{ backgroundColor: v.color }}
                                    />
                                ))}
                            </div>
                        )}
                        {/* View All History Icon - always visible */}
                        {visits.length > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAllVisitsModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                title={`View complete visit history (${totalVisitCount} visits)`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
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

                {/* Content */}
                {isExpanded && (
                    <div className="px-6 pb-6 space-y-6 animate-slideDown">
                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                                    Loading visit history...
                                </span>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !isLoading && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                <button
                                    onClick={fetchVisitData}
                                    className="mt-2 text-xs text-red-700 dark:text-red-300 underline"
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {/* No Visits State */}
                        {!isLoading && !error && visits.length === 0 && (
                            <div className="text-center py-12">
                                <span className="text-4xl mb-4 block">📋</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No previous visits recorded for this patient.
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    Visits will appear here as you add notes and observations.
                                </p>
                            </div>
                        )}

                        {/* Main Content */}
                        {!isLoading && !error && visits.length > 0 && (
                            <>
                                {/* Visit Cards Grid - Now first */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                                        <span>🗓️</span> Recent Visits
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                                        {visits.map((visit, index) => (
                                            <VisitCard
                                                key={visit.id}
                                                visit={visit}
                                                showConnectionArrow={index < visits.length - 1}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Lab Trend Graph - Now below cards */}
                                {labTrends.length > 0 && (
                                    <LabTrendGraph trends={labTrends} visits={visits} />
                                )}

                                {/* View Complete History Button - always visible when there are visits */}
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={() => setShowAllVisitsModal(true)}
                                        className="w-full py-3 px-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                        View Complete History ({totalVisitCount} visits)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Nephrologist Scratchpad - Replaces DoctorActionPanel */}
            <NephrologistScratchpad
                patientId={patientId}
                onNoteSaved={handleNoteSaved}
            />

            {/* Visit History Modal */}
            <VisitHistoryModal
                patientId={patientId}
                isOpen={showAllVisitsModal}
                onClose={() => setShowAllVisitsModal(false)}
            />
        </div>
    );
};

export default PatientVisitHistoryView;
