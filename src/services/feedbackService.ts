/**
 * feedbackService — patient feedback, in and out
 *
 * Two halves that never meet:
 *
 *   IN   the public form, with no session at all, through two SECURITY DEFINER
 *        RPCs. The table has no anon grant, so these are the only door.
 *   OUT  the doctor dashboard, signed in as the hospital, reading the table
 *        directly under RLS.
 *
 * Aggregation happens here in JavaScript rather than in SQL. Ratings are JSONB
 * keyed by question id so the survey can change without a migration, and the
 * volume is a few hundred responses a month — the same call the dialysis
 * register already makes, for the same reason.
 */
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';
import { ALL_QUESTIONS, DOCTOR_QUESTION_IDS, NEEDS_ATTENTION_AT, doctorDisplayName, normalizeRoomNumber, normalizeOtherDoctorName, type VisitTypeId } from '../components/feedback/feedbackQuestions';

// ─────────────────────────────────────────────────────────────────────────────
// IN — the public form
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedLocation {
    locationId: string;
    locationLabel: string;
    area: string;
    hospitalName: string;
    hospitalLogo: string | null;
    /** For "Which doctor did you see?". Empty before 20261008 has run. */
    doctors: { id: string; name: string }[];
}

export class FeedbackCodeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FeedbackCodeError';
    }
}

/** Turn a poster code into something the form can put a name on. */
export async function resolveFeedbackLocation(code: string): Promise<ResolvedLocation> {
    const res = await withTimeout(
        (supabase as any).rpc('feedback_resolve_location', { p_code: (code || '').trim() }) as any,
        10000,
        'Timed out while opening the feedback form'
    ) as { data: any; error: any };

    if (res.error) throw res.error;
    const d = res.data || {};
    if (!d.found) throw new FeedbackCodeError('This code does not match any hospital');
    if (!d.active) throw new FeedbackCodeError('This feedback form has been closed');

    return {
        locationId: d.location_id,
        locationLabel: d.location_label || '',
        area: d.area || 'hospital',
        hospitalName: d.hospital_name || 'Hospital',
        hospitalLogo: d.hospital_logo || null,
        doctors: Array.isArray(d.doctors)
            ? d.doctors.filter((x: any) => x && x.id && x.name).map((x: any) => ({ id: String(x.id), name: String(x.name) }))
            : [],
    };
}

export interface VoiceNote {
    blob: Blob;
    seconds: number;
    mimeType: string;
}

/** Already re-drawn and re-encoded on the phone; see feedbackPhoto. */
export interface FeedbackPhoto {
    blob: Blob;
    width: number;
    height: number;
}

export interface FeedbackSubmission {
    code: string;
    visitType: VisitTypeId | null;
    ratings: Record<string, number>;
    comment: string;
    mrNumber: string;
    shareWithDoctor: boolean;
    language: string;
    voice?: VoiceNote | null;
    photo?: FeedbackPhoto | null;
    /** A clinic tablet handed from patient to patient. See feedbackLinks. */
    desk?: boolean;
    /** The doctor the patient says they saw, from the picker. */
    ratedDoctorId?: string | null;
    /** Admitted patients: the room they are in. Required by the form there. */
    roomNumber?: string | null;
    /** "Others": a doctor not on the list, by name. Optional. */
    ratedDoctorOther?: string | null;
}

const AUDIO_BUCKET = 'feedback-audio';
const PHOTO_BUCKET = 'feedback-photos';

/**
 * Paths of files already uploaded for a blob that has not been sent yet.
 *
 * Hospital wifi drops between the upload and the submit, and the patient taps
 * Send again. Without this every retry uploads a fresh copy and strands the
 * last one in incoming/, where nothing points at it — somebody's voice, or a
 * photo of a ward, that nobody can reach. Keyed by the blob itself, so a new
 * recording or a retaken photo gets a new upload.
 */
const uploadedFor = new WeakMap<Blob, string>();

