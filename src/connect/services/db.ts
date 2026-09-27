/**
 * The one door from Connect to Supabase.
 *
 * Every read and write in Connect goes through `run`, which applies the
 * codebase's rule that all Supabase calls carry a timeout (utils/requestUtils)
 * and turns a PostgREST error into a thrown Error with a readable message, so
 * screens can `try { await … } catch (e) { toast(e.message) }` and nothing else.
 */
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../utils/requestUtils';

// The generated table types predate every Connect table; the services own the
// shapes instead, one interface per row type.
export const db = supabase as any;

/**
 * Thrown when a Connect table or column does not exist yet — the migration has
 * not been run on this database. The shell shows one clear setup message
 * instead of a raw "relation does not exist" on every screen.
 */
export class SetupRequiredError extends Error {
    constructor() {
        super('Connect is not set up on this database yet. Run sql/20260927d_connect.sql in Supabase.');
        this.name = 'SetupRequiredError';
    }
}

const MISSING_SCHEMA = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

export async function run<T>(query: PromiseLike<{ data: T | null; error: any }>, message: string, ms = 15000): Promise<T> {
    const res = await withTimeout(Promise.resolve(query) as Promise<{ data: T | null; error: any }>, ms, message);
    if (res.error) {
        const e = res.error;
        if (MISSING_SCHEMA.has(String(e?.code))) throw new SetupRequiredError();
        throw new Error(e?.message ? `${message}: ${e.message}` : message);
    }
    return res.data as T;
}

/** Clinic-local 'YYYY-MM-DD' for a Date — never toISOString, which is UTC. */
export const localDateKey = (d: Date = new Date()): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
