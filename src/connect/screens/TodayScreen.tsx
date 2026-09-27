/**
 * Today — who needs a call, why, and the calls themselves.
 *
 * The list is the protocol engine's output (services/worklist.ts). Each row says
 * why the patient is on it and, if they cannot be dialled right now, why not —
 * in words a coordinator can act on ("No phone number", "Called 3h ago").
 *
 * Calling:
 *   · one patient — the Call button on the row
 *   · everyone ready — "Call all ready", which shows the exact list first, then
 *     places the calls ONE AFTER ANOTHER, not at once. The live function keeps a
 *     single in-flight call per patient and a daily cap per centre; firing a
 *     burst would trip the cap mid-list and leave the rest unexplained. The run
 *     can be stopped, and it stops by itself on the first refusal that would
 *     repeat for every call (daily cap, agent not configured).
 *   The tab must stay open while a batch runs; the screen says so.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useCentre } from '../session';
import { loadWorklist, type WorklistData } from '../services/worklist';
import { placeCall, type CallAttempt } from '../services/calls';
import { speakDate, type WorkItem } from '../protocol/engine';
import { CALL_PURPOSE_LABEL } from '../protocol/settings';
import { SetupNotice } from '../ui/SetupNotice';
import { Badge, Button, Card, Empty, Modal, Spinner, Stat, cx, fmtWhen, readOperator } from '../ui/kit';

const REASON_TONE: Record<WorkItem['reason'], 'rose' | 'amber' | 'sky' | 'violet'> = {
    missed_session: 'rose',
    review_overdue: 'amber',
    lab_due: 'violet',
    review_due: 'sky',
};
const REASON_LABEL: Record<WorkItem['reason'], string> = {
    missed_session: 'Missed session',
    review_overdue: 'Missed review',
    lab_due: 'Labs due',
    review_due: 'Review soon',
};

/** Refusals that will repeat for every remaining call — stop the batch on these. */
const STOPS_BATCH = /daily limit|not configured|not set up|unauthor|missing authorization|sarvam_|app_version|api key/i;

const outcomeOf = (a: CallAttempt): { label: string; tone: 'green' | 'gray' | 'amber' | 'rose' | 'sky' } => {
    if (a.status === 'placing' || a.status === 'placed') return { label: 'In progress', tone: 'sky' };
    if (a.disposition === 'RED_FLAG_REPORTED') return { label: 'Red flag', tone: 'rose' };
    if (a.connected) return { label: 'Spoke', tone: 'green' };
    if (a.status === 'failed') return { label: 'Failed', tone: 'rose' };
    if (a.status === 'expired') return { label: 'No outcome', tone: 'gray' };
    if (a.providerStatus === 'busy') return { label: 'Busy', tone: 'amber' };
    return { label: 'No answer', tone: 'amber' };
};

