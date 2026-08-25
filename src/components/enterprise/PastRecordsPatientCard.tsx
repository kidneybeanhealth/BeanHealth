/**
 * PastRecordsPatientCard — the single Past Records patient card
 * ─────────────────────────────────────────────────────────────
 * Reception and the Doctor dashboard used to render this card twice, from two
 * independently-evolved blocks of JSX. They drifted: different chrome, different
 * fields, different review semantics. This is the Reception layout, extracted
 * once and used by both, so the next change lands in both places.
 *
 * Role differences are props, not forks:
 *   • onDelete   — Reception only (hard-deletes the patient record)
 *   • metricsDoctorSpecialty — Doctor passes its own; Reception derives it from
 *     the patient's treating doctor (see resolvePatientDoctorSpecialty)
 *
 * Review dates are shown per treating doctor on both surfaces. A patient shared
 * between doctors carries one chip each, so neither role sees a single date that
 * silently belongs to someone else.
 */
import React from 'react';
import PastRecordsMetricsSection from './PastRecordsMetricsSection';
import type {
    ReceptionPastRecordPatient,
    ReceptionReviewFilter,
} from '../../services/enterpriseReviewService';

/** Past Records view — review filters plus the two report views */
export type PastRecordsView = ReceptionReviewFilter | 'weekly_report' | 'calendar';

// Lives in pastRecordsPrint so the print builder pulls in no React.
import { formatDoctorLabel } from './pastRecordsPrint';
export { formatDoctorLabel };

export const getReviewFilterLabel = (filterKey: PastRecordsView): string => {
    if (filterKey === 'all') return 'All';
    if (filterKey === 'due_today') return 'Due Today';
    if (filterKey === 'due_tomorrow') return 'Due Tomorrow';
    if (filterKey === 'upcoming') return 'Upcoming';
    if (filterKey === 'overdue') return 'Missed Followup';
    if (filterKey === 'followup_needed') return 'Followup Needed';
    if (filterKey === 'review_completed') return 'Review Completed';
    if (filterKey === 'followup_stopped') return 'Follow-up Stopped';
    if (filterKey === 'weekly_report') return 'Overdue Weekly Report';
    if (filterKey === 'calendar') return 'Calendar';
    return 'Not Completed';
};

export const getReviewBadgeClass = (category: ReceptionReviewFilter): string => {
    if (category === 'due_today') return 'bg-orange-50 text-orange-700';
    if (category === 'due_tomorrow') return 'bg-sky-50 text-sky-700';
    if (category === 'upcoming') return 'bg-emerald-50 text-emerald-700';
    if (category === 'overdue') return 'bg-rose-50 text-rose-700';
    if (category === 'followup_needed') return 'bg-amber-50 text-amber-700';
    if (category === 'not_completed') return 'bg-red-50 text-red-700';
    if (category === 'followup_stopped') return 'bg-amber-50 text-amber-700';
    return 'bg-gray-100 text-gray-600';
};

// Lives in pastRecordsPrint so the print builder pulls in no React.
import { formatPastDate } from './pastRecordsPrint';
export { formatPastDate };

const shortDate = (value?: string | null): string => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export interface StopFollowupOverride {
    followupStoppedAt: string;
    followupStopReason: string;
}

export interface PastRecordsPatientCardProps {
    patient: ReceptionPastRecordPatient;
    /** 1-based position badge shown on the card. */
    index: number;
    hospitalId: string;
    /** Selects the department metrics profile for the embedded metrics section. */
    metricsDoctorSpecialty: string | null;

    onToggleAppAccess: (patient: ReceptionPastRecordPatient) => void;
    onVisitHistory: (patient: ReceptionPastRecordPatient) => void;
    onStopFollowup: (patient: ReceptionPastRecordPatient) => void;
    onCallLog: (patient: ReceptionPastRecordPatient) => void;
    /** Reception only — omit to hide the delete action entirely. */
    onDelete?: (patient: ReceptionPastRecordPatient) => void;
    /** Correct the patient's own details. Optional, like onDelete. */
    onEdit?: (patient: ReceptionPastRecordPatient) => void;

    isAppAccessUpdating: boolean;
    isCallHistoryExpanded: boolean;
    onToggleCallHistory: (patientId: string) => void;

    /** Optimistic local state so a just-stopped follow-up reads correctly before the refetch lands. */
    locallyStoppedFollowupIds: Set<string>;
    stopFollowupOverrides: Record<string, StopFollowupOverride>;
}

