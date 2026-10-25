/**
 * BeanHealth AI Call Campaign
 * ───────────────────────────
 * Reception picks a cohort, types the numbers, locks the list, and approves each
 * call one at a time. The agent's account of every call lands beside it and, at
 * the same moment, on the patient's Past Records card — both read the same
 * hospital_voice_call_attempts rows, so there is nothing to reconcile.
 *
 * THE PHONE NUMBERS NEVER LEAVE THIS TAB. The hospital stopped collecting them:
 * new registration no longer asks, so most patients have none on file and a
 * typed number is the only way to reach them. It is held in React state, sent
 * with the call, and discarded — the attempt row keeps only the last two digits,
 * enough to confirm the right number was reached and useless for dialling.
 * Closing the tab loses them, which is the correct behaviour, so we warn first.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
    fetchReceptionPastRecords,
    type ReceptionPastRecordPatient,
    type ReceptionReviewFilter,
} from '../../services/enterpriseReviewService';
import {
    placeReviewCall, fetchCallerLines, formatCallerLine, fetchVoiceUsage, fetchVoiceCallStatement, formatRupees, formatDuration,
    type VoiceUsageMonth, type VoiceCallStatement,
} from '../../services/voiceCallService';
import { formatPastDate } from './PastRecordsPatientCard';
import TwoStepConfirmModal from '../common/TwoStepConfirmModal';
import { buildMissedMonths, missedReviewDate } from './MissedFollowupMonths';
import {
    patientTypeOf, MISSED_REASON_LABELS, NO_CONVERSATION, NO_CONVERSATION_LABEL, callResultLabel, withPatientName,
    formatCallDuration,
    buildAiCallReportCsv, onePerPatient,
} from './aiCallReport';
import { retryReason, parseKeywords, type RetryRules } from './aiCallRetry';
import AiCallReportView from './AiCallReportView';

type CohortFilter = Extract<ReceptionReviewFilter, 'all' | 'due_today' | 'due_tomorrow' | 'overdue'> | 'priority';

/** 'priority' re-orders the missed-followup cohort; it is not its own query. */
const cohortToFilter = (c: CohortFilter): ReceptionReviewFilter =>
    (c === 'priority' ? 'overdue' : c);

/**
 * Call priority — who reception should ring first.
 *
 * OPERATIONAL, NOT CLINICAL. This ranks on how long someone has been out of
 * contact and how hard we have already tried to reach them. It says nothing
 * about how ill anyone is: this table has no eGFR, no CKD stage, no labs. A
 * score presented as clinical risk would be read as one by whoever works the
 * list, and that would be a lie the software told a nurse.
 *
 * Every reason is shown on the row. Reception should be able to disagree with
 * the order and see immediately why it came out that way — a ranking nobody can
 * audit is one nobody should follow.
 */
export interface CallPriority {
    score: number;
    reasons: string[];
}

export const scoreCallPriority = (
    patient: ReceptionPastRecordPatient,
    today = new Date()
): CallPriority => {
    const reasons: string[] = [];
    let score = 0;

    const due = patient.latestReviewDate ? new Date(patient.latestReviewDate) : null;
    const daysOverdue = due
        ? Math.floor((new Date(today.toDateString()).getTime() - new Date(due.toDateString()).getTime()) / 86400000)
        : 0;
    if (daysOverdue > 0) {
        // The dominant term. Capped so a two-year-old review cannot bury a
        // patient who is three weeks out and still reachable.
        score += Math.min(daysOverdue, 180);
        reasons.push(`${daysOverdue}d overdue`);
    }

    const calls = patient.callHistory || [];
    if (calls.length === 0) {
        // Nobody has tried. Ranks above someone already chased repeatedly:
        // an untried patient is the one most likely to be reached today.
        score += 60;
        reasons.push('never called');
    } else {
        const last = calls[0];
        if (last?.call_status && last.call_status !== 'picked') {
            score += 25;
            reasons.push('last call not picked');
        }
        // Diminishing returns, not zero — someone rung four times without answer
        // still matters, just less than someone nobody has phoned.
        score -= Math.min(calls.length * 8, 40);
    }

    const age = Number(String(patient.age ?? '').replace(/\D/g, ''));
    if (Number.isFinite(age) && age >= 70) {
        score += 20;
        reasons.push('age 70+');
    }

    if (patient.lastVisitAt) {
        const monthsSince = Math.floor(
            (today.getTime() - new Date(patient.lastVisitAt).getTime()) / (30 * 86400000)
        );
        if (monthsSince >= 6) {
            score += 25;
            reasons.push(`${monthsSince}m since last visit`);
        }
    } else {
        score += 15;
        reasons.push('no recorded visit');
    }

    return { score, reasons };
};

const COHORTS: { key: CohortFilter; label: string }[] = [
    { key: 'priority', label: 'Call First' },
    { key: 'overdue', label: 'Missed Followup' },
    { key: 'due_today', label: 'Due Today' },
    { key: 'due_tomorrow', label: 'Due Tomorrow' },
    { key: 'all', label: 'All' },
];

type PatientType = 'all' | 'old' | 'new';

/** Mirrors the Edge Function's toE164 so the UI refuses the same numbers it would. */
const toE164 = (raw: string): string | null => {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
    return null;
};

type RunState = 'idle' | 'calling' | 'waiting' | 'done' | 'failed';

interface PlacedCall {
    id: string;
    patientId: string;
    name: string;
    mrNumber: string | null;
    createdAt: string;
    status: string;
    providerStatus: string | null;
    dialedNumber: string | null;
    summary: string | null;
    disposition: string | null;
    missedReason: MissedReason | null;
    vars: Record<string, unknown> | null;
    durationSeconds: number | null;
}

/** When this patient was last rung, by anyone. */
interface LastCall { at: string; by: 'AI' | 'Reception' }

/**
 * The few patient fields a call needs. Saved with the call list, so the list
 * survives leaving the page even when the patient is not in the cohort on screen.
 */
interface CallPatient {
    id: string;
    name: string;
    mr_number: string | null;
    age: string | number | null;
    phone: string | null;
    doctorName: string | null;
    reviewDate: string | null;
    lastVisitAt: string | null;
}

interface Row {
    patient: CallPatient;
    phone: string;
    state: RunState;
    attemptRef: string | null;
    summary: string | null;
    disposition: string | null;
    missedReason: MissedReason | null;
    providerStatus: string | null;
    vars: Record<string, unknown> | null;
    durationSeconds: number | null;
    error: string | null;
    /** Calls placed to this patient from this list. */
    attempts: number;
    lastAttemptAt: number | null;
    /** The retry rules want this patient rung again; `retryNote` says why. */
    retryPending: boolean;
    retryNote: string | null;
    /** Taken out of the run by reception without removing them from the list. */
    skipped: boolean;
    /** The number that rang them last. */
    callerLine?: string | null;
}

const toCallPatient = (p: ReceptionPastRecordPatient): CallPatient => {
    const dr = p.doctorReviews?.[0];
    return {
        id: p.id,
        name: p.name,
        mr_number: p.mr_number || null,
        age: (p.age as any) ?? null,
        phone: p.phone || null,
        doctorName: dr?.doctorName || null,
        reviewDate: dr?.reviewDate || p.latestReviewDate || null,
        lastVisitAt: p.lastVisitAt || null,
    };
};

const newRow = (patient: CallPatient, phone = patient.phone || ''): Row => ({
    patient, phone, state: 'idle', attemptRef: null, summary: null, disposition: null,
    missedReason: null, providerStatus: null, vars: null, durationSeconds: null, error: null,
    attempts: 0, lastAttemptAt: null, retryPending: false, retryNote: null, skipped: false,
});

/**
 * How a run behaves. Manual: reception presses Call for each patient.
 * Automatic: the page rings the list in order, one call per calling number at a
 * time, and rings again whoever the retry rules say should be.
 */
interface CampaignSettings {
    mode: 'manual' | 'auto';
    retryNotAnswered: boolean;
    retryBusy: boolean;
    retryCouldNotConnect: boolean;
    retryNoConversation: boolean;
    retryKeywords: string;
    maxRetries: number;
    /** 'end': after everyone else has had a first call. 'soon': as soon as the gap allows. */
    retryWhen: 'end' | 'soon';
    pauseSeconds: number;
    /** Calls at the same time in automatic mode. 0 = one per calling number. */
    parallel: number;
}

const DEFAULT_SETTINGS: CampaignSettings = {
    mode: 'manual',
    retryNotAnswered: true,
    retryBusy: true,
    retryCouldNotConnect: false,
    retryNoConversation: true,
    retryKeywords: '',
    maxRetries: 1,
    retryWhen: 'end',
    pauseSeconds: 15,
    parallel: 0,
};

const toRules = (s: CampaignSettings): RetryRules => ({
    notAnswered: s.retryNotAnswered,
    busy: s.retryBusy,
    couldNotConnect: s.retryCouldNotConnect,
    noConversation: s.retryNoConversation,
    keywords: parseKeywords(s.retryKeywords),
    maxRetries: s.maxRetries,
});

/** Never ring the same patient twice within this long, whatever the settings. */
const MIN_RETRY_GAP_MS = 2 * 60_000;

/** One calling session: from the first call placed off a list until "Start a new list". */
interface CallSession { startedAt: string; attemptRefs: string[] }

const SETTINGS_KEY = (hospitalId: string) => `bh.aiCallSettings.v1.${hospitalId}`;
const SESSION_KEY = (hospitalId: string) => `bh.aiCallSession.v1.${hospitalId}`;

