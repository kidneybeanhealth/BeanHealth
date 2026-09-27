/**
 * feedbackQuestions — the one place the survey is defined
 *
 * Both the public form and the doctor's dashboard read this file. The form
 * renders it; the panel averages by it and labels the columns from it. Adding,
 * removing or re-wording a question is an edit here and nothing else — no
 * migration, because answers land in a JSONB column keyed by `id`, and no
 * second list to keep in sync, which is the failure this codebase has paid for
 * twice already with the Past Records print sheet.
 *
 * ── Why the set branches on visit type ────────────────────────────────────
 * One QR covers the whole hospital, so the form cannot know whether it is being
 * filled in by somebody four hours into dialysis, somebody in a ward bed, or
 * somebody who waited twenty minutes for an OP consultation. Asking all of them
 * every question produces a long form that elderly patients abandon and answers
 * about facilities they never used. Asking what kind of visit it was first costs
 * one tap and makes every question after it relevant.
 *
 * It also gives "which part of the hospital is this about" a home before the
 * hospital decides whether to split the QR by station — which is the whole
 * reason the location row exists while there is only one of them.
 *
 * ── Rules for editing ─────────────────────────────────────────────────────
 * - `id` is written into the database. Never reuse one for a different question
 *   and never rename one, or a month of history silently changes meaning.
 *   Retiring a question means deleting it here; the old answers stay readable
 *   because `questionLabel()` falls back to the stored id.
 * - Keep `core` short. Every extra row is a patient who stops halfway.
 */

export type VisitTypeId = 'opd' | 'dialysis' | 'inpatient' | 'pharmacy' | 'other';

export type Lang = 'en' | 'ta';

export interface VisitTypeOption {
    id: VisitTypeId;
    label: string;
    labelTa: string;
    /** Sub-line on the chooser, in the patient's words rather than the hospital's. */
    hint: string;
    hintTa: string;
}

export const VISIT_TYPES: VisitTypeOption[] = [
    { id: 'opd', label: 'OP consultation', labelTa: 'வெளிநோயாளி ஆலோசனை', hint: 'Came to see a doctor', hintTa: 'மருத்துவரைப் பார்க்க வந்தேன்' },
    { id: 'dialysis', label: 'Dialysis', labelTa: 'டயாலிசிஸ்', hint: 'Came for a dialysis session', hintTa: 'டயாலிசிஸுக்கு வந்தேன்' },
    { id: 'inpatient', label: 'Admitted', labelTa: 'அனுமதிக்கப்பட்டுள்ளேன்', hint: 'Staying in a room or ward', hintTa: 'அறை அல்லது வார்டில் தங்கியுள்ளேன்' },
    { id: 'pharmacy', label: 'Pharmacy only', labelTa: 'மருந்தகம் மட்டும்', hint: 'Came to collect medicines', hintTa: 'மருந்து வாங்க வந்தேன்' },
    { id: 'other', label: 'Something else', labelTa: 'வேறு ஏதாவது', hint: 'Tests, reports, an enquiry', hintTa: 'பரிசோதனை, ரிப்போர்ட், விசாரணை' },
];

export interface FeedbackQuestion {
    /** Stored in hospital_feedback.ratings. Permanent. */
    id: string;
    label: string;
    /**
     * Tamil. UNVERIFIED — machine-written and not yet read by anyone at the
     * hospital. Have the physician assistant check every line before a poster
     * goes on a wall: a survey a patient half-understands returns worse data
     * than one they cannot read at all.
     */
    labelTa: string;
    /** Shown under the label when the question could be read two ways. */
    hint?: string;
    hintTa?: string;
    /** Absent means every visit type is asked this. */
    visitTypes?: VisitTypeId[];
}

/**
 * Asked of everybody. Five is the ceiling — past that, completion falls off a
 * cliff on a phone held in one hand.
 */