const PastRecordsPatientCard: React.FC<PastRecordsPatientCardProps> = ({
    patient,
    index,
    hospitalId,
    metricsDoctorSpecialty,
    onToggleAppAccess,
    onVisitHistory,
    onStopFollowup,
    onCallLog,
    onDelete,
    onEdit,
    isAppAccessUpdating,
    isCallHistoryExpanded,
    onToggleCallHistory,
    locallyStoppedFollowupIds,
    stopFollowupOverrides,
}) => {
    const relationLabel = patient.gender === 'F' ? 'W/o' : 'S/o';
    const isFollowupStopped =
        patient.continuityStatus === 'transferred_out' || locallyStoppedFollowupIds.has(patient.id);
    const stopReasonText =
        patient.followupStopReason || stopFollowupOverrides[patient.id]?.followupStopReason || '';
    const stopDateText =
        patient.followupStoppedAt || stopFollowupOverrides[patient.id]?.followupStoppedAt || null;

    const callHistory = patient.callHistory || [];
    // Why is this patient a missed follow-up?
    //
    // "A date went past" is not an answer reception can act on. The useful facts
    // are: when were they last actually seen and by whom, when was the review that
    // is now overdue assigned, and when did we last try to reach them. Together
    // they say whether this is someone who slipped once or someone drifting away.
    //
    // Shown whenever ANY of the patient's doctors has an overdue review, not only
    // under the Missed Followup chip — if a review is overdue you want the reason
    // wherever you meet the patient.
    const overdueReview = (patient.doctorReviews || []).find(
        (dr) => dr.reviewCategory === 'overdue' || dr.reviewCategory === 'followup_needed'
    ) || null;
    const latestVisit = patient.prescriptions?.[0] || null;
    // Why this patient is being brought back, from whichever doctor's review is
    // live. Shown for everyone, not just the overdue — reception reads it before
    // dialling, and "come for review" is not something you can say on a call.
    const followupReason = (patient.doctorReviews || [])
        .map((dr) => dr.reviewReason)
        .find((r) => r && r.trim()) || null;
    const lastCall = (patient.callHistory || [])[0] || null;

    const visibleCallHistory = isCallHistoryExpanded ? callHistory : callHistory.slice(0, 2);
    const hiddenCallCount = Math.max(callHistory.length - 2, 0);


    return (
        <div className="px-4 sm:px-5 py-4">
            <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/40 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_23rem] gap-5 items-start">

                    {/* ── Patient details ─────────────────────────────── */}
                    <div className="min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-[11px] text-gray-500 font-bold">
                                {index + 1}
                            </span>
                            <p className="text-base font-extrabold tracking-tight text-gray-900">{patient.name}</p>
                            {patient.isDeceased && (
                                <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-1">
                                    Patient Deceased
                                </span>
                            )}
                            {isFollowupStopped && (
                                <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                                    Follow-up Stopped
                                </span>
                            )}
                            {patient.isDeceased ? (
                                <span className="inline-flex items-center text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                                    {`Review Cancelled${patient.deceasedAt ? ` (${formatPastDate(patient.deceasedAt)})` : ''}`}
                                </span>
                            ) : patient.doctorReviews && patient.doctorReviews.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {patient.doctorReviews.map((dr) => (
                                        <span
                                            key={dr.doctorId || `${dr.doctorName || 'unassigned'}-${dr.reviewDate || 'none'}`}
                                            className="inline-flex items-center text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1 whitespace-nowrap"
                                        >
                                            {formatDoctorLabel(dr.doctorName)} - {shortDate(dr.reviewDate)}
                                            {dr.reviewSetAt && (
                                                <span className="ml-1.5 text-[10px] font-medium text-gray-400">
                                                    · set {shortDate(dr.reviewSetAt)}
                                                    {dr.reviewSource === 'discharge_card'
                                                        ? ' (discharge)'
                                                        : dr.reviewSource === 'reception'
                                                            ? ' (reception)'
                                                            : ''}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="inline-flex items-center text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                                    {`Review Date: ${formatPastDate(patient.latestReviewDate)}`}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                            <p className="text-gray-700">Age: <span className="font-semibold text-gray-900">{patient.age || '--'}</span></p>
                            <p className="text-gray-700">{relationLabel}: <span className="font-semibold text-gray-900">{patient.father_husband_name || '--'}</span></p>
                        </div>

                        <p className="text-base text-gray-900 font-extrabold tracking-wide">MR: {patient.mr_number || '--'}</p>

                        {patient.isDeceased && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                Patient is deceased{patient.deceasedAt ? ` on ${formatPastDate(patient.deceasedAt)}` : ''}.
                                Upcoming reviews have been cancelled.
                            </div>
                        )}

                        {!patient.isDeceased && isFollowupStopped && (
                            <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 text-xs text-amber-900">
                                <div className="font-bold text-amber-800">
                                    Follow-up stopped{stopDateText ? ` on ${formatPastDate(stopDateText)}` : ''}
                                </div>
                                <div className="mt-1 font-semibold text-amber-700">Active upcoming reviews were cancelled.</div>
                                {stopReasonText && (
                                    <div className="mt-2 rounded-md border border-amber-200 bg-white/70 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
                                        <span className="font-bold text-amber-800">Reason:</span> {stopReasonText}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getReviewBadgeClass(patient.reviewCategory)}`}>
                                {getReviewFilterLabel(patient.reviewCategory)}
                            </span>
                            {patient.cameEarly && (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                    Came Early
                                </span>
                            )}
                            <span className="text-[11px] text-orange-700 font-bold bg-orange-50 px-2 py-1 rounded-full border border-orange-100">
                                Visits: {patient.prescriptions?.length || 0}
                            </span>
                        </div>

                        {followupReason && !patient.isDeceased && !isFollowupStopped && (
                            <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
                                <span className="font-bold text-sky-800">Follow-up for: </span>{followupReason}
                            </div>
                        )}

                        {overdueReview && !patient.isDeceased && !isFollowupStopped && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-[11px] leading-relaxed text-rose-900">
                                <span className="font-bold text-rose-800">Why: </span>
                                Review for <span className="font-bold">{formatPastDate(overdueReview.reviewDate)}</span>
                                {overdueReview.doctorName ? <> with <span className="font-bold">{overdueReview.doctorName}</span></> : null}
                                {overdueReview.reviewSetAt ? <>, assigned <span className="font-bold">{formatPastDate(overdueReview.reviewSetAt)}</span></> : null}
                                {' \u00B7 '}
                                {latestVisit
                                    ? <>Last seen <span className="font-bold">{formatPastDate(latestVisit.created_at)}</span>{latestVisit.doctor?.name ? ` by ${latestVisit.doctor.name}` : ''}</>
                                    : <span className="font-semibold">No recorded visit</span>}
                                {' \u00B7 '}
                                {lastCall
                                    ? <>Last called <span className="font-bold">{formatPastDate(lastCall.called_at)}</span>{lastCall.call_status ? ` (${lastCall.call_status === 'picked' ? 'picked' : 'not picked'})` : ''}</>
                                    : <span className="font-semibold">Never called</span>}
                            </div>
                        )}
                    </div>

                    {/* ── Actions + call history ──────────────────────── */}
                    <div className="shrink-0 w-full max-w-full space-y-2.5">
                        <div className="flex flex-wrap justify-start items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onToggleAppAccess(patient)}
                                disabled={isAppAccessUpdating}
                                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-60 ${patient.app_access_enabled
                                    ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100'
                                    }`}
                            >
                                {isAppAccessUpdating
                                    ? 'Updating...'
                                    : `Patient App: ${patient.app_access_enabled ? 'ON' : 'OFF'}`}
                            </button>
                            <button
                                type="button"
                                onClick={() => onVisitHistory(patient)}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-orange-200 text-orange-700 bg-white hover:bg-orange-50 transition-colors"
                            >
                                Visit History
                            </button>
                            {!patient.isDeceased && (
                                <button
                                    type="button"
                                    onClick={() => { if (!isFollowupStopped) onStopFollowup(patient); }}
                                    disabled={isFollowupStopped}
                                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${isFollowupStopped
                                        ? 'border-amber-200 text-amber-700 bg-amber-100 cursor-not-allowed'
                                        : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                        }`}
                                >
                                    {isFollowupStopped ? 'Follow-up Stopped' : 'Stop Follow-up'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => onCallLog(patient)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Call Log
                            </button>
                            {onEdit && (
                                <button
                                    type="button"
                                    onClick={() => onEdit(patient)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                                    title="Edit patient details"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    type="button"
                                    onClick={() => onDelete(patient)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Patient Record"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Call History</p>
                            {callHistory.length > 0 ? (
                                <div className="space-y-1.5">
                                    {visibleCallHistory.map((entry) => (
                                        <div key={entry.id} className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="font-semibold text-gray-700">{formatPastDate(entry.called_at)}</span>
                                                <span className={`font-bold px-1.5 py-0.5 rounded ${entry.call_status === 'picked' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                    {entry.call_status === 'picked' ? 'Picked' : 'Not Picked'}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-gray-600 leading-relaxed">Response: {entry.patient_response || '--'}</p>
                                        </div>
                                    ))}
                                    {hiddenCallCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => onToggleCallHistory(patient.id)}
                                            className="text-xs font-semibold text-sky-700 hover:text-sky-800 mt-1"
                                        >
                                            {isCallHistoryExpanded
                                                ? 'Show less call history'
                                                : `Show ${hiddenCallCount} more call entr${hiddenCallCount === 1 ? 'y' : 'ies'}`}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400">No previous call history.</p>
                            )}
                        </div>
                    </div>
                </div>

                <PastRecordsMetricsSection
                    hospitalId={hospitalId}
                    patientId={patient.id}
                    patientName={patient.name}
                    appAccessEnabled={patient.app_access_enabled}
                    doctorSpecialty={metricsDoctorSpecialty}
                    accent="orange"
                />
            </div>
        </div>
    );
};

export default PastRecordsPatientCard;
