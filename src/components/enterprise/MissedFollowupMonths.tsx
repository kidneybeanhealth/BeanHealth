/**
 * MissedFollowupMonths — month breakdown above the Missed Followup list
 * ─────────────────────────────────────────────────────────────────────
 * "You have 137 missed follow-ups" is not a workload anyone can plan around.
 * Grouped by the month the review was DUE, it becomes one: this month's misses
 * are still warm and worth calling today; last year's are a different job with a
 * different script.
 *
 * Grouping is by due month rather than by how overdue a patient is, because that
 * is the number reception already thinks in — "the August people" — and it makes
 * a month's list a stable, printable unit of work.
 *
 * Counts come from the FULL filtered set, not the page on screen. A month strip
 * that counted only the loaded 50 would be worse than no strip at all.
 */
import React, { useMemo } from 'react';
import type { ReceptionPastRecordPatient } from '../../services/enterpriseReviewService';

export interface MissedMonthBucket {
    /** YYYY-MM — stable key and sort order. */
    key: string;
    label: string;
    patients: ReceptionPastRecordPatient[];
}

/**
 * The review date that put this patient in the missed bucket.
 *
 * Prefers the specific doctor's overdue review over the collapsed
 * `latestReviewDate`, which belongs to whichever review was touched most
 * recently and may be a live future one — filing a patient under October
 * because that is their NEXT appointment would put them in the wrong month.
 */
export const missedReviewDate = (patient: ReceptionPastRecordPatient): string | null => {
    const overdue = (patient.doctorReviews || []).find(
        (dr) => dr.reviewCategory === 'overdue' || dr.reviewCategory === 'followup_needed'
    );
    return overdue?.reviewDate || patient.latestReviewDate || null;
};

/** Group patients by the month their missed review was due, newest month first. */
export const buildMissedMonths = (patients: ReceptionPastRecordPatient[]): MissedMonthBucket[] => {
    const byKey = new Map<string, MissedMonthBucket>();

    for (const patient of patients) {
        const date = missedReviewDate(patient);
        if (!date) continue;
        const key = date.slice(0, 7); // YYYY-MM
        if (!byKey.has(key)) {
            let label = key;
            try {
                label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', {
                    month: 'long', year: 'numeric',
                });
            } catch { /* fall back to the raw key */ }
            byKey.set(key, { key, label, patients: [] });
        }
        byKey.get(key)!.patients.push(patient);
    }

    return Array.from(byKey.values()).sort((a, b) => b.key.localeCompare(a.key));
};

interface Props {
    months: MissedMonthBucket[];
    /** null = show every month together. */
    selectedMonth: string | null;
    onSelectMonth: (key: string | null) => void;
    loading?: boolean;
    /** Prints the currently-selected month (or all, when none is selected). */
    onPrint?: () => void;
}

const MissedFollowupMonths: React.FC<Props> = ({
    months, selectedMonth, onSelectMonth, loading = false, onPrint,
}) => {
    const total = useMemo(
        () => months.reduce((sum, m) => sum + m.patients.length, 0),
        [months]
    );

    if (loading) {
        return (
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-rose-50/30">
                <p className="text-xs font-semibold text-gray-500">Counting missed follow-ups…</p>
            </div>
        );
    }

    if (months.length === 0) {
        return (
            <div className="px-4 sm:px-6 py-6 border-b border-gray-100 bg-emerald-50/40 text-center">
                <p className="text-sm font-bold text-emerald-800">No missed follow-ups</p>
                <p className="text-xs text-emerald-700 mt-0.5">Everyone with a past review date has been seen since.</p>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-rose-50/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Missed follow-ups by month</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                        Grouped by the month the review was due · {total} patient{total === 1 ? '' : 's'} in total
                    </p>
                </div>
                {onPrint && (
                    <button
                        type="button"
                        onClick={onPrint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print {selectedMonth ? months.find(m => m.key === selectedMonth)?.label ?? 'month' : 'all'}
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => onSelectMonth(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        selectedMonth === null
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
                    }`}
                >
                    All months · {total}
                </button>
                {months.map((month) => (
                    <button
                        key={month.key}
                        type="button"
                        onClick={() => onSelectMonth(month.key === selectedMonth ? null : month.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                            selectedMonth === month.key
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
                        }`}
                    >
                        {month.label} · {month.patients.length}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MissedFollowupMonths;
