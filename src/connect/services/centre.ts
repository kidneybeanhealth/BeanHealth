/**
 * The signed-in centre: who they are, and the rules they run on.
 *
 * A Connect centre is a hospital account whose hospital_profiles.product is
 * 'connect'. 'frontdesk' is accepted too — it is what the same product was
 * called on v12, and any account created then should not be locked out by a
 * rename.
 */
import { db, run } from './db';
import { resolveSettings, type ConnectSettings } from '../protocol/settings';

export interface Centre {
    id: string;
    name: string;
    logo: string | null;
    product: string;
    frontDeskNumber: string | null;
    address: string | null;
    dailyCap: number | null;
    settings: ConnectSettings;
}

export const CONNECT_PRODUCTS = ['connect', 'frontdesk'];

export async function loadCentre(userId: string): Promise<Centre | null> {
    // select('*'): hospital_logo and several voice columns were added outside the
    // migration files, and naming a column a database lacks fails the whole read.
    const row = await run<any>(
        db.from('hospital_profiles').select('*').eq('id', userId).maybeSingle(),
        'Could not load the centre'
    );
    if (!row) return null;
    const settings = resolveSettings(row.connect_settings);
    // The centre's call language lives in its own column; the settings default
    // mirrors it so the engine and the call use the same one.
    if (typeof row.default_call_language === 'string' && row.default_call_language) {
        settings.calls.defaultLanguage = row.default_call_language;
    }
    return {
        id: row.id,
        name: row.hospital_name || 'Centre',
        logo: row.hospital_logo || row.avatar_url || null,
        product: row.product || 'kidney_os',
        frontDeskNumber: row.voice_front_desk_number ?? null,
        address: row.voice_hospital_address ?? row.address ?? null,
        dailyCap: typeof row.ai_call_daily_cap === 'number' ? row.ai_call_daily_cap : null,
        settings,
    };
}

export async function saveCentreSettings(
    centreId: string,
    settings: ConnectSettings,
    basics: { frontDeskNumber: string | null; address: string | null; dailyCap: number | null }
): Promise<void> {
    await run(
        db.from('hospital_profiles').update({
            connect_settings: settings,
            default_call_language: settings.calls.defaultLanguage,
            voice_front_desk_number: basics.frontDeskNumber?.trim() || null,
            voice_hospital_address: basics.address?.trim() || null,
            ...(basics.dailyCap && basics.dailyCap > 0 ? { ai_call_daily_cap: Math.round(basics.dailyCap) } : {}),
        }).eq('id', centreId),
        'Could not save settings'
    );
}