const newObjectId = () => (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** The container type without codec parameters — what the bucket's audio/* check sees. */
const baseMime = (m: string) => (m || 'audio/webm').split(';')[0].trim() || 'audio/webm';
const extFor = (m: string): string => {
    const b = baseMime(m);
    if (b.includes('mp4') || b.includes('m4a') || b.includes('aac')) return 'm4a';
    if (b.includes('ogg')) return 'ogg';
    if (b.includes('mpeg')) return 'mp3';
    if (b.includes('wav')) return 'wav';
    return 'webm';
};

/**
 * Upload a recording into the bucket's `incoming/` folder, the only place an
 * unsigned-in phone is allowed to write. Upload happens at Send, not at Stop, so
 * a patient who records and then walks away leaves nothing behind.
 */
async function uploadVoiceNote(v: VoiceNote): Promise<string> {
    const done = uploadedFor.get(v.blob);
    if (done) return done;
    const path = `incoming/${newObjectId()}.${extFor(v.mimeType)}`;
    const res = await withTimeout(
        (supabase as any).storage.from(AUDIO_BUCKET).upload(path, v.blob, {
            contentType: baseMime(v.mimeType),
            upsert: false,
        }) as any,
        45000,
        'Timed out while uploading your voice note'
    ) as { error: any };
    if (res.error) throw new Error('Could not upload your voice note');
    uploadedFor.set(v.blob, path);
    return path;
}

/**
 * Upload a photo into `incoming/` of its own bucket, under the same rules as a
 * voice note: written at Send, never overwritten, attached by the submit RPC
 * only if it is fresh and unclaimed.
 */
async function uploadPhoto(p: FeedbackPhoto): Promise<string> {
    const done = uploadedFor.get(p.blob);
    if (done) return done;
    const type = (p.blob.type || 'image/jpeg').split(';')[0].trim();
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const path = `incoming/${newObjectId()}.${ext}`;
    const res = await withTimeout(
        (supabase as any).storage.from(PHOTO_BUCKET).upload(path, p.blob, {
            contentType: type,
            upsert: false,
        }) as any,
        45000,
        'Timed out while uploading your photo'
    ) as { error: any };
    if (res.error) throw new Error('Could not upload your photo. You can remove it and send without it.');
    uploadedFor.set(p.blob, path);
    return path;
}

const DEVICE_KEY_STORAGE = 'bh_feedback_device';

/**
 * A random id per browser, used only to stop one phone submitting fifty times.
 *
 * It never leaves this function in the clear: the server hashes it with the
 * location and the date, and stores only the hash. If storage is unavailable —
 * a private window, a locked-down browser — the throttle is skipped rather than
 * the submission refused. Somebody in a dialysis chair does not get a second go
 * at this, so a failed throttle must not cost them their answer.
 */
function deviceKey(): string {
    try {
        let k = localStorage.getItem(DEVICE_KEY_STORAGE);
        if (!k) {
            k = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
            localStorage.setItem(DEVICE_KEY_STORAGE, k);
        }
        return k;
    } catch {
        return '';
    }
}

export interface SubmitResult {
    /** True when this browser already answered today. Thanked, not scolded. */
    duplicate: boolean;
    identified: boolean;
}

export async function submitFeedback(s: FeedbackSubmission): Promise<SubmitResult> {
    // Both at once: on a slow line the two uploads are most of the wait.
    const [audioPath, photoPath] = await Promise.all([
        s.voice ? uploadVoiceNote(s.voice) : Promise.resolve(null),
        s.photo ? uploadPhoto(s.photo) : Promise.resolve(null),
    ]);

    const params: Record<string, unknown> = {
        p_code: (s.code || '').trim(),
        p_visit_type: s.visitType,
        p_ratings: s.ratings,
        p_comment: (s.comment || '').trim() || null,
        p_mr_number: s.shareWithDoctor ? (s.mrNumber || '').trim() || null : null,
        p_share_with_doctor: !!s.shareWithDoctor,
        p_language: s.language || 'en',
        // One tablet, many patients: the per-phone throttle would drop every
        // desk response after the first.
        p_device_key: s.desk ? null : deviceKey(),
    };
    // The three newer arguments are sent ONLY when used. A plain poster
    // response then matches the function's original eight-argument signature
    // too, so a build that reaches production before
    // sql/20260927c_feedback_voice_and_delete.sql has run still accepts
    // ordinary feedback instead of rejecting every submission.
    if (audioPath) {
        params.p_audio_path = audioPath;
        params.p_audio_seconds = Math.round(s.voice!.seconds);
    }
    if (photoPath) params.p_photo_path = photoPath;
    if (s.desk) params.p_source = 'desk';
    if (s.ratedDoctorId) params.p_rated_doctor_id = s.ratedDoctorId;
    const room = normalizeRoomNumber(s.roomNumber);
    if (room) params.p_room_number = room;
    const otherDoctor = s.ratedDoctorId ? '' : normalizeOtherDoctorName(s.ratedDoctorOther);
    if (otherDoctor) params.p_rated_doctor_other = otherDoctor;

    const call = (p: Record<string, unknown>) => withTimeout(
        (supabase as any).rpc('submit_hospital_feedback', p) as any,
        15000,
        'Timed out while sending your feedback'
    ) as Promise<{ data: any; error: any }>;

    let res = await call(params);
    // PGRST202 = no function with these arguments: this build is live but the
    // matching SQL has not run yet. Step back rather than lose the response:
    //   - The photo (sql/20261104_feedback_photo.sql) is dropped first. The
    //     words and ratings still arrive; the file stays in incoming/ unclaimed.
    //   - The room and an "Others" doctor name
    //     (sql/20261015_feedback_room_and_other_doctor.sql) are not dropped:
    //     they move to the front of the comment, where the register shows them.
    //     The room is required on the inpatient form, so losing it is not an option.
    //   - The rated doctor id (sql/20261008_feedback_places_and_doctors.sql) is
    //     dropped; the ratings matter more than who they are filed under.
    const moveToComment = (key: string, label: string) => {
        const note = `${label} ${params[key]}`;
        delete params[key];
        params.p_comment = params.p_comment ? `${note} — ${params.p_comment}` : note;
    };
    if (res.error?.code === 'PGRST202' && 'p_photo_path' in params) {
        delete params.p_photo_path;
        res = await call(params);
    }
    if (res.error?.code === 'PGRST202' && ('p_room_number' in params || 'p_rated_doctor_other' in params)) {
        if ('p_rated_doctor_other' in params) moveToComment('p_rated_doctor_other', 'Doctor:');
        if ('p_room_number' in params) moveToComment('p_room_number', 'Room');
        res = await call(params);
    }
    if (res.error?.code === 'PGRST202' && 'p_rated_doctor_id' in params) {
        const { p_rated_doctor_id: _drop, ...rest } = params;
        res = await call(rest);
    }

    if (res.error) throw res.error;
    const d = res.data || {};
    if (!d.ok) {
        if (d.reason === 'unknown_code') throw new FeedbackCodeError('This code does not match any hospital');
        if (d.reason === 'empty') throw new Error('Please rate at least one thing, write a comment, record a voice note, or add a photo');
        throw new Error('Could not send your feedback');
    }
    return { duplicate: !!d.duplicate, identified: !!d.identified };
}

// ─────────────────────────────────────────────────────────────────────────────
// OUT — the doctor dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackResponse {
    id: string;
    submittedAt: string;
    visitType: string | null;
    ratings: Record<string, number>;
    comment: string | null;
    locationLabel: string | null;
    /** Null for an anonymous response, which is most of them. */
    patientId: string | null;
    patientName: string | null;
    mrNumber: string | null;
    doctorId: string | null;
    /** The doctor the patient picked. Recorded for anonymous responses too. */
    ratedDoctorId: string | null;
    ratedDoctorName: string | null;
    /** Admitted patients' room, as they typed it (tidied). */
    roomNumber: string | null;
    /** "Others": a doctor not on the list, by the name the patient typed. */
    ratedDoctorOther: string | null;
    /** Storage path of the voice note, if they recorded one. */
    audioPath: string | null;
    audioSeconds: number | null;
    /** Storage path of the photo, if they attached one. */
    photoPath: string | null;
    /** 'qr' from the poster, 'desk' from a clinic tablet. */
    source: string;
    /** The lowest score given, or null if they only left a comment, voice note or photo. */
    lowestRating: number | null;
}

