/**
 * labelPrintService — finding the patients whose labels are being printed
 *
 * Label stock is a ROLL, not a sheet: die-cut labels on a liner with a gap
 * between each, and the printer's gap sensor feeds exactly one label at a time.
 * So there is no "labels per sheet" to lay out, and printing ten labels is
 * simply ten pages, each one label tall. That is what makes a batch worth
 * offering — the desk can pick a set and the roll does the rest.
 *
 * Patient rows only. Nothing here touches reviews or visits, because a label is
 * a fact about a person, not about an appointment.
 */
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';
import type { LabelPatient } from '../components/enterprise/patientLabel';

const BASE = 'id, name, age, gender, phone, mr_number, father_husband_name, place, created_at';
/** Added by sql/20260919_patient_address_fields.sql. Absent on an un-migrated DB. */
const EXTRA = 'address_line1, address_line2, city_pincode, alt_phone';
const SELECT = `${BASE}, ${EXTRA}`;

/** True once we learn this database has the address columns; false once we learn it does not. */
let hasAddressColumns: boolean | null = null;

const missingAddressColumns = (error: any): boolean => {
    const msg = String(error?.message || '').toLowerCase();
    return error?.code === '42703'
        || error?.code === 'PGRST204'
        || ['address_line1', 'address_line2', 'city_pincode', 'alt_phone'].some(c => msg.includes(c));
};

export interface LabelCandidate extends LabelPatient {
    id: string;
}

/** Empty string means "not typed", which is NULL in the database, not ''. */
const blank = (v: unknown) => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
};

/**
 * The four contact fields the label prints and `hospital_patients` gained in
 * sql/20260919_patient_address_fields.sql.
 */
export interface PatientContactInput {
    altPhone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    cityPincode?: string | null;
}

const contactColumns = (c: PatientContactInput, omitBlank: boolean): Record<string, any> => {
    const all: Record<string, any> = {
        address_line1: blank(c.addressLine1),
        address_line2: blank(c.addressLine2),
        city_pincode: blank(c.cityPincode),
        alt_phone: blank(c.altPhone),
    };
    if (!omitBlank) return all;
    // On an UPDATE, a field the form left empty means "I did not type this",
    // not "erase what is stored". Reception reaches the registration form by
    // typing an MR number, and when they type one without picking from the
    // dropdown the form is blank — writing those blanks back would wipe an
    // address somebody else entered. Clearing a field is done deliberately in
    // the label editor, which writes NULL on purpose.
    return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== null));
};

/**
 * Run a hospital_patients write with the label's address columns attached, and
 * run it again without them if this database predates the migration.
 *
 * Exported because reception's registration forms write the same row from a
 * different code path. Without this, adding four optional fields to the busiest
 * screen in the hospital would take registration down entirely on any site that
 * has not run sql/20260919_patient_address_fields.sql — a far worse failure than
 * a label printing without an address.
 *
 * `run` receives the row and the columns to select back, so the caller keeps
 * control of both the operation (insert/update) and its filters.
 */
export async function writePatientWithContact<T>(
    run: (row: Record<string, any>, cols: string) => PromiseLike<{ data: T | null; error: any }>,
    base: Record<string, any>,
    contact: PatientContactInput,
    { omitBlank = false }: { omitBlank?: boolean } = {}
): Promise<{ data: T | null; error: any }> {
    if (hasAddressColumns !== false) {
        const res = await run({ ...base, ...contactColumns(contact, omitBlank) }, SELECT);
        if (!res.error) { hasAddressColumns = true; return res; }
        if (!missingAddressColumns(res.error)) return res;
        hasAddressColumns = false;
    }
    return run(base, BASE);
}

interface SupabaseResult<T> { data: T | null; error: any }

