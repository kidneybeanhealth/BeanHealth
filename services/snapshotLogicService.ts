/**
 * Nephrologist Snapshot Logic Service
 * 
 * DETERMINISTIC RULE-BASED LOGIC
 * No ML, no inference, no guessing
 * Strict medico-legal defensibility
 * 
 * Last Updated: 2024-12-24
 */

import { EnhancedMedication, CaseDetails, Vitals, LabTestType, LabResult } from '../types';
import { AlertWithPatient } from '../types/alerts';

// =============================================================================
// TYPES
// =============================================================================

export type CKDStage = 'Stage 1' | 'Stage 2' | 'Stage 3' | 'Stage 4' | 'Stage 5' | 'Unknown';
export type Etiology = 'Diabetes' | 'Hypertension' | 'Unknown' | 'Other';
export type RiskTier = 'Stable' | 'Watch' | 'High-risk';
export type ActionState = 'no-action' | 'review' | 'immediate';

export interface TrendStatus {
    status: 'Abnormal' | 'Controlled' | 'No data';
    arrow: '↑' | '↓' | '→' | '—';
    timeRef: string;
    value?: number;
}

export interface SnapshotResult {
    // CKD Identity
    ckdStage: CKDStage;
    stageDate: string;
    etiology: Etiology;

    // Risk Tier (with reason)
    riskTier: RiskTier;
    riskReason: string;

    // Trends
    eGFRTrend: TrendStatus;
    creatinineTrend: TrendStatus;
    potassiumTrend: TrendStatus;
    bpTrend: TrendStatus;

    // Medications
    hasRenalRiskMedication: boolean;
    renalRiskMedicationNote: string;

    // Lab Follow-up
    hasPendingLabs: boolean;
    pendingLabNote: string;

    // Messages
    hasUnreviewedHighRisk: boolean;
    messageNote: string;
    daysSinceLastContact: number | null;

    // Action State (THE MOST IMPORTANT)
    actionState: ActionState;
    actionReason: string;

    // NEW: Next Action (workflow nudge, not clinical advice)
    nextAction: string;

    // NEW: Abnormality timestamp (medico-legal)
    abnormalityDetectedAt: string | null;
    abnormalityDaysAgo: number | null;

    // Medico-legal
    lastDoctorReviewedAt: string | null;
    daysSinceReview: number | null;
}

// =============================================================================
// STATIC LISTS (MVP)
// =============================================================================

/**
 * Renal-risk medications
 * ⚠️ No dose advice, no toxicity claims, no recommendations
 */
export const RENAL_RISK_MEDICATIONS = [
    // NSAIDs
    'ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'piroxicam',
    'meloxicam', 'ketorolac', 'celecoxib', 'aspirin',
    // Aminoglycosides
    'gentamicin', 'tobramycin', 'amikacin', 'streptomycin', 'neomycin',
    // Other nephrotoxics
    'vancomycin', 'amphotericin', 'cyclosporine', 'tacrolimus',
    'cisplatin', 'methotrexate', 'lithium', 'acyclovir',
    // Contrast (if flagged)
    'contrast', 'iodinated contrast'
];

/**
 * High-risk message keywords (privacy-safe, no diagnosis)
 */
export const HIGH_RISK_KEYWORDS = [
    'pain', 'severe pain', 'chest pain',
    'breathless', 'breathing', 'short of breath', 'dyspnea',
    'dizziness', 'dizzy', 'faint', 'fainting',
    'vomiting', 'vomit', 'nausea',
    'reduced urine', 'no urine', 'blood in urine', 'dark urine',
    'swelling', 'edema', 'swollen',
    'fever', 'high fever',
    'confusion', 'confused',
    'emergency', 'urgent', 'help'
];

// =============================================================================
// CKD STAGE LOGIC (Section 1)
// =============================================================================

/**
 * Determine CKD Stage from eGFR value
 * STRICT thresholds per KDIGO guidelines
 */
export function getCKDStageFromEGFR(egfr: number | undefined | null): CKDStage {
    if (egfr === undefined || egfr === null) return 'Unknown';

    if (egfr >= 90) return 'Stage 1';
    if (egfr >= 60) return 'Stage 2';
    if (egfr >= 30) return 'Stage 3';  // Combining 3a/3b for simplicity
    if (egfr >= 15) return 'Stage 4';
    return 'Stage 5';
}

/**
 * Get etiology - ONLY doctor-tagged, no inference
 */
