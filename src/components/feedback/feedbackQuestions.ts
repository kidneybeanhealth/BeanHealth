/**
 * feedbackQuestions — the one place the survey is defined
 *
 * Both the public form and the dashboards read this file. The form renders it;
 * the register averages by it and labels the columns from it. Adding, removing
 * or re-wording a question is an edit here and nothing else — no migration,
 * because answers land in a JSONB column keyed by `id`, and no second list to
 * keep in sync, which is the failure this codebase has paid for twice already
 * with the Past Records print sheet.
 *
 * ── What decides which questions a patient sees ──────────────────────────
 * The visit type. On the hospital-wide QR the patient picks it first; on a
 * place QR (OP, IP, Reception, Restroom, …) the poster's `area` fixes it and
 * the chooser is skipped — somebody scanning the restroom poster is not asked
 * what brought them to hospital. See `fixedVisitTypeFor`.
 *
 * Within a visit type a question is either
 *   - `askedFor`   shown to everybody on that visit, or
 *   - `offeredFor` shown only once the patient says they used it today
 *                  ("Did you also use: Laboratory · Insurance / TPA · Pharmacy").
 * The second keeps rows a patient cannot answer off the form. For OP, KKC asked
 * (Oct 2026) for laboratory and pharmacy to be asked outright — nearly every OP
 * visit passes through both — so only Insurance / TPA stays opt-in there.
 *
 * ── The question set ─────────────────────────────────────────────────────
 * Laid out by KKC (Oct 2026): doctor consultation, nursing, reception,
 * laboratory and insurance/TPA for everybody; dialysis services, staff care,
 * cleanliness, waiting time and overall dialysis experience for dialysis;
 * room or ward, food and housekeeping for admitted patients. The hospital's
 * own descriptions ("attention, responsiveness and explanation") are the hints.
 * The doctor consultation is three ratings rather than one, attributed to the
 * doctor the patient picks — the hospital asked to see each doctor's own.
 *
 * ── Rules for editing ─────────────────────────────────────────────────────
 * - `id` is written into the database. Never reuse one for a different question
 *   and never rename one, or a month of history silently changes meaning.
 *   Retiring a question means moving it to RETIRED_LABELS, so old responses
 *   still read as words on the register.
 * - Tamil is UNVERIFIED — machine-written and not yet read by anyone at the
 *   hospital. Have it checked before a poster goes on a wall: a survey a
 *   patient half-understands returns worse data than one they cannot read.
 */

export type VisitTypeId =
    | 'opd' | 'dialysis' | 'inpatient' | 'pharmacy' | 'other'
    // Places, not visits. Set only by a place QR, never offered in the chooser:
    // somebody at the reception desk or in a restroom has not told us their visit.
    | 'reception' | 'restroom';

export type Lang = 'en' | 'ta';

export interface VisitTypeOption {
    id: VisitTypeId;
    label: string;
    labelTa: string;
    /** Sub-line on the chooser, in the patient's words rather than the hospital's. */
    hint: string;
    hintTa: string;
}

/** The chooser on the hospital-wide QR. */
export const VISIT_TYPES: VisitTypeOption[] = [
    { id: 'opd', label: 'OP consultation', labelTa: 'வெளிநோயாளி ஆலோசனை', hint: 'Came to see a doctor', hintTa: 'மருத்துவரைப் பார்க்க வந்தேன்' },
    { id: 'dialysis', label: 'Dialysis', labelTa: 'டயாலிசிஸ்', hint: 'Came for a dialysis session', hintTa: 'டயாலிசிஸுக்கு வந்தேன்' },
    { id: 'inpatient', label: 'Admitted', labelTa: 'அனுமதிக்கப்பட்டுள்ளேன்', hint: 'Staying in a room or ward', hintTa: 'அறை அல்லது வார்டில் தங்கியுள்ளேன்' },
    { id: 'pharmacy', label: 'Pharmacy only', labelTa: 'மருந்தகம் மட்டும்', hint: 'Came to collect medicines', hintTa: 'மருந்து வாங்க வந்தேன்' },
    { id: 'other', label: 'Something else', labelTa: 'வேறு ஏதாவது', hint: 'Tests, reports, an enquiry', hintTa: 'பரிசோதனை, ரிப்போர்ட், விசாரணை' },
];

const PLACE_LABELS: Record<string, string> = {
    reception: 'Reception',
    restroom: 'Restroom',
};

/**
 * The visit type a place QR stands for, or null for the hospital-wide QR (and
 * any area this build does not know), which shows the chooser instead.
 * `area` is free text on hospital_feedback_locations, so a few spellings are
 * accepted rather than one exact word somebody has to remember in SQL.
 */