export interface QuestionAverage {
    id: string;
    label: string;
    average: number;
    count: number;
}

export interface DoctorScore {
    id: string;
    name: string;
    /** Responses that picked this doctor. */
    count: number;
    /** Mean of the doctor-section ratings only, not the whole visit. */
    average: number | null;
    byQuestion: { id: string; average: number | null; count: number }[];
}

export interface FeedbackRegister {
    responses: FeedbackResponse[];
    total: number;
    /** Responses carrying at least one rating at or below NEEDS_ATTENTION_AT. */
    needsAttention: FeedbackResponse[];
    overall: number | null;
    byQuestion: QuestionAverage[];
    byVisitType: { id: string; label: string; count: number; average: number | null }[];
    byLocation: { id: string; label: string; count: number; average: number | null }[];
    /** Admitted patients, per room. Empty until rooms are being recorded. */
    byRoom: { id: string; label: string; count: number; average: number | null }[];
    byDoctor: DoctorScore[];
}

const mean = (xs: number[]): number | null =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

/** Every rating in one response, for "how did this visit go" as a single number. */
const responseScores = (r: FeedbackResponse): number[] =>
    Object.values(r.ratings || {}).filter(v => typeof v === 'number' && v >= 1 && v <= 5);

export interface FeedbackQuery {
    hospitalId: string;
    from: string;
    to: string;
    /** With `doctorScope`, narrows the Responses list to one doctor. */
    doctorId?: string | null;
    /**
     * 'about'  — responses where the patient picked this doctor
     * 'shared' — named patients who shared their feedback with this doctor
     * Ignored without `doctorId`.
     */
    doctorScope?: 'all' | 'about' | 'shared';
    limit?: number;
}