export function getEtiology(caseDetails: CaseDetails | null): Etiology {
    if (!caseDetails?.medicalHistory || caseDetails.medicalHistory.length === 0) {
        return 'Unknown';
    }

    const historyLower = caseDetails.medicalHistory.map(h => h.toLowerCase()).join(' ');

    // Only explicit tags
    if (historyLower.includes('diabetic nephropathy') ||
        historyLower.includes('diabetes mellitus') ||
        historyLower.includes('dm ckd') ||
        historyLower.includes('type 2 diabetes') ||
        historyLower.includes('type 1 diabetes')) {
        return 'Diabetes';
    }

    if (historyLower.includes('hypertensive nephropathy') ||
        historyLower.includes('hypertension ckd') ||
        historyLower.includes('htn ckd')) {
        return 'Hypertension';
    }

    // If has medical history but no clear etiology tag
    return 'Unknown';
}

// =============================================================================
// RISK TIER LOGIC (Section 2 - CRITICAL)
// =============================================================================

export interface RiskTierInput {
    lastAbnormalLabDate: Date | null;
    pendingLabCount: number;
    unresolvedAlertCount: number;
}

/**
 * Calculate Risk Tier with reason
 * HARD RULES - non-negotiable
 */
export function calculateRiskTier(input: RiskTierInput): { tier: RiskTier; reason: string } {
    const { lastAbnormalLabDate, pendingLabCount, unresolvedAlertCount } = input;

    // Check if abnormal lab within 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const abnormalLabWithin30Days = lastAbnormalLabDate !== null && lastAbnormalLabDate >= thirtyDaysAgo;

    // RULE 1: High Risk
    if (unresolvedAlertCount >= 1) {
        return { tier: 'High-risk', reason: 'active alert detected' };
    }
    if (abnormalLabWithin30Days) {
        return { tier: 'High-risk', reason: 'abnormal lab detected' };
    }

    // RULE 2: Watch
    if (pendingLabCount >= 1) {
        return { tier: 'Watch', reason: 'pending labs' };
    }

    // RULE 3: Stable
    return { tier: 'Stable', reason: 'no abnormal labs (30 days)' };
}

// =============================================================================
// TREND SUMMARY LOGIC (Section 3)
// =============================================================================

export interface TrendInput {
    values: { date: string; value: number }[];
    normalMin: number;
    normalMax: number;
    invertDirection?: boolean; // For eGFR where ↓ is bad
}

/**
 * Calculate trend from last 2-3 values
 * NO daily data required
 */
