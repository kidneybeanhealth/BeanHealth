/**
 * Connect patients — list, add, edit the programme, and import.
 *
 * Ported from v12's frontdeskService, whose two rules were learned the hard way
 * at KKC and are kept exactly:
 *
 *   A review always has a doctor. An ownerless review is one nothing closes and
 *   no list shows. A row without a doctor gets one placeholder doctor per centre.
 *
 *   Nothing is written until the operator has seen the preview. An import that
 *   silently drops 30% of a list is how a centre stops trusting it.
 *
 * And one rule Connect adds: an update never blanks a field the file did not
 * carry, so a partial export cannot erase an attender or a schedule typed in by
 * hand.
 */
import { db, run } from './db';
import { describePhoneInput, normalizeIndianMobile } from '../../utils/phoneUtils';
import { parseDialysisDays, parseImportDate, parseLanguage, parseProgramme, type ImportField, type Mapping } from './importers';
import type { Programme } from '../protocol/settings';

export interface ConnectPatient {
    id: string;
    name: string;
    mrNumber: string | null;
    age: string | null;
    gender: string | null;
    phone: string | null;
    phoneE164: string | null;
    attenderName: string | null;
    attenderRelation: string | null;
    attenderPhone: string | null;
    attenderPhoneE164: string | null;
    place: string | null;
    programme: Programme | null;
    dialysisDays: number[] | null;
    dialysisShift: string | null;
    preferredLanguage: string | null;
    callHold: boolean;
    callHoldReason: string | null;
    doNotCall: boolean;
    isDeceased: boolean;
    stopped: boolean;
    source: string | null;
    createdAt: string;
}

const COLUMNS = [
    'id', 'name', 'mr_number', 'age', 'gender', 'phone', 'phone_e164',
    'attender_name', 'attender_relation', 'attender_phone', 'attender_phone_e164', 'place',
    'programme', 'dialysis_days', 'dialysis_shift', 'preferred_language',
    'call_hold', 'call_hold_reason', 'do_not_call', 'is_deceased', 'continuity_status', 'source', 'created_at',
].join(', ');

const toPatient = (r: any): ConnectPatient => ({
    id: r.id,
    name: r.name || '',
    mrNumber: r.mr_number ?? null,
    age: r.age ?? null,
    gender: r.gender ?? null,
    phone: r.phone ?? null,
    phoneE164: r.phone_e164 ?? null,
    attenderName: r.attender_name ?? null,
    attenderRelation: r.attender_relation ?? null,
    attenderPhone: r.attender_phone ?? null,
    attenderPhoneE164: r.attender_phone_e164 ?? null,
    place: r.place ?? null,
    programme: r.programme ?? null,
    dialysisDays: Array.isArray(r.dialysis_days) ? r.dialysis_days.map(Number) : null,
    dialysisShift: r.dialysis_shift ?? null,
    preferredLanguage: r.preferred_language ?? null,
    callHold: !!r.call_hold,
    callHoldReason: r.call_hold_reason ?? null,
    doNotCall: !!r.do_not_call,
    isDeceased: !!r.is_deceased,
    stopped: r.continuity_status === 'transferred_out' || r.continuity_status === 'inactive_lost_followup',
    source: r.source ?? null,
    createdAt: r.created_at,
});

/**
 * Every patient of the centre. A dialysis unit runs to a few hundred; the cap is
 * a guard against a runaway query, not a page size, and the screen says so if
 * it is ever reached.
 */
export const PATIENT_CAP = 5000;

export async function fetchPatients(centreId: string): Promise<ConnectPatient[]> {
    const rows = await run<any[]>(
        db.from('hospital_patients').select(COLUMNS).eq('hospital_id', centreId)
            .order('name', { ascending: true }).limit(PATIENT_CAP),
        'Could not load patients'
    );
    return (rows || []).map(toPatient);
}

// ── Doctors (a review always has one) ───────────────────────────────────

const PLACEHOLDER_DOCTOR = 'Clinic follow-up';

/** Find or create a doctor by name. "Dr. Meena R" and "meena r" are one doctor. */
export async function ensureDoctor(centreId: string, rawName?: string | null): Promise<string> {
    const name = (rawName || '').trim() || PLACEHOLDER_DOCTOR;
    const key = name.replace(/^dr\.?\s*/i, '').trim().toLowerCase();
    const existing = await run<{ id: string; name: string }[]>(
        db.from('hospital_doctors').select('id, name').eq('hospital_id', centreId),
        'Could not load doctors'
    );
    const hit = (existing || []).find(d => d.name.replace(/^dr\.?\s*/i, '').trim().toLowerCase() === key);
    if (hit) return hit.id;
    // access_code is NOT NULL on hospital_doctors. A Connect doctor never logs
    // in, so this is an unguessable placeholder, not a credential.
    const accessCode = Math.random().toString(36).slice(2, 10).toUpperCase();
    const created = await run<{ id: string }>(
        db.from('hospital_doctors').insert({ hospital_id: centreId, name, specialty: null, access_code: accessCode, is_active: true })
            .select('id').single(),
        'Could not create the doctor'
    );
    return created.id;
}

