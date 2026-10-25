/**
 * aiCallReport — the AI follow-up call report sent to the hospital
 *
 * `summarizeReport` sorts the calls the way the doctor reads them (needs action,
 * will come, other outcomes, not reached) for the on-screen report, and
 * `buildAiCallReportCsv` writes the same rows in the same order, so the page the
 * doctor reads and the Excel file the front desk works from cannot disagree.
 * Kept in a .ts file so the logic stays testable and React-free.
 *
 * Also the single home of the outcome vocabulary the campaign page shows on
 * screen: the agent's `missed_reason` codes, its dispositions, and how a
 * carrier result reads to a person.
 */

/**
 * Old or new patient, read from the year in the MR number (KNH/25/012345 → 25).
 * New means the MR was issued this year: a patient who first came to the
 * hospital recently. Entries carry stray spaces and missing prefixes, so the
 * match is loose; anything unreadable is neither.
 */
const THIS_YEAR_YY = String(new Date().getFullYear()).slice(2);
export const patientTypeOf = (mr: string | null | undefined): 'old' | 'new' | null => {
    const yy = (mr || '').match(/^\s*(?:[A-Za-z]+\s*\/)?\s*(\d\d)\/\d{4,}/)?.[1];
    if (!yy || yy > THIS_YEAR_YY) return null;
    return yy === THIS_YEAR_YY ? 'new' : 'old';
};

/** Agent v10+ `missed_reason` codes, as a person would say them. */
export const MISSED_REASON_LABELS: Record<string, string> = {
    TRAVEL_DISTANCE: 'Travel or distance',
    COST: 'Cost',
    FEELING_BETTER: 'Felt better',
    UNWELL_OR_ADMITTED: 'Unwell or admitted elsewhere',
    NO_ESCORT: 'No one to bring them',
    WORK_OR_FAMILY: 'Work or family',
    FORGOT: 'Forgot the date',
    TREATED_ELSEWHERE: 'Treated elsewhere',
    NOT_SATISFIED: 'Not satisfied with care',
    OTHER: 'Other',
    NOT_SHARED: 'Did not say',
};

const DISPOSITION_LABELS: Record<string, string> = {
    WILL_COME: 'Will come',
    // Said by the call result instead ("Picked up, no conversation").
    NOT_REACHABLE: '',
    CALLBACK_REQUESTED: 'Asked for a call back',
    NOT_INTERESTED: 'Not interested',
    WRONG_NUMBER: 'Wrong number',
    PATIENT_HOSPITALISED: 'In hospital now',
    PATIENT_DECEASED: 'Patient deceased',
    DO_NOT_CALL: 'Asked not to be called',
    RED_FLAG_REPORTED: 'RED FLAG: review now',
    LANGUAGE_BARRIER: 'Language barrier',
};

const titleCase = (code: string): string =>
    code.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const dispositionLabel = (code: string | null | undefined): string => {
    if (!code) return '';
    const key = code.trim().toUpperCase();
    if (key in DISPOSITION_LABELS) return DISPOSITION_LABELS[key];
    // REFUSED_COST, REFUSED_DISTANCE …: the agent invents the suffix.
    if (key.startsWith('REFUSED_')) return `Will not come (${titleCase(key.slice(8))})`;
    return titleCase(key);
};

/** The agent writes "NA" (and sometimes "none") for "nothing to report". */
const str = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t && !/^(n\/?a|none|null|nil|-)$/i.test(t) ? t : null;
};

/** The raw row the report is built from: one hospital_voice_call_attempts row. */
export interface AiCallReportInput {
    name: string;
    mrNumber: string | null;
    createdAt: string;
    status: string;
    providerStatus: string | null;
    durationSeconds?: number | null;
    vars: Record<string, unknown> | null;
    /** Calls placed to this patient in the session; set when one row stands for several. */
    attempts?: number;
}

/** Where a patient sits in the report, in reading order. */
export type ReportGroup = 'action' | 'coming' | 'other' | 'unreached';