export function calculateTrend(input: TrendInput): TrendStatus {
    const { values, normalMin, normalMax, invertDirection = false } = input;

    // No data in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentValues = values.filter(v => new Date(v.date) >= ninetyDaysAgo);

    if (recentValues.length === 0) {
        return { status: 'No data', arrow: '—', timeRef: 'no recent data' };
    }

    const latestValue = recentValues[recentValues.length - 1].value;
    const isAbnormal = latestValue < normalMin || latestValue > normalMax;

    // Determine arrow direction based on last 2-3 values
    let arrow: '↑' | '↓' | '→' = '→';
    let timeRef = 'last 90 days';

    if (recentValues.length >= 2) {
        const oldest = recentValues[0].value;
        const newest = recentValues[recentValues.length - 1].value;
        const percentChange = ((newest - oldest) / oldest) * 100;

        // Determine time reference
        const daysDiff = Math.floor(
            (new Date(recentValues[recentValues.length - 1].date).getTime() -
                new Date(recentValues[0].date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= 14) timeRef = 'last 14 days';
        else if (daysDiff <= 30) timeRef = 'last 30 days';
        else timeRef = 'last 90 days';

        if (percentChange > 10) arrow = '↑';
        else if (percentChange < -10) arrow = '↓';
        else arrow = '→';
    }

    if (isAbnormal) {
        return { status: 'Abnormal', arrow, timeRef, value: latestValue };
    }

    return { status: 'Controlled', arrow, timeRef, value: latestValue };
}

/**
 * Calculate BP trend from vitals
 */
export function calculateBPTrend(vitals: Vitals | null): TrendStatus {
    if (!vitals?.bloodPressure?.value) {
        return { status: 'No data', arrow: '—', timeRef: 'no recent data' };
    }

    const bpStr = vitals.bloodPressure.value;
    const match = bpStr.match(/(\d+)\/(\d+)/);

    if (!match) {
        return { status: 'No data', arrow: '—', timeRef: 'invalid format' };
    }

    const systolic = parseInt(match[1]);
    const diastolic = parseInt(match[2]);

    // BP targets for CKD: <140/90 mmHg (general), <130/80 for diabetics
    const isControlled = systolic < 140 && diastolic < 90;

    return {
        status: isControlled ? 'Controlled' : 'Abnormal',
        arrow: '→', // BP shown without trend arrow
        timeRef: 'current',
        value: systolic
    };
}

// =============================================================================
// NEPHROTOXIC MEDICATION FLAG (Section 4)
// =============================================================================

/**
 * Check for renal-risk medications
 * ⚠️ No dose advice, no toxicity claims, no recommendations
 */
export function checkRenalRiskMedications(medications: EnhancedMedication[]): {
    hasRisk: boolean;
    note: string;
} {
    const foundMeds: string[] = [];

    for (const med of medications) {
        const medNameLower = med.name.toLowerCase();
        for (const riskMed of RENAL_RISK_MEDICATIONS) {
            if (medNameLower.includes(riskMed)) {
                foundMeds.push(med.name);
                break;
            }
        }
    }

    if (foundMeds.length > 0) {
        return {
            hasRisk: true,
            note: 'Renal-risk medication present'
        };
    }

    return {
        hasRisk: false,
        note: 'No renal-risk medications'
    };
}

// =============================================================================
// LAB FOLLOW-UP LOGIC (Section 5)
// =============================================================================

/**
 * Get expected lab frequency based on CKD stage
 */
export function getExpectedLabFrequencyDays(stage: CKDStage): number {
    switch (stage) {
        case 'Stage 5': return 15;  // Every 15-30 days
        case 'Stage 4': return 30;  // Every 30-60 days
        case 'Stage 3': return 45;  // Every 30-60 days
        case 'Stage 2': return 90;  // Every 90 days
        case 'Stage 1': return 180; // Every 6 months
        default: return 90;
    }
}

/**
 * Check if labs are pending/overdue
 */
export function checkPendingLabs(
    stage: CKDStage,
    lastLabDate: Date | null,
    doctorOverrideDays?: number
): { isPending: boolean; note: string } {
    if (!lastLabDate) {
        return { isPending: true, note: 'No labs on record' };
    }

    const expectedDays = doctorOverrideDays ?? getExpectedLabFrequencyDays(stage);
    const expectedDate = new Date(lastLabDate);
    expectedDate.setDate(expectedDate.getDate() + expectedDays);

    const today = new Date();
    const isPending = expectedDate < today;

    if (isPending) {
        const daysOverdue = Math.floor((today.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
        return { isPending: true, note: `Labs overdue by ${daysOverdue} days` };
    }

    const daysUntil = Math.floor((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { isPending: false, note: `Next scheduled labs: ${daysUntil} days` };
}

// =============================================================================
// MESSAGE TRIAGE LOGIC (Section 6)
// =============================================================================

export interface MessageForTriage {
    text: string;
    isUrgent?: boolean;
    isRead?: boolean;
    timestamp: string;
}

/**
 * Check for high-risk unreviewed messages
 * ⚠️ No blocking, no auto-response, no diagnosis
 */
export function checkHighRiskMessages(messages: MessageForTriage[]): {
    hasUnreviewedHighRisk: boolean;
    note: string;
    hoursAgo?: number;
} {
    for (const msg of messages) {
        // Skip if already read/acknowledged
        if (msg.isRead) continue;

        // Check if doctor-marked urgent
        if (msg.isUrgent) {
            const hoursAgo = Math.floor(
                (Date.now() - new Date(msg.timestamp).getTime()) / (1000 * 60 * 60)
            );
            return {
                hasUnreviewedHighRisk: true,
                note: `Unreviewed high-risk message (${hoursAgo}h)`,
                hoursAgo
            };
        }

        // Check for high-risk keywords
        const textLower = msg.text?.toLowerCase() || '';
        for (const keyword of HIGH_RISK_KEYWORDS) {
            if (textLower.includes(keyword)) {
                const hoursAgo = Math.floor(
                    (Date.now() - new Date(msg.timestamp).getTime()) / (1000 * 60 * 60)
                );
                return {
                    hasUnreviewedHighRisk: true,
                    note: `Unreviewed high-risk message (${hoursAgo}h)`,
                    hoursAgo
                };
            }
        }
    }

    return {
        hasUnreviewedHighRisk: false,
        note: 'No unreviewed high-risk messages'
    };
}

// =============================================================================
// ACTION STATE LOGIC (Section 7 - THE MOST IMPORTANT)
// =============================================================================

export interface ActionStateInput {
    riskTier: RiskTier;
    abnormalTrendPresent: boolean;
    unreviewedHighRiskMessage: boolean;
}

/**
 * Calculate Action State
 * 
 * 🚫 HARD RULE (NON-NEGOTIABLE):
 * "No action needed" can NEVER coexist with abnormal data.
 */
export function calculateActionState(input: ActionStateInput): {
    state: ActionState;
    reason: string;
} {
    const { riskTier, abnormalTrendPresent, unreviewedHighRiskMessage } = input;

    // IMMEDIATE ATTENTION (Red)
    if (unreviewedHighRiskMessage) {
        return { state: 'immediate', reason: 'Unreviewed high-risk message' };
    }
    if (abnormalTrendPresent) {
        return { state: 'immediate', reason: 'Abnormal trend detected' };
    }
    if (riskTier === 'High-risk') {
        return { state: 'immediate', reason: 'High-risk status' };
    }

    // REVIEW REQUIRED (Amber)
    if (riskTier === 'Watch') {
        return { state: 'review', reason: 'Pending follow-up items' };
    }

    // NO ACTION NEEDED (Green) - ONLY if everything is stable
    return { state: 'no-action', reason: 'All metrics stable' };
}

// =============================================================================
// MAIN SNAPSHOT CALCULATOR
// =============================================================================

export interface SnapshotInput {
    // Lab data
    latestLabs: Record<LabTestType, LabResult | null>;
    labTrendData: {
        creatinine: { date: string; value: number }[];
        egfr: { date: string; value: number }[];
        potassium: { date: string; value: number }[];
    };

    // Alerts
    unresolvedAlerts: AlertWithPatient[];

    // Medications
    medications: EnhancedMedication[];

    // Case details
    caseDetails: CaseDetails | null;

    // Vitals
    vitals: Vitals | null;

    // Messages from patient
    patientMessages: MessageForTriage[];

    // Last doctor review timestamp
    lastDoctorReviewedAt: Date | null;

    // Optional doctor override for lab frequency
    labFrequencyOverrideDays?: number;
}

/**
 * Calculate complete snapshot with all rules applied
 */
export function calculateSnapshot(input: SnapshotInput): SnapshotResult {
    const {
        latestLabs,
        labTrendData,
        unresolvedAlerts,
        medications,
        caseDetails,
        vitals,
        patientMessages,
        lastDoctorReviewedAt,
        labFrequencyOverrideDays
    } = input;

    // =========================================================================
    // 1. CKD IDENTITY
    // =========================================================================
    const latestEgfr = latestLabs['egfr'];
    const ckdStage = getCKDStageFromEGFR(latestEgfr?.value);
    const stageDate = latestEgfr?.testDate || latestEgfr?.test_date || 'Unknown';
    const etiology = getEtiology(caseDetails);

    // =========================================================================
    // 2. TREND CALCULATIONS
    // =========================================================================
    const eGFRTrend = calculateTrend({
        values: labTrendData.egfr,
        normalMin: 60,
        normalMax: 999,
        invertDirection: true
    });

    const creatinineTrend = calculateTrend({
        values: labTrendData.creatinine,
        normalMin: 0.7,
        normalMax: 1.3
    });

    const potassiumTrend = calculateTrend({
        values: labTrendData.potassium,
        normalMin: 3.5,
        normalMax: 5.0
    });

    const bpTrend = calculateBPTrend(vitals);

    // =========================================================================
    // 3. DETECT ABNORMAL TRENDS
    // =========================================================================
    const abnormalTrendPresent =
        eGFRTrend.status === 'Abnormal' ||
        creatinineTrend.status === 'Abnormal' ||
        potassiumTrend.status === 'Abnormal' ||
        bpTrend.status === 'Abnormal';

    // =========================================================================
    // 4. MEDICATION CHECK
    // =========================================================================
    const { hasRisk: hasRenalRiskMedication, note: renalRiskMedicationNote } =
        checkRenalRiskMedications(medications);

    // =========================================================================
    // 5. LAB FOLLOW-UP CHECK
    // =========================================================================
    const lastLabDate = latestLabs['creatinine']?.testDate
        ? new Date(latestLabs['creatinine'].testDate)
        : null;

    const { isPending: hasPendingLabs, note: pendingLabNote } =
        checkPendingLabs(ckdStage, lastLabDate, labFrequencyOverrideDays);

    // =========================================================================
    // 6. MESSAGE TRIAGE
    // =========================================================================
    const { hasUnreviewedHighRisk, note: messageNote } =
        checkHighRiskMessages(patientMessages);

    // Calculate days since last contact
    let daysSinceLastContact: number | null = null;
    if (patientMessages.length > 0) {
        const lastMsgDate = new Date(patientMessages[patientMessages.length - 1].timestamp);
        daysSinceLastContact = Math.floor(
            (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60 * 24)
        );
    }

    // =========================================================================
    // 7. LAST ABNORMAL LAB DATE (for risk tier)
    // =========================================================================
    let lastAbnormalLabDate: Date | null = null;

    // Check each lab trend for abnormal status
    if (creatinineTrend.status === 'Abnormal' && labTrendData.creatinine.length > 0) {
        const lastCreatDate = new Date(labTrendData.creatinine[labTrendData.creatinine.length - 1].date);
        if (!lastAbnormalLabDate || lastCreatDate > lastAbnormalLabDate) {
            lastAbnormalLabDate = lastCreatDate;
        }
    }
    if (potassiumTrend.status === 'Abnormal' && labTrendData.potassium.length > 0) {
        const lastKDate = new Date(labTrendData.potassium[labTrendData.potassium.length - 1].date);
        if (!lastAbnormalLabDate || lastKDate > lastAbnormalLabDate) {
            lastAbnormalLabDate = lastKDate;
        }
    }

    // =========================================================================
    // 8. RISK TIER CALCULATION
    // =========================================================================
    const { tier: riskTier, reason: riskReason } = calculateRiskTier({
        lastAbnormalLabDate,
        pendingLabCount: hasPendingLabs ? 1 : 0,
        unresolvedAlertCount: unresolvedAlerts.length
    });

    // =========================================================================
    // 9. ACTION STATE (THE MOST IMPORTANT - HARD RULE)
    // =========================================================================
    const { state: actionState, reason: actionReason } = calculateActionState({
        riskTier,
        abnormalTrendPresent,
        unreviewedHighRiskMessage: hasUnreviewedHighRisk
    });

    // =========================================================================
    // 10. MEDICO-LEGAL TIMESTAMP
    // =========================================================================
    let daysSinceReview: number | null = null;
    if (lastDoctorReviewedAt) {
        daysSinceReview = Math.floor(
            (Date.now() - lastDoctorReviewedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
    }

    // =========================================================================
    // 11. NEXT ACTION (workflow nudge, not clinical advice)
    // =========================================================================
    let nextAction = '';
    if (actionState === 'immediate') {
        if (hasUnreviewedHighRisk) {
            nextAction = 'Review patient message';
        } else if (abnormalTrendPresent) {
            nextAction = 'Review abnormal labs';
        } else if (unresolvedAlerts.length > 0) {
            nextAction = 'Review active alerts';
        } else {
            nextAction = 'Review patient status';
        }
    } else if (actionState === 'review') {
        if (hasPendingLabs) {
            nextAction = 'Order repeat labs';
        } else {
            nextAction = 'Schedule follow-up';
        }
    } else {
        nextAction = ''; // No action needed
    }

    // =========================================================================
    // 12. ABNORMALITY DETECTION TIMESTAMP
    // =========================================================================
    let abnormalityDetectedAt: string | null = null;
    let abnormalityDaysAgo: number | null = null;

    if (lastAbnormalLabDate) {
        abnormalityDetectedAt = lastAbnormalLabDate.toISOString();
        abnormalityDaysAgo = Math.floor(
            (Date.now() - lastAbnormalLabDate.getTime()) / (1000 * 60 * 60 * 24)
        );
    }

    // =========================================================================
    // RETURN COMPLETE SNAPSHOT
    // =========================================================================
    return {
        ckdStage,
        stageDate: typeof stageDate === 'string' ? stageDate : 'Unknown',
        etiology,
        riskTier,
        riskReason,
        eGFRTrend,
        creatinineTrend,
        potassiumTrend,
        bpTrend,
        hasRenalRiskMedication,
        renalRiskMedicationNote,
        hasPendingLabs,
        pendingLabNote,
        hasUnreviewedHighRisk,
        messageNote,
        daysSinceLastContact,
        actionState,
        actionReason,
        nextAction,
        abnormalityDetectedAt,
        abnormalityDaysAgo,
        lastDoctorReviewedAt: lastDoctorReviewedAt?.toISOString() || null,
        daysSinceReview
    };
}