async function scheduleReview(centreId: string, patientId: string, reviewDate: string, doctorId: string): Promise<void> {
    // One active review per patient+doctor (idx_unique_active_review_per_doctor):
    // repoint the existing one rather than colliding with it.
    const active = await run<{ id: string } | null>(
        db.from('hospital_patient_reviews').select('id').eq('hospital_id', centreId).eq('patient_id', patientId)
            .eq('doctor_id', doctorId).in('status', ['pending', 'rescheduled']).limit(1).maybeSingle(),
        'Could not check the review'
    );
    if (active?.id) {
        await run(db.from('hospital_patient_reviews').update({ next_review_date: reviewDate, updated_at: new Date().toISOString() }).eq('id', active.id),
            'Could not update the review');
    } else {
        await run(db.from('hospital_patient_reviews').insert({ hospital_id: centreId, patient_id: patientId, doctor_id: doctorId, next_review_date: reviewDate, status: 'pending' }),
            'Could not schedule the review');
    }
}

// ── One patient by hand ──────────────────────────────────────────────────

export interface PatientInput {
    name: string;
    mrNumber: string;
    age?: string | null;
    gender?: string | null;
    phone?: string | null;
    attenderName?: string | null;
    attenderRelation?: string | null;
    attenderPhone?: string | null;
    place?: string | null;
    programme?: Programme | null;
    dialysisDays?: number[] | null;
    dialysisShift?: string | null;
    preferredLanguage?: string | null;
    doctorName?: string | null;
    reviewDate?: string | null;
}

const blank = (v?: string | null) => {
    const t = (v ?? '').trim();
    return t ? t : null;
};

export async function addPatient(centreId: string, input: PatientInput): Promise<string> {
    const name = input.name.trim();
    const mrNumber = input.mrNumber.trim();
    if (!name) throw new Error('Name is required');
    if (!mrNumber) throw new Error('Patient ID is required');
    const clash = await run<{ id: string; name: string } | null>(
        db.from('hospital_patients').select('id, name').eq('hospital_id', centreId).eq('mr_number', mrNumber).maybeSingle(),
        'Could not check the patient ID'
    );
    if (clash?.id) throw new Error(`ID ${mrNumber} already belongs to ${clash.name}`);

    const created = await run<{ id: string }>(
        db.from('hospital_patients').insert({
            hospital_id: centreId, name, mr_number: mrNumber,
            age: blank(input.age), gender: blank(input.gender),
            phone: blank(input.phone),
            attender_name: blank(input.attenderName), attender_relation: blank(input.attenderRelation),
            attender_phone: blank(input.attenderPhone), place: blank(input.place),
            programme: input.programme || null,
            dialysis_days: input.dialysisDays?.length ? input.dialysisDays : null,
            dialysis_shift: blank(input.dialysisShift),
            preferred_language: blank(input.preferredLanguage),
            token_number: null, source: 'connect_manual',
        }).select('id').single(),
        'Could not save the patient'
    );
    if (input.reviewDate) {
        await scheduleReview(centreId, created.id, input.reviewDate, await ensureDoctor(centreId, input.doctorName));
    }
    return created.id;
}

/** Edit an existing patient. Only the fields passed are written. */
export async function updatePatient(centreId: string, patientId: string, patch: Partial<PatientInput>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) {
        if (!patch.name.trim()) throw new Error('Name cannot be empty');
        row.name = patch.name.trim();
    }
    if (patch.age !== undefined) row.age = blank(patch.age);
    if (patch.gender !== undefined) row.gender = blank(patch.gender);
    if (patch.phone !== undefined) row.phone = blank(patch.phone);
    if (patch.attenderName !== undefined) row.attender_name = blank(patch.attenderName);
    if (patch.attenderRelation !== undefined) row.attender_relation = blank(patch.attenderRelation);
    if (patch.attenderPhone !== undefined) row.attender_phone = blank(patch.attenderPhone);
    if (patch.place !== undefined) row.place = blank(patch.place);
    if (patch.programme !== undefined) row.programme = patch.programme || null;
    if (patch.dialysisDays !== undefined) row.dialysis_days = patch.dialysisDays?.length ? patch.dialysisDays : null;
    if (patch.dialysisShift !== undefined) row.dialysis_shift = blank(patch.dialysisShift);
    if (patch.preferredLanguage !== undefined) row.preferred_language = blank(patch.preferredLanguage);
    if (Object.keys(row).length) {
        // hospital_patients has NO updated_at column. Writing one is what made
        // Stop Follow-up fail silently at KKC for months.
        await run(db.from('hospital_patients').update(row).eq('id', patientId).eq('hospital_id', centreId),
            'Could not save the patient');
    }
    if (patch.reviewDate) {
        await scheduleReview(centreId, patientId, patch.reviewDate, await ensureDoctor(centreId, patch.doctorName));
    }
}