/**
 * Read a period's feedback and roll it up.
 *
 * `doctorId` narrows the identified responses only. The averages stay
 * hospital-wide on purpose: a doctor comparing their own ward against the
 * hospital is the useful frame, and an average over the two or three named
 * responses a doctor happens to have is noise dressed up as a metric.
 */
export async function fetchFeedbackRegister(q: FeedbackQuery): Promise<FeedbackRegister> {
    const empty: FeedbackRegister = {
        responses: [], total: 0, needsAttention: [], overall: null,
        byQuestion: [], byVisitType: [], byLocation: [], byRoom: [], byDoctor: [],
    };
    if (!q.hospitalId) return empty;

    const BASE = `
        id, submitted_at, visit_type, ratings, comment, patient_id, doctor_id,
        shared_with_doctor, audio_path, audio_seconds, source, location_id,
        hospital_feedback_locations ( id, label ),
        hospital_patients ( id, name, mr_number )`;
    const read = (cols: string) => withTimeout(
        (supabase
            .from('hospital_feedback' as any)
            .select(cols)
            .eq('hospital_id', q.hospitalId)
            .gte('submitted_at', q.from)
            .lte('submitted_at', q.to)
            .order('submitted_at', { ascending: false })
            .limit(q.limit ?? 1000)) as any,
        15000,
        'Timed out while loading feedback'
    ) as Promise<{ data: any[] | null; error: any }>;

    // Newest columns first. A column that does not exist yet (its SQL not run)
    // fails the whole read, so step back to the next variant rather than leave
    // the register unopenable: photo (20261104), room (20261015), rated doctor
    // (20261008), base.
    const RATED = `,
        rated_doctor_id,
        rated_doctor:hospital_doctors!hospital_feedback_rated_doctor_id_fkey ( id, name )`;
    const variants = [
        `${BASE}${RATED}, room_number, rated_doctor_other, photo_path`,
        `${BASE}${RATED}, room_number, rated_doctor_other`,
        `${BASE}${RATED}`,
        BASE,
    ];
    let res = await read(variants[0]);
    for (let i = 1; i < variants.length && res.error && ['42703', 'PGRST200', 'PGRST100'].includes(res.error.code); i++) {
        res = await read(variants[i]);
    }

    if (res.error) throw res.error;

    const rows: FeedbackResponse[] = (res.data || []).map((r: any) => {
        const ratings: Record<string, number> = (r.ratings && typeof r.ratings === 'object') ? r.ratings : {};
        const scores = Object.values(ratings).filter(v => typeof v === 'number') as number[];
        // A patient row only comes back when they identified themselves AND
        // ticked the box; anything else stays anonymous on every surface.
        const identified = !!r.patient_id && r.shared_with_doctor === true;
        return {
            id: r.id,
            submittedAt: r.submitted_at,
            visitType: r.visit_type ?? null,
            ratings,
            comment: r.comment ?? null,
            locationLabel: r.hospital_feedback_locations?.label ?? null,
            patientId: identified ? r.patient_id : null,
            patientName: identified ? (r.hospital_patients?.name ?? null) : null,
            mrNumber: identified ? (r.hospital_patients?.mr_number ?? null) : null,
            doctorId: identified ? (r.doctor_id ?? null) : null,
            ratedDoctorId: r.rated_doctor_id ?? null,
            ratedDoctorName: r.rated_doctor?.name ? doctorDisplayName(r.rated_doctor.name) : null,
            roomNumber: r.room_number ?? null,
            ratedDoctorOther: r.rated_doctor_other ?? null,
            audioPath: r.audio_path ?? null,
            audioSeconds: r.audio_seconds ?? null,
            photoPath: r.photo_path ?? null,
            source: r.source || 'qr',
            lowestRating: scores.length ? Math.min(...scores) : null,
        };
    });

    // Aggregates always cover the whole hospital; only the list is scoped.
    const byQuestion: QuestionAverage[] = ALL_QUESTIONS
        .map(qq => {
            const vals = rows.map(r => r.ratings[qq.id]).filter(v => typeof v === 'number') as number[];
            return { id: qq.id, label: qq.label, average: mean(vals) ?? 0, count: vals.length };
        })
        .filter(a => a.count > 0);

    const group = <T extends { key: string; label: string }>(keyOf: (r: FeedbackResponse) => T | null) => {
        const acc = new Map<string, { label: string; scores: number[]; count: number }>();
        for (const r of rows) {
            const k = keyOf(r);
            if (!k) continue;
            const cur = acc.get(k.key) || { label: k.label, scores: [], count: 0 };
            cur.count += 1;
            cur.scores.push(...responseScores(r));
            acc.set(k.key, cur);
        }
        return [...acc.entries()]
            .map(([id, v]) => ({ id, label: v.label, count: v.count, average: mean(v.scores) }))
            .sort((a, b) => b.count - a.count);
    };

    // Per doctor: only the doctor-section answers, so a cold ward meal does not
    // count against the consultant who saw them.
    const doctorAcc = new Map<string, { name: string; count: number; byQ: Map<string, number[]> }>();
    for (const r of rows) {
        // A listed doctor by id; an "Others" doctor by the typed name, so two
        // patients naming the same visiting doctor land on one line.
        const key = r.ratedDoctorId || (r.ratedDoctorOther ? `other:${r.ratedDoctorOther.toLowerCase()}` : null);
        if (!key) continue;
        const cur = doctorAcc.get(key)
            || { name: r.ratedDoctorId ? (r.ratedDoctorName || 'Doctor') : `Other · ${r.ratedDoctorOther}`, count: 0, byQ: new Map<string, number[]>() };
        cur.count += 1;
        for (const id of DOCTOR_QUESTION_IDS) {
            const v = r.ratings[id];
            if (typeof v === 'number') cur.byQ.set(id, [...(cur.byQ.get(id) || []), v]);
        }
        doctorAcc.set(key, cur);
    }
    const byDoctor: DoctorScore[] = [...doctorAcc.entries()]
        .map(([id, v]) => ({
            id,
            name: v.name,
            count: v.count,
            average: mean([...v.byQ.values()].flat()),
            byQuestion: DOCTOR_QUESTION_IDS.map(qid => {
                const vals = v.byQ.get(qid) || [];
                return { id: qid, average: mean(vals), count: vals.length };
            }),
        }))
        .sort((a, b) => b.count - a.count);

    const scope = q.doctorId ? (q.doctorScope || 'all') : 'all';
    const visible = scope === 'about' ? rows.filter(r => r.ratedDoctorId === q.doctorId)
        : scope === 'shared' ? rows.filter(r => r.doctorId === q.doctorId)
        : rows;

    return {
        responses: visible,
        total: rows.length,
        needsAttention: visible.filter(r => r.lowestRating !== null && r.lowestRating <= NEEDS_ATTENTION_AT),
        overall: mean(rows.flatMap(responseScores)),
        byQuestion,
        byVisitType: group(r => (r.visitType ? { key: r.visitType, label: r.visitType } as any : null)),
        byLocation: group(r => (r.locationLabel ? { key: r.locationLabel, label: r.locationLabel } as any : null)),
        byRoom: group(r => (r.roomNumber ? { key: r.roomNumber, label: `Room ${r.roomNumber}` } as any : null)),
        byDoctor,
    };
}

