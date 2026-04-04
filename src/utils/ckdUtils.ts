// CKD Utility Functions
// This file contains utility functions for CKD-specific calculations and status determinations

import { CKDStage, VitalStatus } from '../types';

// ============================================
// CKD STAGE CALCULATION
// ============================================

/**
 * Calculate CKD stage based on eGFR value
 * @param egfr - eGFR value in ml/min/1.73m²
 * @returns CKD stage (1, 2, 3a, 3b, 4, or 5)
 */
export function calculateCKDStage(egfr: number): CKDStage {
    if (egfr >= 90) return '1';
    if (egfr >= 60) return '2';
    if (egfr >= 45) return '3a';
    if (egfr >= 30) return '3b';
    if (egfr >= 15) return '4';
    return '5';
}

/**
 * Get recommended daily fluid target based on CKD stage
 * @param stage - CKD stage
 * @returns Recommended daily fluid intake in ml
 */
export function getFluidTargetByStage(stage: CKDStage): number {
    switch (stage) {
        case '1':
        case '2':
            return 2000; // 2.0 L/day
        case '3a':
        case '3b':
            return 1500; // 1.5 L/day
        case '4':
            return 1200; // 1.2 L/day
        case '5':
            return 1000; // 1.0 L/day (not on dialysis)
        default:
            return 1500; // Default to 1.5 L/day
    }
}

// ============================================
// BLOOD PRESSURE STATUS
// ============================================

/**
 * Determine status of blood pressure for CKD patients
 * @param systolic - Systolic BP
 * @param diastolic - Diastolic BP
 * @returns Status and message
 */
export function getBloodPressureStatus(systolic: number, diastolic: number): {
    status: VitalStatus;
    message: string;
} {
    // Critical: ≥160 systolic or >95 diastolic
    if (systolic >= 160 || diastolic > 95) {
        return { status: 'critical', message: 'Critical - Immediate Review Required' };
    }

    // Alert: ≥140/90
    if (systolic >= 140 || diastolic >= 90) {
        return { status: 'abnormal', message: 'Review Required' };
    }

    // Needs attention: 130-139/80-89
    if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
        return { status: 'borderline', message: 'Needs Attention' };
    }

    // Low BP alert: <100/60
    if (systolic < 100 || diastolic < 60) {
        return { status: 'borderline', message: 'Low Blood Pressure' };
    }

    // Within target: <130/80
    return { status: 'normal', message: 'Within Target' };
}

// ============================================
// HEART RATE STATUS
// ============================================

/**
 * Determine status of heart rate
 * @param heartRate - Heart rate in bpm
 * @returns Status and message
 */
export function getHeartRateStatus(heartRate: number): {
    status: VitalStatus;
    message: string;
} {
    if (heartRate < 50) {
        return { status: 'abnormal', message: 'Low Heart Rate - Monitor' };
    }

    if (heartRate > 110) {
        return { status: 'abnormal', message: 'High Heart Rate - Monitor' };
    }

    if (heartRate >= 60 && heartRate <= 90) {
        return { status: 'normal', message: 'Normal' };
    }

    return { status: 'borderline', message: 'Borderline' };
}

// ============================================
// SPO2 STATUS
// ============================================

/**
 * Determine status of SpO2 (oxygen saturation)
 * @param spo2 - SpO2 percentage
 * @returns Status and message
 */
export function getSpo2Status(spo2: number): {
    status: VitalStatus;
    message: string;
} {
    if (spo2 < 90) {
        return { status: 'critical', message: 'Critical - Urgent' };
    }

    if (spo2 >= 90 && spo2 < 95) {
        return { status: 'abnormal', message: 'Needs Monitoring' };
    }

    return { status: 'normal', message: 'Normal' };
}

// ============================================
// WEIGHT CHANGE STATUS (FLUID RETENTION)
// ============================================