export function fixedVisitTypeFor(area: string | null | undefined): VisitTypeId | null {
    switch ((area || '').trim().toLowerCase()) {
        case 'opd': case 'op': case 'outpatient': return 'opd';
        case 'ward': case 'ip': case 'inpatient': return 'inpatient';
        case 'dialysis': return 'dialysis';
        case 'pharmacy': return 'pharmacy';
        case 'reception': return 'reception';
        case 'restroom': case 'toilet': return 'restroom';
        default: return null;
    }
}

/**
 * The poster's headline for a place, in English and Tamil. Keyed off the same
 * `area` as `fixedVisitTypeFor`, so a poster can never promise one form and
 * open another. Anything that is not a known place — the hospital-wide QR —
 * is "Patient Feedback". Tamil UNVERIFIED, like the rest of this file.
 */
export function posterTitleFor(area: string | null | undefined): { en: string; ta: string; isPlace: boolean } {
    switch (fixedVisitTypeFor(area)) {
        case 'opd': return { en: 'Outpatient Feedback', ta: 'வெளிநோயாளர் கருத்து', isPlace: true };
        case 'inpatient': return { en: 'Inpatient Feedback', ta: 'உள்நோயாளர் கருத்து', isPlace: true };
        case 'dialysis': return { en: 'Dialysis Feedback', ta: 'டயாலிசிஸ் கருத்து', isPlace: true };
        case 'pharmacy': return { en: 'Pharmacy Feedback', ta: 'மருந்தகம் கருத்து', isPlace: true };
        case 'reception': return { en: 'Reception Feedback', ta: 'வரவேற்பு கருத்து', isPlace: true };
        case 'restroom': return { en: 'Restroom Feedback', ta: 'கழிப்பறை கருத்து', isPlace: true };
        default: return { en: 'Patient Feedback', ta: 'நோயாளர் கருத்து', isPlace: false };
    }
}

/** Visits where the patient saw a doctor, so the doctor section applies. */
export const DOCTOR_VISITS: VisitTypeId[] = ['opd', 'dialysis', 'inpatient'];

export type SectionId = 'doctor' | 'services' | 'dialysis' | 'stay' | 'restroom' | 'overall';

export const SECTIONS: { id: SectionId; label: string; labelTa: string }[] = [
    { id: 'doctor', label: 'Your doctor', labelTa: 'உங்கள் மருத்துவர்' },
    { id: 'dialysis', label: 'Dialysis', labelTa: 'டயாலிசிஸ்' },
    { id: 'stay', label: 'Your stay', labelTa: 'நீங்கள் தங்கியிருந்தது' },
    { id: 'restroom', label: 'Restroom', labelTa: 'கழிப்பறை' },
    { id: 'services', label: 'Hospital services', labelTa: 'மருத்துவமனை சேவைகள்' },
    { id: 'overall', label: 'Overall', labelTa: 'ஒட்டுமொத்தம்' },
];

export interface FeedbackQuestion {
    /** Stored in hospital_feedback.ratings. Permanent. */
    id: string;
    label: string;
    labelTa: string;
    /** Shown under the label: what to think about when rating. */
    hint?: string;
    hintTa?: string;
    section: SectionId;
    /** Asked of everybody on these visits. */
    askedFor: VisitTypeId[];
    /** Asked only once the patient says they used it today. */
    offeredFor?: VisitTypeId[];
}

const EVERY_VISIT: VisitTypeId[] = ['opd', 'dialysis', 'inpatient', 'pharmacy', 'other', 'reception'];

