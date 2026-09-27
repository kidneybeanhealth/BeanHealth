/**
 * Connect protocol engine — who needs a call today, and why
 *
 * A pure function: data in, a worklist out. No database, no clock of its own
 * (today is a parameter), so every rule below is covered by engine.test.ts and
 * can be reasoned about without a running centre.
 *
 * ── The principle: a wrong call is worse than no call ──────────────────────
 * Ringing a patient who was sitting in the dialysis chair on Wednesday to ask
 * why they missed Wednesday is the fastest way to teach a centre to switch the
 * product off. So every rule here errs toward NOT calling:
 *
 *   · A session counts as missed only when somebody MARKED it missed. A day
 *     nobody marked is listed as "unmarked" for a human to settle — never
 *     assumed missed. A centre that forgets to mark attendance for a week must
 *     get a nudge, not two hundred wrong calls.
 *   · A missed session followed by an attended one is recovered. No call.
 *   · A lab never recorded has no baseline. No call; it is counted instead.
 *   · A review more than `overdueWindowDays` overdue is past what a reminder
 *     can fix. No call; a human should look at it.
 *   · One call per patient per day, whatever the number of reasons.
 *
 * ── Dates ─────────────────────────────────────────────────────────────────
 * Every date is a clinic-local 'YYYY-MM-DD' key, and all arithmetic is done in
 * UTC on those keys, so a worklist computed at 11:58 pm and at 12:01 am differs
 * only by the day that actually changed — never by a timezone offset.
 */
import type { CallPurpose, ConnectSettings, LabTestRule, Programme } from './settings';

export type DateKey = string;

export interface EnginePatient {
    id: string;
    name: string;
    mrNumber: string | null;
    programme: Programme | null;
    /** ISO weekdays, 1 = Monday … 7 = Sunday. */
    dialysisDays: number[] | null;
    phoneE164: string | null;
    attenderPhoneE164: string | null;
    doNotCall: boolean;
    callHold: boolean;
    isDeceased: boolean;
    /** Left the programme (continuity_status not active). */
    stopped: boolean;
}

export interface EngineSession { patientId: string; date: DateKey; status: 'attended' | 'missed' | 'cancelled' }
export interface EngineLab { patientId: string; testCode: string; doneOn: DateKey }
export interface EngineReview { patientId: string; reviewDate: DateKey }
export interface EngineAttempt {
    patientId: string;
    purpose: CallPurpose;
    createdAt: string;   // ISO timestamp
    status: string;      // placing | placed | completed | failed | expired
    connected: boolean;
}

export type WorkReason = 'missed_session' | 'review_overdue' | 'lab_due' | 'review_due';

export interface WorkItem {
    key: string;
    patientId: string;
    patientName: string;
    mrNumber: string | null;
    reason: WorkReason;
    purpose: CallPurpose;
    /** 1 urgent · 2 today · 3 routine */
    priority: 1 | 2 | 3;
    title: string;
    detail: string;
    /** The date this became due — the oldest thing it is about. */
    since: DateKey;
    callable: boolean;
    /** Why it cannot be dialled right now, in words a coordinator can act on. */
    blockedReason: string | null;
    /** Missed sessions in a row, for the missed-session reason. */
    streak?: number;
}

export interface Unmarked { patientId: string; patientName: string; date: DateKey }

export interface WorklistResult {
    items: WorkItem[];
    /** Scheduled sessions nobody has marked attended or missed. */
    unmarked: Unmarked[];
    /** Patients whose labs cannot be scheduled because none were ever recorded. */
    labsNoBaseline: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────
const DAY = 86_400_000;
const toUtc = (k: DateKey): number => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
};
const fromUtc = (t: number): DateKey => new Date(t).toISOString().slice(0, 10);
export const addDays = (k: DateKey, n: number): DateKey => fromUtc(toUtc(k) + n * DAY);
export const daysBetween = (a: DateKey, b: DateKey): number => Math.round((toUtc(b) - toUtc(a)) / DAY);
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoWeekday = (k: DateKey): number => {
    const d = new Date(toUtc(k)).getUTCDay();
    return d === 0 ? 7 : d;
};
const WEEKDAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const speakDate = (k: DateKey): string => {
    const [, m, d] = k.split('-').map(Number);
    return `${WEEKDAY[isoWeekday(k)]} ${d} ${MONTH[m - 1]}`;
};

/** Next scheduled session strictly after `from`, within two weeks, or null. */
export function nextSessionAfter(days: number[] | null, from: DateKey): DateKey | null {
    if (!days?.length) return null;
    for (let i = 1; i <= 14; i++) {
        const k = addDays(from, i);
        if (days.includes(isoWeekday(k))) return k;
    }
    return null;
}