/**
 * Determine if weight change indicates fluid retention
 * @param currentWeight - Current weight in kg
 * @param baselineWeight - Baseline weight in kg
 * @param hoursElapsed - Hours since baseline measurement
 * @returns Status and message
 */
export function getWeightChangeStatus(
    currentWeight: number,
    baselineWeight: number,
    hoursElapsed: number
): {
    status: VitalStatus;
    message: string;
    changeKg: number;
} {
    const changeKg = currentWeight - baselineWeight;
    const changePercent = (changeKg / baselineWeight) * 100;

    // >1 kg increase in 24h or >2 kg in 72h
    if (hoursElapsed <= 24 && changeKg > 1) {
        return {
            status: 'abnormal',
            message: 'Rapid Weight Gain - Possible Fluid Retention',
            changeKg
        };
    }

    if (hoursElapsed <= 72 && changeKg > 2) {
        return {
            status: 'abnormal',
            message: 'Concerning Weight Gain - Fluid Retention Risk',
            changeKg
        };
    }

    // >2% body weight gain over 48-72 hours
    if (hoursElapsed >= 48 && hoursElapsed <= 72 && changePercent > 2) {
        return {
            status: 'abnormal',
            message: 'Fluid Retention Alert - Review Required',
            changeKg
        };
    }

    // Good stability: <0.5 kg fluctuations
    if (Math.abs(changeKg) < 0.5) {
        return {
            status: 'normal',
            message: 'Stable Weight',
            changeKg
        };
    }

    return {
        status: 'borderline',
        message: 'Minor Weight Change',
        changeKg
    };
}

// ============================================
// LAB RESULTS STATUS
// ============================================

/**
 * Determine status of Potassium levels (critical in CKD)
 * @param potassium - Potassium in mmol/L
 * @param onACEiARBMRA - Patient on ACEi/ARB/MRA medications
 * @returns Status and message
 */
export function getPotassiumStatus(potassium: number, onACEiARBMRA: boolean = false): {
    status: VitalStatus;
    message: string;
} {
    if (potassium > 6.0) {
        return { status: 'critical', message: 'Critical - Urgent Clinical Action' };
    }

    if (potassium > 5.5) {
        const severity = onACEiARBMRA ? 'Hyperkalemia - High Risk (on ACEi/ARB/MRA)' : 'Hyperkalemia - Alert';
        return { status: 'abnormal', message: severity };
    }

    if (potassium >= 5.1 && potassium <= 5.5) {
        return { status: 'borderline', message: 'Borderline High - Monitor' };
    }

    if (potassium >= 3.5 && potassium <= 5.0) {
        return { status: 'normal', message: 'Normal' };
    }

    return { status: 'abnormal', message: 'Low Potassium' };
}

/**
 * Determine status of Hemoglobin (CKD Anemia)
 * @param hemoglobin - Hemoglobin in g/dL
 * @returns Status and message
 */
export function getHemoglobinStatus(hemoglobin: number): {
    status: VitalStatus;
    message: string;
} {
    if (hemoglobin < 10) {
        return { status: 'abnormal', message: 'Moderate-Severe Anemia - Review Required' };
    }

    if (hemoglobin >= 10 && hemoglobin < 12) {
        return { status: 'borderline', message: 'Mild Anemia (common in CKD)' };
    }

    return { status: 'normal', message: 'Normal' };
}

/**
 * Determine status of Bicarbonate (Metabolic Acidosis)
 * @param bicarbonate - Bicarbonate in mmol/L
 * @returns Status and message
 */
export function getBicarbonateStatus(bicarbonate: number): {
    status: VitalStatus;
    message: string;
} {
    if (bicarbonate < 22) {
        return { status: 'abnormal', message: 'Metabolic Acidosis (CKD Complication)' };
    }

    if (bicarbonate >= 22 && bicarbonate <= 29) {
        return { status: 'normal', message: 'Normal' };
    }

    return { status: 'borderline', message: 'Elevated Bicarbonate' };
}