export const ALL_QUESTIONS: FeedbackQuestion[] = [
    // ── Your doctor ──────────────────────────────────────────────────────
    // Attributed to the doctor picked above them (hospital_feedback.rated_doctor_id).
    { id: 'doctor_listened', section: 'doctor', askedFor: DOCTOR_VISITS,
      label: 'Listened to you', labelTa: 'நீங்கள் சொன்னதைக் கேட்டார்',
      hint: 'Gave you time to say what was wrong', hintTa: 'உங்கள் பிரச்சனையைச் சொல்ல நேரம் கொடுத்தார்' },
    { id: 'doctor_explained', section: 'doctor', askedFor: DOCTOR_VISITS,
      label: 'Explained your condition', labelTa: 'உங்கள் உடல்நிலையை விளக்கினார்',
      hint: 'And the treatment, in words you understood', hintTa: 'சிகிச்சையையும், புரியும்படி' },
    { id: 'doctor_answered', section: 'doctor', askedFor: DOCTOR_VISITS,
      label: 'Answered your questions', labelTa: 'உங்கள் கேள்விகளுக்கு பதில் அளித்தார்' },

    // ── Dialysis ─────────────────────────────────────────────────────────
    { id: 'dialysis_services', section: 'dialysis', askedFor: ['dialysis'],
      label: 'Dialysis services', labelTa: 'டயாலிசிஸ் சேவை',
      hint: 'The session itself — machine, chair, comfort', hintTa: 'டயாலிசிஸ் — இயந்திரம், நாற்காலி, வசதி' },
    { id: 'dialysis_staff_care', section: 'dialysis', askedFor: ['dialysis'],
      label: 'Staff care', labelTa: 'ஊழியர்களின் கவனிப்பு',
      hint: 'Technicians and nurses during your session', hintTa: 'டயாலிசிஸின் போது தொழில்நுட்பர்கள், செவிலியர்கள்' },
    { id: 'dialysis_cleanliness', section: 'dialysis', askedFor: ['dialysis'],
      label: 'Cleanliness', labelTa: 'சுத்தம்' },
    { id: 'dialysis_waiting', section: 'dialysis', askedFor: ['dialysis'],
      label: 'Waiting time', labelTa: 'காத்திருப்பு நேரம்',
      hint: 'Before your session started', hintTa: 'டயாலிசிஸ் தொடங்கும் முன்' },
    { id: 'dialysis_overall', section: 'dialysis', askedFor: ['dialysis'],
      label: 'Overall dialysis experience', labelTa: 'ஒட்டுமொத்த டயாலிசிஸ் அனுபவம்' },

    // ── Your stay ────────────────────────────────────────────────────────
    { id: 'room_ward', section: 'stay', askedFor: ['inpatient'],
      label: 'Room or ward', labelTa: 'அறை அல்லது வார்டு',
      hint: 'Bed, fan or AC, noise, comfort', hintTa: 'படுக்கை, மின்விசிறி/AC, சத்தம், வசதி' },
    { id: 'food', section: 'stay', askedFor: ['inpatient'],
      label: 'Food services', labelTa: 'உணவு சேவை',
      hint: 'Taste, timing, and your diet being followed', hintTa: 'சுவை, நேரம், உங்கள் உணவுக் கட்டுப்பாடு' },
    { id: 'housekeeping', section: 'stay', askedFor: ['inpatient'],
      label: 'Housekeeping', labelTa: 'தூய்மைப் பணி',
      hint: 'Cleaning of the room, bathroom and linen', hintTa: 'அறை, குளியலறை, படுக்கை விரிப்பு சுத்தம்' },

    // ── Restroom (its own QR) ────────────────────────────────────────────
    { id: 'restroom', section: 'restroom', askedFor: ['restroom'],
      label: 'Cleanliness', labelTa: 'சுத்தம்' },
    { id: 'restroom_supplies', section: 'restroom', askedFor: ['restroom'],
      label: 'Water, soap and tissue', labelTa: 'தண்ணீர், சோப்பு, டிஷ்யூ' },
    { id: 'restroom_working', section: 'restroom', askedFor: ['restroom'],
      label: 'Everything working', labelTa: 'எல்லாம் சரியாக இயங்குகிறது',
      hint: 'Taps, flush, lights, door lock', hintTa: 'குழாய், ஃப்ளஷ், விளக்கு, கதவுப் பூட்டு' },

    // ── Hospital services ────────────────────────────────────────────────
    { id: 'nursing', section: 'services', askedFor: ['opd', 'dialysis', 'inpatient'],
      label: 'Nursing services', labelTa: 'செவிலியர் சேவை',
      hint: 'Attention, responsiveness and explanation', hintTa: 'கவனிப்பு, உடனடி உதவி, விளக்கம்' },
    { id: 'reception', section: 'services', askedFor: EVERY_VISIT,
      label: 'Reception', labelTa: 'வரவேற்பு',
      hint: 'Helpfulness, guidance and communication', hintTa: 'உதவி, வழிகாட்டல், தொடர்பு' },
    { id: 'waiting_time', section: 'services', askedFor: ['opd', 'reception'],
      label: 'Waiting time', labelTa: 'காத்திருப்பு நேரம்',
      hint: 'How long until you were seen', hintTa: 'பார்க்கப்படும் வரை எவ்வளவு நேரம்' },
    { id: 'laboratory', section: 'services', askedFor: ['opd', 'other'], offeredFor: ['dialysis', 'inpatient'],
      label: 'Laboratory', labelTa: 'ஆய்வகம்',
      hint: 'Waiting time, sample collection and the report', hintTa: 'காத்திருப்பு, மாதிரி சேகரிப்பு, ரிப்போர்ட்' },
    { id: 'insurance_tpa', section: 'services', askedFor: [], offeredFor: ['opd', 'dialysis', 'inpatient', 'other', 'reception'],
      label: 'Insurance / TPA', labelTa: 'காப்பீடு / TPA',
      hint: 'Guidance, communication and the claim process', hintTa: 'வழிகாட்டல், தொடர்பு, க்ளெய்ம் நடைமுறை' },
    { id: 'pharmacy', section: 'services', askedFor: ['opd', 'pharmacy'], offeredFor: ['dialysis', 'inpatient'],
      label: 'Pharmacy', labelTa: 'மருந்தகம்',
      hint: 'Medicines available, waiting, how to take them', hintTa: 'மருந்து கிடைப்பு, காத்திருப்பு, எப்படி எடுப்பது' },

    // ── Overall ──────────────────────────────────────────────────────────
    // Not for dialysis, which has its own overall, nor for a place QR, where
    // the patient is still mid-visit.
    { id: 'overall', section: 'overall', askedFor: ['opd', 'inpatient', 'pharmacy', 'other'],
      label: 'Overall experience', labelTa: 'ஒட்டுமொத்த அனுபவம்',
      hint: 'Your visit today, taken as a whole', hintTa: 'இன்றைய வருகை முழுவதுமாக' },
];

