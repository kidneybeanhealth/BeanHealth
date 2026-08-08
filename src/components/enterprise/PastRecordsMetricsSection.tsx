/**
 * PastRecordsMetricsSection — patient metrics outside the live queue
 * ──────────────────────────────────────────────────────────────────
 * The OPD metrics a doctor records in the live queue were only reachable while
 * the patient was still in that queue. This makes the same record viewable and
 * editable from Past Records on both the Reception and Doctor dashboards.
 *
 * Deliberately lazy: Past Records lists 50 patients a page, and pulling a full
 * metrics history for every row would be wasted work for the one or two a user
 * actually opens. Nothing is fetched until the section is expanded, and the
 * result is cached per source for as long as the card stays mounted.
 *
 * Both dashboards render this one component so the surface cannot drift apart
 * the way the surrounding Past Records cards did.
 */
import React, { useCallback, useEffect, useState } from 'react';
import QueuePatientMetricsPanel from './QueuePatientMetricsPanel';
import {
    fetchDepartmentQueueMetrics,
    type MetricsSource,
    type QueuePatientMetricsSnapshot,
} from '../../services/departmentPatientMetricsService';
import type { ReceptionPastRecordPatient } from '../../services/enterpriseReviewService';

interface Props {
    hospitalId: string;
    patientId: string;
    patientName?: string;
    appAccessEnabled?: boolean;
    /**
     * Drives which department metrics profile applies. The Doctor dashboard
     * passes its own specialty; Reception has no doctor of its own and passes
     * the treating doctor's (see resolvePatientDoctorSpecialty).
     */
    doctorSpecialty: string | null;
    /** Visual accent so the section sits naturally in each dashboard's palette. */
    accent?: 'orange' | 'slate';
}

/**
 * Which department profile applies to a Past Records patient?
 *
 * Reception is department-agnostic, so the profile has to come from whoever is
 * actually treating the patient: their most recent review's doctor first, then
 * the doctor on their latest prescription. Returning null (rather than assuming
 * a default) keeps the department isolation intact — an unconfigured department
 * shows the "no profile" notice instead of borrowing another one's metrics.
 */
export const resolvePatientDoctorSpecialty = (
    patient: Pick<ReceptionPastRecordPatient, 'doctorReviews' | 'prescriptions'>
): string | null => {
    const fromReview = patient.doctorReviews?.find(r => r.doctorSpecialty)?.doctorSpecialty;
    if (fromReview) return fromReview;
    const fromRx = patient.prescriptions?.find(rx => rx.doctor?.specialty)?.doctor?.specialty;
    return fromRx || null;
};

const ACCENTS = {
    orange: {
        button: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
        shell: 'border-orange-100 bg-gradient-to-br from-orange-50/40 to-white',
    },
    slate: {
        button: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
        shell: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white',
    },
} as const;

const PastRecordsMetricsSection: React.FC<Props> = ({
    hospitalId,
    patientId,
    patientName,
    appAccessEnabled,
    doctorSpecialty,
    accent = 'orange',
}) => {
    const [open, setOpen] = useState(false);
    const [source, setSource] = useState<MetricsSource>('opd');
    const [snapshot, setSnapshot] = useState<QueuePatientMetricsSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState(0);

    const styles = ACCENTS[accent];

    useEffect(() => {
        if (!open || !hospitalId || !patientId) return;

        let isActive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await fetchDepartmentQueueMetrics({
                    hospitalId,
                    patientIds: [patientId],
                    doctorSpecialty,
                    sources: [source],
                });
                if (isActive) setSnapshot(result[patientId] || null);
            } catch (err) {
                console.error('[PastRecordsMetricsSection] load failed', err);
                if (isActive) setError('Could not load patient metrics');
            } finally {
                if (isActive) setLoading(false);
            }
        })();

        return () => { isActive = false; };
    }, [open, hospitalId, patientId, doctorSpecialty, source, refreshToken]);

    const handleSaved = useCallback(() => setRefreshToken(t => t + 1), []);

    return (
        <div className="mt-3">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors ${styles.button}`}
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Patient Metrics
                <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className={`mt-3 rounded-2xl border p-4 ${styles.shell}`}>
                    {loading && !snapshot ? (
                        <p className="text-sm font-medium text-gray-500 py-4 text-center">Loading metrics…</p>
                    ) : error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm font-medium">
                            {error}
                        </div>
                    ) : snapshot && !snapshot.profileConfigured ? (
                        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-700 text-sm font-medium">
                            {doctorSpecialty
                                ? 'This department does not have a configured metrics profile yet. Nephrology is isolated and active; other departments can be added with their own adapter.'
                                : 'No treating doctor is on record for this patient yet, so no department metrics profile applies.'}
                        </div>
                    ) : (
                        <QueuePatientMetricsPanel
                            hospitalId={hospitalId}
                            patientId={patientId}
                            patientName={patientName}
                            appAccessEnabled={appAccessEnabled}
                            metrics={snapshot}
                            onSaved={handleSaved}
                            source={source}
                            onSourceChange={setSource}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default PastRecordsMetricsSection;