const readStored = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
};

/**
 * Latest call by reception or the AI. The AI's own outcome is also written to
 * the call log (as "[AI call …]"), so either source can hold the newest one.
 */
const lastCallOf = (p: ReceptionPastRecordPatient): LastCall | null => {
    let last: LastCall | null = null;
    for (const c of p.callHistory || []) {
        if (!c.called_at) continue;
        const ai = /^(\[AI call|\*\*\* RED FLAG)/.test(c.patient_response || '');
        if (!last || c.called_at > last.at) last = { at: c.called_at, by: ai ? 'AI' : 'Reception' };
    }
    for (const v of p.voiceCalls || []) {
        if (v.createdAt && (!last || v.createdAt > last.at)) last = { at: v.createdAt, by: 'AI' };
    }
    return last;
};

const shortDay = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

/**
 * The call list is kept per hospital on this device, so reception can pick
 * patients, leave, and come back to add, remove or reorder. Typed numbers are
 * kept apart, in this browser tab only: the patient's own number on file is
 * already in the record, and a typed one should not outlive the tab.
 */
const LIST_KEY = (hospitalId: string) => `bh.aiCallList.v1.${hospitalId}`;
const PHONES_KEY = (hospitalId: string) => `bh.aiCallPhones.v1.${hospitalId}`;

const loadSavedRows = (hospitalId: string): Row[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(LIST_KEY(hospitalId)) || '[]');
        const phones = JSON.parse(sessionStorage.getItem(PHONES_KEY(hospitalId)) || '{}');
        if (!Array.isArray(saved)) return [];
        return saved
            .filter((r: any) => r?.patient?.id)
            .map((r: any) => ({
                ...newRow(r.patient as CallPatient),
                ...r,
                phone: typeof phones[r.patient.id] === 'string' ? phones[r.patient.id] : (r.patient.phone || ''),
                error: null,
            }));
    } catch {
        return [];
    }
};

/**
 * Why the patient missed their review — the question the doctor cares about
 * most. From agent version 10 the agent returns `missed_reason` (one of the
 * codes below) alongside `reason_text`, the patient's own reason in a line.
 * Earlier calls have only `reason_text`, which is still shown.
 */
interface MissedReason { label: string | null; text: string | null }

const readMissedReason = (vars: any): MissedReason | null => {
    let code = typeof vars?.missed_reason === 'string' ? vars.missed_reason.trim().toUpperCase() : '';
    let text = typeof vars?.reason_text === 'string' ? vars.reason_text.trim() : '';
    if (/^(n\/?a|none|null|nil|-)$/i.test(text)) text = '';
    const disposition = typeof vars?.disposition === 'string' ? vars.disposition.trim().toUpperCase() : '';
    if (code === 'NOT_SHARED' && NO_CONVERSATION.has(disposition)) code = '';
    if (!code && !text) return null;
    return { label: code ? (MISSED_REASON_LABELS[code] || code.replace(/_/g, ' ').toLowerCase()) : null, text: text || null };
};

const MissedReasonLine: React.FC<{ reason: MissedReason | null }> = ({ reason }) => {
    if (!reason) return null;
    return (
        <p className="mt-1 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-relaxed">
            <span className="font-bold">Why they missed:</span>{' '}
            {reason.label && <span className="font-semibold">{reason.label}</span>}
            {reason.label && reason.text && ' — '}
            {reason.text}
        </p>
    );
};

interface Props {
    hospitalId: string;
    /** Printed at the top of the call report. */
    hospitalName?: string;
    onBack: () => void;
}

/** A row mid-call can't be removed or cleared. */
const isBusy = (r: Row): boolean => r.state === 'calling' || r.state === 'waiting';

