/**
 * Connect protocol settings — the rules a centre runs on, with defaults
 *
 * Stored per centre in hospital_profiles.connect_settings (JSONB). Anything the
 * centre has not set falls back to the defaults below, key by key, so adding a
 * rule later never breaks a centre that saved its settings before it existed.
 *
 * ── The lab intervals are STARTING POINTS, not clinical guidance ──────────
 * They are common nephrology practice, written so a new centre gets a working
 * worklist on day one. Every centre's nephrologist must confirm or change them
 * in Settings before calls are placed on the strength of them. The Settings
 * screen says so, and so does this comment, because a default that silently
 * becomes "the protocol" is how the wrong patient gets told they are overdue.
 */

export type Programme = 'dialysis' | 'ckd' | 'transplant' | 'general';

export const PROGRAMMES: { id: Programme; label: string }[] = [
    { id: 'dialysis', label: 'Dialysis' },
    { id: 'ckd', label: 'CKD follow-up' },
    { id: 'transplant', label: 'Transplant' },
    { id: 'general', label: 'General' },
];

/**
 * Why a call is being made. Each purpose needs its own script on the voice
 * agent — a review reminder cannot tell somebody they missed Wednesday's
 * dialysis — so a purpose is only callable once its agent exists. See
 * `calls.purposesReady` and docs/CONNECT.md.
 */
export type CallPurpose = 'review' | 'review_reminder' | 'missed_session' | 'lab_due';

/** Every purpose, in the order screens list them. */
export const CALL_PURPOSES: CallPurpose[] = ['missed_session', 'review', 'review_reminder', 'lab_due'];

export const CALL_PURPOSE_LABEL: Record<CallPurpose, string> = {
    // 'review' is the MISSED-review script — it tells the patient they missed
    // their appointment. An appointment still ahead is 'review_reminder', which
    // needs its own agent; place-review-call enforces the date either way.
    review: 'Missed review',
    review_reminder: 'Upcoming review reminder',
    missed_session: 'Missed dialysis session',
    lab_due: 'Lab tests due',
};

export interface LabTestRule {
    /** Stored in connect_lab_records.test_code. Permanent — never reuse or rename. */
    code: string;
    label: string;
    everyDays: number;
    programmes: Programme[];
}

export interface ConnectSettings {
    missedSession: {
        enabled: boolean;
        /** How far back a missed, unrecovered session still earns a call. */
        lookbackDays: number;
        /** Consecutive missed sessions that make it urgent and raise an alert. */
        streakAlertAt: number;
    };
    labs: {
        enabled: boolean;
        /** Call this many days BEFORE a test falls due, so it can be booked. */
        leadDays: number;
        tests: LabTestRule[];
    };
    review: {
        enabled: boolean;
        /** Remind this many days before the review date. 1 = the day before. */
        leadDays: number;
        /** Past this many days overdue, stop calling — it needs a human, not a reminder. */
        overdueWindowDays: number;
    };
    calls: {
        /** Do not call the same patient for the same reason again within this window. */
        retryAfterHours: number;
        /** Unanswered attempts per item before it is handed to a person. */
        maxAttemptsPerItem: number;
        /** Purposes whose voice-agent script exists. Only these can be dialled. */
        purposesReady: CallPurpose[];
        /** Opening language when the patient has none set. */
        defaultLanguage: string;
    };
    alerts: {
        coordinatorName: string;
        /** Digits only with country code, e.g. 919876543210. Staff numbers, not patients'. */
        coordinatorWhatsApp: string;
        doctorName: string;
        doctorWhatsApp: string;
    };
}

export const CALL_LANGUAGES = ['Tamil', 'English', 'Hindi', 'Telugu', 'Kannada', 'Malayalam'];

export const DEFAULT_SETTINGS: ConnectSettings = {
    missedSession: { enabled: true, lookbackDays: 7, streakAlertAt: 2 },
    labs: {
        enabled: true,
        leadDays: 3,
        tests: [
            { code: 'cbc', label: 'CBC', everyDays: 30, programmes: ['dialysis'] },
            { code: 'rft', label: 'Kidney function (RFT) & electrolytes', everyDays: 30, programmes: ['dialysis', 'transplant'] },
            { code: 'iron', label: 'Iron studies', everyDays: 90, programmes: ['dialysis'] },
            { code: 'ipth', label: 'iPTH', everyDays: 90, programmes: ['dialysis'] },
            { code: 'viral', label: 'Viral markers (HBsAg, HCV, HIV)', everyDays: 180, programmes: ['dialysis'] },
            { code: 'rft_ckd', label: 'Kidney function (RFT)', everyDays: 90, programmes: ['ckd'] },
            { code: 'uacr', label: 'Urine ACR', everyDays: 180, programmes: ['ckd'] },
            { code: 'tac', label: 'Tacrolimus level', everyDays: 30, programmes: ['transplant'] },
        ],
    },
    review: { enabled: true, leadDays: 1, overdueWindowDays: 30 },
    calls: {
        retryAfterHours: 20,
        maxAttemptsPerItem: 2,
        // Only the review agent exists on Sarvam today (agent v9).
        purposesReady: ['review'],
        defaultLanguage: 'Tamil',
    },
    alerts: { coordinatorName: '', coordinatorWhatsApp: '', doctorName: '', doctorWhatsApp: '' },
};

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Merge stored settings over the defaults, section by section and key by key,
 * dropping anything of the wrong type. A malformed value falls back to the
 * default rather than breaking the worklist.
 */
export function resolveSettings(stored: unknown): ConnectSettings {
    const s = isObj(stored) ? stored : {};
    const out: any = structuredClone(DEFAULT_SETTINGS);
    for (const section of Object.keys(out) as (keyof ConnectSettings)[]) {
        const incoming = s[section];
        if (!isObj(incoming)) continue;
        for (const key of Object.keys(out[section])) {
            const def = out[section][key];
            const val = incoming[key];
            if (val === undefined || val === null) continue;
            if (Array.isArray(def) ? Array.isArray(val) : typeof val === typeof def) {
                out[section][key] = val;
            }
        }
    }
    // Lab rules and purposes are validated item by item.
    out.labs.tests = (out.labs.tests as any[]).filter(t =>
        isObj(t) && typeof t.code === 'string' && t.code && typeof t.label === 'string'
        && Number.isFinite(t.everyDays) && t.everyDays > 0 && Array.isArray(t.programmes));
    out.calls.purposesReady = (out.calls.purposesReady as any[]).filter(p => CALL_PURPOSES.includes(p));
    return out as ConnectSettings;
}