export const REPORT_GROUPS: { key: ReportGroup; title: string; hint: string }[] = [
    { key: 'action', title: 'Needs action', hint: 'Red flags, call-back requests and patients who will not come' },
    { key: 'coming', title: 'Will come', hint: 'Agreed to come for their review' },
    { key: 'other', title: 'Other outcomes', hint: 'In hospital, wrong number, deceased and similar' },
    { key: 'unreached', title: 'Not reached', hint: 'No conversation took place; worth calling again' },
];

export interface AiCallReportRow {
    name: string;
    createdAt: string;
    group: ReportGroup;
    redFlag: boolean;
    callback: boolean;
    preferredDay: string;
    durationSeconds: number | null;
    mrNumber: string;
    patientType: string;
    calledAt: string;
    answered: boolean;
    callResult: string;
    duration: string;
    attempts: string;
    spokeTo: string;
    outcome: string;
    outcomeCode: string;
    reasonLabel: string;
    reasonText: string;
    nextStep: string;
    summary: string;
}

/**
 * Outcomes where no real conversation happened, so "why did you miss" was
 * never answered and a "Did not say" would only be noise.
 */
export const NO_CONVERSATION = new Set(['NOT_REACHABLE', 'WRONG_NUMBER', 'LANGUAGE_BARRIER']);

/**
 * Did anybody actually talk? The agent marks a call it could not get going as
 * NOT_REACHABLE, and a call cut off at once comes back with every output empty.
 * Both connected, but neither is an answered call.
 */
const hadConversation = (vars: Record<string, unknown> | null | undefined): boolean => {
    if (vars === undefined) return true; // caller has no outputs to judge by
    const v = vars || {};
    const disposition = (str(v.disposition) || '').toUpperCase();
    if (disposition === 'NOT_REACHABLE') return false;
    return Boolean(disposition || str(v.call_summary) || str(v.reason_text));
};

export const NO_CONVERSATION_LABEL = 'Picked up, no conversation';

/**
 * How the call ended, in words. Only a connected call where somebody spoke is
 * "Answered"; pass the call's outputs (`vars`) so a pick-up with nothing said
 * reads as such.
 */
export const callResultLabel = (
    status: string,
    providerStatus: string | null,
    vars?: Record<string, unknown> | null,
): string => {
    let carrier: string;
    switch ((providerStatus || '').toLowerCase()) {
        case 'connected': carrier = 'Answered'; break;
        case 'no_answer': return 'Not answered';
        case 'busy': return 'Busy';
        case 'failed': return 'Could not connect';
        default:
            if (status === 'failed') return 'Could not place';
            if (status !== 'completed') return 'Waiting for result';
            carrier = 'Answered';
    }
    return hadConversation(vars) ? carrier : NO_CONVERSATION_LABEL;
};