const REASON_ORDER: Record<WorkReason, number> = { missed_session: 0, review_overdue: 1, lab_due: 2, review_due: 3 };
const PURPOSE_OF: Record<WorkReason, CallPurpose> = {
    missed_session: 'missed_session',
    review_overdue: 'review',
    review_due: 'review',
    lab_due: 'lab_due',
};

const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of xs) {
        const k = key(x);
        const arr = m.get(k);
        if (arr) arr.push(x); else m.set(k, [x]);
    }
    return m;
};

export interface EngineInput {
    today: DateKey;
    /** Current instant, for "called 3 hours ago". */
    now: Date;
    settings: ConnectSettings;
    patients: EnginePatient[];
    sessions: EngineSession[];
    labs: EngineLab[];
    reviews: EngineReview[];
    attempts: EngineAttempt[];
}

export function buildWorklist(input: EngineInput): WorklistResult {
    const { today, now, settings } = input;
    const sessionsBy = groupBy(input.sessions, s => s.patientId);
    const labsBy = groupBy(input.labs, l => l.patientId);
    const reviewsBy = groupBy(input.reviews, r => r.patientId);
    const attemptsBy = groupBy(input.attempts, a => a.patientId);

    const items: WorkItem[] = [];
    const unmarked: Unmarked[] = [];
    const noBaseline = new Set<string>();

    for (const p of input.patients) {
        if (p.isDeceased || p.stopped) continue;
        const raw: Omit<WorkItem, 'callable' | 'blockedReason' | 'key' | 'purpose'>[] = [];

        // ── Missed dialysis session ─────────────────────────────────────
        if (settings.missedSession.enabled && p.programme === 'dialysis') {
            const mine = (sessionsBy.get(p.id) || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
            const windowStart = addDays(today, -settings.missedSession.lookbackDays);

            // Unmarked scheduled days in the window, today excluded — today's
            // shift may simply not have happened yet.
            if (p.dialysisDays?.length) {
                const marked = new Set(mine.map(s => s.date));
                for (let k = windowStart; k < today; k = addDays(k, 1)) {
                    if (p.dialysisDays.includes(isoWeekday(k)) && !marked.has(k)) {
                        unmarked.push({ patientId: p.id, patientName: p.name, date: k });
                    }
                }
            }

            // The most recent decisive session (cancelled ones decide nothing).
            const decisive = mine.filter(s => s.status !== 'cancelled' && s.date <= today);
            const latest = decisive[0];
            if (latest && latest.status === 'missed' && latest.date >= windowStart) {
                let streak = 0;
                for (const s of decisive) {
                    if (s.status === 'missed') streak++;
                    else break;
                }
                const next = nextSessionAfter(p.dialysisDays, today) ?? nextSessionAfter(p.dialysisDays, addDays(today, -1));
                const urgent = streak >= settings.missedSession.streakAlertAt;
                raw.push({
                    patientId: p.id, patientName: p.name, mrNumber: p.mrNumber,
                    reason: 'missed_session',
                    priority: urgent ? 1 : 2,
                    title: streak > 1 ? `Missed ${streak} dialysis sessions in a row` : 'Missed a dialysis session',
                    detail: `Last missed ${speakDate(latest.date)}${next ? ` · next scheduled ${speakDate(next)}` : ''}`,
                    since: latest.date,
                    streak,
                });
            }
        }

        // ── Labs due ────────────────────────────────────────────────────
        if (settings.labs.enabled && p.programme) {
            const rules: LabTestRule[] = settings.labs.tests.filter(t => t.programmes.includes(p.programme as Programme));
            const mine = labsBy.get(p.id) || [];
            const due: { rule: LabTestRule; dueOn: DateKey }[] = [];
            for (const rule of rules) {
                const last = mine.filter(l => l.testCode === rule.code).map(l => l.doneOn).sort().pop();
                if (!last) { noBaseline.add(p.id); continue; }
                const dueOn = addDays(last, rule.everyDays);
                if (daysBetween(today, dueOn) <= settings.labs.leadDays) due.push({ rule, dueOn });
            }
            if (due.length) {
                // One item for all of a patient's tests: one call, not four.
                due.sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
                const earliest = due[0].dueOn;
                const overdue = earliest < today;
                raw.push({
                    patientId: p.id, patientName: p.name, mrNumber: p.mrNumber,
                    reason: 'lab_due',
                    priority: overdue ? 2 : 3,
                    title: overdue ? 'Lab tests overdue' : 'Lab tests due soon',
                    detail: due.map(d => `${d.rule.label} (${d.dueOn < today ? 'due since' : 'due'} ${speakDate(d.dueOn)})`).join(' · '),
                    since: earliest,
                });
            }
        }

        // ── Review ──────────────────────────────────────────────────────
        if (settings.review.enabled) {
            const dates = (reviewsBy.get(p.id) || []).map(r => r.reviewDate).filter(Boolean).sort();
            // The nearest review that is not in the past, else the latest past one.
            const upcoming = dates.find(d => d >= today);
            const pastLatest = dates.filter(d => d < today).pop();
            if (upcoming && daysBetween(today, upcoming) <= settings.review.leadDays) {
                raw.push({
                    patientId: p.id, patientName: p.name, mrNumber: p.mrNumber,
                    reason: 'review_due', priority: 3,
                    title: upcoming === today ? 'Review is today' : 'Review is coming up',
                    detail: `Review on ${speakDate(upcoming)}`,
                    since: upcoming,
                });
            } else if (!upcoming && pastLatest && daysBetween(pastLatest, today) <= settings.review.overdueWindowDays) {
                raw.push({
                    patientId: p.id, patientName: p.name, mrNumber: p.mrNumber,
                    reason: 'review_overdue', priority: 2,
                    title: 'Missed review',
                    detail: `Review was ${speakDate(pastLatest)} · ${daysBetween(pastLatest, today)} days ago`,
                    since: pastLatest,
                });
            }
        }

        if (!raw.length) continue;

        // ── Callability ─────────────────────────────────────────────────
        raw.sort((a, b) => REASON_ORDER[a.reason] - REASON_ORDER[b.reason]);
        const attempts = attemptsBy.get(p.id) || [];
        const inFlight = attempts.some(a => a.status === 'placing' || a.status === 'placed');
        const calledToday = attempts.some(a => a.createdAt.slice(0, 10) === today && a.status !== 'failed');
        const hasPhone = !!(p.phoneE164 || p.attenderPhoneE164);

        raw.forEach((r, i) => {
            const purpose = PURPOSE_OF[r.reason];
            // A reminder is placed BEFORE its date — "your review is tomorrow" —
            // so for the ahead-of-time reasons the attempts that count start
            // lead-days before `since`. Counting only from `since` would miss
            // yesterday's reminder and ring the patient about it again today.
            const windowStart =
                r.reason === 'review_due' ? addDays(r.since, -settings.review.leadDays)
                : r.reason === 'lab_due' && r.since > today ? addDays(r.since, -settings.labs.leadDays)
                : r.since;
            const forThis = attempts.filter(a => a.purpose === purpose && a.createdAt.slice(0, 10) >= windowStart);
            const unanswered = forThis.filter(a => !a.connected && a.status !== 'placing' && a.status !== 'placed');
            const recent = forThis
                .map(a => new Date(a.createdAt).getTime())
                .filter(t => now.getTime() - t < settings.calls.retryAfterHours * 3_600_000)
                .sort((a, b) => b - a)[0];

            let blocked: string | null = null;
            if (p.doNotCall) blocked = 'Asked not to be called';
            else if (p.callHold) blocked = 'On hold — not now';
            else if (!hasPhone) blocked = 'No phone number';
            else if (!settings.calls.purposesReady.includes(purpose)) blocked = 'Voice agent not set up for this call type yet';
            else if (inFlight) blocked = 'A call is in progress';
            else if (forThis.some(a => a.connected)) blocked = 'Already reached about this';
            else if (unanswered.length >= settings.calls.maxAttemptsPerItem) blocked = `No answer after ${unanswered.length} calls — ring by hand`;
            else if (recent) blocked = `Called ${Math.max(1, Math.round((now.getTime() - recent) / 3_600_000))}h ago`;
            else if (i > 0 || calledToday) blocked = i > 0 ? `One call a day — ${raw[0].title.toLowerCase()} first` : 'Already called today';

            items.push({
                ...r,
                key: `${p.id}:${r.reason}:${r.since}`,
                purpose,
                callable: blocked === null,
                blockedReason: blocked,
            });
        });
    }

    // Sort by PATIENT, then keep each patient's own items together in the order
    // they are meant to be dealt with. Sorting items independently put a
    // patient's blocked "one call a day" item above the call it was waiting on.
    const cmpSince = (a: DateKey, b: DateKey) => (a < b ? -1 : a > b ? 1 : 0);
    const groups = [...groupBy(items, i => i.patientId).values()];
    groups.sort((ga, gb) => {
        const pa = Math.min(...ga.map(i => i.priority)), pb = Math.min(...gb.map(i => i.priority));
        const sa = ga.map(i => i.since).sort()[0], sb = gb.map(i => i.since).sort()[0];
        return pa - pb || cmpSince(sa, sb) || ga[0].patientName.localeCompare(gb[0].patientName);
    });
    items.length = 0;
    for (const g of groups) items.push(...g);
    unmarked.sort((a, b) =>
        (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || a.patientName.localeCompare(b.patientName));

    return { items, unmarked, labsNoBaseline: noBaseline.size };
}