const toCandidate = (r: any): LabelCandidate => ({
    id: r.id,
    mrNumber: r.mr_number || '',
    name: r.name || '',
    age: r.age ?? null,
    gender: r.gender ?? null,
    phone: r.phone ?? null,
    altPhone: r.alt_phone ?? null,
    fatherHusbandName: r.father_husband_name ?? null,
    place: r.place ?? null,
    addressLine1: r.address_line1 ?? null,
    addressLine2: r.address_line2 ?? null,
    cityPincode: r.city_pincode ?? null,
    registeredAt: r.created_at ?? null,
});

/**
 * Run a patient query, dropping the address columns if this database predates
 * them. Degrading to the base columns keeps label printing working on a site
 * that has not run the migration; failing outright would take the whole feature
 * down over four optional fields.
 */
export const selectPatientsDegrading = async (
    build: (cols: string) => any,
    timeoutMessage: string
): Promise<any[]> => {
    if (hasAddressColumns !== false) {
        const res = await withTimeout(build(SELECT) as any, 10000, timeoutMessage) as SupabaseResult<any[]>;
        if (!res.error) { hasAddressColumns = true; return res.data || []; }
        if (!missingAddressColumns(res.error)) throw res.error;
        hasAddressColumns = false;
    }
    const res = await withTimeout(build(BASE) as any, 10000, timeoutMessage) as SupabaseResult<any[]>;
    if (res.error) throw res.error;
    return res.data || [];
};

export interface PatientLabelDetails {
    /**
     * Optional, and only written when present.
     *
     * Reception types the honorific themselves — the label stopped adding one
     * after "Ms. MRS. JERENA" reached a patient's file — so a record created
     * before that change can carry a name with no Mr/Mrs at all, and the label
     * is where that gets noticed. Blanking it is refused below: this is a
     * sticker editor, and a patient with no name is not a recoverable state.
     */
    name?: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    cityPincode: string | null;
    /** The single free-text field that predates the structured address, and
     *  which the label still falls back to for line 1. */
    place: string | null;
    altPhone: string | null;
    phone: string | null;
    fatherHusbandName: string | null;
    age: string | number | null;
    gender: string | null;
}

export class LabelColumnsMissingError extends Error {
    constructor() {
        super('Run sql/20260919_patient_address_fields.sql, then save again');
        this.name = 'LabelColumnsMissingError';
    }
}

/**
 * Persist what the desk typed while working through a batch.
 *
 * Empty strings are written as NULL, so clearing a field actually clears it —
 * a label that keeps printing an address the receptionist just deleted is worse
 * than one that never had it.
 */
export async function updatePatientLabelDetails(
    hospitalId: string,
    patientId: string,
    d: PatientLabelDetails
): Promise<void> {
    if (!hospitalId || !patientId) throw new Error('Missing hospital or patient identifier');

    // `undefined` means the caller is not editing the name; '' means they
    // cleared it, which is the one edit this function will not make.
    const name = d.name === undefined ? undefined : String(d.name ?? '').trim();
    if (name !== undefined && !name) throw new Error('Name cannot be empty');

    const res = await withTimeout(
        ((supabase.from('hospital_patients') as any)
            .update({
                ...(name !== undefined ? { name } : {}),
                address_line1: blank(d.addressLine1),
                address_line2: blank(d.addressLine2),
                city_pincode: blank(d.cityPincode),
                place: blank(d.place),
                alt_phone: blank(d.altPhone),
                phone: blank(d.phone),
                father_husband_name: blank(d.fatherHusbandName),
                age: blank(d.age),
                gender: blank(d.gender),
                // hospital_patients has NO updated_at column. Writing one here is
                // exactly what made Stop Follow-up silently fail for months.
            })
            .eq('hospital_id', hospitalId)
            .eq('id', patientId)) as any,
        10000,
        'Timed out while saving patient details'
    ) as SupabaseResult<any>;

    if (res.error) {
        if (missingAddressColumns(res.error)) throw new LabelColumnsMissingError();
        throw res.error;
    }
}

export interface NewLabelPatientInput {
    name: string;
    mrNumber: string;
    age?: string | null;
    gender?: string | null;
    phone?: string | null;
    altPhone?: string | null;
    fatherHusbandName?: string | null;
    place?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    cityPincode?: string | null;
}