export const CORE_QUESTIONS: FeedbackQuestion[] = [
    { id: 'overall', label: 'Overall experience', labelTa: 'ஒட்டுமொத்த அனுபவம்', hint: 'Your visit today, taken as a whole', hintTa: 'இன்றைய வருகை முழுவதுமாக' },
    { id: 'staff_behaviour', label: 'Staff behaviour', labelTa: 'ஊழியர்களின் நடத்தை', hint: 'Reception, nurses, attenders', hintTa: 'வரவேற்பு, செவிலியர், உதவியாளர்' },
    { id: 'cleanliness', label: 'Cleanliness', labelTa: 'சுத்தம்' },
    { id: 'restroom', label: 'Restroom', labelTa: 'கழிப்பறை' },
    { id: 'waiting_time', label: 'Waiting time', labelTa: 'காத்திருப்பு நேரம்' },
];

/** Asked only when they apply, so nobody rates a ward they never entered. */
export const CONDITIONAL_QUESTIONS: FeedbackQuestion[] = [
    { id: 'doctor_consultation', label: 'Time with the doctor', labelTa: 'மருத்துவருடன் செலவிட்ட நேரம்', hint: 'Were your questions answered', hintTa: 'உங்கள் கேள்விகளுக்கு பதில் கிடைத்ததா', visitTypes: ['opd', 'inpatient'] },
    { id: 'dialysis_unit', label: 'Dialysis unit comfort', labelTa: 'டயாலிசிஸ் பிரிவின் வசதி', hint: 'The chair, the room, the temperature', hintTa: 'நாற்காலி, அறை, குளிர்ச்சி', visitTypes: ['dialysis'] },
    { id: 'dialysis_staff', label: 'Dialysis technicians', labelTa: 'டயாலிசிஸ் தொழில்நுட்பர்கள்', visitTypes: ['dialysis'] },
    { id: 'room_comfort', label: 'Room or ward comfort', labelTa: 'அறை அல்லது வார்டு வசதி', visitTypes: ['inpatient'] },
    { id: 'night_staff', label: 'Night-time care', labelTa: 'இரவு நேர கவனிப்பு', visitTypes: ['inpatient'] },
    { id: 'pharmacy', label: 'Pharmacy', labelTa: 'மருந்தகம்', hint: 'Stock, waiting, explanation of the medicines', hintTa: 'மருந்து கிடைப்பு, காத்திருப்பு, விளக்கம்', visitTypes: ['opd', 'dialysis', 'inpatient', 'pharmacy'] },
    { id: 'billing', label: 'Billing clarity', labelTa: 'பில்லிங் தெளிவு', visitTypes: ['opd', 'dialysis', 'inpatient', 'pharmacy', 'other'] },
];

export const ALL_QUESTIONS: FeedbackQuestion[] = [...CORE_QUESTIONS, ...CONDITIONAL_QUESTIONS];

const BY_ID = new Map(ALL_QUESTIONS.map(q => [q.id, q]));

/** The questions to show for a visit type; `null` before one is chosen. */
export function questionsFor(visitType: VisitTypeId | null): FeedbackQuestion[] {
    if (!visitType) return CORE_QUESTIONS;
    return [
        ...CORE_QUESTIONS,
        ...CONDITIONAL_QUESTIONS.filter(q => !q.visitTypes || q.visitTypes.includes(visitType)),
    ];
}

/**
 * Label for a stored answer. Falls back to the raw id so a retired question
 * still reads as something in a historical response rather than vanishing.
 */
export function questionLabel(id: string): string {
    return BY_ID.get(id)?.label || id;
}

export function visitTypeLabel(id: string | null | undefined): string {
    if (!id) return 'Not stated';
    return VISIT_TYPES.find(v => v.id === id)?.label || id;
}

/** 1–5, low to high. Wording matters more than the number: "OK" is not "Average". */
export const SCALE: { value: number; label: string; labelTa: string }[] = [
    { value: 1, label: 'Very poor', labelTa: 'மிக மோசம்' },
    { value: 2, label: 'Poor', labelTa: 'மோசம்' },
    { value: 3, label: 'OK', labelTa: 'பரவாயில்லை' },
    { value: 4, label: 'Good', labelTa: 'நல்லது' },
    { value: 5, label: 'Very good', labelTa: 'மிக நல்லது' },
];

/** At or below this, somebody should look at it today. */
export const NEEDS_ATTENTION_AT = 2;