/** Today in the browser's own date, as YYYY-MM-DD. */
const localDay = (d: Date = new Date()): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const AICallCampaignPage: React.FC<Props> = ({ hospitalId, hospitalName = '', onBack }) => {
    // The campaign works a whole cohort, so it must not be paginated. Missed
    // Followup at KKC runs to thousands across years, and a 200-row page hid
    // most of them behind a count that read as complete.
    const CAMPAIGN_FETCH_LIMIT = 5000;

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [missedMonth, setMissedMonth] = useState<string | null>(null);
    const [patientType, setPatientType] = useState<PatientType>('all');
    // Most patients registered Apr–Sep 2026 have no number on file (the field was
    // hidden at registration), so the first runs work from those who do.
    const [phoneOnly, setPhoneOnly] = useState(false);
    const [cohort, setCohort] = useState<CohortFilter>('overdue');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<ReceptionPastRecordPatient[]>([]);
    // The call list: who will be rung, in this order. Survives leaving the page.
    const [rows, setRows] = useState<Row[]>(() => loadSavedRows(hospitalId));
    const [activeId, setActiveId] = useState<string | null>(null);
    const [clearArmed, setClearArmed] = useState(false);
    const [settings, setSettings] = useState<CampaignSettings>(() => readStored(SETTINGS_KEY(hospitalId), DEFAULT_SETTINGS));
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const [session, setSession] = useState<CallSession | null>(() => {
        const saved = readStored<CallSession | null>(SESSION_KEY(hospitalId), null as any);
        return saved && Array.isArray(saved.attemptRefs) ? saved : null;
    });
    // Automatic calling never resumes on its own: reception starts it each time.
    const [autoRunning, setAutoRunning] = useState(false);
    const [autoNote, setAutoNote] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const failStreakRef = useRef(0);
    // The numbers calls ring from. One call per number at a time, so this is how
    // many patients automatic calling may ring at once.
    const [callerLines, setCallerLines] = useState<string[] | null>(null);
    useEffect(() => { fetchCallerLines().then(setCallerLines); }, []);
    const lineCount = Math.max(1, callerLines?.length || 0);
    const parallel = settings.parallel > 0 ? Math.min(settings.parallel, lineCount) : lineCount;
    const [showSettings, setShowSettings] = useState(false);
    const [showScript, setShowScript] = useState(false);
    // Three sections stacked as collapsibles meant opening Usage pushed the
    // patient list — the thing the page exists for — below the fold. They are
    // peers, not accessories, so they are views rather than accordions.
    const [view, setView] = useState<'campaign' | 'placed' | 'usage'>('campaign');
    const [placed, setPlaced] = useState<PlacedCall[]>([]);
    const [placedOpen, setPlacedOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<PlacedCall | null>(null);
    // One poller per call in flight, keyed by patient, so reordering or removing
    // other rows can never point an outcome at the wrong patient.
    const pollersRef = useRef<Map<string, number>>(new Map());

    // ── Cohort ────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchReceptionPastRecords({ hospitalId, page: 0, pageSize: CAMPAIGN_FETCH_LIMIT, reviewFilter: cohortToFilter(cohort), lean: true })
            .then((res) => { if (!cancelled) setCandidates(res.patients); })
            .catch((err) => { if (!cancelled) toast.error(err?.message || 'Could not load patients'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [hospitalId, cohort]);
    const inList = useMemo(() => new Set(rows.map((r) => r.patient.id)), [rows]);
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    const lastCalls = useMemo(() => {
        const m = new Map<string, LastCall | null>();
        candidates.forEach((p) => m.set(p.id, lastCallOf(p)));
        return m;
    }, [candidates]);

    // NOT keyed on `search`. The cohort fetch pulls the whole list in ~40
    // sequential chunks; re-running it per keystroke left the page pinned on
    // "Loading…" and never settling. Search filters what is already in memory.

    // Save the list on every change. Typed numbers go to this tab's session only.
    useEffect(() => {
        try {
            localStorage.setItem(LIST_KEY(hospitalId), JSON.stringify(rows.map(({ phone, error, ...rest }) => rest)));
            const typed: Record<string, string> = {};
            rows.forEach((r) => { if (r.phone && r.phone !== (r.patient.phone || '')) typed[r.patient.id] = r.phone; });
            sessionStorage.setItem(PHONES_KEY(hospitalId), JSON.stringify(typed));
        } catch { /* storage full or blocked: the list still works for this visit */ }
    }, [rows, hospitalId]);

    useEffect(() => {
        try { localStorage.setItem(SETTINGS_KEY(hospitalId), JSON.stringify(settings)); } catch { /* blocked storage */ }
    }, [settings, hospitalId]);
    useEffect(() => {
        try {
            if (session) localStorage.setItem(SESSION_KEY(hospitalId), JSON.stringify(session));
            else localStorage.removeItem(SESSION_KEY(hospitalId));
        } catch { /* blocked storage */ }
    }, [session, hospitalId]);

    const updateSettings = (patch: Partial<CampaignSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

    // Closing the tab loses typed numbers (not those on file), so warn first.
    const hasTypedNumbers = rows.some((r) => r.state === 'idle' && r.phone && r.phone !== (r.patient.phone || ''));
    useEffect(() => {
        if (!hasTypedNumbers) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasTypedNumbers]);

    useEffect(() => () => { pollersRef.current.forEach((t) => window.clearInterval(t)); }, []);

    // Month buckets, Missed Followup only. Built from the full cohort, so the
    // count on each chip is the real total for that month rather than whatever
    // happened to land on a page.
    const missedMonths = useMemo(
        () => (cohort === 'overdue' ? buildMissedMonths(candidates) : []),
        [cohort, candidates]
    );

    const monthBase = useMemo(
        () => (cohort === 'overdue' && missedMonth
            ? candidates.filter((p) => (missedReviewDate(p) || '').slice(0, 7) === missedMonth)
            : candidates),
        [candidates, cohort, missedMonth]
    );
    const typeCounts = useMemo(() => {
        const counts = { all: monthBase.length, old: 0, new: 0 };
        for (const p of monthBase) {
            const t = patientTypeOf(p.mr_number);
            if (t) counts[t]++;
        }
        return counts;
    }, [monthBase]);

    const typeBase = useMemo(
        () => (patientType === 'all' ? monthBase : monthBase.filter((p) => patientTypeOf(p.mr_number) === patientType)),
        [monthBase, patientType]
    );
    const phoneCount = useMemo(() => typeBase.filter((p) => !!toE164(p.phone || '')).length, [typeBase]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        let base = phoneOnly ? typeBase.filter((p) => !!toE164(p.phone || '')) : typeBase;
        if (q) {
            base = base.filter((p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.mr_number || '').toLowerCase().includes(q));
        }
        // Selected float to the top and hold their order, so a long list stays
        // reviewable — the operator can see what they picked without scrolling
        // back through hundreds of unchecked rows.
        if (cohort === 'priority') {
            base = [...base].sort((a, b) => scoreCallPriority(b).score - scoreCallPriority(a).score);
        }
        const picked: ReceptionPastRecordPatient[] = [];
        const rest: ReceptionPastRecordPatient[] = [];
        for (const p of base) (inList.has(p.id) ? picked : rest).push(p);
        return [...picked, ...rest];
    }, [typeBase, phoneOnly, cohort, inList, search]);

    const allVisibleSelected = visible.length > 0 && visible.every((p) => inList.has(p.id));

    // Scoped to what is on screen. Selecting across a hidden month would queue
    // calls to patients the operator never looked at.
    const toggleAllVisible = () => setRows((prev) => {
        if (allVisibleSelected) {
            const drop = new Set(visible.map((p) => p.id));
            return prev.filter((r) => !drop.has(r.patient.id) || isBusy(r));
        }
        const have = new Set(prev.map((r) => r.patient.id));
        return [...prev, ...visible.filter((p) => !have.has(p.id)).map((p) => newRow(toCallPatient(p)))];
    });

    // Every call this hospital has placed, newest first — campaign or the AI Call
    // button on a card. One list, because "have we already rung them?" does not
    // care which surface started it.
    const loadPlaced = useCallback(async () => {
        const { data, error } = await (supabase.from('hospital_voice_call_attempts' as any) as any)
            .select('id, patient_id, status, provider_status, duration_seconds, final_agent_variables, created_at, dialed_number, patient:hospital_patients(name, mr_number)')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) { toast.error('Could not load placed calls'); return; }
        setPlaced((data || []).map((r: any) => ({
            id: r.id,
            patientId: r.patient_id,
            name: r.patient?.name || 'Unknown patient',
            mrNumber: r.patient?.mr_number || null,
            createdAt: r.created_at,
            status: r.status,
            providerStatus: r.provider_status,
            dialedNumber: r.dialed_number || null,
            summary: typeof r.final_agent_variables?.call_summary === 'string' ? r.final_agent_variables.call_summary : null,
            disposition: typeof r.final_agent_variables?.disposition === 'string' ? r.final_agent_variables.disposition : null,
            missedReason: readMissedReason(r.final_agent_variables),
            vars: r.final_agent_variables || null,
            durationSeconds: typeof r.duration_seconds === 'number' ? r.duration_seconds : null,
        })));
    }, [hospitalId]);

    useEffect(() => { loadPlaced(); }, [loadPlaced]);

    // ── Report for the hospital ───────────────────────────────────────────
    // The report opens over the page, in this tab. 'range' = Placed Calls dates; 'session' = this list.
    const [reportView, setReportView] = useState<'range' | 'session' | null>(null);
    const [reportFrom, setReportFrom] = useState(localDay());
    const [reportTo, setReportTo] = useState(localDay());
    const rangeReport = useMemo(() => onePerPatient(placed
        .filter((c) => { const d = localDay(new Date(c.createdAt)); return d >= reportFrom && d <= reportTo; })),
    [placed, reportFrom, reportTo]);
    const reportCalls = rangeReport.inputs;
    const reportPeriod = reportFrom === reportTo
        ? new Date(`${reportFrom}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : `${new Date(`${reportFrom}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(`${reportTo}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const printReport = () => {
        if (reportCalls.length === 0) { toast.error('No calls in these dates'); return; }
        setReportView('range');
    };

    const downloadReport = () => {
        if (reportCalls.length === 0) { toast.error('No calls in these dates'); return; }
        const blob = new Blob([buildAiCallReportCsv(reportCalls)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI calls ${reportFrom}${reportTo !== reportFrom ? ` to ${reportTo}` : ''}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const deletePlaced = async () => {
        const call = pendingDelete;
        if (!call) return;
        setPendingDelete(null);
        setDeletingId(call.id);
        try {
            const { error } = await (supabase.from('hospital_voice_call_attempts' as any) as any)
                .delete().eq('id', call.id).eq('hospital_id', hospitalId);
            if (error) throw error;
            setPlaced((prev) => prev.filter((c) => c.id !== call.id));
            // Clear it from the run column too, so a deleted call cannot keep
            // showing a summary that no longer exists anywhere.
            setRows((prev) => prev.map((r) => r.attemptRef === call.id
                ? { ...r, state: 'idle', attemptRef: null, summary: null, disposition: null, missedReason: null, error: null }
                : r));
            toast.success('Call record deleted');
        } catch (err: any) {
            toast.error(err?.message || 'Could not delete the call record');
        } finally {
            setDeletingId(null);
        }
    };

    const toggle = (p: ReceptionPastRecordPatient) => setRows((prev) => {
        const existing = prev.find((r) => r.patient.id === p.id);
        if (existing) return isBusy(existing) ? prev : prev.filter((r) => r.patient.id !== p.id);
        return [...prev, newRow(toCallPatient(p))];
    });

    const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.patient.id !== id || isBusy(r)));

    const moveRow = (id: string, dir: -1 | 1) => setRows((prev) => {
        const i = prev.findIndex((r) => r.patient.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
    });

    /** Clear everyone not mid-call. Asks once, inline, before doing it. */
    const clearList = () => {
        if (!clearArmed) { setClearArmed(true); window.setTimeout(() => setClearArmed(false), 4000); return; }
        setRows((prev) => prev.filter(isBusy));
        setClearArmed(false);
        setActiveId(null);
    };

    const setPhone = (id: string, phone: string) =>
        setRows((prev) => prev.map((r) => r.patient.id === id ? { ...r, phone } : r));

    const readyCount = useMemo(() => rows.filter((r) => toE164(r.phone)).length, [rows]);

    const startCalling = () => {
        if (readyCount === 0) { toast.error('Add at least one valid mobile number first'); return; }
        if (!activeId || !rows.some((r) => r.patient.id === activeId)) {
            setActiveId((rows.find((r) => r.state === 'idle' && toE164(r.phone)) || rows[0]).patient.id);
        }
        setStep(3);
    };

    // ── Running ───────────────────────────────────────────────────────────
    const pollOutcome = useCallback((patientId: string, attemptRef: string) => {
        const pollers = pollersRef.current;
        const prior = pollers.get(patientId);
        if (prior) window.clearInterval(prior);
        const startedAt = Date.now();
        const timer = window.setInterval(async () => {
            const { data } = await (supabase.from('hospital_voice_call_attempts' as any) as any)
                .select('status, provider_status, duration_seconds, final_agent_variables, failure_reason')
                .eq('id', attemptRef).maybeSingle();

            const settled = data && (data.status === 'completed' || data.status === 'failed');
            // Ten minutes without an outcome is not a call still in progress. Stop
            // polling and say so, rather than spinning against a row forever.
            const timedOut = Date.now() - startedAt > 10 * 60_000;
            if (!settled && !timedOut) return;

            window.clearInterval(timer);
            pollers.delete(patientId);
            const vars = data?.final_agent_variables || {};
            const retry = settled
                ? retryReason(
                    { status: data.status, providerStatus: data?.provider_status ?? null, vars: data?.final_agent_variables ?? null },
                    // `attempts` already counts this call.
                    (rowsRef.current.find((r) => r.patient.id === patientId)?.attempts) || 1,
                    toRules(settingsRef.current),
                )
                : null;
            setRows((prev) => prev.map((r) => r.patient.id !== patientId ? r : {
                ...r,
                retryPending: !!retry,
                retryNote: retry,
                state: data?.status === 'completed' ? 'done' : 'failed',
                summary: typeof vars.call_summary === 'string' ? vars.call_summary : null,
                disposition: typeof vars.disposition === 'string' ? vars.disposition : null,
                missedReason: readMissedReason(vars),
                providerStatus: data?.provider_status ?? null,
                vars: data?.final_agent_variables ?? null,
                durationSeconds: data?.duration_seconds ?? null,
                error: timedOut && !settled
                    ? 'No outcome came back within 10 minutes.'
                    : (data?.failure_reason || null),
            }));
            loadPlaced();
        }, 5000);
        pollers.set(patientId, timer);
    }, [loadPlaced]);

    // A list restored mid-call picks up where it left off.
    useEffect(() => {
        rows.forEach((r) => {
            if ((r.state === 'calling' || r.state === 'waiting') && r.attemptRef && !pollersRef.current.has(r.patient.id)) {
                pollOutcome(r.patient.id, r.attemptRef);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Place one call. Says how it went so automatic calling can decide whether to
     * carry on: 'capped' is the daily limit (stop), 'refused' is the server
     * declining this patient (move on), 'error' is anything else.
     */
    const placeCall = async (patientId: string): Promise<'placed' | 'refused' | 'capped' | 'linesBusy' | 'error'> => {
        const row = rowsRef.current.find((r) => r.patient.id === patientId);
        if (!row) return 'error';
        if (!toE164(row.phone)) { toast.error('Add a valid mobile number for this patient first'); return 'refused'; }
        setRows((prev) => prev.map((r) => r.patient.id === patientId ? {
            ...r, state: 'calling', error: null, retryPending: false, retryNote: null, skipped: false,
            attempts: r.attempts + 1, lastAttemptAt: Date.now(),
        } : r));
        try {
            const res = await placeReviewCall({
                patientId,
                requestedByName: 'Reception (campaign)',
                phoneOverride: row.phone,
            });
            setRows((prev) => prev.map((r) => r.patient.id === patientId ? { ...r, state: 'waiting', attemptRef: res.attemptRef, callerLine: res.callerLine } : r));
            setSession((prev) => ({
                startedAt: prev?.startedAt || new Date().toISOString(),
                attemptRefs: [...(prev?.attemptRefs || []), res.attemptRef],
            }));
            pollOutcome(patientId, res.attemptRef);
            return 'placed';
        } catch (err: any) {
            const message: string = err?.message || 'Call failed';
            // Every number busy (another device calling, or an outcome still on its
            // way): nothing was dialled, so the patient goes back exactly as they were.
            if (/calling numbers? (are|is) busy/i.test(message)) {
                setRows((prev) => prev.map((r) => r.patient.id === patientId ? row : r));
                if (settingsRef.current.mode === 'manual') toast.error(message);
                return 'linesBusy';
            }
            setRows((prev) => prev.map((r) => r.patient.id === patientId ? { ...r, state: 'failed', error: message } : r));
            if (/daily limit/i.test(message)) return 'capped';
            // The server's own refusals: deceased, stopped, do-not-call, on hold,
            // a call already running, no review to call about.
            if (/deceased|stopped|asked not to be called|in progress|on hold|no upcoming review|review/i.test(message)) return 'refused';
            return 'error';
        }
    };

    const skipRow = (id: string) => setRows((prev) => prev.map((r) => r.patient.id === id ? { ...r, retryPending: false, skipped: true } : r));

    // ── Automatic calling ────────────────────────────────────────────────
    // Up to `parallel` calls at once, one per calling number: while a number is
    // free, pause, then ring the next patient. First calls go in list order;
    // retries go after them, or as soon as the two-minute gap allows, as chosen.
    // Stops on the daily limit, after three calls in a row could not be placed,
    // or when the list runs out and the last call has come back.
    useEffect(() => {
        if (!autoRunning) return;
        const inProgress = rows.filter(isBusy).length;
        const progressNote = inProgress === 1 ? '1 call in progress' : `${inProgress} calls in progress`;
        if (inProgress >= parallel) { setAutoNote(`${progressNote}…`); return; }
        const now = Date.now();
        const callable = (r: Row) => !r.skipped && !!toE164(r.phone);
        const fresh = rows.find((r) => r.state === 'idle' && r.attempts === 0 && callable(r));
        const retries = rows.filter((r) => r.retryPending && callable(r));
        const dueRetry = retries.find((r) => (r.lastAttemptAt || 0) + MIN_RETRY_GAP_MS <= now);
        const next = settings.retryWhen === 'soon' ? (dueRetry || fresh) : (fresh || dueRetry);

        if (!next) {
            if (inProgress > 0) { setAutoNote(`${progressNote}. Waiting for ${inProgress === 1 ? 'it' : 'them'} to finish…`); return; }
            if (retries.length > 0) {
                const wait = Math.max(1000, Math.min(...retries.map((r) => (r.lastAttemptAt || 0) + MIN_RETRY_GAP_MS - now)));
                setAutoNote(`Waiting ${Math.ceil(wait / 1000)} s before calling ${retries.length === 1 ? retries[0].patient.name : `${retries.length} patients`} again…`);
                const t = window.setTimeout(() => setTick((n) => n + 1), wait);
                return () => window.clearTimeout(t);
            }
            setAutoRunning(false);
            setAutoNote('The list is finished.');
            return;
        }

        setAutoNote(`${inProgress > 0 ? `${progressNote}. ` : ''}Next: ${next.patient.name}${next.attempts > 0 ? ` (attempt ${next.attempts + 1})` : ''} in ${settings.pauseSeconds} s`);
        const t = window.setTimeout(async () => {
            setActiveId(next.patient.id);
            const result = await placeCall(next.patient.id);
            if (result === 'capped') {
                setAutoRunning(false);
                setAutoNote('Stopped: the daily call limit has been reached.');
            } else if (result === 'linesBusy') {
                // Not a failure: the patient is back on the list and is tried again after the pause.
                setAutoNote('Every calling number is busy. Trying again shortly…');
            } else if (result === 'error') {
                failStreakRef.current += 1;
                if (failStreakRef.current >= 3) {
                    setAutoRunning(false);
                    setAutoNote('Stopped: three calls in a row could not be placed. The error is shown on the patient.');
                }
            } else {
                failStreakRef.current = 0;
            }
        }, settings.pauseSeconds * 1000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRunning, rows, settings, tick, parallel]);

    const startAuto = () => {
        if (readyCount === 0) { toast.error('No patient on the list has a valid number'); return; }
        failStreakRef.current = 0;
        setAutoNote(null);
        setAutoRunning(true);
    };

    // ── This session ─────────────────────────────────────────────────────
    const listFinished = rows.length > 0 && !rows.some(isBusy) && !!session?.attemptRefs.length
        && rows.every((r) => r.skipped || !toE164(r.phone) || ((r.state === 'done' || r.state === 'failed') && !r.retryPending));

    /** One row per patient, with every call this session counted. */
    const sessionReport = useMemo(() => {
        if (!session?.attemptRefs.length) return null;
        const refs = new Set(session.attemptRefs);
        const { inputs, totals } = onePerPatient(placed.filter((c) => refs.has(c.id)));
        return {
            inputs,
            totals: { ...totals, callsPlaced: session.attemptRefs.length },
            answered: inputs.filter((c) => callResultLabel(c.status, c.providerStatus, c.vars) === 'Answered').length,
        };
    }, [session, placed]);

    const sessionLabel = session
        ? `Calling session from ${new Date(session.startedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}`
        : '';

    const printSessionReport = () => {
        if (!sessionReport || sessionReport.inputs.length === 0) { toast.error('No calls in this session have come back yet'); return; }
        setReportView('session');
    };

    const downloadSessionReport = () => {
        if (!sessionReport || sessionReport.inputs.length === 0) { toast.error('No calls in this session have come back yet'); return; }
        const blob = new Blob([buildAiCallReportCsv(sessionReport.inputs)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI call session ${localDay(new Date(session!.startedAt))}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    /** Clear the finished list and start counting a new session. */
    const startNewList = () => {
        setAutoRunning(false);
        setRows((prev) => prev.filter(isBusy));
        setSession(null);
        setActiveId(null);
        setAutoNote(null);
        setStep(1);
    };

    const current = rows.find((r) => r.patient.id === activeId) || null;
    const busy = current ? isBusy(current) : false;
    const nextIdle = current
        ? rows.slice(rows.findIndex((r) => r.patient.id === current.patient.id) + 1).find((r) => r.state === 'idle')
        : undefined;

    // What the agent is handed. Shown before the call so reception can see the
    // patient is right and the dates make sense — a wrong doctor or a blank
    // review date is far cheaper to catch here than on the phone.
    const agentParams = (row: Row) => [
        ['patient_name', row.patient.name || '—'],
        ['mr_number', row.patient.mr_number || '—'],
        ['doctor_name', row.patient.doctorName || '—'],
        ['review_date', formatPastDate(row.patient.reviewDate)],
        ['last_visit_date', row.patient.lastVisitAt ? formatPastDate(row.patient.lastVisitAt) : '—'],
    ] as [string, string][];

    const callListPanel = (
        <aside className="rounded-2xl border border-violet-200 bg-white p-4 xl:sticky xl:top-4">
            <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-bold text-gray-900">Call list · {rows.length}</p>
                {rows.length > 0 && (
                    <button type="button" onClick={clearList}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border ${clearArmed ? 'bg-red-600 text-white border-red-600' : 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100'}`}>
                        {clearArmed ? 'Tap again to clear' : 'Clear list'}
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Tick patients on the left to add them. Reorder or remove them here. The list is kept on this computer,
                so you can leave and come back to it.
            </p>
            {rows.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">No patients yet.</p>
            ) : (
                <ol className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                    {rows.map((row, i) => (
                        <li key={row.patient.id} className="flex items-center gap-2 px-2 py-2">
                            <span className="w-5 text-xs text-gray-400 text-right shrink-0">{i + 1}</span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-gray-900 truncate">{row.patient.name}</span>
                                <span className="block text-[11px] text-gray-500">
                                    {row.patient.mr_number || '—'}{!toE164(row.phone) && <span className="text-red-600"> · no number</span>}
                                </span>
                            </span>
                            {row.state !== 'idle' && <RowTag row={row} />}
                            <MoveButtons name={row.patient.name}
                                onUp={i > 0 ? () => moveRow(row.patient.id, -1) : undefined}
                                onDown={i < rows.length - 1 ? () => moveRow(row.patient.id, 1) : undefined}
                                onRemove={isBusy(row) ? undefined : () => removeRow(row.patient.id)} />
                        </li>
                    ))}
                </ol>
            )}
            <button type="button" onClick={() => setStep(2)} disabled={rows.length === 0}
                className="mt-3 w-full py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300">
                Next: check numbers ({rows.length})
            </button>
        </aside>
    );

    const callControls = (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-gray-100 p-1" role="group" aria-label="Calling mode">
                    {([
                        ['manual', 'Manual: I press Call for each'],
                        ['auto', 'Automatic: call the whole list'],
                    ] as const).map(([key, label]) => (
                        <button key={key} type="button" aria-pressed={settings.mode === key}
                            onClick={() => { if (key === 'manual') setAutoRunning(false); updateSettings({ mode: key }); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${settings.mode === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                {settings.mode === 'auto' && (
                    autoRunning ? (
                        <button type="button" onClick={() => { setAutoRunning(false); setAutoNote('Stopped. The call in progress, if any, will finish.'); }}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700">
                            Stop
                        </button>
                    ) : (
                        <button type="button" onClick={startAuto} disabled={readyCount === 0}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300">
                            Start automatic calling
                        </button>
                    )
                )}
                {settings.mode === 'auto' && lineCount > 1 && (
                    <label className="flex items-center gap-1.5 text-sm text-gray-700">
                        At once
                        <select value={parallel} onChange={(e) => updateSettings({ parallel: Number(e.target.value) })}
                            aria-label="Calls at the same time"
                            className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm">
                            {Array.from({ length: lineCount }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>{n === 1 ? '1 call' : `${n} calls`}</option>
                            ))}
                        </select>
                    </label>
                )}
                <button type="button" onClick={() => setShowSettings((v) => !v)}
                    className="ml-auto text-xs font-semibold text-violet-700 hover:underline">
                    {showSettings ? 'Hide' : 'Show'} call-again settings
                </button>
            </div>
            {settings.mode === 'auto' && (
                <p className="text-xs text-gray-600">
                    {autoNote || `Calls ${parallel === 1 ? 'one patient at a time' : `${parallel} patients at a time, each from a different number`}, in list order, then rings again whoever the settings below say. Keep this page open: calling stops if you leave it.`}
                </p>
            )}
            {callerLines && callerLines.length > 0 && (
                <p className="text-[11px] text-gray-500">
                    Calling {callerLines.length === 1 ? 'number' : 'numbers'}: {callerLines.map(formatCallerLine).join(' · ')}
                </p>
            )}
            {showSettings && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-sm">
                    <div className="space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Call again when</p>
                        {([
                            ['retryNotAnswered', 'Not answered'],
                            ['retryBusy', 'Busy'],
                            ['retryCouldNotConnect', 'Could not connect'],
                            ['retryNoConversation', 'Picked up, no conversation (cut the call)'],
                        ] as const).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2">
                                <input type="checkbox" className="w-4 h-4 accent-violet-600"
                                    checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked } as Partial<CampaignSettings>)} />
                                {label}
                            </label>
                        ))}
                        <label className="block pt-1">
                            <span className="text-xs text-gray-600">…or the agent's summary mentions (comma separated)</span>
                            <input value={settings.retryKeywords} onChange={(e) => updateSettings({ retryKeywords: e.target.value })}
                                placeholder="call ended, disconnected, call later"
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                        </label>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                            A call that reached a decision is never repeated: will come, will not come, don't call,
                            in hospital, deceased, red flag or wrong number.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Extra calls per patient</span>
                            <select value={settings.maxRetries} onChange={(e) => updateSettings({ maxRetries: Number(e.target.value) })}
                                className="mt-1 block w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                                <option value={0}>None: one call only</option>
                                <option value={1}>1 more call</option>
                                <option value={2}>2 more calls</option>
                                <option value={3}>3 more calls</option>
                            </select>
                        </label>
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Call again</span>
                            <label className="flex items-center gap-2 mt-1">
                                <input type="radio" name="retryWhen" className="accent-violet-600" checked={settings.retryWhen === 'end'}
                                    onChange={() => updateSettings({ retryWhen: 'end' })} />
                                After the rest of the list
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="retryWhen" className="accent-violet-600" checked={settings.retryWhen === 'soon'}
                                    onChange={() => updateSettings({ retryWhen: 'soon' })} />
                                As soon as possible (at least 2 minutes later)
                            </label>
                        </div>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Pause between automatic calls</span>
                            <select value={settings.pauseSeconds} onChange={(e) => updateSettings({ pauseSeconds: Number(e.target.value) })}
                                className="mt-1 block w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                                {[10, 15, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
                            </select>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );

    const sessionPanel = session && session.attemptRefs.length > 0 ? (
        <div className={`rounded-2xl border p-4 ${listFinished ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-gray-900">
                        {listFinished ? 'This list is finished' : 'This calling session'}
                    </p>
                    <p className="text-xs text-gray-600">
                        {sessionLabel} · {session.attemptRefs.length} call{session.attemptRefs.length === 1 ? '' : 's'} placed
                        {sessionReport ? ` · ${sessionReport.inputs.length} patients · ${sessionReport.answered} answered` : ''}
                        {sessionReport?.totals.timedCalls ? ` · ${formatCallDuration(sessionReport.totals.callSeconds)} total` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={printSessionReport}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700">
                        Report for this session
                    </button>
                    <button type="button" onClick={downloadSessionReport}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                        Download for Excel
                    </button>
                    <button type="button" onClick={() => setStep(1)}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                        Add more patients
                    </button>
                    {listFinished && (
                        <button type="button" onClick={startNewList}
                            className="px-3 py-2 rounded-lg text-xs font-bold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-50">
                            Start a new list
                        </button>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">BeanHealth AI Call Campaign</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Pick the patients, type the numbers, then approve each call.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowScript((v) => !v)}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                        {showScript ? 'Hide script' : 'View call script'}
                    </button>
                    <button type="button" onClick={onBack}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                        Back
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                Phone numbers typed here are used for the call and then discarded. They are never saved to the
                patient record — only the last two digits are kept, so you can confirm the right number was reached.
            </div>

            {showScript && <CallScript />}

            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
                {([
                    ['campaign', 'Call Campaign'],
                    ['placed', `Placed Calls${placed.length ? ` (${placed.length})` : ''}`],
                    ['usage', 'Usage & Billing'],
                ] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setView(key)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${view === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {view === 'usage' && <UsagePanel hospitalId={hospitalId} />}

            {view === 'placed' && (
            <div className="rounded-2xl border border-gray-200 bg-white">
                <div className="px-4 pt-4 pb-3 flex flex-wrap items-end justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">Placed Call List</p>
                    <div className="flex flex-wrap items-end gap-2">
                        <label className="text-[11px] font-semibold text-gray-500">
                            From
                            <input type="date" value={reportFrom} max={reportTo} onChange={(e) => setReportFrom(e.target.value)}
                                className="block mt-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800" />
                        </label>
                        <label className="text-[11px] font-semibold text-gray-500">
                            To
                            <input type="date" value={reportTo} min={reportFrom} onChange={(e) => setReportTo(e.target.value)}
                                className="block mt-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800" />
                        </label>
                        <button type="button" onClick={printReport}
                            className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700">
                            Report for the hospital ({reportCalls.length})
                        </button>
                        <button type="button" onClick={downloadReport}
                            className="px-3 py-2 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                            Download for Excel
                        </button>
                    </div>
                </div>
                {(
                    <div className="px-4 pb-4">
                        {placed.length === 0 ? (
                            <p className="text-sm text-gray-500">No AI calls have been placed yet.</p>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto space-y-2">
                                {placed.map((call) => (
                                    <div key={call.id} className="grid grid-cols-1 md:grid-cols-[1.1fr_2fr_auto] gap-3 items-start rounded-xl border border-gray-200 p-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm">{call.name}</p>
                                            <p className="text-xs text-gray-500">{call.mrNumber || '—'}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {formatPastDate(call.createdAt)}
                                                {call.dialedNumber ? ` · ${call.dialedNumber}` : ''}
                                            </p>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                {call.status === 'completed'
                                                    ? <ResultTag label={callResultLabel(call.status, call.providerStatus, call.vars)} seconds={call.durationSeconds} />
                                                    : <StateChip state={call.status === 'failed' ? 'failed' : 'waiting'} />}
                                                {call.disposition && (
                                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${call.disposition === 'RED_FLAG_REPORTED' ? 'bg-red-100 text-red-800' : 'bg-violet-100 text-violet-800'}`}>
                                                        {call.disposition.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <MissedReasonLine reason={call.missedReason} />
                                            {call.summary
                                                ? <p className="mt-1 text-xs text-gray-700 leading-relaxed whitespace-pre-line">{withPatientName(call.summary, call.name)}</p>
                                                : <p className="text-xs text-gray-400">
                                                    {callResultLabel(call.status, call.providerStatus, call.vars) === NO_CONVERSATION_LABEL
                                                        ? 'Picked up, but the call ended before anything was said.'
                                                        : 'Nobody spoke, so there is no summary.'}
                                                </p>}
                                        </div>
                                        <button type="button" onClick={() => setPendingDelete(call)} disabled={deletingId === call.id}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap">
                                            {deletingId === call.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="mt-2 text-[11px] text-gray-400">
                            Deleting a call removes its summary from the patient's Past Records card too — both read the
                            same record. Delete when you want to call that patient again from scratch.
                        </p>
                    </div>
                )}
            </div>
            )}

            {view === 'campaign' && (
            <>
            <div className="flex items-center gap-2 text-xs font-semibold">
                {(['Select patients', 'Confirm & numbers', 'Place calls'] as const).map((label, i) => (
                    <React.Fragment key={label}>
                        <span className={`px-2.5 py-1 rounded-full ${step === i + 1 ? 'bg-violet-600 text-white' : step > i + 1 ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                            {i + 1}. {label}
                        </span>
                        {i < 2 && <span className="text-gray-300">›</span>}
                    </React.Fragment>
                ))}
            </div>

            {step === 1 && (
                <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-start">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 min-w-0">
                    {cohort === 'priority' && (
                        <p className="mb-3 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 leading-relaxed">
                            <span className="font-bold">Ordered by how long the patient has been out of contact</span> — days
                            overdue, whether anyone has called, how long since their last visit. The reason for each
                            position is shown on the row. This is not a clinical risk score: it uses no labs or CKD stage.
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {COHORTS.map((c) => (
                            <button key={c.key} type="button" onClick={() => { setCohort(c.key); setMissedMonth(null); setPatientType('all'); }}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${cohort === c.key ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or MR number…"
                        className="w-full mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />

                    {cohort === 'overdue' && missedMonths.length > 0 && (
                        <div className="mb-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                                Missed by month — pick one to work through
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => setMissedMonth(null)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${missedMonth === null ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                    All months ({candidates.length})
                                </button>
                                {missedMonths.map((m) => (
                                    <button key={m.key} type="button" onClick={() => setMissedMonth(m.key)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${missedMonth === m.key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                        {m.label} ({m.patients.length})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                            Old or new patient — from the year in the MR number
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {([
                                ['all', `All patients (${typeCounts.all})`],
                                ['old', `Old patients (${typeCounts.old})`],
                                ['new', `New patients (${typeCounts.new})`],
                            ] as const).map(([key, label]) => (
                                <button key={key} type="button" onClick={() => setPatientType(key)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${patientType === key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                    {label}
                                </button>
                            ))}
                            <span className="mx-1 w-px self-stretch bg-gray-200" aria-hidden="true" />
                            <button type="button" onClick={() => setPhoneOnly((v) => !v)} aria-pressed={phoneOnly}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${phoneOnly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                Has phone number ({phoneCount})
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}
                                disabled={visible.length === 0} className="w-4 h-4 accent-violet-600" />
                            <span className="font-semibold text-gray-700">
                                {allVisibleSelected ? 'Clear all' : 'Select all'}
                            </span>
                            <span className="text-gray-400">
                                {loading ? 'Loading the full list — this takes a moment…' : `${visible.length} shown`}
                            </span>
                        </label>
                        <span className="font-semibold text-violet-700">{rows.length} in call list</span>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                        {visible.map((p) => (
                            <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50/40 cursor-pointer">
                                <input type="checkbox" checked={inList.has(p.id)} onChange={() => toggle(p)}
                                    className="w-4 h-4 accent-violet-600" />
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold text-gray-900 text-sm truncate">{p.name}</span>
                                        {p.phone && (
                                            toE164(p.phone)
                                                ? <span className="shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums">{p.phone}</span>
                                                : <span className="shrink-0 text-xs font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded tabular-nums" title="Not a valid mobile number, so this patient cannot be dialled until it is corrected">{p.phone} · check</span>
                                        )}
                                        {(() => {
                                            const last = lastCalls.get(p.id);
                                            return last
                                                ? <span className="shrink-0 text-[11px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded whitespace-nowrap" title={new Date(last.at).toLocaleString('en-IN')}>
                                                    Last call {shortDay(last.at)} · {last.by}
                                                </span>
                                                : <span className="shrink-0 text-[11px] text-gray-400 whitespace-nowrap">Not called yet</span>;
                                        })()}
                                    </span>
                                    <span className="block text-xs text-gray-500">
                                        {p.mr_number || '—'} · Age {p.age ?? '--'}
                                        {patientTypeOf(p.mr_number) && (
                                            <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${patientTypeOf(p.mr_number) === 'new' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                                                {patientTypeOf(p.mr_number) === 'new' ? 'New' : 'Old'}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                {cohort === 'priority' ? (
                                    <span className="flex flex-wrap justify-end gap-1 max-w-[55%]">
                                        {scoreCallPriority(p).reasons.map((r) => (
                                            <span key={r} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 whitespace-nowrap">
                                                {r}
                                            </span>
                                        ))}
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {formatPastDate(p.latestReviewDate)}
                                    </span>
                                )}
                            </label>
                        ))}
                        {!loading && visible.length === 0 && (
                            <p className="px-3 py-6 text-center text-sm text-gray-500">No patients in this list.</p>
                        )}
                    </div>

                </div>
                {callListPanel}
                </div>
            )}

            {step === 2 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-600 mb-3">
                        Check each patient, put them in the order to ring, and enter the number to dial. {readyCount} of {rows.length} ready.
                        Patients without a valid number stay on the list but are skipped until you add one.
                    </p>
                    {rows.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">The call list is empty. Add patients first.</p>}
                    <div className="max-h-[460px] overflow-y-auto space-y-2">
                        {rows.map((row, i) => {
                            const valid = !!toE164(row.phone);
                            return (
                                <div key={row.patient.id} className="grid grid-cols-1 md:grid-cols-[auto_1.3fr_1.6fr_1fr] gap-3 items-start rounded-xl border border-gray-200 p-3">
                                    <MoveButtons name={row.patient.name}
                                        onUp={i > 0 ? () => moveRow(row.patient.id, -1) : undefined}
                                        onDown={i < rows.length - 1 ? () => moveRow(row.patient.id, 1) : undefined}
                                        onRemove={isBusy(row) ? undefined : () => removeRow(row.patient.id)} />
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 text-sm"><span className="text-gray-400 mr-1">{i + 1}.</span>{row.patient.name}</p>
                                        <p className="text-xs text-gray-500">{row.patient.mr_number || '—'}</p>
                                        {row.state !== 'idle' && <div className="mt-1"><RowTag row={row} /></div>}
                                    </div>
                                    <div className="text-xs space-y-0.5">
                                        {agentParams(row).map(([k, v]) => (
                                            <p key={k} className="text-gray-600">
                                                <span className="text-gray-400">{k}:</span> <span className="font-semibold text-gray-800">{v}</span>
                                            </p>
                                        ))}
                                    </div>
                                    <div>
                                        <input value={row.phone} inputMode="numeric" placeholder="10-digit mobile"
                                            disabled={row.state !== 'idle'}
                                            onChange={(e) => setPhone(row.patient.id, e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50 ${row.phone && !valid ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                                        {row.phone && !valid && <p className="text-[11px] text-red-600 mt-1">Not a valid mobile number</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => setStep(1)}
                            className="px-4 py-2.5 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300">Add or remove patients</button>
                        <button type="button" onClick={startCalling} disabled={readyCount === 0}
                            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300">
                            Start calling ({readyCount} ready)
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-4">
                {callControls}
                {sessionPanel}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Call queue · {rows.length}</p>
                            <button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-violet-700 hover:underline">
                                + Add patients
                            </button>
                        </div>
                        <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
                            {rows.map((row, i) => (
                                <div key={row.patient.id}
                                    className={`flex items-center gap-1 pr-1 ${row.patient.id === activeId ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                                    <button type="button" onClick={() => setActiveId(row.patient.id)}
                                        className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center gap-2">
                                        <span className="w-6 text-xs text-gray-400">{i + 1}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-semibold text-gray-900 truncate">{row.patient.name}</span>
                                            <span className="block text-xs text-gray-500">
                                                {row.patient.mr_number || '—'}{!toE164(row.phone) && <span className="text-red-600"> · no number</span>}
                                            </span>
                                        </span>
                                        <RowTag row={row} />
                                    </button>
                                    <MoveButtons name={row.patient.name}
                                        onUp={i > 0 ? () => moveRow(row.patient.id, -1) : undefined}
                                        onDown={i < rows.length - 1 ? () => moveRow(row.patient.id, 1) : undefined}
                                        onRemove={isBusy(row) ? undefined : () => removeRow(row.patient.id)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        {!current ? <p className="text-sm text-gray-500">Pick a patient.</p> : (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-gray-900">{current.patient.name}</p>
                                        <p className="text-xs text-gray-500">{current.patient.mr_number || '—'} · dialling ••••••{current.phone.replace(/\D/g, '').slice(-2)}</p>
                                    </div>
                                    <RowTag row={current} />
                                </div>

                                <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">What the agent will use</p>
                                    {agentParams(current).map(([k, v]) => (
                                        <p key={k} className="text-gray-600">
                                            <span className="text-gray-400">{k}:</span> <span className="font-semibold text-gray-800">{v}</span>
                                        </p>
                                    ))}
                                </div>

                                {current.state === 'idle' && (toE164(current.phone)
                                    ? (
                                        <button type="button" onClick={() => placeCall(current.patient.id)} disabled={autoRunning}
                                            className="mt-3 w-full py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300">
                                            {autoRunning ? 'Automatic calling is on' : `Place call to ${current.patient.name}`}
                                        </button>
                                    ) : (
                                        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                            No valid number for this patient. Add one in step 2, or remove them from the list.
                                        </p>
                                    ))}
                                {busy && (
                                    <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                                        {current.state === 'calling' ? 'Placing the call…' : 'Call in progress — the summary appears here when it ends.'}
                                    </p>
                                )}
                                {current.error && (
                                    <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 break-words">{current.error}</p>
                                )}
                                {current.summary && (
                                    <div className="mt-3 rounded-xl border border-gray-200 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Agent's account of the call</p>
                                        {current.disposition && (
                                            <span className="inline-block mt-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                                                {current.disposition.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        <MissedReasonLine reason={current.missedReason} />
                                        <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{withPatientName(current.summary, current.patient.name)}</p>
                                    </div>
                                )}
                                {(current.state === 'done' || current.state === 'failed') && (
                                    <div className="mt-3 space-y-2">
                                        {current.retryPending && (
                                            <p className="text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                                                Suggested: call again ({current.retryNote}).
                                                {settings.mode === 'auto' && autoRunning ? ' Automatic calling will do this.' : ''}
                                            </p>
                                        )}
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => placeCall(current.patient.id)}
                                                disabled={autoRunning || !toE164(current.phone)}
                                                className="flex-1 py-2 rounded-xl text-sm font-bold text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 disabled:opacity-40">
                                                ↻ Call again
                                            </button>
                                            {(current.retryPending || !current.skipped) && (
                                                <button type="button" onClick={() => skipRow(current.patient.id)} disabled={current.skipped}
                                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40">
                                                    Skip
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {(current.state === 'done' || current.state === 'failed') && nextIdle && (
                                    <button type="button" onClick={() => setActiveId(nextIdle.patient.id)}
                                        className="mt-3 w-full py-2.5 rounded-xl font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                                        Next patient →
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
                </div>
            )}

            </>
            )}

            {reportView === 'range' && (
                <AiCallReportView
                    calls={reportCalls}
                    totals={rangeReport.totals}
                    hospitalName={hospitalName}
                    title="AI follow-up call report"
                    periodLabel={reportPeriod}
                    onDownloadCsv={downloadReport}
                    onClose={() => setReportView(null)}
                />
            )}
            {reportView === 'session' && sessionReport && (
                <AiCallReportView
                    calls={sessionReport.inputs}
                    totals={sessionReport.totals}
                    hospitalName={hospitalName}
                    title="AI follow-up calls · session report"
                    periodLabel={sessionLabel}
                    onDownloadCsv={downloadSessionReport}
                    onClose={() => setReportView(null)}
                />
            )}

            <TwoStepConfirmModal
                isOpen={!!pendingDelete}
                title={`Delete the AI call record for ${pendingDelete?.name ?? ''}?`}
                description={
                    'This is the only record of that call. Deleting it also removes the summary from the ' +
                    "patient's Past Records card, and cannot be undone. You can then call them again from scratch."
                }
                continueLabel="Yes, delete it"
                confirmLabel="Delete permanently"
                onCancel={() => setPendingDelete(null)}
                onConfirm={deletePlaced}
            />
        </div>
    );
};

/** One month's line items — who was called, when, how long, and what it cost. */
const CallStatement: React.FC<{ hospitalId: string; monthKey: string; monthLabel: string }> = ({ hospitalId, monthKey, monthLabel }) => {
    const [data, setData] = useState<VoiceCallStatement | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setData(null); setError(null);
        fetchVoiceCallStatement(hospitalId, monthKey)
            .then(setData)
            .catch((e) => setError(e?.message || 'Could not load the statement'));
    }, [hospitalId, monthKey]);

    const exportCsv = () => {
        if (!data) return;
        const head = 'Date,Time,Patient,MR ID,Duration (s),Outcome,Amount (INR)';
        const body = data.rows.map((r) => [
            new Date(r.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
            new Date(r.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
            `"${r.patientName.replace(/"/g, '""')}"`,
            r.mrNumber || '',
            r.durationSeconds ?? '',
            r.outcome || '',
            (r.amountPaise / 100).toFixed(2),
        ].join(','));
        const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `beanhealth-ai-calls-${monthKey}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    if (error) return <p className="text-sm text-red-600 mt-3">{error}</p>;
    if (!data) return <p className="text-sm text-gray-500 mt-3">Loading statement…</p>;
    if (data.rows.length === 0) return <p className="text-sm text-gray-500 mt-3">No completed calls in {monthLabel}.</p>;

    return (
        <div className="mt-3">
            {data.ratePaise === null && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    No per-call rate is set for this hospital, so amounts are not shown. Usage below is complete.
                </p>
            )}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-gray-500 uppercase tracking-wide text-[10px]">
                            <th className="px-2.5 py-2">Date &amp; time</th>
                            <th className="px-2.5 py-2">Patient</th>
                            <th className="px-2.5 py-2">Duration</th>
                            <th className="px-2.5 py-2">Outcome</th>
                            <th className="px-2.5 py-2 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.map((r) => (
                            <tr key={r.id} className="border-t border-gray-100">
                                <td className="px-2.5 py-2 whitespace-nowrap text-gray-600">
                                    {new Date(r.createdAt).toLocaleString('en-IN', {
                                        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
                                        hour: '2-digit', minute: '2-digit', hour12: true,
                                    })}
                                </td>
                                <td className="px-2.5 py-2">
                                    <span className="font-semibold text-gray-900">{r.patientName}</span>
                                    <span className="block text-[11px] text-gray-500">{r.mrNumber || '—'}</span>
                                </td>
                                <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{formatDuration(r.durationSeconds)}</td>
                                <td className="px-2.5 py-2">
                                    <span className={`font-bold ${r.connected ? 'text-emerald-700' : 'text-gray-500'}`}>
                                        {r.connected ? 'Answered' : (r.outcome === 'no_answer' ? 'No answer' : r.outcome === 'busy' ? 'Busy' : 'Not connected')}
                                    </span>
                                </td>
                                <td className="px-2.5 py-2 text-right whitespace-nowrap">
                                    {data.ratePaise === null
                                        ? <span className="text-gray-400">—</span>
                                        : r.amountPaise > 0
                                            ? <span className="font-semibold text-gray-900">{formatRupees(r.amountPaise)}</span>
                                            : <span className="text-gray-400">Not charged</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                            <td className="px-2.5 py-2.5 font-bold text-gray-900" colSpan={3}>
                                {monthLabel} — {data.rows.length} call{data.rows.length === 1 ? '' : 's'} attempted
                            </td>
                            <td className="px-2.5 py-2.5 font-bold text-emerald-700 whitespace-nowrap">
                                {data.billableCount} billable
                            </td>
                            <td className="px-2.5 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">
                                {data.ratePaise === null ? '—' : formatRupees(data.totalPaise)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <button type="button" onClick={exportCsv}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                Export {monthLabel} as CSV
            </button>
        </div>
    );
};

/**
 * Usage & Billing — what this hospital used, per month.
 *
 * Deliberately shows NO rupee figure. The rate is a commercial term between
 * BeanHealth and the hospital, not something reception sets, and baking a price
 * into the UI before it is agreed is how a wrong number ends up on an invoice.
 * This panel supplies the count; the invoice supplies the rate.
 */
const UsagePanel: React.FC<{ hospitalId: string }> = ({ hospitalId }) => {
    const [open, setOpen] = useState(true);
    const [rows, setRows] = useState<VoiceUsageMonth[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openMonth, setOpenMonth] = useState<string | null>(null);

    useEffect(() => {
        if (!open || rows) return;
        fetchVoiceUsage(hospitalId)
            .then(setRows)
            .catch((e) => setError(e?.message || 'Could not load usage'));
    }, [open, rows, hospitalId]);

    const exportCsv = () => {
        if (!rows?.length) return;
        const header = 'Month,Calls placed,Connected (billable),Not connected,Failed,Duration known,Total seconds';
        const body = rows.map((m) =>
            [m.label, m.placed, m.connected, m.notConnected, m.failed, m.withDuration, m.totalSeconds].join(','));
        const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beanhealth-ai-calls-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const current = rows?.[0] || null;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white">
            <button type="button" onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
                <span className="text-sm font-bold text-gray-900">
                    Usage &amp; Billing
                    {current && <span className="ml-1.5 text-violet-700">({current.connected} billable this month)</span>}
                </span>
                <span className="text-xs font-semibold text-violet-700">{open ? 'Hide' : 'Show'}</span>
            </button>

            {open && (
                <div className="px-4 pb-4">
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {!rows && !error && <p className="text-sm text-gray-500">Loading usage…</p>}
                    {rows && rows.length === 0 && <p className="text-sm text-gray-500">No calls placed yet.</p>}

                    {rows && rows.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                {[
                                    ['Calls placed', current!.placed, 'text-gray-900'],
                                    ['Connected — billable', current!.connected, 'text-emerald-700'],
                                    ['Not connected', current!.notConnected, 'text-gray-500'],
                                    ['Failed', current!.failed, 'text-red-600'],
                                ].map(([label, value, cls]) => (
                                    <div key={String(label)} className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                                        <p className={`text-2xl font-bold mt-0.5 ${cls}`}>{value as number}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                                {current!.label} · billable means the call reached the patient. Unanswered and failed
                                calls are not charged.
                                {current!.withDuration < current!.connected && (
                                    <> Call duration is recorded for only {current!.withDuration} of {current!.connected} connected
                                    calls — the provider sends it on a webhook that does not fire for this account, so
                                    per-minute billing is not possible on this data.</>
                                )}
                            </p>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-gray-400 uppercase tracking-wide text-[10px]">
                                            <th className="py-1.5 pr-3">Month</th>
                                            <th className="py-1.5 pr-3">Placed</th>
                                            <th className="py-1.5 pr-3">Connected</th>
                                            <th className="py-1.5 pr-3">Not connected</th>
                                            <th className="py-1.5">Failed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((m) => (
                                            <tr key={m.key} onClick={() => setOpenMonth(openMonth === m.key ? null : m.key)}
                                                className={`border-t border-gray-100 cursor-pointer ${openMonth === m.key ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                                                <td className="py-1.5 pr-3 font-semibold text-gray-800 whitespace-nowrap">
                                                    {openMonth === m.key ? '▾ ' : '▸ '}{m.label}
                                                </td>
                                                <td className="py-1.5 pr-3">{m.placed}</td>
                                                <td className="py-1.5 pr-3 font-bold text-emerald-700">{m.connected}</td>
                                                <td className="py-1.5 pr-3 text-gray-500">{m.notConnected}</td>
                                                <td className="py-1.5 text-red-600">{m.failed}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {openMonth && (
                                <CallStatement hospitalId={hospitalId} monthKey={openMonth}
                                    monthLabel={rows.find((m) => m.key === openMonth)?.label || openMonth} />
                            )}

                            <button type="button" onClick={exportCsv}
                                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                                Export monthly summary
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/** How a finished call ended, coloured so a pick-up with no conversation never reads as answered. */
const ResultTag: React.FC<{ label: string; seconds?: number | null }> = ({ label, seconds }) => {
    const cls = label === 'Answered'
        ? 'bg-emerald-100 text-emerald-800'
        : label === NO_CONVERSATION_LABEL
            ? 'bg-amber-100 text-amber-800'
            : 'bg-gray-100 text-gray-700';
    const time = formatCallDuration(seconds);
    return (
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>
            {label}{time ? ` · ${time}` : ''}
        </span>
    );
};

const RowTag: React.FC<{ row: Row }> = ({ row }) => (
    <span className="flex flex-wrap items-center justify-end gap-1">
        {row.state === 'done'
            ? <ResultTag label={callResultLabel('completed', row.providerStatus, row.vars)} seconds={row.durationSeconds} />
            : <StateChip state={row.state} />}
        {row.retryPending && (
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-sky-100 text-sky-800" title={row.retryNote || ''}>
                ↻ Call again
            </span>
        )}
        {row.skipped && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-gray-100 text-gray-500">Skipped</span>}
        {row.attempts > 1 && <span className="text-[11px] text-gray-500 whitespace-nowrap">{row.attempts} calls</span>}
        {row.callerLine && isBusy(row) && (
            <span className="text-[11px] text-gray-500 whitespace-nowrap" title={formatCallerLine(row.callerLine)}>from …{row.callerLine.slice(-4)}</span>
        )}
    </span>
);

const MoveButtons: React.FC<{ onUp?: () => void; onDown?: () => void; onRemove?: () => void; name: string }> = ({ onUp, onDown, onRemove, name }) => (
    <span className="flex items-center gap-0.5 shrink-0">
        <button type="button" onClick={onUp} disabled={!onUp} aria-label={`Move ${name} up`}
            className="w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30">↑</button>
        <button type="button" onClick={onDown} disabled={!onDown} aria-label={`Move ${name} down`}
            className="w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30">↓</button>
        <button type="button" onClick={onRemove} disabled={!onRemove} aria-label={`Remove ${name} from the call list`}
            className="w-7 h-7 rounded-md text-red-500 hover:bg-red-50 disabled:opacity-30">✕</button>
    </span>
);

const StateChip: React.FC<{ state: RunState }> = ({ state }) => {
    const map: Record<RunState, [string, string]> = {
        idle: ['Not called', 'bg-gray-100 text-gray-600'],
        calling: ['Placing…', 'bg-amber-100 text-amber-800'],
        waiting: ['In progress', 'bg-amber-100 text-amber-800'],
        done: ['Done', 'bg-emerald-100 text-emerald-800'],
        failed: ['Failed', 'bg-red-100 text-red-700'],
    };
    const [label, cls] = map[state];
    return <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>{label}</span>;
};

/**
 * The call outline, per language.
 *
 * NOT the agent's prompt — that lives in the Sarvam console and is the single
 * source of truth. This is a plain-language summary of the flow, kept here so
 * nobody has to open the console to answer "what did it say to my patient?".
 *
 * One section per language rather than one language with a translation beneath
 * it: reception reads the language the call was actually placed in, and a
 * receptionist checking a Hindi call should not have to read past Tamil to
 * find it. English stays last as the fallback the agent uses when it cannot
 * continue in the patient's own language.
 */
const SCRIPT_STEPS = [
    {
        // A short opener, then silence until the person answers. The first second
        // of an Indian mobile call is often lost while audio connects, so the full
        // introduction must not be spent there (agent v10).
        label: 'Opening — then waits',
        ta: 'ஹலோ, வணக்கம்!',
        hi: 'हैलो, नमस्ते!',
        en: 'Hello, good day!',
    },
    {
        label: 'Introduction',
        ta: 'வணக்கம், நான் ஆஷா, {hospital_name}-லிருந்து பேசுகிறேன். {patient_name} பேசுகிறீர்களா, அல்லது குடும்பத்தினரா?',
        hi: 'नमस्ते, मैं आशा बोल रही हूँ, {hospital_name} से। क्या मैं {patient_name} से बात कर रही हूँ, या परिवार के किसी सदस्य से?',
        en: 'Hello, this is Asha calling from {hospital_name}. Am I speaking with {patient_name}, or a family member?',
    },
    {
        label: 'Why we called',
        ta: 'உங்கள் மறு பரிசோதனை தேதி {review_date}. அது முடிந்து {days_overdue} நாட்கள் ஆகிவிட்டன.',
        hi: 'आपकी जाँच की तारीख़ {review_date} थी। उसे {days_overdue} दिन हो चुके हैं।',
        en: 'Your review was due on {review_date} — that was {days_overdue} days ago.',
    },
    {
        // Asked on every call, before "when can you come" (agent v10). The doctor
        // wants this most when the patient is not willing to come back.
        label: 'Why they missed',
        ta: 'அன்று ஏன் வர முடியவில்லை என்று சொல்ல முடியுமா? டாக்டர் அதைத் தெரிந்து கொள்ள விரும்புகிறார்.',
        hi: 'उस दिन आप क्यों नहीं आ पाए, बता सकते हैं? डॉक्टर यह जानना चाहते हैं।',
        en: 'May I ask why you could not come that day? The doctor would like to know.',
    },
    {
        label: 'The ask',
        ta: 'நீங்கள் எப்போது வர முடியும்? நேரம் ஒதுக்க வேண்டாம், OP நேரத்தில் வந்தால் போதும்.',
        hi: 'आप कब आ सकते हैं? अपॉइंटमेंट की ज़रूरत नहीं है — OP समय में आ जाइए।',
        en: 'When can you come? No appointment needed — just come during OP hours.',
    },
    {
        label: 'Red flag',
        ta: 'மூச்சுத் திணறல், வீக்கம், சிறுநீர் குறைவு இருந்தால் — உடனே வாருங்கள். முன் அலுவலகம்: {front_desk_number}',
        hi: 'साँस लेने में तकलीफ़, सूजन, या पेशाब कम होना — तुरंत आइए। फ्रंट डेस्क: {front_desk_number}',
        en: 'Breathlessness, swelling, reduced urine — come in now. Front desk: {front_desk_number}',
    },
] as const;

const SCRIPT_LANGUAGES = [
    { key: 'ta', name: 'தமிழ்', english: 'Tamil', note: 'Default opening language for KKC.' },
    { key: 'hi', name: 'हिन्दी', english: 'Hindi', note: 'Used when the patient answers in Hindi.' },
    { key: 'en', name: 'English', english: '', note: 'Fallback, and what reception reads to check the flow.' },
] as const;

const CallScript: React.FC = () => (
    <div className="rounded-2xl border border-violet-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Call script — what the patient hears</p>
            <p className="text-[11px] text-gray-400">Agent “Asha” · Sarvam app_version 10</p>
        </div>
        <p className="text-xs text-gray-500 mb-4">
            Summary of the flow, not the agent's prompt — that lives in the Sarvam console. The call opens in the
            language set for that call and follows the patient from there; the agent supports 11 Indian languages,
            of which the three below are the ones KKC actually sees.
        </p>

        <div className="space-y-4">
            {SCRIPT_LANGUAGES.map((lang) => (
                <section key={lang.key}>
                    <div className="flex items-baseline gap-2 mb-2 pb-1.5 border-b border-gray-200">
                        <h4 className="text-sm font-bold text-gray-900">{lang.name}</h4>
                        {lang.english && <span className="text-xs text-gray-400">{lang.english}</span>}
                        <span className="ml-auto text-[11px] text-gray-400">{lang.note}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm">
                        {SCRIPT_STEPS.map((step) => (
                            <div key={step.label} className="rounded-xl border border-gray-200 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{step.label}</p>
                                <p className="mt-1 text-gray-900 leading-relaxed">{step[lang.key]}</p>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>

        <p className="mt-4 text-xs text-gray-500">
            The agent never moves an appointment. It records what the patient said; a human reschedules.
        </p>
    </div>
);

export default AICallCampaignPage;