export async function setCallHold(centreId: string, patientId: string, hold: boolean, reason?: string | null): Promise<void> {
    await run(
        db.from('hospital_patients').update({
            call_hold: hold,
            call_hold_reason: hold ? blank(reason) : null,
            call_hold_at: hold ? new Date().toISOString() : null,
        }).eq('id', patientId).eq('hospital_id', centreId),
        'Could not update the call hold'
    );
}

// ── Import: preview first, then commit ───────────────────────────────────

export interface ImportRowInput extends PatientInput {
    /** True when the ID was taken from the phone because the list carried none. */
    idFromPhone?: boolean;
}

export interface ImportPreviewRow {
    line: number;
    input: ImportRowInput;
    /** insert = new ID; update = ID already exists; skip = cannot be imported */
    action: 'insert' | 'update' | 'skip';
    problems: string[];
    warnings: string[];
}

/**
 * Classify every row before anything is written. Problems block a row;
 * warnings do not, but the operator sees every one of them.
 *
 * `idFromPhone`: a list pasted from WhatsApp rarely carries an MR number. The
 * phone becomes the ID ("PH-9876543210") so pasting the same list tomorrow
 * updates those patients instead of duplicating them — and the preview says so
 * on every such row.
 */
export async function buildImportPreview(
    centreId: string,
    rows: string[][],
    mapping: Mapping,
    opts: { idFromPhone?: boolean; firstLine?: number } = {}
): Promise<ImportPreviewRow[]> {
    const get = (r: string[], f: ImportField) => (mapping[f] === undefined ? '' : String(r[mapping[f]!] ?? '').trim());
    const firstLine = opts.firstLine ?? 2;

    const ids = rows.map(r => {
        const mr = get(r, 'mrNumber');
        if (mr) return mr;
        if (!opts.idFromPhone) return '';
        const e164 = normalizeIndianMobile(get(r, 'phone'));
        return e164 ? `PH-${e164.slice(3)}` : '';
    });

    const existing = new Set<string>();
    const wanted = ids.filter(Boolean);
    for (let i = 0; i < wanted.length; i += 200) {
        const chunk = wanted.slice(i, i + 200);
        const found = await run<{ mr_number: string }[]>(
            db.from('hospital_patients').select('mr_number').eq('hospital_id', centreId).in('mr_number', chunk),
            'Could not check existing patients'
        );
        (found || []).forEach(p => existing.add(p.mr_number));
    }

    const seen = new Set<string>();
    return rows.map((r, idx) => {
        const problems: string[] = [];
        const warnings: string[] = [];
        const mrNumber = ids[idx];
        const idFromPhone = !get(r, 'mrNumber') && !!mrNumber;
        const name = get(r, 'name');
        const phone = get(r, 'phone');
        const attenderPhone = get(r, 'attenderPhone');
        const reviewRaw = get(r, 'reviewDate');
        const reviewDate = reviewRaw ? parseImportDate(reviewRaw) : null;
        const programmeRaw = get(r, 'programme');
        let programme = programmeRaw ? parseProgramme(programmeRaw) : null;
        const daysRaw = get(r, 'dialysisDays');
        const dialysisDays = daysRaw ? parseDialysisDays(daysRaw) : null;
        const langRaw = get(r, 'language');
        const preferredLanguage = langRaw ? parseLanguage(langRaw) : null;
        const genderRaw = get(r, 'gender').toUpperCase();
        const gender = genderRaw.startsWith('M') ? 'M' : genderRaw.startsWith('F') ? 'F' : '';

        if (!mrNumber) problems.push(opts.idFromPhone ? 'No patient ID and no usable phone to identify them' : 'No patient ID');
        if (!name) problems.push('No name');
        if (mrNumber && seen.has(mrNumber)) problems.push('Appears twice in this list');
        if (mrNumber) seen.add(mrNumber);

        if (idFromPhone) warnings.push(`No patient ID — using ${mrNumber}`);
        if (phone && describePhoneInput(phone).kind === 'invalid') warnings.push(`Phone "${phone}" will not dial`);
        if (attenderPhone && describePhoneInput(attenderPhone).kind === 'invalid') warnings.push(`Attender phone "${attenderPhone}" will not dial`);
        if (!normalizeIndianMobile(phone) && !normalizeIndianMobile(attenderPhone)) warnings.push('No dialable number — cannot be called');
        if (reviewRaw && !reviewDate) warnings.push(`Review date "${reviewRaw}" not understood — no review scheduled`);
        if (programmeRaw && !programme) warnings.push(`Programme "${programmeRaw}" not understood`);
        if (daysRaw && !dialysisDays) warnings.push(`Dialysis days "${daysRaw}" not understood — no schedule set`);
        // A schedule only means something for dialysis; a list that carries one
        // — even one we could not read, like "alternate days" — but no programme
        // column is a dialysis list.
        if (daysRaw && !programme) programme = 'dialysis';
        if (langRaw && !preferredLanguage) warnings.push(`Language "${langRaw}" not supported — centre default used`);

        const action: ImportPreviewRow['action'] = problems.length ? 'skip' : existing.has(mrNumber) ? 'update' : 'insert';
        return {
            line: idx + firstLine,
            action, problems, warnings,
            input: {
                name, mrNumber, idFromPhone,
                phone: phone || null, attenderPhone: attenderPhone || null,
                attenderName: get(r, 'attenderName') || null,
                age: get(r, 'age') || null, gender: gender || null,
                place: get(r, 'place') || null,
                programme, dialysisDays, preferredLanguage,
                doctorName: get(r, 'doctorName') || null, reviewDate,
            },
        };
    });
}

