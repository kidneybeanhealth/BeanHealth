import React, { useState, useEffect, useCallback } from 'react';
import { Patient, EnhancedMedication, CaseDetails, Vitals, LabTestType } from '../types';
import { AlertWithPatient } from '../types/alerts';
import { LabResultsService } from '../services/labResultsService';
import AlertService from '../services/alertService';
import { ChatService } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';
import { recordDoctorReview } from '../services/acknowledgmentService';
import {
    calculateSnapshot,
    SnapshotResult,
    SnapshotInput,
    MessageForTriage,
    ActionState,
    RiskTier,
    TrendStatus
} from '../services/snapshotLogicService';

interface NephrologistSnapshotProps {
    patient: Patient;
    patientMedications: EnhancedMedication[];
    caseDetails: CaseDetails | null;
    vitals: Vitals | null;
}

const NephrologistSnapshot: React.FC<NephrologistSnapshotProps> = ({
    patient,
    patientMedications,
    caseDetails,
    vitals
}) => {
    const { user } = useAuth();
    const [snapshotData, setSnapshotData] = useState<SnapshotResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);

    // Fetch and calculate snapshot
    const fetchSnapshotData = useCallback(async () => {
        if (!patient?.id || !user?.id) return;

        setIsLoading(true);

        try {
            // Fetch lab data
            const [creatinineData, egfrData, potassiumData, latestLabs] = await Promise.all([
                LabResultsService.getTrendData(patient.id, 'creatinine' as LabTestType, 10),
                LabResultsService.getTrendData(patient.id, 'egfr' as LabTestType, 10),
                LabResultsService.getTrendData(patient.id, 'potassium' as LabTestType, 10),
                LabResultsService.getLatestResults(patient.id)
            ]);

            // Fetch alerts
            let unresolvedAlerts: AlertWithPatient[] = [];
            try {
                const alerts = await AlertService.getAlertsForDoctor(user.id, { includeAcknowledged: false });
                unresolvedAlerts = alerts.filter((a: AlertWithPatient) => a.patient_id === patient.id);
            } catch (e) {
                console.error('Error fetching alerts:', e);
            }

            // Fetch messages
            let patientMessages: MessageForTriage[] = [];
            try {
                const messages = await ChatService.getConversation(user.id, patient.id);
                patientMessages = messages
                    .filter(m => m.senderId === patient.id)
                    .map(m => ({
                        text: m.text || '',
                        isUrgent: m.isUrgent,
                        isRead: m.isRead,
                        timestamp: m.timestamp
                    }));
            } catch (e) {
                console.error('Error fetching messages:', e);
            }

            // Build snapshot input
            const input: SnapshotInput = {
                latestLabs,
                labTrendData: {
                    creatinine: creatinineData,
                    egfr: egfrData,
                    potassium: potassiumData
                },
                unresolvedAlerts,
                medications: patientMedications,
                caseDetails,
                vitals,
                patientMessages,
                lastDoctorReviewedAt: null // TODO: Fetch from database
            };

            // Calculate snapshot using deterministic rules
            const result = calculateSnapshot(input);
            setSnapshotData(result);
        } catch (error) {
            console.error('Error fetching snapshot data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [patient?.id, user?.id, patientMedications, caseDetails, vitals]);

    useEffect(() => {
        fetchSnapshotData();
    }, [fetchSnapshotData]);

    // ==========================================================================
    // UI COMPONENTS
    // ==========================================================================

    // Action State Badge (THE MOST IMPORTANT)
    const ActionStateBadge: React.FC<{ state: ActionState; reason: string; nextAction?: string }> = ({ state, reason, nextAction }) => {
        const styles = {
            'no-action': 'bg-green-500 text-white',
            'review': 'bg-amber-500 text-white',
            'immediate': 'bg-red-600 text-white animate-pulse'
        };
        const icons = {
            'no-action': '✅',
            'review': '⚠️',
            'immediate': '🔴'
        };
        const labels = {
            'no-action': 'No action needed',
            'review': 'Review required',
            'immediate': 'Immediate attention'
        };

        return (
            <div className={`${styles[state]} px-4 py-2 rounded-xl shadow-lg flex flex-col items-end`}>
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icons[state]}</span>
                    <span className="font-bold text-sm">{labels[state]}</span>
                </div>
                {nextAction && (
                    <span className="text-xs font-medium mt-1 bg-white/20 px-2 py-0.5 rounded">
                        → {nextAction}
                    </span>
                )}
                <span className="text-[10px] opacity-90 mt-0.5">{reason}</span>
            </div>
        );
    };

    // Trend display with ONE arrow, ONE word, ONE time reference
    const TrendDisplay: React.FC<{ label: string; trend: TrendStatus }> = ({ label, trend }) => {
        const statusColors = {
            'Abnormal': 'text-red-600 dark:text-red-400',
            'Controlled': 'text-green-600 dark:text-green-400',
            'No data': 'text-gray-400'
        };

        return (
            <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
                <span className={`text-xs font-semibold ${statusColors[trend.status]}`}>
                    {trend.arrow} {trend.status} ({trend.timeRef})
                </span>
            </div>
        );
    };

    // Risk tier badge
    const getRiskTierStyles = (tier: RiskTier) => {
        switch (tier) {
            case 'Stable':
                return 'text-green-700 dark:text-green-400';
            case 'Watch':
                return 'text-amber-700 dark:text-amber-400';
            case 'High-risk':
                return 'text-red-700 dark:text-red-400';
        }
    };

    // Loading state
    if (isLoading || !snapshotData) {
        return (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl p-6 shadow-sm border border-indigo-100 dark:border-indigo-900/50 animate-pulse">
                <div className="h-6 bg-indigo-200/50 dark:bg-indigo-800/30 rounded w-48 mb-4"></div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-24 bg-white/50 dark:bg-white/5 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-indigo-100/50 dark:border-indigo-900/50">
            {/* Header with Action State */}
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h2 className="text-lg font-extrabold text-indigo-900 dark:text-indigo-100 tracking-tight flex items-center gap-2">
                        <span className="text-xl">🔬</span>
                        Nephrologist Snapshot
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        {/* Risk tier - subtle, smaller */}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getRiskTierStyles(snapshotData.riskTier)} bg-opacity-10`}>
                            {snapshotData.riskTier}
                        </span>
                        {snapshotData.riskReason && (
                            <>
                                <span className="text-gray-400 text-[10px]">•</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {snapshotData.riskReason}
                                </span>
                            </>
                        )}
                    </div>
                    {/* Abnormality detection timestamp */}
                    {snapshotData.abnormalityDaysAgo !== null && (
                        <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 font-medium">
                            ⚠️ Abnormality detected: {snapshotData.abnormalityDaysAgo === 0 ? 'Today' : `${snapshotData.abnormalityDaysAgo} day${snapshotData.abnormalityDaysAgo !== 1 ? 's' : ''} ago`}
                        </p>
                    )}
                    {/* Medico-legal timestamp */}
                    {snapshotData.daysSinceReview !== null && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            Last reviewed: {snapshotData.daysSinceReview} days ago
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <ActionStateBadge
                        state={snapshotData.actionState}
                        reason={snapshotData.actionReason}
                        nextAction={snapshotData.nextAction}
                    />
                    {/* Acknowledge button - records that doctor has seen this, does NOT clear red state */}
                    {snapshotData.actionState !== 'no-action' && (
                        <button
                            onClick={async () => {
                                if (!user?.id) return;
                                setIsMarkingReviewed(true);
                                try {
                                    // Record acknowledgment to database
                                    const result = await recordDoctorReview(patient.id, user.id);
                                    if (result.success) {
                                        // Refresh snapshot to show updated review timestamp
                                        await fetchSnapshotData();
                                    } else {
                                        console.error('Failed to record acknowledgment:', result.error);
                                    }
                                } catch (error) {
                                    console.error('Error recording acknowledgment:', error);
                                } finally {
                                    setIsMarkingReviewed(false);
                                }
                            }}
                            disabled={isMarkingReviewed}
                            className="text-[10px] px-2 py-1 bg-white/80 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            title="Records that you've seen this alert. Alert remains active until resolved."
                        >
                            {isMarkingReviewed ? 'Saving...' : '👁 Acknowledge'}
                        </button>
                    )}
                </div>
            </div>

            {/* 5-Section Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* 1️⃣ CKD Identity */}
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">🏷️</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">CKD Identity</span>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <p className="text-xl font-black text-gray-900 dark:text-white">{snapshotData.ckdStage}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{snapshotData.stageDate}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {snapshotData.etiology}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2️⃣ Trend Summary */}
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">📊</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Trends</span>
                    </div>
                    <div className="space-y-1">
                        <TrendDisplay label="eGFR" trend={snapshotData.eGFRTrend} />
                        <TrendDisplay label="Creatinine" trend={snapshotData.creatinineTrend} />
                        <TrendDisplay label="K+" trend={snapshotData.potassiumTrend} />
                        <TrendDisplay label="BP" trend={snapshotData.bpTrend} />
                    </div>
                </div>

                {/* 3️⃣ Medications */}
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">💊</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Medications</span>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {patientMedications.length} active meds
                        </p>
                        <p className={`text-xs font-semibold ${snapshotData.hasRenalRiskMedication ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {snapshotData.hasRenalRiskMedication ? '⚠️' : '✓'} {snapshotData.renalRiskMedicationNote}
                        </p>
                    </div>
                </div>

                {/* 4️⃣ Lab Follow-up */}
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">🔬</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Labs</span>
                    </div>
                    <div className="space-y-2">
                        <p className={`text-xs font-semibold ${snapshotData.hasPendingLabs ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                            {snapshotData.hasPendingLabs ? '⚠️' : '✓'} {snapshotData.pendingLabNote}
                        </p>
                    </div>
                </div>

                {/* 5️⃣ Messages (Safety-focused) */}
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">💬</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Messages</span>
                    </div>
                    <div className="space-y-2">
                        <p className={`text-xs font-semibold ${snapshotData.hasUnreviewedHighRisk ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {snapshotData.hasUnreviewedHighRisk ? '🚨' : '✓'} {snapshotData.messageNote}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {snapshotData.daysSinceLastContact !== null
                                ? `Last contact: ${snapshotData.daysSinceLastContact} day${snapshotData.daysSinceLastContact !== 1 ? 's' : ''} ago`
                                : 'No patient messages yet'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NephrologistSnapshot;
