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

const SELECT = 'id, name, age, gender, phone, mr_number, father_husband_name, place, created_at';

export interface LabelCandidate extends LabelPatient {
    id: string;
}

interface SupabaseResult<T> { data: T | null; error: any }

const toCandidate = (r: any): LabelCandidate => ({
    id: r.id,
    mrNumber: r.mr_number || '',
    name: r.name || '',
    age: r.age ?? null,
    gender: r.gender ?? null,
    phone: r.phone ?? null,
    fatherHusbandName: r.father_husband_name ?? null,
    place: r.place ?? null,
    registeredAt: r.created_at ?? null,
});

const escapeForIlike = (v: string) => v.replace(/[%_,()]/g, ' ').trim();

/** Name or MR number, newest first. Bounded — this feeds a pick list, not a report. */
export async function searchPatientsForLabel(
    hospitalId: string,
    query: string,
    limit = 25
): Promise<LabelCandidate[]> {
    const q = escapeForIlike(query || '');
    if (!hospitalId || q.length < 2) return [];

    const res = await withTimeout(
        ((supabase.from('hospital_patients') as any)
            .select(SELECT)
            .eq('hospital_id', hospitalId)
            .or(`name.ilike.%${q}%,mr_number.ilike.%${q}%`)
            .order('created_at', { ascending: false })
            .limit(limit)) as any,
        10000,
        'Timed out while searching patients'
    ) as SupabaseResult<any[]>;

    if (res.error) throw res.error;
    return (res.data || []).map(toCandidate);
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

    const res = await withTimeout(
        ((supabase.from('hospital_patients') as any)
            .select(SELECT)
            .eq('hospital_id', hospitalId)
            .gte('created_at', start.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit)) as any,
        10000,
        'Timed out while loading today’s registrations'
    ) as SupabaseResult<any[]>;

    if (res.error) throw res.error;
    return (res.data || []).map(toCandidate);
}
