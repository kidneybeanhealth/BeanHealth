/**
 * Alerts — red flags and callback requests, raised by the calls themselves.
 *
 * A red flag is the agent hearing a danger symptom (breathlessness, chest pain,
 * no urine, …). On the call the agent tells the patient to come in or go to the
 * nearest emergency and reads out the centre's front-desk number; this screen
 * is where a person picks it up afterwards. It must be impossible to miss, so
 * the open count sits on the tab from every screen and red flags sort first.
 *
 * Acknowledge = "I have seen this and I am on it". Resolve = "done", with a note
 * of what was done — the monthly report counts both, and the time to
 * acknowledge a red flag is one of its headline numbers.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCentre } from '../session';
import { acknowledgeAlert, fetchAlerts, resolveAlert, whatsAppForwardUrl, type AlertStatus, type ConnectAlert } from '../services/alerts';
import { SetupNotice } from '../ui/SetupNotice';
import { Badge, Button, Card, Empty, Field, Modal, Spinner, cx, fmtWhen, inputCls, readOperator } from '../ui/kit';

const AlertsScreen: React.FC = () => {
    const centre = useCentre();
    const [tab, setTab] = useState<AlertStatus>('open');
    const [alerts, setAlerts] = useState<ConnectAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [resolving, setResolving] = useState<ConnectAlert | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
            setAlerts(await fetchAlerts(centre.id, { sinceIso: since }));
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [centre.id]);

    useEffect(() => { load(); }, [load]);
    // New red flags must surface without anyone pressing refresh.
    useEffect(() => {
        const t = window.setInterval(load, 60_000);
        return () => window.clearInterval(t);
    }, [load]);

    const counts = useMemo(() => ({
        open: alerts.filter(a => a.status === 'open').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
    }), [alerts]);

    const shown = useMemo(() => alerts
        .filter(a => a.status === tab)
        .sort((a, b) => (a.kind === b.kind ? b.createdAt.localeCompare(a.createdAt) : a.kind === 'red_flag' ? -1 : 1)), [alerts, tab]);

    const ack = async (a: ConnectAlert) => {
        setBusy(a.id);
        try {
            await acknowledgeAlert(centre.id, a.id, readOperator() || null);
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not update');
        } finally {
            setBusy(null);
        }
    };

    const resolve = async () => {
        if (!resolving) return;
        setBusy(resolving.id);
        try {
            await resolveAlert(centre.id, resolving.id, readOperator() || null, note);
            setResolving(null);
            setNote('');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not update');
        } finally {
            setBusy(null);
        }
    };

    const { coordinatorName, coordinatorWhatsApp, doctorName, doctorWhatsApp } = centre.settings.alerts;
    const forwardTargets = [
        coordinatorWhatsApp && { label: coordinatorName || 'Coordinator', to: coordinatorWhatsApp },
        doctorWhatsApp && { label: doctorName || 'Doctor', to: doctorWhatsApp },
    ].filter(Boolean) as { label: string; to: string }[];

    if (loading && !alerts.length) return <Spinner label="Loading alerts…" />;
    if (error) return <SetupNotice error={error} />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
                    <p className="text-sm text-gray-500">Red flags and callback requests from calls. Last 60 days.</p>
                </div>
                <Button onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
            </div>

            <div className="flex gap-1.5">
                {([['open', 'Open'], ['acknowledged', 'In hand'], ['resolved', 'Resolved']] as const).map(([k, label]) => (
                    <button
                        key={k} type="button" onClick={() => setTab(k)}
                        className={cx('rounded-full border px-3 py-1 text-xs font-semibold', tab === k ? 'border-[#5FA01F] bg-[#F0F9E6] text-[#3F7A12]' : 'border-gray-200 bg-white text-gray-600')}
                    >
                        {label} · {counts[k]}
                    </button>
                ))}
            </div>

            {!forwardTargets.length && (
                <p className="text-[11px] text-gray-400">Add the coordinator's and doctor's WhatsApp numbers in Settings to forward alerts in one tap.</p>
            )}

            {shown.length === 0 ? (
                <Empty title={tab === 'open' ? 'No open alerts' : 'Nothing here'}>
                    {tab === 'open' && 'When a patient reports a red-flag symptom or asks for a callback on a call, it appears here.'}
                </Empty>
            ) : (
                <div className="space-y-3">
                    {shown.map(a => {
                        const phone = a.phoneE164 || a.attenderPhoneE164;
                        return (
                            <Card key={a.id} className={cx('p-4', a.kind === 'red_flag' && a.status === 'open' && 'border-rose-300 bg-rose-50/60')}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge tone={a.kind === 'red_flag' ? 'rose' : 'amber'}>{a.kind === 'red_flag' ? 'Red flag' : 'Callback'}</Badge>
                                            <span className="text-sm font-bold text-gray-900">{a.patientName || 'Patient'}</span>
                                            {a.mrNumber && <span className="font-mono text-[11px] text-gray-400">{a.mrNumber}</span>}
                                        </div>
                                        {a.detail && <p className="mt-1.5 text-sm leading-6 text-gray-700">{a.detail}</p>}
                                        <p className="mt-1 text-[11px] text-gray-400">
                                            Raised {fmtWhen(a.createdAt)}
                                            {a.acknowledgedAt && ` · in hand since ${fmtWhen(a.acknowledgedAt)}${a.acknowledgedByName ? ` (${a.acknowledgedByName})` : ''}`}
                                            {a.resolvedAt && ` · resolved ${fmtWhen(a.resolvedAt)}`}
                                        </p>
                                        {a.resolutionNote && <p className="mt-1 text-xs text-gray-600"><span className="font-semibold">Done: </span>{a.resolutionNote}</p>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {phone && <a href={`tel:${phone}`} className="inline-flex min-h-[34px] items-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50">Call {phone}</a>}
                                        {forwardTargets.map(t => (
                                            <a key={t.to} href={whatsAppForwardUrl(t.to, a, centre.name)} target="_blank" rel="noreferrer noopener"
                                                className="inline-flex min-h-[34px] items-center rounded-xl border border-[#CFE8B4] bg-[#F0F9E6] px-3 text-xs font-semibold text-[#3F7A12] hover:bg-[#E3F3D2]">
                                                WhatsApp {t.label}
                                            </a>
                                        ))}
                                        {a.status === 'open' && <Button size="sm" onClick={() => ack(a)} disabled={busy === a.id}>In hand</Button>}
                                        {a.status !== 'resolved' && <Button size="sm" tone="primary" onClick={() => { setResolving(a); setNote(''); }} disabled={busy === a.id}>Resolve</Button>}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal
                open={!!resolving} onClose={() => setResolving(null)} title="Resolve alert"
                footer={<><Button onClick={() => setResolving(null)}>Cancel</Button><Button tone="primary" onClick={resolve} disabled={busy === resolving?.id}>Resolve</Button></>}
            >
                <p className="mb-3 text-sm text-gray-600">{resolving?.title}</p>
                <Field label="What was done" hint="Kept with the alert and shown in the monthly report's detail.">
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={cx(inputCls, 'py-2')} placeholder="Spoke to the son; patient brought in for dialysis today." />
                </Field>
            </Modal>
        </div>
    );
};

export default AlertsScreen;