/**
 * Register a patient from the label screen.
 *
 * Mirrors the Past Records "New Registration" branch, which writes ONE row to
 * hospital_patients and nothing else. Read that carefully before changing this:
 *
 *   THIS MUST NEVER TOUCH hospital_queues.
 *
 * A patient registered here is someone whose physical file needs a sticker, not
 * someone waiting to see a doctor. Putting them in the live queue would hand a
 * doctor a patient who is not in the building, and `token_number` is explicitly
 * null for the same reason — a token belongs to a visit.
 *
 * No review row either. A review needs an owning doctor, and four separate paths
 * have already created ownerless reviews that then drifted into false missed
 * follow-ups. Follow-up is scheduled from Past Records, where the doctor is
 * required.
 */
export async function registerPatientForLabel(
    hospitalId: string,
    input: NewLabelPatientInput
): Promise<LabelCandidate> {
    const name = (input.name || '').trim();
    const mr = (input.mrNumber || '').trim();
    if (!hospitalId) throw new Error('Hospital profile not found');
    if (!name) throw new Error('Name is required');
    // A bare "KNH/" is the autofilled prefix with nothing typed after it.
    if (!mr || mr.toUpperCase() === 'KNH/') throw new Error('MR number is required — it is what gets barcoded');

    const dup = await withTimeout(
        ((supabase.from('hospital_patients') as any)
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('mr_number', mr)
            .maybeSingle()) as any,
        10000,
        'Timed out while checking the MR number'
    ) as SupabaseResult<any>;
    if (dup.error) throw dup.error;
    if (dup.data?.id) throw new Error('That MR number already exists');

    const base: Record<string, any> = {
        hospital_id: hospitalId,
        name,
        mr_number: mr,
        age: blank(input.age),
        gender: blank(input.gender),
        phone: blank(input.phone),
        father_husband_name: blank(input.fatherHusbandName),
        place: blank(input.place),
        // Not a visit. No token, and deliberately no queue row anywhere below.
        token_number: null,
    };
    const res = await writePatientWithContact<any>(
        (row, cols) => withTimeout(
            ((supabase.from('hospital_patients') as any).insert(row).select(cols).single()) as any,
            12000,
            'Timed out while saving the patient'
        ) as Promise<SupabaseResult<any>>,
        base,
        input
    );
    if (res.error) throw res.error;

    return toCandidate(res.data);
}

const escapeForIlike = (v: string) => v.replace(/[%_,()]/g, ' ').trim();

/** Name or MR number, newest first. Bounded — this feeds a pick list, not a report. */
export async function searchPatientsForLabel(
    hospitalId: string,
    query: string,
    limit = 25
): Promise<LabelCandidate[]> {
    const q = escapeForIlike(query || '');
    if (!hospitalId || q.length < 2) return [];

    const rows = await selectPatientsDegrading(
        (cols) => (supabase.from('hospital_patients') as any)
            .select(cols)
            .eq('hospital_id', hospitalId)
            .or(`name.ilike.%${q}%,mr_number.ilike.%${q}%`)
            .order('created_at', { ascending: false })
            .limit(limit),
        'Timed out while searching patients'
    );
    return rows.map(toCandidate);
}

/**
 * Everyone registered today.
 *
 * The obvious batch: a day's new files all need a sticker. Bounded by the day
 * rather than by a page size, because a half-printed day is worse than none.
 */
export async function fetchTodayRegistrations(hospitalId: string, limit = 200): Promise<LabelCandidate[]> {
    if (!hospitalId) return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    // Degrades like every other read here: this is the default batch, so a
    // hard failure would be the first thing reception hits on opening the screen.
    const rows = await selectPatientsDegrading(
        (cols) => (supabase.from('hospital_patients') as any)
            .select(cols)
            .eq('hospital_id', hospitalId)
            .gte('created_at', start.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit),
        'Timed out while loading today’s registrations'
    );
    return rows.map(toCandidate);
}