/**
 * Delete a response for good — the hospital's way of saying "dealt with".
 *
 * The recording and the photo go FIRST. The storage policies authorise deleting
 * a file only while a feedback row of this hospital still points at it, so
 * deleting the row first would leave a voice recording or a photo that nothing
 * references and nobody can reach or remove. If a file will not go, the row
 * stays and the error says so. Deleting is retry-safe: removing a file that is
 * already gone is not an error, so a second attempt after a half-failure still
 * gets to the row.
 */
export async function deleteFeedback(
    hospitalId: string, id: string, audioPath: string | null, photoPath: string | null = null,
): Promise<void> {
    if (!hospitalId || !id) throw new Error('Missing hospital or response identifier');

    if (photoPath) {
        const rm = await withTimeout(
            (supabase as any).storage.from(PHOTO_BUCKET).remove([photoPath]) as any,
            15000,
            'Timed out while deleting the photo'
        ) as { error: any };
        if (rm.error) throw new Error('Could not delete the photo, so the response was kept');
    }

    if (audioPath) {
        const rm = await withTimeout(
            (supabase as any).storage.from(AUDIO_BUCKET).remove([audioPath]) as any,
            15000,
            'Timed out while deleting the voice note'
        ) as { error: any };
        if (rm.error) throw new Error('Could not delete the voice note, so the response was kept');
    }

    const res = await withTimeout(
        ((supabase.from('hospital_feedback') as any)
            .delete()
            .eq('hospital_id', hospitalId)
            .eq('id', id)) as any,
        10000,
        'Timed out while deleting'
    ) as { error: any };
    if (res.error) throw res.error;
}

