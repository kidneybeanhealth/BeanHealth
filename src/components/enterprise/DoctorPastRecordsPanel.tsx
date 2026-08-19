import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
    fetchReceptionPastRecords,
    stopPatientFollowup,
    updatePatientAppAccess,
    type ReceptionPastRecordPatient,
    type ReceptionReviewFilter,
} from '../../services/enterpriseReviewService';

import AddFollowupModal from './AddFollowupModal';
import StopFollowupModal from './StopFollowupModal';
import MissedFollowupMonths, { buildMissedMonths, missedReviewDate } from './MissedFollowupMonths';
import PastRecordsPatientCard, {
    getReviewFilterLabel,
    formatPastDate,
    type PastRecordsView,
} from './PastRecordsPatientCard';

const VisitJourneyModal = lazy(() => import('../modals/VisitJourneyModal'));

// Past Records report views — lazy (only loaded when the chip is opened)
const WeeklyOverdueReportPanel = lazy(() =>
    import('./ReceptionActivityPanels').then(m => ({ default: m.WeeklyOverdueReportPanel }))
);
const ReceptionCalendarPanel = lazy(() =>
    import('./ReceptionActivityPanels').then(m => ({ default: m.ReceptionCalendarPanel }))
);

interface DoctorProfileLike {
    id: string;
    name: string;
    specialty?: string;
    hospital_id: string;
    avatar_url?: string | null;
}

interface DoctorPastRecordsPanelProps {
    doctor: DoctorProfileLike;
    onBack: () => void;
    onViewPrescription: (prescription: any) => void;
    onEditResend?: (prescription: any) => void;
}

type CallLogStatus = 'picked' | 'not_picked';

interface CallLogTarget {
    patientId: string;
    mrNumber: string | null;
    patientName: string;
    reviewDate: string | null;
    doctorId?: string | null;  // Track which doctor's review
    doctorName?: string | null; // Doctor name for display
}

interface CallHistoryEntry {
    id: string;
    called_at: string;
    call_status: string | null;
    patient_response: string | null;
}

interface StopFollowupOverride {
    continuityStatus: 'transferred_out';
    followupStoppedAt: string;
    followupStopReason: string;
}

const PAST_RECORDS_PER_PAGE = 50;
/** Print pulls the whole filtered set in one go, independent of what's on screen. */
const PAST_RECORDS_PRINT_LIMIT = 5000;

