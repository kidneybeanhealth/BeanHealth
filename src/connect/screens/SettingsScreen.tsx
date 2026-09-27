/**
 * Settings — the centre's protocol, call setup, and who gets alerts.
 *
 * Editable by the centre: the rules (lookback, lead days, lab intervals), call
 * language, front-desk number, daily limit, and the alert contacts.
 *
 * NOT editable here: which call types the voice agent can place. Enabling
 * "missed session" before its script exists on the agent would dial patients
 * with the review-reminder script — a wrong call, the thing this whole product
 * is built to avoid. So `calls.purposesReady` is shown read-only and preserved
 * on save exactly as BeanHealth set it (see docs/CONNECT.md).
 */
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCentre, useConnectSession } from '../session';
import { saveCentreSettings } from '../services/centre';
import { CALL_LANGUAGES, CALL_PURPOSES, CALL_PURPOSE_LABEL, PROGRAMMES, type ConnectSettings, type LabTestRule, type Programme } from '../protocol/settings';
import { Badge, Button, Card, Field, cx, inputCls } from '../ui/kit';

const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const codeFor = (label: string, taken: string[]) => {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'test';
    let c = base, i = 2;
    while (taken.includes(c)) c = `${base}_${i++}`;
    return c;
};
const digitsOnly = (v: string) => v.replace(/\D/g, '');

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
    <Card className="p-5">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-5 text-gray-500">{hint}</p>}
        <div className="mt-4">{children}</div>
    </Card>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        {label}
    </label>
);