/**
 * A short-lived link to play a voice note. Signed rather than public: the
 * bucket is private, and a recording is somebody's voice.
 */
export async function getFeedbackAudioUrl(path: string): Promise<string> {
    const res = await withTimeout(
        (supabase as any).storage.from(AUDIO_BUCKET).createSignedUrl(path, 60 * 60) as any,
        10000,
        'Timed out while loading the voice note'
    ) as { data: { signedUrl?: string } | null; error: any };
    if (res.error || !res.data?.signedUrl) throw new Error('Could not load the voice note');
    return res.data.signedUrl;
}

/** A short-lived link to view a photo. Signed for the same reason as audio. */
export async function getFeedbackPhotoUrl(path: string): Promise<string> {
    const res = await withTimeout(
        (supabase as any).storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60) as any,
        10000,
        'Timed out while loading the photo'
    ) as { data: { signedUrl?: string } | null; error: any };
    if (res.error || !res.data?.signedUrl) throw new Error('Could not load the photo');
    return res.data.signedUrl;
}

export interface FeedbackLocation {
    id: string;
    code: string;
    label: string;
    area: string;
    isActive: boolean;
}

/** The posters this hospital has. One today; more when they split by station. */
export async function fetchFeedbackLocations(hospitalId: string): Promise<FeedbackLocation[]> {
    if (!hospitalId) return [];
    const res = await withTimeout(
        (supabase
            .from('hospital_feedback_locations' as any)
            .select('id, code, label, area, is_active')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: true })) as any,
        10000,
        'Timed out while loading feedback posters'
    ) as { data: any[] | null; error: any };
    if (res.error) throw res.error;
    return (res.data || []).map((r: any) => ({
        id: r.id, code: r.code, label: r.label, area: r.area, isActive: r.is_active !== false,
    }));
}

/**
 * The hospital's logo for the poster header.
 *
 * `hospital_logo` is what the patient app reads, but it is empty at KKC; the
 * logo reception and the doctors actually print on the Past Records sheet lives
 * in `avatar_url`. Selecting `*` rather than naming both, because hospital_logo
 * was added to this table outside the migration files and naming a column a
 * site does not have fails the whole read.
 */
export async function fetchHospitalLogo(hospitalId: string): Promise<string | null> {
    if (!hospitalId) return null;
    try {
        const res = await withTimeout(
            ((supabase as any).from('hospital_profiles').select('*').eq('id', hospitalId).maybeSingle()) as any,
            10000,
            'Timed out while loading the hospital logo'
        ) as { data: any; error: any };
        if (res.error || !res.data) return null;
        return res.data.hospital_logo || res.data.avatar_url || null;
    } catch {
        return null;
    }
}