/** 134 → "2:14". Blank when the platform never reported a length. */
export const formatCallDuration = (seconds: number | null | undefined): string => {
    if (seconds == null || !Number.isFinite(seconds)) return '';
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The agent's summary refers to the patient by the variable's name
 * ("patient_name stated…") rather than the name itself. Put the name back
 * wherever the summary is shown or exported.
 */
export const withPatientName = (summary: string | null, name: string): string | null =>
    summary ? summary.replace(/\bpatient_name\b/gi, name) : null;

export const toReportRow = (c: AiCallReportInput): AiCallReportRow => {
    const v = c.vars || {};
    const callResult = callResultLabel(c.status, c.providerStatus, c.vars);
    const answered = callResult === 'Answered';
    const pickedUp = answered || callResult === NO_CONVERSATION_LABEL;
    const disposition = str(v.disposition);
    const rawCode = (str(v.missed_reason) || '').toUpperCase();
    const code = rawCode === 'NOT_SHARED' && NO_CONVERSATION.has((disposition || '').toUpperCase()) ? '' : rawCode;
    const spoke = str(v.spoke_to);
    const preferred = str(v.preferred_day);
    const callback = (str(v.callback_requested) || '').toLowerCase() === 'yes';
    const next = [
        disposition?.toUpperCase() === 'RED_FLAG_REPORTED' ? 'Red flag: call the patient back today' : null,
        callback ? 'Asked for a call back' : null,
        preferred ? `Will come: ${preferred}` : null,
    ].filter(Boolean).join(' · ');
    const type = patientTypeOf(c.mrNumber);
    const codeUpper = (disposition || '').toUpperCase();
    const redFlag = codeUpper === 'RED_FLAG_REPORTED';
    const callbackAsked = callback || codeUpper === 'CALLBACK_REQUESTED';
    const group: ReportGroup = !answered
        ? 'unreached'
        : redFlag || callbackAsked || codeUpper.startsWith('REFUSED') || codeUpper === 'NOT_INTERESTED'
            ? 'action'
            : codeUpper === 'WILL_COME' ? 'coming' : 'other';
    return {
        name: c.name,
        createdAt: c.createdAt,
        group,
        redFlag: answered && redFlag,
        callback: answered && callbackAsked,
        preferredDay: answered ? (preferred || '') : '',
        durationSeconds: c.durationSeconds ?? null,
        mrNumber: c.mrNumber || '',
        patientType: type === 'new' ? 'New' : type === 'old' ? 'Old' : '',
        calledAt: new Date(c.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
        }),
        answered,
        callResult,
        duration: formatCallDuration(c.durationSeconds),
        attempts: c.attempts && c.attempts > 1 ? `${c.attempts} attempts` : '',
        spokeTo: answered && spoke && spoke.toUpperCase() !== 'UNKNOWN' ? titleCase(spoke) : '',
        outcome: answered ? dispositionLabel(disposition) : '',
        outcomeCode: (disposition || '').toUpperCase(),
        reasonLabel: answered && code ? (MISSED_REASON_LABELS[code] || titleCase(code)) : '',
        reasonText: answered ? (str(v.reason_text) || '') : '',
        nextStep: answered ? next : '',
        summary: pickedUp ? (withPatientName(str(v.call_summary), c.name) || '') : '',
    };
};

export interface ReportTotals { callsPlaced: number; callSeconds: number; timedCalls: number }

/**
 * One row per patient, with every call to them counted. A patient rung twice is
 * one patient in the report, not two: the row shown is their latest answered
 * call, else their latest call, so an unanswered retry never hides a
 * conversation that already happened. Totals still count every call.
 */
export function onePerPatient(
    calls: (Omit<AiCallReportInput, 'attempts'> & { patientId: string })[],
): { inputs: AiCallReportInput[]; totals: ReportTotals } {
    const isAnswered = (c: Omit<AiCallReportInput, 'attempts'>) =>
        callResultLabel(c.status, c.providerStatus, c.vars) === 'Answered';
    const byPatient = new Map<string, { pick: (typeof calls)[number]; attempts: number }>();
    for (const c of calls) {
        const seen = byPatient.get(c.patientId);
        if (!seen) { byPatient.set(c.patientId, { pick: c, attempts: 1 }); continue; }
        seen.attempts += 1;
        const a = isAnswered(c);
        if (a !== isAnswered(seen.pick) ? a : c.createdAt > seen.pick.createdAt) seen.pick = c;
    }
    const inputs = [...byPatient.values()]
        .sort((a, b) => a.pick.createdAt.localeCompare(b.pick.createdAt))
        .map(({ pick: c, attempts }) => ({
            name: c.name, mrNumber: c.mrNumber, createdAt: c.createdAt, status: c.status,
            providerStatus: c.providerStatus, vars: c.vars, durationSeconds: c.durationSeconds, attempts,
        }));
    const timed = calls.filter((c) => c.durationSeconds != null);
    return {
        inputs,
        totals: {
            callsPlaced: calls.length,
            callSeconds: timed.reduce((n, c) => n + (c.durationSeconds || 0), 0),
            timedCalls: timed.length,
        },
    };
}

