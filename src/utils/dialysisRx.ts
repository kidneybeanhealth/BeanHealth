/**
 * dialysisRx — pure helpers for loading a previous dialysis prescription into
 * a new one (EnterpriseDoctorDashboard's Dialysis Rx ▸ Load previous Rx).
 */

/** YYYY-MM-DD for a date in the device's own time zone (IST at the clinic). */
export const localDateKey = (d: Date = new Date()): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * A loaded Rx is a template for today's session, not a copy of the old visit.
 * A review date that has already passed belongs to that old visit; carried over,
 * it would file the patient as overdue the moment the new Rx is sent. Future
 * dates are kept — they may still be the plan. The date lives in two places
 * (`next_review_date` and a `Review:` line in notes), and the modal reads both.
 */
export function asRxTemplate<T extends { next_review_date?: string | null; notes?: string | null }>(
    rx: T,
    todayKey: string = localDateKey(),
): T {
    const notes = rx?.notes || '';
    const noted = (notes.match(/(?:^|\n)Review:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/) || [])[1] || '';
    const review = String(rx?.next_review_date || noted || '').split('T')[0];
    if (!review || review >= todayKey) return rx;
    return { ...rx, next_review_date: null, notes: notes.replace(/(^|\n)Review:[^\n]*/, '$1Review: ') };
}

/** patient id → how many dialysis Rx, and the newest one's timestamp. Rows newest first. */
export function summariseDialysisHistory(rows: { patient_id: string; created_at: string }[]): Record<string, { count: number; lastAt: string }> {
    const out: Record<string, { count: number; lastAt: string }> = {};
    for (const r of rows) {
        const cur = out[r.patient_id];
        if (cur) {
            cur.count += 1;
            if (r.created_at > cur.lastAt) cur.lastAt = r.created_at;
        } else {
            out[r.patient_id] = { count: 1, lastAt: r.created_at };
        }
    }
    return out;
}