const TodayScreen: React.FC = () => {
    const centre = useCentre();
    const [data, setData] = useState<WorklistData | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ready' | 'all' | 'blocked'>('ready');
    const [calling, setCalling] = useState<string | null>(null);
    const [confirmBatch, setConfirmBatch] = useState(false);
    const [batch, setBatch] = useState<{ done: number; total: number; failed: number } | null>(null);
    const stopRef = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await loadWorklist(centre));
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [centre]);

    useEffect(() => { load(); }, [load]);

    // Outcomes arrive on the webhook minutes after a call; refresh while any
    // call is still in progress, so the row settles without a manual reload.
    const inFlight = useMemo(() => (data?.attempts || []).some(a => a.status === 'placing' || a.status === 'placed'), [data]);
    useEffect(() => {
        if (!inFlight || batch) return;
        const t = window.setInterval(load, 30_000);
        return () => window.clearInterval(t);
    }, [inFlight, batch, load]);

    const patientsById = useMemo(() => new Map((data?.patients || []).map(p => [p.id, p])), [data]);
    const items = data?.result.items || [];
    const ready = items.filter(i => i.callable);
    const shown = filter === 'ready' ? ready : filter === 'blocked' ? items.filter(i => !i.callable) : items;
    const urgent = items.filter(i => i.priority === 1).length;

    const todays = useMemo(
        () => (data?.attempts || []).filter(a => a.createdAt.slice(0, 10) === data?.today || a.status === 'placing' || a.status === 'placed'),
        [data]
    );

    const languageFor = (patientId: string) =>
        patientsById.get(patientId)?.preferredLanguage || centre.settings.calls.defaultLanguage;

    const callOne = async (item: WorkItem): Promise<void> => {
        await placeCall({
            patientId: item.patientId,
            purpose: item.purpose,
            language: languageFor(item.patientId),
            requestedByName: readOperator() || null,
            purposeDetail: item.purpose === 'review' ? null : item.detail,
        });
    };

    const onCall = async (item: WorkItem) => {
        setCalling(item.key);
        try {
            await callOne(item);
            toast.success(`Calling ${item.patientName}`);
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not place the call', { duration: 7000 });
        } finally {
            setCalling(null);
        }
    };

    const runBatch = async () => {
        setConfirmBatch(false);
        const queue = ready.slice();
        stopRef.current = false;
        setBatch({ done: 0, total: queue.length, failed: 0 });
        let failed = 0;
        for (let i = 0; i < queue.length; i++) {
            if (stopRef.current) break;
            const item = queue[i];
            setCalling(item.key);
            try {
                await callOne(item);
            } catch (e: any) {
                failed++;
                const msg = e?.message || 'Could not place the call';
                toast.error(`${item.patientName}: ${msg}`, { duration: 8000 });
                if (STOPS_BATCH.test(msg)) { toast.error('Stopped — this would fail for every remaining call.', { duration: 8000 }); break; }
            }
            setBatch({ done: i + 1, total: queue.length, failed });
            // A breath between calls: the provider rate-limits bursts, and the
            // in-flight row needs to exist before the next patient is checked.
            if (i < queue.length - 1 && !stopRef.current) await new Promise(r => setTimeout(r, 2500));
        }
        setCalling(null);
        setBatch(null);
        await load();
    };

    // Leaving mid-batch abandons the remaining calls; ask first.
    useEffect(() => {
        if (!batch) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [batch]);

    if (loading && !data) return <Spinner label="Working out today's list…" />;
    if (error && !data) return <SetupNotice error={error} />;
    if (!data) return null;

    const { unmarked, labsNoBaseline } = data.result;
    const unmarkedDates = [...new Set(unmarked.map(u => u.date))];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Today</h1>
                    <p className="text-sm text-gray-500">Who needs a call, and why.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={load} disabled={loading || !!batch}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
                    <Button tone="primary" onClick={() => setConfirmBatch(true)} disabled={!ready.length || !!batch}>
                        Call all ready ({ready.length})
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Ready to call" value={ready.length} tone={ready.length ? 'green' : 'default'} />
                <Stat label="Urgent" value={urgent} tone={urgent ? 'rose' : 'default'} hint="missed sessions in a row" />
                <Stat label="Waiting" value={items.length - ready.length} hint="see why below" />
                <Stat label="Calls today" value={todays.length} hint={`${todays.filter(a => a.connected).length} reached`} />
            </div>

            {batch && (
                <Card className="border-[#CFE8B4] bg-[#F0F9E6] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold text-[#3F7A12]">Calling {batch.done} of {batch.total}{batch.failed ? ` · ${batch.failed} not placed` : ''}</p>
                            <p className="text-xs text-[#3F7A12]/80">Keep this tab open until it finishes.</p>
                        </div>
                        <Button tone="danger" size="sm" onClick={() => { stopRef.current = true; }}>Stop after this call</Button>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-[#5FA01F] transition-all" style={{ width: `${(batch.done / Math.max(1, batch.total)) * 100}%` }} />
                    </div>
                </Card>
            )}

            {centre.settings.missedSession.enabled && unmarked.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-900">
                        {unmarked.length} dialysis session{unmarked.length === 1 ? '' : 's'} not marked
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-amber-900/90">
                        Connect only calls about a session somebody marked missed — never an unmarked one, so nobody is
                        rung about a session they attended. Unmarked: {unmarkedDates.slice(0, 5).map(speakDate).join(' · ')}{unmarkedDates.length > 5 ? ` and ${unmarkedDates.length - 5} more day${unmarkedDates.length - 5 === 1 ? '' : 's'}` : ''}.
                    </p>
                    <Link to="/attendance" className="mt-2 inline-block text-xs font-bold text-amber-900 underline">Mark attendance →</Link>
                </Card>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
                {([['ready', `Ready (${ready.length})`], ['blocked', `Waiting (${items.length - ready.length})`], ['all', `All (${items.length})`]] as const).map(([k, label]) => (
                    <button
                        key={k} type="button" onClick={() => setFilter(k)}
                        className={cx('rounded-full border px-3 py-1 text-xs font-semibold', filter === k ? 'border-[#5FA01F] bg-[#F0F9E6] text-[#3F7A12]' : 'border-gray-200 bg-white text-gray-600')}
                    >
                        {label}
                    </button>
                ))}
                {labsNoBaseline > 0 && (
                    <span className="ml-auto text-[11px] text-gray-400">
                        {labsNoBaseline} patient{labsNoBaseline === 1 ? ' has' : 's have'} no lab record yet — record one on the patient to start lab reminders
                    </span>
                )}
            </div>

            {shown.length === 0 ? (
                <Empty title={filter === 'ready' ? 'Nobody is ready to call right now' : 'Nothing here'}>
                    {items.length === 0
                        ? 'No missed sessions, lab tests or reviews need a call today. Add patients and mark attendance, and this list fills itself.'
                        : 'Everyone on the list is waiting for a reason shown under "Waiting".'}
                </Empty>
            ) : (
                <Card className="divide-y divide-gray-100 overflow-hidden">
                    {shown.map(item => {
                        const p = patientsById.get(item.patientId);
                        return (
                            <div key={item.key} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', item.priority === 1 && 'bg-rose-50/40')}>
                                <div className="min-w-0 flex-1 basis-64">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-gray-900">{item.patientName}</span>
                                        {item.mrNumber && <span className="font-mono text-[11px] text-gray-400">{item.mrNumber}</span>}
                                        <Badge tone={REASON_TONE[item.reason]}>{REASON_LABEL[item.reason]}</Badge>
                                        {item.priority === 1 && <Badge tone="rose">Urgent</Badge>}
                                    </div>
                                    <p className="mt-0.5 text-sm text-gray-700">{item.title}</p>
                                    <p className="text-xs text-gray-500">{item.detail}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {item.callable ? (
                                        <>
                                            <span className="text-[11px] text-gray-400">{languageFor(item.patientId)}{p?.phoneE164 ? '' : ' · attender'}</span>
                                            <Button tone="primary" size="sm" onClick={() => onCall(item)} disabled={!!calling || !!batch}>
                                                {calling === item.key ? 'Calling…' : 'Call'}
                                            </Button>
                                        </>
                                    ) : (
                                        <span className="max-w-[220px] text-right text-xs text-gray-500">{item.blockedReason}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </Card>
            )}

            <div>
                <h2 className="mb-2 text-sm font-bold text-gray-800">Calls today</h2>
                {todays.length === 0 ? (
                    <p className="text-xs text-gray-400">No calls yet today.</p>
                ) : (
                    <Card className="divide-y divide-gray-100 overflow-hidden">
                        {todays.map(a => {
                            const p = patientsById.get(a.patientId);
                            const o = outcomeOf(a);
                            return (
                                <div key={a.id} className="px-4 py-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900">{p?.name || 'Patient'}</span>
                                        <Badge tone={o.tone}>{o.label}</Badge>
                                        <span className="text-[11px] text-gray-400">{CALL_PURPOSE_LABEL[a.purpose]} · {fmtWhen(a.createdAt)}</span>
                                        {a.callbackRequested && <Badge tone="amber">Callback asked</Badge>}
                                    </div>
                                    {(a.summary || a.failureReason) && (
                                        <p className="mt-1 text-xs leading-5 text-gray-600">
                                            {a.summary ? <><span className="font-semibold text-gray-500">Agent's account{a.spokeTo ? ` (spoke to ${a.spokeTo.toLowerCase()})` : ''}: </span>{a.summary}</> : a.failureReason}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </Card>
                )}
                <p className="mt-1.5 text-[11px] text-gray-400">
                    "Agent's account" is the voice agent's own summary of the call, not a transcript.
                </p>
            </div>

            <Modal
                open={confirmBatch} onClose={() => setConfirmBatch(false)} title={`Call ${ready.length} patient${ready.length === 1 ? '' : 's'}?`}
                footer={<><Button onClick={() => setConfirmBatch(false)}>Cancel</Button><Button tone="primary" onClick={runBatch}>Start calling</Button></>}
            >
                <p className="text-sm text-gray-600">Calls are placed one after another. Keep this tab open until it finishes; you can stop at any point.</p>
                <ul className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
                    {ready.map(i => (
                        <li key={i.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="font-medium text-gray-900">{i.patientName}</span>
                            <span className="text-xs text-gray-500">{CALL_PURPOSE_LABEL[i.purpose]} · {languageFor(i.patientId)}</span>
                        </li>
                    ))}
                </ul>
                {centre.dailyCap && <p className="mt-2 text-[11px] text-gray-400">Daily limit for this centre: {centre.dailyCap} calls.</p>}
            </Modal>
        </div>
    );
};

export default TodayScreen;
