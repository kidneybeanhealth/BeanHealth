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

/** "1m 12s" reads faster than "72" when scanning a column of calls. */
const formatCallDuration = (seconds?: number | null): string | null => {
    if (typeof seconds !== 'number' || seconds <= 0) return null;
    const m = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const formatCallTimestamp = (value?: string | null): string => {
    if (!value) return '--';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });
};

/** Carrier result, in words reception uses rather than the provider's enum. */
const VOICE_STATUS_LABEL: Record<string, string> = {
    connected: 'Answered',
    no_answer: 'No answer',
    busy: 'Busy',
    failed: 'Could not connect',
};

export const getReviewFilterLabel = (filterKey: PastRecordsView): string => {
    if (filterKey === 'all') return 'All';
    if (filterKey === 'due_today') return 'Due Today';
    if (filterKey === 'due_tomorrow') return 'Due Tomorrow';
    if (filterKey === 'upcoming') return 'Upcoming';
    if (filterKey === 'overdue') return 'Missed Followup';
    if (filterKey === 'followup_needed') return 'Followup Needed';
    if (filterKey === 'review_completed') return 'Review Completed';
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
    return 'bg-gray-100 text-gray-600';
};

export const formatPastDate = (value?: string | null): string => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
    /** Optional AI voice call. Omit to hide the action entirely (e.g. before the
     *  Sarvam agent is configured for this hospital). */
    onVoiceCall?: (patient: ReceptionPastRecordPatient) => void;
    /** True while a call is being placed for THIS patient. */
    isVoiceCallPlacing?: boolean;

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
    onVoiceCall,
    isVoiceCallPlacing = false,
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
    const voiceCalls = patient.voiceCalls || [];
    // Which transcripts are open. Card-local: it is pure display state, and
    // lifting it would mean every panel threading a Set through for no reason.
    const [openTranscripts, setOpenTranscripts] = React.useState<Record<string, boolean>>({});
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
    const lastCall = (patient.callHistory || [])[0] || null;

    const visibleCallHistory = isCallHistoryExpanded ? callHistory : callHistory.slice(0, 2);
    const hiddenCallCount = Math.max(callHistory.length - 2, 0);

    // Reachability, for the reminder pipeline.
    //
    // `phone_e164` is a generated column: a string means dialable, null means the
    // stored number can't be used. UNDEFINED means the migration hasn't been
    // applied yet — treating that as "unreachable" would paint every patient in
    // the clinic with a warning chip, so it stays silent instead.
    //
    // Nothing is shown for a reachable patient. This chip exists to surface a gap
    // that can be closed at the next visit, not to decorate the ones that are fine.
    const reachabilityKnown = patient.phone_e164 !== undefined;
    const isUnreachable = reachabilityKnown && !patient.phone_e164;
    // A patient who will never be messaged doesn't need a chip nagging about it.
    const showReachabilityChip = isUnreachable && !patient.isDeceased && !isFollowupStopped;
    const hasRawPhone = Boolean((patient.phone || '').trim());

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
                                            {dr.doctorName ? `${dr.doctorName} - ` : ''}{shortDate(dr.reviewDate)}
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
                            {showReachabilityChip && (
                                <span
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
                                    title={
                                        hasRawPhone
                                            ? `"${patient.phone}" is not a usable mobile number — this patient cannot be sent reminders.`
                                            : 'No phone number on file — this patient cannot be sent reminders.'
                                    }
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636L5.636 18.364M12 2a10 10 0 100 20 10 10 0 000-20z" />
                                    </svg>
                                    {hasRawPhone ? 'Phone not usable' : 'No phone'}
                                </span>
                            )}
                        </div>

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
                            {onVoiceCall && (() => {
                                // Mirror the Edge Function's refusals so the button
                                // explains itself instead of failing after a round trip.
                                const blockedReason = isUnreachable
                                    ? (hasRawPhone ? 'This number cannot be dialled' : 'No phone number on file')
                                    : patient.isDeceased
                                        ? 'Patient is deceased'
                                        : isFollowupStopped
                                            ? 'Follow-up has been stopped'
                                            : null;
                                return (
                                    <button
                                        type="button"
                                        onClick={() => { if (!blockedReason && !isVoiceCallPlacing) onVoiceCall(patient); }}
                                        disabled={Boolean(blockedReason) || isVoiceCallPlacing}
                                        title={blockedReason || 'Have the AI agent call this patient about their review'}
                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                            blockedReason
                                                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                                : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                                        }`}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-15a3 3 0 013 3v4a3 3 0 11-6 0V6a3 3 0 013-3z" />
                                        </svg>
                                        {isVoiceCallPlacing ? 'Calling…' : 'AI Call'}
                                    </button>
                                );
                            })()}
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

                        {onVoiceCall && (
                            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700 mb-1">AI Call History</p>
                                {voiceCalls.length === 0 ? (
                                    <p className="text-xs text-gray-500">No AI calls yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {voiceCalls.map((call) => {
                                            const isOpen = !!openTranscripts[call.id];
                                            const duration = formatCallDuration(call.durationSeconds);
                                            // 'placed' means Sarvam accepted the call but no outcome has
                                            // come back. Showing it as a plain entry would read as "we
                                            // called and they said nothing" — the opposite of the truth.
                                            const inFlight = call.status === 'placing' || call.status === 'placed';
                                            // Staleness is derived from the clock, not from the stored
                                            // status. The server-side sweep runs at the START of the next
                                            // place-review-call — so if nobody rings anyone else, a row
                                            // sits at 'placed' indefinitely and the card would keep
                                            // promising an outcome that is never coming.
                                            const ageMinutes = (Date.now() - new Date(call.createdAt).getTime()) / 60000;
                                            const outcomeLost = inFlight && ageMinutes > 30;
                                            const awaitingOutcome = inFlight && !outcomeLost;
                                            return (
                                                <div key={call.id} className="text-xs bg-white border border-violet-100 rounded-lg px-2.5 py-2">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="font-semibold text-gray-700">{formatCallTimestamp(call.createdAt)}</span>
                                                        {awaitingOutcome ? (
                                                            <span className="font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Waiting for outcome</span>
                                                        ) : outcomeLost ? (
                                                            <span className="font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">No outcome received</span>
                                                        ) : call.status === 'failed' ? (
                                                            <span className="font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">Failed</span>
                                                        ) : (
                                                            <span className={`font-bold px-1.5 py-0.5 rounded ${call.sarvamStatus === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {VOICE_STATUS_LABEL[call.sarvamStatus || ''] || 'Completed'}
                                                            </span>
                                                        )}
                                                        {duration && <span className="text-gray-500">{duration}</span>}
                                                        {call.disposition && (
                                                            <span className={`font-bold px-1.5 py-0.5 rounded ${call.disposition === 'RED_FLAG_REPORTED' ? 'bg-red-100 text-red-800' : 'bg-violet-100 text-violet-800'}`}>
                                                                {call.disposition.replace(/_/g, ' ')}
                                                            </span>
                                                        )}
                                                        {call.callbackRequested && (
                                                            <span className="font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">Callback asked</span>
                                                        )}
                                                    </div>

                                                    {awaitingOutcome && (
                                                        <p className="mt-1 text-amber-700 leading-relaxed">
                                                            The call was placed. The result usually lands within a few minutes of it ending.
                                                        </p>
                                                    )}
                                                    {outcomeLost && (
                                                        <p className="mt-1 text-orange-800 leading-relaxed">
                                                            The call was placed, but no result was ever reported back — so we cannot say
                                                            whether it was answered or what was said. Check with the patient before assuming.
                                                        </p>
                                                    )}
                                                    {call.status === 'failed' && call.failureReason && (
                                                        <p className="mt-1 text-red-700 leading-relaxed break-words">{call.failureReason}</p>
                                                    )}
                                                    {call.reasonText && (
                                                        <p className="mt-1 text-gray-700 leading-relaxed">Summary: {call.reasonText}</p>
                                                    )}
                                                    {(call.spokeTo || call.preferredDay) && (
                                                        <p className="mt-1 text-gray-500">
                                                            {call.spokeTo ? `Spoke to ${call.spokeTo}` : ''}
                                                            {call.spokeTo && call.preferredDay ? ' · ' : ''}
                                                            {call.preferredDay ? `Prefers ${call.preferredDay}` : ''}
                                                        </p>
                                                    )}

                                                    {call.transcript.length > 0 && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenTranscripts((prev) => ({ ...prev, [call.id]: !prev[call.id] }))}
                                                                className="mt-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900"
                                                            >
                                                                {isOpen ? 'Hide conversation' : `Show conversation (${call.transcript.length} turns)`}
                                                            </button>
                                                            {isOpen && (
                                                                <div className="mt-1.5 space-y-1 max-h-64 overflow-y-auto rounded-md bg-gray-50 border border-gray-100 p-2">
                                                                    {call.transcript.map((turn, i) => (
                                                                        <p key={i} className="leading-relaxed">
                                                                            <span className={`font-bold ${turn.role === 'agent' ? 'text-violet-700' : 'text-gray-700'}`}>
                                                                                {turn.role === 'agent' ? 'Agent' : 'Patient'}:
                                                                            </span>{' '}
                                                                            <span className="text-gray-700">{turn.text}</span>
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
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
