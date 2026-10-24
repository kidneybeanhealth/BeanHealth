/**
 * aiCallReport — the AI follow-up call report sent to the hospital
 *
 * One builder for the printable sheet and one for the spreadsheet, both from the
 * same rows, so the PDF the doctor reads and the Excel file the front desk works
 * from cannot disagree. Kept in a .ts file, like the dialysis register, so the
 * report does not drag React in behind it.
 *
 * Also the single home of the outcome vocabulary the campaign page shows on
 * screen: the agent's `missed_reason` codes, its dispositions, and how a
 * carrier result reads to a person.
 */
import { escapeHtml } from './dialysisRegisterPrint';

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
}

export interface AiCallReportRow {
    name: string;
    mrNumber: string;
    patientType: string;
    calledAt: string;
    answered: boolean;
    callResult: string;
    duration: string;
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
    return {
        name: c.name,
        mrNumber: c.mrNumber || '',
        patientType: type === 'new' ? 'New' : type === 'old' ? 'Old' : '',
        calledAt: new Date(c.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
        }),
        answered,
        callResult,
        duration: formatCallDuration(c.durationSeconds),
        spokeTo: answered && spoke && spoke.toUpperCase() !== 'UNKNOWN' ? titleCase(spoke) : '',
        outcome: answered ? dispositionLabel(disposition) : '',
        outcomeCode: (disposition || '').toUpperCase(),
        reasonLabel: answered && code ? (MISSED_REASON_LABELS[code] || titleCase(code)) : '',
        reasonText: answered ? (str(v.reason_text) || '') : '',
        nextStep: answered ? next : '',
        summary: pickedUp ? (withPatientName(str(v.call_summary), c.name) || '') : '',
    };
};

export interface AiCallReportParams {
    calls: AiCallReportInput[];
    hospitalName: string;
    periodLabel: string;
}