const toLocalISODate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const DoctorPastRecordsPanel: React.FC<DoctorPastRecordsPanelProps> = ({ doctor, onBack, onViewPrescription, onEditResend }) => {
    const [pastRecords, setPastRecords] = useState<ReceptionPastRecordPatient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewFilter, setReviewFilter] = useState<PastRecordsView>('all');
    const [reviewDateFilter, setReviewDateFilter] = useState('');
    // Report views replace the patient list; list fetches fall back to 'all'
    const isPanelView = reviewFilter === 'weekly_report' || reviewFilter === 'calendar';
    const activeListFilter: ReceptionReviewFilter = isPanelView ? 'all' : (reviewFilter as ReceptionReviewFilter);
    const [pastRecordsPage, setPastRecordsPage] = useState(0);
    const [hasMorePastRecords, setHasMorePastRecords] = useState(true);
    const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);
    const [pastRecordsTotal, setPastRecordsTotal] = useState(0);
    const [expandedCallHistoryPatientIds, setExpandedCallHistoryPatientIds] = useState<Set<string>>(new Set());
    const [journeyPatient, setJourneyPatient] = useState<ReceptionPastRecordPatient | null>(null);
    const [callLogTarget, setCallLogTarget] = useState<CallLogTarget | null>(null);
    const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
    const [callHistoryLoading, setCallHistoryLoading] = useState(false);
    const [callLogSubmitting, setCallLogSubmitting] = useState(false);
    const [callLogStatus, setCallLogStatus] = useState<CallLogStatus>('picked');
    const [callLogNotes, setCallLogNotes] = useState('');
    const [callLogNextDate, setCallLogNextDate] = useState('');
    const [callLogRescheduleDate, setCallLogRescheduleDate] = useState('');
    /** Set when the stored review date changed after this call-log modal opened. */
    const [callLogConflict, setCallLogConflict] = useState<{ storedDate: string; typedDate: string } | null>(null);
    /** null = not asked yet · 'keep' = leave the newer date · 'override' = write the typed one.
     *  A ref, not state: the banner's buttons are type="submit", so onClick and the form
     *  submit run inside the same React event — a queued setState would still read null
     *  in the handler and re-open this prompt forever. Refs apply synchronously. */
    const callLogDateDecisionRef = useRef<null | 'keep' | 'override'>(null);
    const [locallyStoppedFollowupIds, setLocallyStoppedFollowupIds] = useState<Set<string>>(new Set());
    const [stopFollowupOverrides, setStopFollowupOverrides] = useState<Record<string, StopFollowupOverride>>({});
    const [updatingAccessPatientIds, setUpdatingAccessPatientIds] = useState<Set<string>>(new Set());
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    /** When the visible list was last pulled — the call round works off this list,
     *  so its age has to be on screen rather than assumed. */
    const [pastRecordsLoadedAt, setPastRecordsLoadedAt] = useState<Date | null>(null);

    /**
     * The one rule that decides whether a patient belongs on THIS doctor's list.
     * Used by both the on-screen list and Print List — a printed sheet that
     * disagrees with the screen is how a patient gets missed.
     */
    const belongsToThisDoctor = useCallback((patient: ReceptionPastRecordPatient, filter: ReceptionReviewFilter) => {
        const myReview = patient.doctorReviews?.find(dr => dr.doctorId === doctor.id);
        if (!myReview) return false;
        if (filter === 'all') return true;
        return filter === 'overdue'
            ? (myReview.reviewCategory === 'overdue' || myReview.reviewCategory === 'followup_needed')
            : myReview.reviewCategory === filter;
    }, [doctor.id]);

    const fetchPastRecords = useCallback(async (isBackground = false, page = 0, append = false) => {
        if (!doctor.hospital_id) return;
        if (isPanelView) return; // report views don't use the patient list
        if (!isBackground && !append) setLoading(true);
        if (append) setIsLoadingMorePast(true);
        try {
            const result = await fetchReceptionPastRecords({
                hospitalId: doctor.hospital_id,
                page,
                pageSize: PAST_RECORDS_PER_PAGE,
                searchQuery,
                reviewFilter: activeListFilter,
                reviewDate: reviewDateFilter,
            });

            setPastRecordsTotal(result.totalCount);
            setHasMorePastRecords(result.hasMore);
            if (!append) setPastRecordsLoadedAt(new Date());
            
            // Scope to this doctor — and to THIS doctor's bucket for the active chip.
            //
            // The service now matches a patient if ANY of their doctors' reviews fits the
            // filter, because a patient can be due tomorrow for one doctor and overdue for
            // another. Without the second check below, that would leak the other doctor's
            // bucket into this one: Dr B would see a patient under "Due Tomorrow" when it
            // is Dr A they are due with.
            const filteredPatients = result.patients.filter((patient) => belongsToThisDoctor(patient, activeListFilter));
            
            const mergedPatients = filteredPatients.map((patient) => {
                const localOverride = stopFollowupOverrides[patient.id];
                if (!localOverride) return patient;
                return {
                    ...patient,
                    continuityStatus: localOverride.continuityStatus,
                    followupStoppedAt: patient.followupStoppedAt || localOverride.followupStoppedAt,
                    followupStopReason: patient.followupStopReason || localOverride.followupStopReason,
                    latestReviewDate: null,
                };
            });
            setPastRecords(prev => append ? [...prev, ...mergedPatients] : mergedPatients);
            setPastRecordsPage(page);
        } catch (error) {
            console.error('Error fetching patients:', error);
            if (!isBackground) toast.error('Failed to load patients');
        } finally {
            if (!isBackground && !append) setLoading(false);
            if (append) setIsLoadingMorePast(false);
        }
    }, [doctor.hospital_id, searchQuery, activeListFilter, isPanelView, reviewDateFilter, stopFollowupOverrides, belongsToThisDoctor]);

    useEffect(() => {
        fetchPastRecords();
    }, [fetchPastRecords]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            setPastRecords([]);
            setPastRecordsPage(0);
            setHasMorePastRecords(true);
            fetchPastRecords(true, 0, false);
        }, 350);

        return () => clearTimeout(debounce);
    }, [searchQuery, reviewFilter, reviewDateFilter, fetchPastRecords]);

    useEffect(() => {
        const loadHospitalLogo = async () => {
            if (!doctor.hospital_id) return;
            try {
                const { data } = await (supabase as any)
                    .from('hospital_profiles')
                    .select('avatar_url')
                    .eq('id', doctor.hospital_id)
                    .maybeSingle();
                setHospitalLogo(data?.avatar_url || doctor.avatar_url || null);
            } catch {
                setHospitalLogo(doctor.avatar_url || null);
            }
        };
        loadHospitalLogo();
    }, [doctor.hospital_id, doctor.avatar_url]);

    const handleLoadMorePastRecords = () => {
        fetchPastRecords(true, pastRecordsPage + 1, true);
    };



    // ── Missed Followup, grouped by month ────────────────────────────────────
    // Same as Reception, but scoped through belongsToThisDoctor so the counts are
    // this doctor's own — a strip showing the hospital total under a doctor-scoped
    // list would be the "38 of 44" confusion all over again.
    const [missedAll, setMissedAll] = useState<ReceptionPastRecordPatient[]>([]);
    const [missedLoading, setMissedLoading] = useState(false);
    const [missedMonth, setMissedMonth] = useState<string | null>(null);

    const [showAddFollowup, setShowAddFollowup] = useState(false);
    const [stopFollowupTarget, setStopFollowupTarget] = useState<ReceptionPastRecordPatient | null>(null);
    const [stopFollowupSubmitting, setStopFollowupSubmitting] = useState(false);

    useEffect(() => {
        if (reviewFilter !== 'overdue' || !doctor.hospital_id) {
            setMissedAll([]);
            setMissedMonth(null);
            return;
        }
        let isActive = true;
        (async () => {
            setMissedLoading(true);
            try {
                const full = await fetchReceptionPastRecords({
                    hospitalId: doctor.hospital_id,
                    page: 0,
                    pageSize: PAST_RECORDS_PRINT_LIMIT,
                    searchQuery,
                    reviewFilter: 'overdue',
                    reviewDate: reviewDateFilter,
                });
                if (isActive) {
                    setMissedAll(full.patients.filter(p => belongsToThisDoctor(p, 'overdue')));
                }
            } catch (err) {
                console.error('[Missed Followup] month breakdown failed', err);
                if (isActive) setMissedAll([]);
            } finally {
                if (isActive) setMissedLoading(false);
            }
        })();
        return () => { isActive = false; };
    }, [reviewFilter, doctor.hospital_id, searchQuery, reviewDateFilter, belongsToThisDoctor, pastRecordsLoadedAt]);

    const missedMonths = useMemo(() => buildMissedMonths(missedAll), [missedAll]);

    const missedVisibleRecords = useMemo(() => {
        if (reviewFilter !== 'overdue' || missedMonth === null) return null;
        return missedAll.filter(p => (missedReviewDate(p) || '').slice(0, 7) === missedMonth);
    }, [reviewFilter, missedMonth, missedAll]);


    const handlePrintPastRecordsList = async () => {
        if (!['due_today', 'due_tomorrow', 'overdue'].includes(reviewFilter)) {
            toast.error('Print List is available for Due Today, Due Tomorrow, or Missed Followup');
            return;
        }

        if (!doctor.hospital_id) return;

        // Print the COMPLETE filtered set, never the page on screen — the list
        // renders PAST_RECORDS_PER_PAGE at a time behind "Load More", so printing
        // what was loaded silently dropped the overflow under an authoritative-
        // looking "Total". See the same fix in ReceptionDashboard.
        const loadingId = toast.loading('Preparing the full list…');
        let printRecords: ReceptionPastRecordPatient[];
        try {
            const full = await fetchReceptionPastRecords({
                hospitalId: doctor.hospital_id,
                page: 0,
                pageSize: PAST_RECORDS_PRINT_LIMIT,
                searchQuery,
                reviewFilter: activeListFilter,
                reviewDate: reviewDateFilter || undefined,
            });
            // Same doctor scoping the on-screen list applies — printing the
            // hospital-wide set here would hand this doctor other doctors' patients.
            printRecords = full.patients.filter((patient) => belongsToThisDoctor(patient, activeListFilter));
            if (reviewFilter === 'overdue' && missedMonth) {
                printRecords = printRecords.filter(
                    (patient) => (missedReviewDate(patient) || '').slice(0, 7) === missedMonth
                );
            }
            if (full.hasMore) {
                toast.error(`More than ${PAST_RECORDS_PRINT_LIMIT} patients match — printing the first ${PAST_RECORDS_PRINT_LIMIT}.`, { duration: 8000 });
            }
        } catch (err) {
            console.error('[Past Records] print fetch failed', err);
            toast.error('Could not load the full list — nothing printed', { id: loadingId });
            return;
        }
        toast.dismiss(loadingId);

        if (printRecords.length === 0) {
            toast.error('No patient records to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            toast.error('Pop-up blocked. Please allow pop-ups to print the list.');
            return;
        }

        const generatedAt = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        const rowsHtml = printRecords
            .map((patient, index) => {
                const relationLabel = patient.gender === 'F' ? 'W/o' : 'S/o';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(patient.name || '--')}</td>
                        <td>${patient.age ?? '--'}</td>
                        <td>${relationLabel} ${escapeHtml(patient.father_husband_name || '--')}</td>
                        <td>${escapeHtml(patient.mr_number || '--')}</td>
                        <td>${formatPastDate(patient.latestReviewDate)}</td>
                        <td>${formatPastDate(patient.lastVisitAt)}</td>
                    </tr>
                `;
            })
            .join('');

        const html = `
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Past Records Print List</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1f2937; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
                    .title { font-size: 20px; font-weight: 700; margin: 0; }
                    .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
                    .pill { display: inline-block; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; margin-right: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    thead th { text-align: left; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; }
                    tbody td { border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; vertical-align: top; }
                    tbody tr:nth-child(even) { background: #fcfcfd; }
                    .footer { margin-top: 14px; font-size: 11px; color: #6b7280; }
                    @media print { body { margin: 10mm; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1 class="title">Past Records List</h1>
                        <p class="meta">${escapeHtml(doctor.name || 'Doctor')}</p>
                        <p class="meta">Generated: ${generatedAt}</p>
                    </div>
                    <div>
                        <span class="pill">Filter: ${escapeHtml(getReviewFilterLabel(reviewFilter))}</span>
                        <span class="pill">Total: ${printRecords.length}</span>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>S/o / W/o</th>
                            <th>MR ID</th>
                            <th>Due Date</th>
                            <th>Last Visit Date</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <p class="footer">Printed from Doctor Past Records module.</p>
                <script>window.onload = function () { window.print(); };</script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const openCallLog = async (patient: ReceptionPastRecordPatient) => {
        if (!doctor.hospital_id) return;
        
        // NEW: Get this doctor's specific review for the patient
        const doctorReview = patient.doctorReviews?.find(dr => dr.doctorId === doctor.id);
        
        setCallLogTarget({
            patientId: patient.id,
            mrNumber: patient.mr_number || null,
            patientName: patient.name,
            reviewDate: doctorReview?.reviewDate || patient.latestReviewDate,
            doctorId: doctor.id,  // Track the doctor ID
            doctorName: doctor.name,  // Track the doctor name
        });
        setCallHistory([]);
        setCallHistoryLoading(true);
        setCallLogStatus('picked');
        setCallLogNotes('');
        setCallLogNextDate('');
        setCallLogRescheduleDate('');
        setCallLogConflict(null);
        callLogDateDecisionRef.current = null;

        try {
            let query = (supabase as any)
                .from('hospital_patient_followups')
                .select('id, called_at, call_status, patient_response')
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', patient.id);
            
            // Filter by doctor ID
            if (doctor.id) {
                query = query.eq('doctor_id', doctor.id);
            }
            
            const { data, error } = await query
                .order('called_at', { ascending: false })
                .limit(15);

            if (error) throw error;
            setCallHistory((data || []) as CallHistoryEntry[]);
        } catch (error) {
            console.error('Call history fetch error:', error);
            toast.error('Failed to load call history');
            setCallHistory([]);
        } finally {
            setCallHistoryLoading(false);
        }
    };

    const closeCallLog = () => {
        setCallLogTarget(null);
        setCallHistory([]);
        setCallHistoryLoading(false);
        setCallLogSubmitting(false);
        setCallLogStatus('picked');
        setCallLogNotes('');
        setCallLogNextDate('');
        setCallLogRescheduleDate('');
    };

    const togglePatientCallHistory = (patientId: string) => {
        setExpandedCallHistoryPatientIds((prev) => {
            const next = new Set(prev);
            if (next.has(patientId)) next.delete(patientId);
            else next.add(patientId);
            return next;
        });
    };

    const handleTogglePatientAppAccess = async (patient: ReceptionPastRecordPatient) => {
        if (!doctor.hospital_id) return;

        const nextEnabled = !Boolean(patient.app_access_enabled);
        setUpdatingAccessPatientIds((prev) => {
            const next = new Set(prev);
            next.add(patient.id);
            return next;
        });

        try {
            await updatePatientAppAccess({
                hospitalId: doctor.hospital_id,
                patientId: patient.id,
                enabled: nextEnabled,
            });

            setPastRecords((prev) => prev.map((item) => (
                item.id === patient.id
                    ? { ...item, app_access_enabled: nextEnabled }
                    : item
            )));

            toast.success(`Patient App access ${nextEnabled ? 'enabled' : 'disabled'} for ${patient.name}`);
        } catch (error: any) {
            console.error('Failed to update patient app access:', error);
            toast.error(error?.message || 'Failed to update Patient App access');
        } finally {
            setUpdatingAccessPatientIds((prev) => {
                const next = new Set(prev);
                next.delete(patient.id);
                return next;
            });
        }
    };

    /**
     * Opens the reason modal. This used to be a window.confirm() that then wrote
     * reason: 'external_hospital_transfer' regardless of why — so a stop recorded
     * from this dashboard said "transferred to another hospital" even when the
     * patient had simply declined, or died, or could not travel. The stored reason
     * is the whole point of the Follow-up Stopped list, so it has to be real.
     */
    const handleStopFollowup = (patient: ReceptionPastRecordPatient) => {
        setStopFollowupTarget(patient);
    };

    const confirmStopFollowup = async (reason: string, notes: string) => {
        const patient = stopFollowupTarget;
        if (!doctor.hospital_id || !patient) return;
        setStopFollowupSubmitting(true);

        try {
            await stopPatientFollowup({
                hospitalId: doctor.hospital_id,
                patientId: patient.id,
                reason,
                notes,
            });

            const nowIso = new Date().toISOString();
            setLocallyStoppedFollowupIds((prev) => {
                const next = new Set(prev);
                next.add(patient.id);
                return next;
            });
            setStopFollowupOverrides((prev) => ({
                ...prev,
                [patient.id]: {
                    continuityStatus: 'transferred_out',
                    followupStoppedAt: nowIso,
                    followupStopReason: reason,
                },
            }));
            setPastRecords((prev) => prev.map((item) => {
                if (item.id !== patient.id) return item;
                return {
                    ...item,
                    continuityStatus: 'transferred_out',
                    followupStoppedAt: item.followupStoppedAt || nowIso,
                    followupStopReason: reason,
                    latestReviewDate: null,
                };
            }));

            toast.success(`Follow-up stopped for ${patient.name}`);
            setStopFollowupTarget(null);
            fetchPastRecords(true, 0, false);
        } catch (error) {
            console.error('Failed to stop follow-up:', error);
            toast.error('Could not stop follow-up for this patient');
        } finally {
            // Without this the button stays disabled forever after a failure and
            // the modal becomes a dead end.
            setStopFollowupSubmitting(false);
        }
    };

    const handleSubmitCallLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!doctor.hospital_id || !callLogTarget) return;

        setCallLogSubmitting(true);
        try {
            const effectiveReviewDate = callLogStatus === 'picked' ? callLogRescheduleDate : callLogNextDate;

            const { data: existingReview, error: existingError } = await (supabase as any)
                .from('hospital_patient_reviews')
                .select('id, patient_id, next_review_date')
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', callLogTarget.patientId)
                .eq('doctor_id', doctor.id)  // Filter by this doctor
                .in('status', ['pending', 'rescheduled'])
                .order('next_review_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingError) throw existingError;

            // Has the review moved since this modal opened?
            //
            // Calls are made in the morning and typed up in the evening, so the card
            // behind this form can be hours old. A doctor who saw the patient in the
            // meantime has already set a new date, and writing the typed one on top
            // silently overrules them — which is exactly how KNH/25/028475 lost her
            // 13 Aug review to a 14 Jul call logged 3h38m after her visit. Ask first.
            const storedReviewDate = existingReview?.next_review_date || null;
            const capturedReviewDate = callLogTarget.reviewDate || null;
            if (
                effectiveReviewDate
                && storedReviewDate
                && storedReviewDate !== capturedReviewDate
                && callLogDateDecisionRef.current === null
            ) {
                setCallLogConflict({ storedDate: storedReviewDate, typedDate: effectiveReviewDate });
                setCallLogSubmitting(false);
                return;
            }

            // Only write next_review_date when the user actually chose one.
            //
            // This used to fall back to `callLogTarget.reviewDate` — the date captured
            // from the CARD when the modal opened. Logging a call with no reschedule
            // date then wrote that on-screen value straight back into the row, so a
            // stale list silently overwrote the doctor's newer date. KNH/25/028475 was
            // prescribed a 13 Aug review at 02:07pm; a call logged afterwards from a
            // list loaded earlier that day pushed 14 Jul back over it, and she dropped
            // out of Due Today on 13 Aug entirely. A call log records a CALL — it must
            // not silently move an appointment nobody asked to move.
            const reviewPatch: Record<string, any> = {
                status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
                cancelled_at: null,
                completed_at: null,
                updated_at: new Date().toISOString(),
            };
            if (effectiveReviewDate && callLogDateDecisionRef.current !== 'keep') {
                reviewPatch.next_review_date = effectiveReviewDate;
            }

            if (existingReview?.id) {
                const { error: updateError } = await (supabase as any)
                    .from('hospital_patient_reviews')
                    .update(reviewPatch)
                    .eq('id', existingReview.id);
                if (updateError) throw updateError;
            } else if (callLogTarget.mrNumber) {
                const { data: mrPatient, error: mrLookupError } = await (supabase as any)
                    .from('hospital_patients')
                    .select('id')
                    .eq('hospital_id', doctor.hospital_id)
                    .eq('mr_number', callLogTarget.mrNumber)
                    .maybeSingle();

                if (mrLookupError) throw mrLookupError;
                if (mrPatient?.id) {
                    const { error: insertError } = await (supabase as any)
                        .from('hospital_patient_reviews')
                        .insert({
                            hospital_id: doctor.hospital_id,
                            patient_id: mrPatient.id,
                            doctor_id: doctor.id,
                            next_review_date: effectiveReviewDate || callLogTarget.reviewDate,
                            status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
                        });
                    if (insertError) throw insertError;
                }
            }

            await (supabase as any)
                .from('hospital_patient_followups')
                .insert({
                    hospital_id: doctor.hospital_id,
                    review_id: existingReview?.id || null,
                    patient_id: callLogTarget.patientId,
                    doctor_id: doctor.id,  // Include doctor_id
                    called_at: new Date().toISOString(),
                    call_status: callLogStatus,
                    patient_response: callLogNotes.trim() || null,
                    next_followup_date: callLogStatus === 'not_picked' ? (callLogNextDate || null) : null,
                    attended: null,
                    created_by_name: doctor.name || null,
                });

            toast.success('Call log saved');
            closeCallLog();
            await fetchPastRecords(false, 0, false);
        } catch (error: any) {
            console.error('Call log save error:', error);
            toast.error(error.message || 'Failed to save call log');
        } finally {
            setCallLogSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Past Records</h2>
                    <p className="text-sm sm:text-base text-gray-600">Reception-style review tracking and call log workflow</p>
                </div>
                <button
                    onClick={onBack}
                    className="self-start px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:opacity-90 transition-opacity"
                >
                    Back
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <h3 className="text-sm font-bold text-gray-800">Patient Database</h3>
                        </div>
                        {pastRecordsTotal > 0 && !isPanelView && (
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Two different scopes: the list is filtered to this doctor's
                                    patients, while totalCount is hospital-wide. Showing them as
                                    "38 of 44" read as "6 still to load" when it actually meant
                                    "6 belong to another doctor". */}
                                <span className="text-xs text-gray-600 font-semibold bg-white px-3 py-1 rounded-full border border-gray-200">
                                    {pastRecords.length} your patients
                                </span>
                                {pastRecordsTotal > pastRecords.length && (
                                    <span className="text-xs font-medium text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">
                                        {pastRecordsTotal} in hospital
                                    </span>
                                )}
                                {pastRecordsLoadedAt && (
                                    <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                        as of {pastRecordsLoadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => fetchPastRecords(false, 0, false)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                                    title="Re-pull the list — do this right before printing the call sheet"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(['all', 'due_today', 'due_tomorrow', 'upcoming', 'overdue', 'weekly_report', 'review_completed', 'followup_stopped', 'calendar'] as PastRecordsView[]).map((filterKey) => (
                            <button
                                key={filterKey}
                                type="button"
                                onClick={() => setReviewFilter(filterKey)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                    reviewFilter === filterKey
                                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-200'
                                }`}
                            >
                                {getReviewFilterLabel(filterKey)}
                            </button>
                        ))}
                        {(['due_today', 'due_tomorrow', 'overdue'] as PastRecordsView[]).includes(reviewFilter) && (
                            <button
                                type="button"
                                onClick={handlePrintPastRecordsList}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print List
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowAddFollowup(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Schedule a review for a patient who is already registered"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Add to Follow-up
                        </button>
                        {!isPanelView && (
                            <>
                                <label className="text-xs font-semibold text-gray-500 ml-auto">Review Date</label>
                                <input
                                    type="date"
                                    value={reviewDateFilter}
                                    onChange={(e) => setReviewDateFilter(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                {reviewDateFilter && (
                                    <button
                                        type="button"
                                        onClick={() => setReviewDateFilter('')}
                                        className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                                    >
                                        Clear
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {!isPanelView && (
                    <form onSubmit={(e) => { e.preventDefault(); fetchPastRecords(false, 0, false); }} className="relative w-full max-w-md">
                        <input
                            type="text"
                            placeholder="Search by name or MR number..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </form>
                    )}
                </div>

                {reviewFilter === 'weekly_report' ? (
                    <Suspense fallback={<div className="p-16 text-center text-gray-400 text-sm">Loading report…</div>}>
                        <WeeklyOverdueReportPanel hospitalId={doctor.hospital_id} doctorId={doctor.id} />
                    </Suspense>
                ) : reviewFilter === 'calendar' ? (
                    <Suspense fallback={<div className="p-16 text-center text-gray-400 text-sm">Loading calendar…</div>}>
                        <ReceptionCalendarPanel hospitalId={doctor.hospital_id} doctorId={doctor.id} />
                    </Suspense>
                ) : loading ? (
                    <div className="p-20 text-center text-gray-700">Loading patients...</div>
                ) : pastRecords.length === 0 ? (
                    <div className="p-24 text-center flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <p className="text-gray-700 font-medium">No patients found</p>
                        <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
                    </div>
                ) : (
                    <div>
                    {reviewFilter === 'overdue' && (
                        <MissedFollowupMonths
                            months={missedMonths}
                            selectedMonth={missedMonth}
                            onSelectMonth={setMissedMonth}
                            loading={missedLoading}
                            onPrint={handlePrintPastRecordsList}
                        />
                    )}
                    <div className="divide-y divide-gray-100">
                        {(missedVisibleRecords ?? pastRecords).map((patient, index) => (
                            <PastRecordsPatientCard
                                key={patient.id}
                                patient={patient}
                                index={index}
                                hospitalId={doctor.hospital_id}
                                metricsDoctorSpecialty={doctor.specialty || null}
                                onToggleAppAccess={handleTogglePatientAppAccess}
                                onVisitHistory={setJourneyPatient}
                                onStopFollowup={handleStopFollowup}
                                onCallLog={openCallLog}
                                isAppAccessUpdating={updatingAccessPatientIds.has(patient.id)}
                                isCallHistoryExpanded={expandedCallHistoryPatientIds.has(patient.id)}
                                onToggleCallHistory={togglePatientCallHistory}
                                locallyStoppedFollowupIds={locallyStoppedFollowupIds}
                                stopFollowupOverrides={stopFollowupOverrides}
                            />
                        ))}
                    </div>
                    </div>
                )}

                {hasMorePastRecords && !missedVisibleRecords && (
                    <div className="p-4 text-center border-t border-gray-100">
                        <button
                            onClick={handleLoadMorePastRecords}
                            disabled={isLoadingMorePast}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors border border-gray-200 disabled:opacity-50"
                        >
                            {isLoadingMorePast ? 'Loading...' : 'Load More Patients'}
                        </button>
                    </div>
                )}
            </div>

            {callLogTarget && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeCallLog}>
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                            <h3 className="text-lg font-bold">Call Log - {callLogTarget.patientName}</h3>
                            <p className="text-sm text-orange-100">
                                MR: {callLogTarget.mrNumber || '--'} · Review: {formatPastDate(callLogTarget.reviewDate)}
                                {callLogTarget.doctorName && ` · Dr. ${callLogTarget.doctorName}`}
                            </p>
                        </div>
                        <form onSubmit={handleSubmitCallLog} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${callLogStatus === 'picked' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                                    <input type="radio" checked={callLogStatus === 'picked'} onChange={() => setCallLogStatus('picked')} />
                                    <span className="font-semibold text-gray-800">Picked / Reached</span>
                                </label>
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${callLogStatus === 'not_picked' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                                    <input type="radio" checked={callLogStatus === 'not_picked'} onChange={() => setCallLogStatus('not_picked')} />
                                    <span className="font-semibold text-gray-800">Not Picked</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Patient Response / Notes</label>
                                <textarea
                                    value={callLogNotes}
                                    onChange={(e) => setCallLogNotes(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="Add call outcome, notes, follow-up details"
                                />
                            </div>

                            {callLogStatus === 'picked' ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reschedule Date</label>
                                    <input
                                        type="date"
                                        value={callLogRescheduleDate}
                                        onChange={(e) => setCallLogRescheduleDate(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Next Follow-up Date</label>
                                    <input
                                        type="date"
                                        value={callLogNextDate}
                                        onChange={(e) => setCallLogNextDate(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                            )}

                            <div className="border-t border-gray-100 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Call History</p>
                                    {callHistoryLoading && <span className="text-xs text-gray-400">Loading...</span>}
                                </div>
                                {callHistory.length === 0 ? (
                                    <p className="text-sm text-gray-400">No previous call logs</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {callHistory.map((entry) => (
                                            <div key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-semibold text-gray-800">{new Date(entry.called_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">{entry.call_status || '--'}</span>
                                                </div>
                                                <p className="mt-2 text-gray-600">{entry.patient_response || 'No response recorded'}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* The review moved while this form was open — never overwrite
                                a doctor's newer date without asking. */}
                            {callLogConflict && (
                                <div className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
                                    <p className="text-sm font-bold text-amber-900">This patient's review has changed</p>
                                    <p className="mt-1 text-xs leading-relaxed text-amber-800">
                                        It was moved to <span className="font-bold">{new Date(callLogConflict.storedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span> after
                                        you opened this call log — most likely the doctor saw them since.
                                        Saving your date would replace it with <span className="font-bold">{new Date(callLogConflict.typedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>.
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="submit"
                                            onClick={() => { callLogDateDecisionRef.current = 'keep'; setCallLogConflict(null); }}
                                            className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            Keep {new Date(callLogConflict.storedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &middot; just log the call
                                        </button>
                                        <button
                                            type="submit"
                                            onClick={() => { callLogDateDecisionRef.current = 'override'; setCallLogConflict(null); }}
                                            className="px-3 py-2 rounded-lg text-xs font-bold text-amber-800 bg-white border border-amber-300 hover:bg-amber-100"
                                        >
                                            Change it to {new Date(callLogConflict.typedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={closeCallLog} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={callLogSubmitting} className="px-5 py-2 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50">
                                    {callLogSubmitting ? 'Saving...' : 'Save Call Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {stopFollowupTarget && (
                <StopFollowupModal
                    patientName={stopFollowupTarget.name}
                    mrNumber={stopFollowupTarget.mr_number}
                    submitting={stopFollowupSubmitting}
                    onCancel={() => setStopFollowupTarget(null)}
                    onConfirm={confirmStopFollowup}
                />
            )}

            {showAddFollowup && (
                <AddFollowupModal
                    hospitalId={doctor.hospital_id}
                    lockedDoctor={{ id: doctor.id, name: doctor.name, specialty: doctor.specialty || null }}
                    onClose={() => setShowAddFollowup(false)}
                    onScheduled={() => fetchPastRecords(false, 0, false)}
                />
            )}

            {journeyPatient && (
                <Suspense fallback={null}>
                    <VisitJourneyModal
                        hospitalId={doctor.hospital_id}
                        patient={journeyPatient}
                        prescriptions={journeyPatient.prescriptions || []}
                        clinicLogo={hospitalLogo || undefined}
                        onEditResend={onEditResend ? (rx) => { onEditResend(rx); setJourneyPatient(null); } : undefined}
                        onClose={() => setJourneyPatient(null)}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default DoctorPastRecordsPanel;
