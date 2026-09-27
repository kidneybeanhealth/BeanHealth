/**
 * Alerts — the things a human must act on today.
 *
 * Raised in the database, not here: a trigger on hospital_voice_call_attempts
 * inserts a red_flag alert when the agent reports RED_FLAG_REPORTED, and a
 * callback alert when the patient asks for a person to ring back. This file
 * only reads them and records what the centre did about them.
 *
 * WhatsApp: forwarding an alert opens WhatsApp with the message filled in, to
 * the coordinator or doctor numbers in Settings. It does not send by itself —
 * automatic sending needs a WhatsApp Business API account and an approved
 * template, which is calendar time with Meta, not code. The forward keeps the
 * red flag in front of a person the moment it lands, without waiting for that.
 */
import { db, run } from './db';

export type AlertKind = 'red_flag' | 'callback';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface ConnectAlert {
    id: string;
    patientId: string | null;
    patientName: string | null;
    mrNumber: string | null;
    phoneE164: string | null;
    attenderPhoneE164: string | null;
    attemptId: string | null;
    kind: AlertKind;
    title: string;
    detail: string | null;
    status: AlertStatus;
    createdAt: string;
    acknowledgedAt: string | null;
    acknowledgedByName: string | null;
    resolvedAt: string | null;
    resolutionNote: string | null;
}

const toAlert = (r: any): ConnectAlert => ({
    id: r.id,
    patientId: r.patient_id ?? null,
    patientName: r.hospital_patients?.name ?? null,
    mrNumber: r.hospital_patients?.mr_number ?? null,
    phoneE164: r.hospital_patients?.phone_e164 ?? null,
    attenderPhoneE164: r.hospital_patients?.attender_phone_e164 ?? null,
    attemptId: r.attempt_id ?? null,
    kind: r.kind,
    title: r.title,
    detail: r.detail ?? null,
    status: r.status,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at ?? null,
    acknowledgedByName: r.acknowledged_by_name ?? null,
    resolvedAt: r.resolved_at ?? null,
    resolutionNote: r.resolution_note ?? null,
});

/** Fired after an alert changes, so the header's open-alert count updates at once. */
export const ALERTS_CHANGED = 'connect:alerts-changed';
const announce = () => window.dispatchEvent(new Event(ALERTS_CHANGED));

export async function fetchAlerts(centreId: string, opts: { status?: AlertStatus[]; sinceIso?: string } = {}): Promise<ConnectAlert[]> {
    let q = db.from('connect_alerts')
        .select('*, hospital_patients ( name, mr_number, phone_e164, attender_phone_e164 )')
        .eq('hospital_id', centreId)
        .order('created_at', { ascending: false })
        .limit(2000);
    if (opts.status?.length) q = q.in('status', opts.status);
    if (opts.sinceIso) q = q.gte('created_at', opts.sinceIso);
    const rows = await run<any[]>(q, 'Could not load alerts');
    return (rows || []).map(toAlert);
}

export async function acknowledgeAlert(centreId: string, id: string, byName: string | null): Promise<void> {
    await run(
        db.from('connect_alerts').update({
            status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by_name: byName,
        }).eq('id', id).eq('hospital_id', centreId).eq('status', 'open'),
        'Could not update the alert'
    );
    announce();
}

export async function resolveAlert(centreId: string, id: string, byName: string | null, note: string): Promise<void> {
    const now = new Date().toISOString();
    // Resolving an alert nobody acknowledged still records who handled it.
    await run(
        db.from('connect_alerts').update({
            status: 'resolved', resolved_at: now, resolution_note: note.trim() || null,
        }).eq('id', id).eq('hospital_id', centreId),
        'Could not update the alert'
    );
    await run(
        db.from('connect_alerts').update({ acknowledged_at: now, acknowledged_by_name: byName })
            .eq('id', id).eq('hospital_id', centreId).is('acknowledged_at', null),
        'Could not update the alert'
    );
    announce();
}

/** A wa.me link with the alert written out. Digits only, country code included. */
export function whatsAppForwardUrl(toDigits: string, alert: ConnectAlert, centreName: string): string {
    const who = [alert.patientName, alert.mrNumber].filter(Boolean).join(' · ');
    const phone = alert.phoneE164 || alert.attenderPhoneE164;
    const lines = [
        `*${alert.kind === 'red_flag' ? 'RED FLAG' : 'Callback requested'}* — ${centreName}`,
        who,
        alert.detail || '',
        phone ? `Patient phone: ${phone}` : '',
        `Raised ${new Date(alert.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
    ].filter(Boolean);
    return `https://wa.me/${toDigits.replace(/\D/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`;
}
