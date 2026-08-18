/**
 * phoneUtils — Indian mobile normalization, client side
 * ─────────────────────────────────────────────────────
 * MIRRORS sql/20260814_phone_e164.sql :: normalize_indian_mobile(text).
 * The database is the source of truth — hospital_patients.phone_e164 is a
 * generated column, so nothing here can put a wrong value in the DB. This copy
 * exists only so reception gets told at the point of typing, instead of the
 * number silently becoming unreachable weeks later when reminders go out.
 *
 * If the rules change, change them in BOTH files. They are deliberately
 * simple and identical so that staying in sync is easy to eyeball.
 *
 * Country assumption: India (+91), which is every current site.
 */

/** Digits only — same as the SQL's regexp_replace(raw, '\D', '', 'g'). */
const digitsOf = (raw: string): string => raw.replace(/\D/g, '');

/**
 * Indian mobile → E.164 (+91XXXXXXXXXX), or null if not dialable.
 *
 * Accepts the shapes reception actually types:
 *   9876543210    +91 98765 43210    09876543210
 *   919876543210  +919876543210      0919876543210
 *
 * Returns null for anything else — including two numbers in one field, which
 * is a real habit and needs a human to split. Null means "not dialable",
 * never "probably fine".
 */
export const normalizeIndianMobile = (raw?: string | null): string | null => {
    if (!raw) return null;
    const d = digitsOf(raw);

    if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
    if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
    if (/^91[6-9]\d{9}$/.test(d)) return `+91${d.slice(2)}`;
    if (/^091[6-9]\d{9}$/.test(d)) return `+91${d.slice(3)}`;

    return null;
};

export type PhoneVerdictKind = 'empty' | 'valid' | 'invalid';

export interface PhoneVerdict {
    kind: PhoneVerdictKind;
    /** E.164 form, present only when kind === 'valid'. */
    e164: string | null;
    /** Short reason, shown under the input. Null when there is nothing to say. */
    message: string | null;
}

/**
 * Classify what reception has typed so far, for inline feedback.
 *
 * Deliberately quiet while the number is still being typed — nagging on every
 * keystroke trains people to ignore the warning. Only speaks up once the input
 * is long enough to be a finished attempt.
 */
export const describePhoneInput = (raw?: string | null): PhoneVerdict => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { kind: 'empty', e164: null, message: null };

    const e164 = normalizeIndianMobile(trimmed);
    if (e164) return { kind: 'valid', e164, message: null };

    const d = digitsOf(trimmed);

    // Still mid-type: say nothing yet.
    if (d.length < 10) return { kind: 'empty', e164: null, message: null };

    if (/[,/]|\s{2,}/.test(trimmed)) {
        return {
            kind: 'invalid',
            e164: null,
            message: 'Looks like two numbers — keep one here.',
        };
    }
    if (d.length > 12) {
        return { kind: 'invalid', e164: null, message: 'Too many digits for a mobile number.' };
    }
    if (!/^(0|91|091)?[6-9]/.test(d)) {
        return { kind: 'invalid', e164: null, message: 'Indian mobiles start with 6, 7, 8 or 9.' };
    }
    return { kind: 'invalid', e164: null, message: 'Not a valid mobile number.' };
};

/** True when the number can receive a WhatsApp reminder. */
export const isReachableOnWhatsApp = (raw?: string | null): boolean =>
    normalizeIndianMobile(raw) !== null;