export interface ImportResult { inserted: number; updated: number; reviews: number; skipped: number; errors: string[] }

export async function commitImport(centreId: string, preview: ImportPreviewRow[], source: string): Promise<ImportResult> {
    const result: ImportResult = { inserted: 0, updated: 0, reviews: 0, skipped: 0, errors: [] };
    const doctors = new Map<string, string>();
    const doctorFor = async (name?: string | null) => {
        const key = (name || '').trim().toLowerCase() || '__placeholder__';
        if (!doctors.has(key)) doctors.set(key, await ensureDoctor(centreId, name));
        return doctors.get(key)!;
    };

    for (const row of preview) {
        if (row.action === 'skip') { result.skipped++; continue; }
        const p = row.input;
        try {
            let patientId: string;
            if (row.action === 'insert') {
                const created = await run<{ id: string }>(
                    db.from('hospital_patients').insert({
                        hospital_id: centreId, name: p.name, mr_number: p.mrNumber,
                        age: blank(p.age), gender: blank(p.gender), phone: blank(p.phone),
                        attender_name: blank(p.attenderName), attender_phone: blank(p.attenderPhone),
                        place: blank(p.place), programme: p.programme || null,
                        dialysis_days: p.dialysisDays?.length ? p.dialysisDays : null,
                        preferred_language: p.preferredLanguage || null,
                        token_number: null, source,
                    }).select('id').single(),
                    'Could not add the patient'
                );
                patientId = created.id;
                result.inserted++;
            } else {
                // Never blank a field the file did not carry.
                const patch: Record<string, unknown> = { name: p.name };
                if (p.age) patch.age = p.age;
                if (p.gender) patch.gender = p.gender;
                if (p.phone) patch.phone = p.phone;
                if (p.attenderName) patch.attender_name = p.attenderName;
                if (p.attenderPhone) patch.attender_phone = p.attenderPhone;
                if (p.place) patch.place = p.place;
                if (p.programme) patch.programme = p.programme;
                if (p.dialysisDays?.length) patch.dialysis_days = p.dialysisDays;
                if (p.preferredLanguage) patch.preferred_language = p.preferredLanguage;
                const updated = await run<{ id: string }>(
                    db.from('hospital_patients').update(patch).eq('hospital_id', centreId).eq('mr_number', p.mrNumber).select('id').single(),
                    'Could not update the patient'
                );
                patientId = updated.id;
                result.updated++;
            }
            if (p.reviewDate) {
                await scheduleReview(centreId, patientId, p.reviewDate, await doctorFor(p.doctorName));
                result.reviews++;
            }
        } catch (e: any) {
            result.errors.push(`Line ${row.line} (${p.mrNumber || p.name}): ${e?.message || 'failed'}`);
        }
    }
    return result;
}