/**
 * Questions from the first version of the form (Sep 2026). Not asked any more;
 * kept so a response that carries them still reads as words on the register.
 */
const RETIRED_LABELS: Record<string, string> = {
    staff_behaviour: 'Staff behaviour',
    cleanliness: 'Cleanliness',
    doctor_consultation: 'Time with the doctor',
    dialysis_unit: 'Dialysis unit comfort',
    dialysis_staff: 'Dialysis technicians',
    room_comfort: 'Room or ward comfort',
    night_staff: 'Night-time care',
    billing: 'Billing clarity',
};

const BY_ID = new Map(ALL_QUESTIONS.map(q => [q.id, q]));

/** Doctor-section question ids — the ones averaged into a doctor's score. */
export const DOCTOR_QUESTION_IDS = ALL_QUESTIONS.filter(q => q.section === 'doctor').map(q => q.id);

/** Questions the patient can opt into for this visit ("I used the lab today"). */
export function optionalFor(visitType: VisitTypeId | null): FeedbackQuestion[] {
    if (!visitType) return [];
    return ALL_QUESTIONS.filter(q => q.offeredFor?.includes(visitType));
}

/**
 * The questions to show, in section order. `used` holds the ids of optional
 * questions the patient has said apply to them. `null` before a visit type is
 * chosen shows nothing: every question now belongs to some kind of visit.
 */
export function questionsFor(visitType: VisitTypeId | null, used: ReadonlySet<string> = new Set()): FeedbackQuestion[] {
    if (!visitType) return [];
    const shown = ALL_QUESTIONS.filter(q =>
        q.askedFor.includes(visitType) || (q.offeredFor?.includes(visitType) && used.has(q.id)));
    const order = new Map(SECTIONS.map((s, i) => [s.id, i]));
    // Stable sort: within a section, catalogue order.
    return shown
        .map((q, i) => ({ q, i }))
        .sort((a, b) => (order.get(a.q.section)! - order.get(b.q.section)!) || (a.i - b.i))
        .map(x => x.q);
}

/**
 * Label for a stored answer. Falls back to a retired label, then the raw id, so
 * an old question still reads as something rather than vanishing.
 */
export function questionLabel(id: string): string {
    return BY_ID.get(id)?.label || RETIRED_LABELS[id] || id;
}

export function questionSection(id: string): SectionId | null {
    return BY_ID.get(id)?.section ?? null;
}

export function visitTypeLabel(id: string | null | undefined): string {
    if (!id) return 'Not stated';
    return VISIT_TYPES.find(v => v.id === id)?.label || PLACE_LABELS[id] || id;
}

/**
 * "Dr.A.Prabhakar" stays as it is; "A. Divakar" gains a title. Names are stored
 * both ways. A deliberately tiny copy of formatDoctorLabel in
 * PastRecordsPatientCard, because importing that would pull the dashboard into
 * the public form's bundle.
 */
export function doctorDisplayName(name: string | null | undefined): string {
    const n = (name || '').trim();
    if (!n) return 'Doctor';
    return /^dr\b\.?/i.test(n) ? n : `Dr. ${n}`;
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