const count = <T,>(rows: T[], pick: (r: T) => string): [string, number][] => {
    const m = new Map<string, number>();
    rows.forEach((r) => { const k = pick(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export function buildAiCallReportHtml({ calls, hospitalName, periodLabel }: AiCallReportParams): string {
    const rows = calls.map(toReportRow);
    const answered = rows.filter((r) => r.answered);
    const willCome = answered.filter((r) => r.outcomeCode === 'WILL_COME').length;
    const wontCome = answered.filter((r) => r.outcomeCode.startsWith('REFUSED')).length;
    const noTalk = rows.filter((r) => r.callResult === NO_CONVERSATION_LABEL).length;
    const notAnswered = rows.length - answered.length - noTalk;
    const talkSeconds = calls.reduce((n, c) => n + (c.durationSeconds || 0), 0);
    const timed = calls.filter((c) => c.durationSeconds != null).length;
    const reasons = count(answered.filter((r) => r.reasonLabel && r.reasonLabel !== 'Did not say'), (r) => r.reasonLabel);
    const outcomes = count(answered, (r) => r.outcome);
    const old = rows.filter((r) => r.patientType === 'Old').length;
    const fresh = rows.filter((r) => r.patientType === 'New').length;

    const tally = (items: [string, number][]) => items.length
        ? items.map(([k, n]) => `<span class="pill">${escapeHtml(k)} <b>${n}</b></span>`).join('')
        : '<span class="muted">None yet</span>';

    const body = rows.map((r, i) => `
        <tr${r.outcomeCode === 'RED_FLAG_REPORTED' ? ' class="flag"' : ''}>
            <td class="num">${i + 1}</td>
            <td>
                <div class="nm">${escapeHtml(r.name)}</div>
                <div class="mr">${escapeHtml(r.mrNumber || '—')}${r.patientType ? ` · ${r.patientType}` : ''}</div>
                <div class="mr">${escapeHtml(r.calledAt)}</div>
            </td>
            <td>
                <div class="${r.answered ? 'ok' : 'no'}">${escapeHtml(r.callResult)}${r.duration ? ` · ${escapeHtml(r.duration)}` : ''}</div>
                ${r.spokeTo ? `<div class="mr">Spoke to: ${escapeHtml(r.spokeTo)}</div>` : ''}
                ${r.outcome ? `<div class="out">${escapeHtml(r.outcome)}</div>` : ''}
            </td>
            <td>
                ${r.reasonLabel ? `<div class="why">${escapeHtml(r.reasonLabel)}</div>` : ''}
                ${r.reasonText ? `<div>${escapeHtml(r.reasonText)}</div>` : (r.answered ? '' : '<div class="muted">—</div>')}
                ${r.nextStep ? `<div class="next">${escapeHtml(r.nextStep)}</div>` : ''}
            </td>
            <td class="sum">${r.summary ? escapeHtml(r.summary) : '<span class="muted">—</span>'}</td>
        </tr>`).join('');

    return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>AI follow-up calls — ${escapeHtml(periodLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  :root { color-scheme: only light; }
  html, body { background: #ffffff; color: #111827; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; margin: 0; }
  header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 10px; }
  h1 { font-size: 17px; margin: 0 0 2px; }
  .sub { font-size: 12px; color: #4b5563; }
  .totals { margin: 8px 0 8px; display: flex; flex-wrap: wrap; gap: 22px; }
  .totals b { font-size: 16px; display: block; }
  .tally { margin: 6px 0; }
  .tally h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #374151; margin: 0 0 4px; }
  .pill { display: inline-block; border: 1px solid #d1d5db; border-radius: 10px; padding: 1px 8px; margin: 0 5px 4px 0; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #374151;
       border-bottom: 1px solid #9ca3af; padding: 6px; }
  td { padding: 7px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr.flag td { background: #fef2f2; }
  .num { text-align: center; }
  .nm { font-weight: 600; }
  .mr { font-size: 10.5px; color: #6b7280; margin-top: 1px; }
  .ok { font-weight: 600; color: #065f46; }
  .no { font-weight: 600; color: #6b7280; }
  .out { font-weight: 600; margin-top: 2px; }
  .why { font-weight: 700; color: #92400e; }
  .next { margin-top: 3px; color: #1e40af; font-weight: 600; }
  .sum { color: #374151; line-height: 1.4; }
  .muted { color: #9ca3af; }
  footer { margin-top: 12px; font-size: 10px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style></head>
<body>
  <header>
    <h1>AI follow-up calls</h1>
    <div class="sub">${escapeHtml(hospitalName)} &middot; ${escapeHtml(periodLabel)}</div>
  </header>
  <div class="totals">
    <div><b>${rows.length}</b> calls placed</div>
    <div><b>${answered.length}</b> answered</div>
    <div><b>${noTalk}</b> picked up, no conversation</div>
    <div><b>${notAnswered}</b> not answered or busy</div>
    <div><b>${timed ? formatCallDuration(talkSeconds) : '—'}</b> total call time${timed && timed < calls.length ? ` (${timed} of ${calls.length} calls timed)` : ''}</div>
    <div><b>${willCome}</b> will come</div>
    <div><b>${wontCome}</b> will not come</div>
    <div><b>${old}</b> old · <b style="display:inline">${fresh}</b> new patients</div>
  </div>
  <div class="tally"><h2>Why they missed their review</h2>${tally(reasons)}</div>
  <div class="tally"><h2>Outcome of answered calls</h2>${tally(outcomes)}</div>
  <table>
    <colgroup>
      <col style="width:4%" /><col style="width:20%" /><col style="width:16%" />
      <col style="width:24%" /><col style="width:36%" />
    </colgroup>
    <thead><tr>
      <th>#</th><th>Patient</th><th>Call result</th><th>Why they missed / next step</th><th>Agent's account of the call</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <footer>
    Printed ${escapeHtml(new Date().toLocaleString('en-IN'))} from BeanHealth. Calls were placed by the AI assistant;
    the reason and the account are the assistant's summary of what was said, not a recording. Call time is as reported by
    the calling platform; a call with no time shown had none reported. Old or new is read from the
    year in the MR number. No appointment was changed by these calls.
  </footer>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Excel opens this directly; the BOM keeps Tamil and ₹ readable. */
export function buildAiCallReportCsv(calls: AiCallReportInput[]): string {
    const header = ['#', 'Patient', 'MR number', 'Old / New', 'Called at', 'Call result', 'Duration (m:ss)', 'Spoke to', 'Outcome',
        'Why they missed', "Patient's reason", 'Next step', "Agent's account of the call"];
    const lines = calls.map(toReportRow).map((r, i) => [
        String(i + 1), r.name, r.mrNumber, r.patientType, r.calledAt, r.callResult, r.duration, r.spokeTo, r.outcome,
        r.reasonLabel, r.reasonText, r.nextStep, r.summary,
    ].map(csvCell).join(','));
    return '﻿' + [header.join(','), ...lines].join('\r\n');
}