const tally = <T,>(rows: T[], pick: (r: T) => string): [string, number][] => {
    const m = new Map<string, number>();
    rows.forEach((r) => { const k = pick(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const RESULT_ORDER = [NO_CONVERSATION_LABEL, 'Not answered', 'Busy', 'Could not connect', 'Could not place', 'Waiting for result'];

/** Reading order inside a group: the most urgent first, then by when they were called. */
const byUrgency = (a: AiCallReportRow, b: AiCallReportRow): number => {
    const rank = (r: AiCallReportRow) => r.group === 'action'
        ? (r.redFlag ? 0 : r.callback ? 1 : 2)
        : r.group === 'unreached'
            ? Math.max(0, RESULT_ORDER.indexOf(r.callResult))
            : r.group === 'other' ? 0 : 0;
    return rank(a) - rank(b)
        || (a.group === 'other' ? a.outcome.localeCompare(b.outcome) : 0)
        || a.createdAt.localeCompare(b.createdAt);
};

export interface TypeTally { called: number; answered: number; coming: number; unreached: number }

export interface ReportSummary {
    rows: AiCallReportRow[];
    groups: Record<ReportGroup, AiCallReportRow[]>;
    patients: number;
    callsPlaced: number;
    answered: number;
    coming: number;
    wontCome: number;
    action: number;
    unreached: number;
    callSeconds: number;
    timedCalls: number;
    reasons: [string, number][];
    outcomes: [string, number][];
    byType: { Old: TypeTally; New: TypeTally };
}

/**
 * Everything the report shows, from the calls. Pass `totals` from
 * onePerPatient() so calls and time count every attempt, not just the row shown.
 */
export function summarizeReport(
    calls: AiCallReportInput[],
    totals?: ReportTotals,
): ReportSummary {
    const rows = calls.map(toReportRow).sort((a, b) =>
        REPORT_GROUPS.findIndex((g) => g.key === a.group) - REPORT_GROUPS.findIndex((g) => g.key === b.group)
        || byUrgency(a, b));
    const groups = { action: [], coming: [], other: [], unreached: [] } as Record<ReportGroup, AiCallReportRow[]>;
    rows.forEach((r) => groups[r.group].push(r));
    const answered = rows.filter((r) => r.answered);
    const typeTally = (type: string): TypeTally => {
        const t = rows.filter((r) => r.patientType === type);
        return {
            called: t.length,
            answered: t.filter((r) => r.answered).length,
            coming: t.filter((r) => r.group === 'coming').length,
            unreached: t.filter((r) => r.group === 'unreached').length,
        };
    };
    return {
        rows,
        groups,
        patients: rows.length,
        callsPlaced: totals?.callsPlaced ?? calls.length,
        answered: answered.length,
        coming: groups.coming.length,
        wontCome: answered.filter((r) => r.outcomeCode.startsWith('REFUSED') || r.outcomeCode === 'NOT_INTERESTED').length,
        action: groups.action.length,
        unreached: groups.unreached.length,
        callSeconds: totals?.callSeconds ?? calls.reduce((n, c) => n + (c.durationSeconds || 0), 0),
        timedCalls: totals?.timedCalls ?? calls.filter((c) => c.durationSeconds != null).length,
        reasons: tally(answered.filter((r) => r.reasonLabel && r.reasonLabel !== 'Did not say'), (r) => r.reasonLabel),
        outcomes: tally(answered, (r) => r.outcome),
        byType: { Old: typeTally('Old'), New: typeTally('New') },
    };
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Excel opens this directly; the BOM keeps Tamil and ₹ readable. */
export function buildAiCallReportCsv(calls: AiCallReportInput[]): string {
    const header = ['#', 'Section', 'Patient', 'MR number', 'Old / New', 'Called at', 'Call result', 'Duration (m:ss)', 'Attempts', 'Spoke to', 'Outcome',
        'Why they missed', "Patient's reason", 'Next step', "Agent's account of the call"];
    const sectionTitle = (g: ReportGroup) => REPORT_GROUPS.find((x) => x.key === g)?.title || '';
    const lines = summarizeReport(calls).rows.map((r, i) => [
        String(i + 1), sectionTitle(r.group), r.name, r.mrNumber, r.patientType, r.calledAt, r.callResult, r.duration, r.attempts, r.spokeTo, r.outcome,
        r.reasonLabel, r.reasonText, r.nextStep, r.summary,
    ].map(csvCell).join(','));
    return '﻿' + [header.join(','), ...lines].join('\r\n');
}