const SettingsScreen: React.FC = () => {
    const centre = useCentre();
    const { reloadCentre } = useConnectSession();
    const [s, setS] = useState<ConnectSettings>(() => structuredClone(centre.settings));
    const [frontDesk, setFrontDesk] = useState(centre.frontDeskNumber || '');
    const [address, setAddress] = useState(centre.address || '');
    const [dailyCap, setDailyCap] = useState(String(centre.dailyCap ?? 200));
    const [saving, setSaving] = useState(false);
    const [newTest, setNewTest] = useState({ label: '', everyDays: '30', programmes: ['dialysis'] as Programme[] });

    const patch = <K extends keyof ConnectSettings>(section: K, p: Partial<ConnectSettings[K]>) =>
        setS(prev => ({ ...prev, [section]: { ...prev[section], ...p } }));

    const setTest = (code: string, p: Partial<LabTestRule>) =>
        patch('labs', { tests: s.labs.tests.map(t => (t.code === code ? { ...t, ...p } : t)) });

    const addTest = () => {
        const label = newTest.label.trim();
        if (!label || !newTest.programmes.length) return;
        const code = codeFor(label, s.labs.tests.map(t => t.code));
        patch('labs', { tests: [...s.labs.tests, { code, label, everyDays: num(newTest.everyDays, 1, 730, 30), programmes: newTest.programmes }] });
        setNewTest({ label: '', everyDays: '30', programmes: ['dialysis'] });
    };

    const save = async () => {
        setSaving(true);
        try {
            // Call types are BeanHealth's to switch on, never the form's.
            const toSave: ConnectSettings = { ...s, calls: { ...s.calls, purposesReady: centre.settings.calls.purposesReady } };
            await saveCentreSettings(centre.id, toSave, {
                frontDeskNumber: frontDesk, address, dailyCap: num(dailyCap, 1, 2000, centre.dailyCap ?? 200),
            });
            await reloadCentre();
            toast.success('Settings saved');
        } catch (e: any) {
            toast.error(e?.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    const allPurposes = CALL_PURPOSES;

    return (
        <div className="space-y-4 pb-20">
            <div>
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">The rules Connect follows for {centre.name}.</p>
            </div>

            <Section title="Calls" hint="The front-desk number is read out on the call when a patient reports a red-flag symptom. Calls are refused while it is empty.">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Default call language" hint="Used when a patient has none set.">
                        <select className={inputCls} value={s.calls.defaultLanguage} onChange={e => patch('calls', { defaultLanguage: e.target.value })}>
                            {CALL_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </Field>
                    <Field label="Front-desk number">
                        <input className={inputCls} value={frontDesk} onChange={e => setFrontDesk(e.target.value)} placeholder="0422 2494333" />
                    </Field>
                    <Field label="Centre address" hint="Spoken when a patient asks where to come.">
                        <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} />
                    </Field>
                    <Field label="Daily call limit" hint="A safety limit on calls per day.">
                        <input className={inputCls} inputMode="numeric" value={dailyCap} onChange={e => setDailyCap(e.target.value)} />
                    </Field>
                    <Field label="Wait before retrying (hours)" hint="After an unanswered call.">
                        <input className={inputCls} inputMode="numeric" value={s.calls.retryAfterHours} onChange={e => patch('calls', { retryAfterHours: num(e.target.value, 1, 168, 20) })} />
                    </Field>
                    <Field label="Attempts before handing to a person">
                        <input className={inputCls} inputMode="numeric" value={s.calls.maxAttemptsPerItem} onChange={e => patch('calls', { maxAttemptsPerItem: num(e.target.value, 1, 10, 2) })} />
                    </Field>
                </div>
                <div className="mt-4 rounded-xl bg-gray-50 p-3">
                    <p className="text-xs font-bold text-gray-700">Call types the voice agent can make</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {allPurposes.map(p => (
                            <Badge key={p} tone={centre.settings.calls.purposesReady.includes(p) ? 'green' : 'gray'}>
                                {CALL_PURPOSE_LABEL[p]} · {centre.settings.calls.purposesReady.includes(p) ? 'ready' : 'not set up yet'}
                            </Badge>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-gray-500">
                        Each call type needs its own script on the voice agent. BeanHealth switches a type on once its script is live —
                        until then those patients stay on the Today list, marked "not set up", for a person to ring.
                    </p>
                </div>
            </Section>

            <Section title="Missed dialysis sessions" hint="Only sessions marked Missed on the Attendance tab lead to a call — never an unmarked one.">
                <Toggle checked={s.missedSession.enabled} onChange={v => patch('missedSession', { enabled: v })} label="Call patients who miss a session" />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Look back (days)" hint="A miss older than this is left for a person.">
                        <input className={inputCls} inputMode="numeric" value={s.missedSession.lookbackDays} onChange={e => patch('missedSession', { lookbackDays: num(e.target.value, 1, 30, 7) })} />
                    </Field>
                    <Field label="Urgent after (missed in a row)" hint="Moves to the top and marked urgent.">
                        <input className={inputCls} inputMode="numeric" value={s.missedSession.streakAlertAt} onChange={e => patch('missedSession', { streakAlertAt: num(e.target.value, 1, 10, 2) })} />
                    </Field>
                </div>
            </Section>

            <Section title="Reviews">
                <Toggle checked={s.review.enabled} onChange={v => patch('review', { enabled: v })} label="Remind patients about reviews" />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Remind this many days before">
                        <input className={inputCls} inputMode="numeric" value={s.review.leadDays} onChange={e => patch('review', { leadDays: num(e.target.value, 0, 14, 1) })} />
                    </Field>
                    <Field label="Stop calling after (days overdue)" hint="Past this, a reminder cannot fix it — a person should look.">
                        <input className={inputCls} inputMode="numeric" value={s.review.overdueWindowDays} onChange={e => patch('review', { overdueWindowDays: num(e.target.value, 1, 180, 30) })} />
                    </Field>
                </div>
            </Section>

            <Section
                title="Lab tests"
                hint="These intervals are starting points, not clinical guidance. Your nephrologist should confirm every one before calls are placed on the strength of them."
            >
                <Toggle checked={s.labs.enabled} onChange={v => patch('labs', { enabled: v })} label="Remind patients when tests are due" />
                <Field label="Remind this many days before a test is due" className="mt-3 max-w-xs">
                    <input className={inputCls} inputMode="numeric" value={s.labs.leadDays} onChange={e => patch('labs', { leadDays: num(e.target.value, 0, 30, 3) })} />
                </Field>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                            <tr><th className="px-3 py-2">Test</th><th className="px-3 py-2">Every (days)</th><th className="px-3 py-2">Programmes</th><th className="px-3 py-2" /></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {s.labs.tests.map(t => (
                                <tr key={t.code}>
                                    <td className="px-3 py-2">
                                        <input className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm" value={t.label} onChange={e => setTest(t.code, { label: e.target.value })} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm" inputMode="numeric" value={t.everyDays}
                                            onChange={e => setTest(t.code, { everyDays: num(e.target.value, 1, 730, t.everyDays) })} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1">
                                            {PROGRAMMES.filter(p => p.id !== 'general').map(p => {
                                                const on = t.programmes.includes(p.id);
                                                return (
                                                    <button key={p.id} type="button"
                                                        onClick={() => setTest(t.code, { programmes: on ? t.programmes.filter(x => x !== p.id) : [...t.programmes, p.id] })}
                                                        className={cx('rounded-full border px-2 py-0.5 text-[11px] font-semibold', on ? 'border-[#5FA01F] bg-[#F0F9E6] text-[#3F7A12]' : 'border-gray-200 text-gray-500')}>
                                                        {p.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <button type="button" onClick={() => patch('labs', { tests: s.labs.tests.filter(x => x.code !== t.code) })} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Field label="Add a test" className="min-w-[200px] flex-1">
                        <input className={inputCls} value={newTest.label} onChange={e => setNewTest(v => ({ ...v, label: e.target.value }))} placeholder="e.g. Hepatitis B antibody" />
                    </Field>
                    <Field label="Every (days)" className="w-28">
                        <input className={inputCls} inputMode="numeric" value={newTest.everyDays} onChange={e => setNewTest(v => ({ ...v, everyDays: e.target.value }))} />
                    </Field>
                    <Button onClick={addTest} disabled={!newTest.label.trim()}>Add</Button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">New tests apply to Dialysis; change the programmes in the table after adding. Removing a test stops its reminders but keeps the records already entered.</p>
            </Section>

            <Section title="Alerts" hint="Red flags and callback requests can be forwarded to these numbers on WhatsApp in one tap from the Alerts tab. Staff numbers only.">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Coordinator name"><input className={inputCls} value={s.alerts.coordinatorName} onChange={e => patch('alerts', { coordinatorName: e.target.value })} /></Field>
                    <Field label="Coordinator WhatsApp" hint="With country code, e.g. 919876543210.">
                        <input className={inputCls} inputMode="tel" value={s.alerts.coordinatorWhatsApp} onChange={e => patch('alerts', { coordinatorWhatsApp: digitsOnly(e.target.value) })} />
                    </Field>
                    <Field label="Doctor name"><input className={inputCls} value={s.alerts.doctorName} onChange={e => patch('alerts', { doctorName: e.target.value })} /></Field>
                    <Field label="Doctor WhatsApp"><input className={inputCls} inputMode="tel" value={s.alerts.doctorWhatsApp} onChange={e => patch('alerts', { doctorWhatsApp: digitsOnly(e.target.value) })} /></Field>
                </div>
            </Section>

            <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto flex max-w-6xl justify-end">
                    <Button tone="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
                </div>
            </div>
        </div>
    );
};

export default SettingsScreen;
