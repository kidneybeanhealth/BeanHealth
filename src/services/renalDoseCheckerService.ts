/**
 * Renal Dose Checker Service
 *
 * Given a drug name (raw prescription string) and an optional eGFR value,
 * returns an alert describing any renal dose concern.
 *
 * Two modes:
 *  - eGFR known   → band-specific recommendation + severity
 *  - eGFR unknown → generic precaution alert (severity 'caution')
 *
 * The service is intentionally synchronous and dependency-free so it can
 * run inline in the prescription modal on every drug-name change without
 * any async overhead.
 */

import {
    findMatchingRules,
    RenalDoseRule,
    RenalAlertSeverity,
    EgfrBand,
} from '../data/renalDoseDatabase';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RenalDoseAlert {
    /** Display label, e.g. "Metformin" or "NSAIDs" */
    label: string;
    /** ok | caution | reduce | avoid */
    severity: RenalAlertSeverity;
    /** One-line actionable message to show in the prescription row */
    message: string;
    /** Full recommendation text for the expanded tooltip / modal */
    fullRecommendation: string;
    /** Guideline citation */
    source: string;
    /** Whether this should render as a blocking interruptive alert */
    hardStop: boolean;
    /** True when eGFR was not available — message is generic */
    egfrUnavailable: boolean;
    /** The eGFR value used (null when unavailable) */
    egfrUsed: number | null;
}

// ---------------------------------------------------------------------------
// Core checker
// ---------------------------------------------------------------------------

/**
 * Check a single drug entry against renal dose rules.
 *
 * @param drugName  Raw prescription string (e.g. "TAB. GLYCOMET SR 500")
 * @param egfr      Latest eGFR in mL/min/1.73m², or null if unavailable
 * @returns         Array of alerts (usually 0 or 1; occasionally 2 for combos)
 */
export function checkRenalDose(
    drugName: string,
    egfr: number | null
): RenalDoseAlert[] {
    if (!drugName || !drugName.trim()) return [];

    const matchedRules = findMatchingRules(drugName);
    if (matchedRules.length === 0) return [];

    return matchedRules
        .map(rule => buildAlert(rule, egfr))
        .filter((a): a is RenalDoseAlert => a !== null);
}

/**
 * Check every medication row in a prescription list.
 * Returns a map of rowIndex → alerts for that drug.
 */
export function checkAllMedications(
    medications: Array<{ name?: string }>,
    egfr: number | null
): Map<number, RenalDoseAlert[]> {
    const result = new Map<number, RenalDoseAlert[]>();
    medications.forEach((med, idx) => {
        const alerts = checkRenalDose(med.name || '', egfr);
        if (alerts.length > 0) result.set(idx, alerts);
    });
    return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildAlert(
    rule: RenalDoseRule,
    egfr: number | null
): RenalDoseAlert | null {
    if (egfr !== null && !isNaN(egfr)) {
        // eGFR known — find the matching band
        const band = findBand(rule.bands, egfr);
        if (!band) return null; // should not happen if bands cover 0–999
        if (band.severity === 'ok') return null; // no alert needed

        return {
            label: rule.label,
            severity: band.severity,
            message: buildShortMessage(band.severity, rule.label, egfr),
            fullRecommendation: band.recommendation,
            source: rule.source,
            hardStop: rule.hard_stop === true && band.severity === 'avoid',
            egfrUnavailable: false,
            egfrUsed: egfr,
        };
    } else {
        // eGFR unknown — generic alert
        return {
            label: rule.label,
            severity: 'caution',
            message: `Renal function unknown — verify before prescribing ${rule.label}`,
            fullRecommendation: rule.generic_alert,
            source: rule.source,
            hardStop: false, // never hard-stop when we don't have the data
            egfrUnavailable: true,
            egfrUsed: null,
        };
    }
}

function findBand(bands: EgfrBand[], egfr: number): EgfrBand | undefined {
    // Bands are defined as [egfr_min, egfr_max) exclusive upper
    return bands.find(b => egfr >= b.egfr_min && egfr < b.egfr_max);
}

function buildShortMessage(
    severity: RenalAlertSeverity,
    label: string,
    egfr: number
): string {
    const egfrStr = `eGFR ${Math.round(egfr)}`;
    switch (severity) {
        case 'avoid':
            return `${label} — AVOID at ${egfrStr}`;
        case 'reduce':
            return `${label} — dose reduction needed at ${egfrStr}`;
        case 'caution':
            return `${label} — use with caution at ${egfrStr}`;
        default:
            return `${label} — check dose at ${egfrStr}`;
    }
}

// ---------------------------------------------------------------------------
// eGFR staleness check
// ---------------------------------------------------------------------------

/**
 * Returns true if the latest creatinine/eGFR result is older than 90 days
 * (KDIGO recommendation for monitoring interval).
 */
export function isEgfrStale(lastLabDate: string | null | undefined): boolean {
    if (!lastLabDate) return true;
    const daysDiff = (Date.now() - new Date(lastLabDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 90;
}

// ---------------------------------------------------------------------------
// Severity helpers for UI rendering
// ---------------------------------------------------------------------------

export const SEVERITY_CONFIG: Record<
    RenalAlertSeverity,
    { bg: string; border: string; text: string; icon: string; label: string }
> = {
    ok:      { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: '✓',  label: 'OK' },
    caution: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: '⚠',  label: 'Caution' },
    reduce:  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: '↓',  label: 'Reduce dose' },
    avoid:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: '✕',  label: 'Avoid' },
};

/**
 * Returns the highest severity from a list of alerts.
 * Used to determine the worst-case badge for a prescription row.
 */
export function highestSeverity(alerts: RenalDoseAlert[]): RenalAlertSeverity {
    const order: RenalAlertSeverity[] = ['avoid', 'reduce', 'caution', 'ok'];
    for (const s of order) {
        if (alerts.some(a => a.severity === s)) return s;
    }
    return 'ok';
}