/**
 * Determine status of ACR (Albumin-to-Creatinine Ratio)
 * @param acr - ACR in mg/g
 * @returns Status and message
 */
export function getACRStatus(acr: number): {
    status: VitalStatus;
    message: string;
    category: 'normal' | 'moderate' | 'severe';
} {
    if (acr > 300) {
        return {
            status: 'abnormal',
            message: 'Severely Increased Proteinuria',
            category: 'severe'
        };
    }

    if (acr >= 30 && acr <= 300) {
        return {
            status: 'borderline',
            message: 'Moderately Increased Proteinuria',
            category: 'moderate'
        };
    }

    return {
        status: 'normal',
        message: 'Normal',
        category: 'normal'
    };
}

/**
 * Check for ACR category progression (worsening)
 * @param currentACR - Current ACR value
 * @param previousACR - Previous ACR value
 * @returns True if worsened (moved to higher category)
 */
export function hasACRWorsened(currentACR: number, previousACR: number): boolean {
    const currentCategory = getACRStatus(currentACR).category;
    const previousCategory = getACRStatus(previousACR).category;

    const categoryOrder = { 'normal': 0, 'moderate': 1, 'severe': 2 };

    return categoryOrder[currentCategory] > categoryOrder[previousCategory];
}

// ============================================
// GENERAL LAB RESULT STATUS
// ============================================

/**
 * Determine status based on reference range
 * @param value - Lab value
 * @param refMin - Reference range minimum
 * @param refMax - Reference range maximum
 * @returns Status
 */
export function getLabResultStatus(
    value: number,
    refMin: number,
    refMax: number
): VitalStatus {
    // Calculate percentage deviation from normal range
    const midpoint = (refMin + refMax) / 2;
    const rangeSize = refMax - refMin;

    // Within range
    if (value >= refMin && value <= refMax) {
        return 'normal';
    }

    // Slightly outside range (within 10% of range size)
    const deviation = value < refMin ? refMin - value : value - refMax;
    if (deviation <= rangeSize * 0.1) {
        return 'borderline';
    }

    // Significantly outside range (within 25% of range size)
    if (deviation <= rangeSize * 0.25) {
        return 'abnormal';
    }

    // Far outside range
    return 'critical';
}

/**
 * Get color class for status indicator
 * @param status - Vital/lab status
 * @returns Tailwind CSS classes for color
 */
export function getStatusColorClasses(status: VitalStatus): {
    bg: string;
    text: string;
    border: string;
} {
    switch (status) {
        case 'normal':
            return {
                bg: 'bg-green-50 dark:bg-green-900/20',
                text: 'text-green-700 dark:text-green-400',
                border: 'border-green-200 dark:border-green-800'
            };
        case 'borderline':
            return {
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                text: 'text-yellow-700 dark:text-yellow-400',
                border: 'border-yellow-200 dark:border-yellow-800'
            };
        case 'abnormal':
            return {
                bg: 'bg-orange-50 dark:bg-orange-900/20',
                text: 'text-orange-700 dark:text-orange-400',
                border: 'border-orange-200 dark:border-orange-800'
            };
        case 'critical':
            return {
                bg: 'bg-red-50 dark:bg-red-900/20',
                text: 'text-red-700 dark:text-red-400',
                border: 'border-red-200 dark:border-red-800'
            };
        default:
            return {
                bg: 'bg-gray-50 dark:bg-gray-900/20',
                text: 'text-gray-700 dark:text-gray-400',
                border: 'border-gray-200 dark:border-gray-800'
            };
    }
}

/**
 * Get status icon emoji
 * @param status - Vital/lab status
 * @returns Emoji representing status
 */
export function getStatusIcon(status: VitalStatus): string {
    switch (status) {
        case 'normal':
            return '🟢';
        case 'borderline':
            return '🟡';
        case 'abnormal':
            return '🟠';
        case 'critical':
            return '🔴';
        default:
            return '⚪';
    }
}
