/**
 * Patients — the centre's list, and everything the engine needs to know about
 * each person: programme, dialysis days, call language, who answers the phone,
 * when each lab was last done, and whether to leave them alone for now.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCentre } from '../session';
import {
    addPatient, fetchPatients, setCallHold, updatePatient, PATIENT_CAP,
    type ConnectPatient, type PatientInput,
} from '../services/patients';
import { fetchLabs, recordLab } from '../services/records';
import { localDateKey } from '../services/db';
import { describePhoneInput } from '../../utils/phoneUtils';
import { CALL_LANGUAGES, PROGRAMMES, type Programme } from '../protocol/settings';
import { addDays, type EngineLab } from '../protocol/engine';
import { SetupNotice } from '../ui/SetupNotice';
import { Badge, Button, Card, Empty, Field, Modal, Spinner, cx, DAY_LETTERS, fmtDate, fmtDays, inputCls } from '../ui/kit';
import ImportModal from './ImportModal';

const PhoneHint: React.FC<{ value: string }> = ({ value }) => {
    const v = describePhoneInput(value);
    if (v.kind === 'invalid') return <span className="mt-1 block text-[11px] text-rose-600">{v.message || 'This number will not dial.'}</span>;
    if (v.kind === 'valid') return <span className="mt-1 block text-[11px] text-[#4E8A18]">Dials {v.e164}</span>;
    return null;
};

const DayPicker: React.FC<{ value: number[]; onChange: (d: number[]) => void }> = ({ value, onChange }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        {DAY_LETTERS.map((l, i) => {
            const d = i + 1;
            const on = value.includes(d);
            return (
                <button
                    key={d} type="button" aria-pressed={on} title={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}
                    onClick={() => onChange(on ? value.filter(x => x !== d) : [...value, d].sort())}
                    className={cx('h-9 w-9 rounded-lg border text-sm font-bold', on ? 'border-[#5FA01F] bg-[#5FA01F] text-white' : 'border-gray-200 bg-white text-gray-600')}
                >
                    {l}
                </button>
            );
        })}
        <button type="button" onClick={() => onChange([1, 3, 5])} className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#3F7A12] hover:bg-[#F0F9E6]">MWF</button>
        <button type="button" onClick={() => onChange([2, 4, 6])} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#3F7A12] hover:bg-[#F0F9E6]">TTS</button>
    </div>
);

type Draft = PatientInput & { callHold: boolean; callHoldReason: string };

const draftOf = (p: ConnectPatient | null): Draft => ({
    name: p?.name || '',
    mrNumber: p?.mrNumber || '',
    age: p?.age || '',
    gender: p?.gender || '',
    phone: p?.phone || '',
    attenderName: p?.attenderName || '',
    attenderRelation: p?.attenderRelation || '',
    attenderPhone: p?.attenderPhone || '',
    place: p?.place || '',
    programme: p?.programme || null,
    dialysisDays: p?.dialysisDays || [],
    dialysisShift: p?.dialysisShift || '',
    preferredLanguage: p?.preferredLanguage || '',
    doctorName: '',
    reviewDate: '',
    callHold: p?.callHold || false,
    callHoldReason: p?.callHoldReason || '',
});

const PatientEditor: React.FC<{
    patient: ConnectPatient | null;
    labs: EngineLab[];
    onClose: () => void;
    onSaved: () => void;
}> = ({ patient, labs, onClose, onSaved }) => {
    const centre = useCentre();
    const [d, setD] = useState<Draft>(() => draftOf(patient));
    const [saving, setSaving] = useState(false);
    const [labDate, setLabDate] = useState<Record<string, string>>({});
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
    const isNew = !patient;

    const rules = useMemo(
        () => (d.programme ? centre.settings.labs.tests.filter(t => t.programmes.includes(d.programme as Programme)) : []),
        [d.programme, centre.settings.labs.tests]
    );
    const lastDone = (code: string) => labs.filter(l => l.patientId === patient?.id && l.testCode === code).map(l => l.doneOn).sort().pop() || null;

    const save = async () => {
        setSaving(true);
        try {
            const input: PatientInput = {
                ...d,
                dialysisDays: d.programme === 'dialysis' ? d.dialysisDays : [],
                reviewDate: d.reviewDate || null,
            };
            let id = patient?.id;
            if (isNew) {
                id = await addPatient(centre.id, input);
            } else {
                await updatePatient(centre.id, patient!.id, input);
            }
            if (id && (isNew ? d.callHold : d.callHold !== patient!.callHold || (d.callHold && d.callHoldReason !== (patient!.callHoldReason || '')))) {
                await setCallHold(centre.id, id, d.callHold, d.callHoldReason);
            }
            toast.success(isNew ? 'Patient added' : 'Saved');
            onSaved();
        } catch (e: any) {
            toast.error(e?.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    const saveLab = async (code: string) => {
        const on = labDate[code];
        if (!patient || !on) return;
        try {
            await recordLab(centre.id, patient.id, code, on);
            toast.success('Recorded');
            setLabDate(prev => ({ ...prev, [code]: '' }));
            onSaved();
        } catch (e: any) {
            toast.error(e?.message || 'Could not save');
        }
    };

    return (
        <Modal
            open onClose={onClose} wide title={isNew ? 'Add patient' : patient!.name}
            footer={<><Button onClick={onClose}>Cancel</Button><Button tone="primary" onClick={save} disabled={saving || !d.name.trim() || !d.mrNumber.trim()}>{saving ? 'Saving…' : isNew ? 'Add patient' : 'Save'}</Button></>}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Patient</p>
                    <Field label="Name *" hint="As it should be spoken on a call.">
                        <input className={inputCls} value={d.name} onChange={e => set('name', e.target.value)} />
                    </Field>
                    <Field label="Patient ID *" hint={isNew ? 'Your MR / UHID. It cannot be changed later.' : undefined}>
                        <input className={cx(inputCls, !isNew && 'bg-gray-50 text-gray-500')} value={d.mrNumber} disabled={!isNew} onChange={e => set('mrNumber', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Age"><input className={inputCls} value={d.age || ''} onChange={e => set('age', e.target.value)} /></Field>
                        <Field label="Gender">
                            <select className={inputCls} value={d.gender || ''} onChange={e => set('gender', e.target.value)}>
                                <option value="">—</option><option value="M">Male</option><option value="F">Female</option>
                            </select>
                        </Field>
                    </div>
                    <Field label="Phone">
                        <input className={inputCls} value={d.phone || ''} onChange={e => set('phone', e.target.value)} inputMode="tel" />
                        <PhoneHint value={d.phone || ''} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Attender"><input className={inputCls} value={d.attenderName || ''} onChange={e => set('attenderName', e.target.value)} placeholder="Name" /></Field>
                        <Field label="Relation"><input className={inputCls} value={d.attenderRelation || ''} onChange={e => set('attenderRelation', e.target.value)} placeholder="Son, daughter…" /></Field>
                    </div>
                    <Field label="Attender phone" hint="Dialled when the patient has no number.">
                        <input className={inputCls} value={d.attenderPhone || ''} onChange={e => set('attenderPhone', e.target.value)} inputMode="tel" />
                        <PhoneHint value={d.attenderPhone || ''} />
                    </Field>
                    <Field label="Place"><input className={inputCls} value={d.place || ''} onChange={e => set('place', e.target.value)} /></Field>
                </div>

                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Care and calls</p>
                    <Field label="Programme">
                        <select className={inputCls} value={d.programme || ''} onChange={e => set('programme', (e.target.value || null) as Programme | null)}>
                            <option value="">Not set</option>
                            {PROGRAMMES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                    </Field>
                    {d.programme === 'dialysis' && (
                        <>
                            <Field label="Dialysis days">
                                <DayPicker value={d.dialysisDays || []} onChange={v => set('dialysisDays', v)} />
                            </Field>
                            <Field label="Shift">
                                <input className={inputCls} value={d.dialysisShift || ''} onChange={e => set('dialysisShift', e.target.value)} placeholder="Morning / Afternoon / Night" />
                            </Field>
                        </>
                    )}
                    <Field label="Call language">
                        <select className={inputCls} value={d.preferredLanguage || ''} onChange={e => set('preferredLanguage', e.target.value)}>
                            <option value="">Centre default ({centre.settings.calls.defaultLanguage})</option>
                            {CALL_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Next review"><input type="date" className={inputCls} value={d.reviewDate || ''} onChange={e => set('reviewDate', e.target.value)} /></Field>
                        <Field label="With doctor"><input className={inputCls} value={d.doctorName || ''} onChange={e => set('doctorName', e.target.value)} placeholder="Optional" /></Field>
                    </div>
                    <div className="rounded-xl border border-gray-200 p-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <input type="checkbox" checked={d.callHold} onChange={e => set('callHold', e.target.checked)} />
                            Hold calls — not now
                        </label>
                        {d.callHold && (
                            <input className={cx(inputCls, 'mt-2')} value={d.callHoldReason} onChange={e => set('callHoldReason', e.target.value)} placeholder="Admitted elsewhere, travelling, bereavement…" />
                        )}
                        <p className="mt-1.5 text-[11px] text-gray-400">No calls are placed while this is on. Clear it to resume.</p>
                        {patient?.doNotCall && <p className="mt-1.5 text-[11px] font-semibold text-rose-600">This patient asked on a call not to be called again.</p>}
                    </div>

                    {!isNew && rules.length > 0 && (
                        <div className="rounded-xl border border-gray-200 p-3">
                            <p className="text-xs font-bold text-gray-700">Lab tests</p>
                            <p className="mb-2 text-[11px] text-gray-400">Record when each was last done. Reminders start once a test has a date.</p>
                            <div className="space-y-2">
                                {rules.map(r => {
                                    const last = lastDone(r.code);
                                    const due = last ? addDays(last, r.everyDays) : null;
                                    const overdue = !!due && due < localDateKey();
                                    return (
                                        <div key={r.code} className="flex flex-wrap items-center gap-2">
                                            <div className="min-w-0 flex-1 basis-40">
                                                <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                                                <p className={cx('text-[11px]', overdue ? 'text-rose-600' : 'text-gray-400')}>
                                                    {last ? `Last ${fmtDate(last)} · ${overdue ? 'overdue since' : 'due'} ${fmtDate(due)}` : 'No record'}
                                                </p>
                                            </div>
                                            <input
                                                type="date" max={localDateKey()} value={labDate[r.code] || ''}
                                                onChange={e => setLabDate(prev => ({ ...prev, [r.code]: e.target.value }))}
                                                className="h-[34px] rounded-lg border border-gray-200 px-2 text-xs"
                                            />
                                            <Button size="sm" onClick={() => saveLab(r.code)} disabled={!labDate[r.code]}>Done on</Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const PatientsScreen: React.FC = () => {
    const centre = useCentre();
    const [patients, setPatients] = useState<ConnectPatient[]>([]);
    const [labs, setLabs] = useState<EngineLab[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [q, setQ] = useState('');
    const [prog, setProg] = useState<'all' | Programme | 'none'>('all');
    const [editing, setEditing] = useState<ConnectPatient | null | 'new'>(null);
    const [importing, setImporting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ps, ls] = await Promise.all([fetchPatients(centre.id), fetchLabs(centre.id)]);
            setPatients(ps);
            setLabs(ls);
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [centre.id]);

    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => {
        const s = q.trim().toLowerCase();
        return patients.filter(p => {
            if (prog === 'none' ? !!p.programme : prog !== 'all' && p.programme !== prog) return false;
            if (!s) return true;
            return p.name.toLowerCase().includes(s)
                || (p.mrNumber || '').toLowerCase().includes(s)
                || (p.phone || '').includes(s)
                || (p.attenderName || '').toLowerCase().includes(s);
        });
    }, [patients, q, prog]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: patients.length, none: 0 };
        for (const p of patients) { const k = p.programme || 'none'; c[k] = (c[k] || 0) + 1; }
        return c;
    }, [patients]);

    if (loading && !patients.length) return <Spinner label="Loading patients…" />;
    if (error) return <SetupNotice error={error} />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Patients</h1>
                    <p className="text-sm text-gray-500">{patients.length} patient{patients.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setImporting(true)}>Import list</Button>
                    <Button tone="primary" onClick={() => setEditing('new')}>Add patient</Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <input className={cx(inputCls, 'max-w-xs')} placeholder="Search name, ID, phone, attender" value={q} onChange={e => setQ(e.target.value)} />
                {([['all', 'All'], ...PROGRAMMES.map(p => [p.id, p.label]), ['none', 'No programme']] as [string, string][]).map(([k, label]) => (
                    (k === 'all' || counts[k]) ? (
                        <button
                            key={k} type="button" onClick={() => setProg(k as any)}
                            className={cx('rounded-full border px-3 py-1 text-xs font-semibold', prog === k ? 'border-[#5FA01F] bg-[#F0F9E6] text-[#3F7A12]' : 'border-gray-200 bg-white text-gray-600')}
                        >
                            {label} · {counts[k] || 0}
                        </button>
                    ) : null
                ))}
            </div>

            {patients.length === 0 ? (
                <Empty title="No patients yet">
                    Import the list your hospital system exports (CSV or Excel), paste one sent on WhatsApp, or add patients one at a time.
                </Empty>
            ) : shown.length === 0 ? (
                <Empty title="No patients match" />
            ) : (
                <Card className="overflow-hidden">
                    <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 md:grid">
                        <span>Patient</span><span>Programme</span><span>Phone</span><span>Calls</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {shown.map(p => (
                            <button
                                key={p.id} type="button" onClick={() => setEditing(p)}
                                className="grid w-full grid-cols-1 gap-1 px-4 py-2.5 text-left hover:bg-gray-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:gap-3"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-gray-900">{p.name}</span>
                                    <span className="block font-mono text-[11px] text-gray-400">{p.mrNumber}</span>
                                </span>
                                <span className="text-xs text-gray-700">
                                    {p.programme ? PROGRAMMES.find(x => x.id === p.programme)?.label : <span className="text-gray-400">—</span>}
                                    {p.programme === 'dialysis' && <span className="ml-1 text-gray-400">{fmtDays(p.dialysisDays)}</span>}
                                </span>
                                <span className="text-xs text-gray-600">
                                    {p.phoneE164 || (p.attenderPhoneE164 ? <>{p.attenderPhoneE164} <span className="text-gray-400">(attender)</span></> : <span className="text-rose-600">No number</span>)}
                                </span>
                                <span className="flex flex-wrap gap-1">
                                    {p.isDeceased && <Badge tone="gray">Deceased</Badge>}
                                    {p.stopped && <Badge tone="gray">Left programme</Badge>}
                                    {p.doNotCall && <Badge tone="rose">Do not call</Badge>}
                                    {p.callHold && <Badge tone="amber">On hold</Badge>}
                                    {!p.isDeceased && !p.stopped && !p.doNotCall && !p.callHold && (
                                        p.phoneE164 || p.attenderPhoneE164
                                            ? <Badge tone="green">{p.preferredLanguage || centre.settings.calls.defaultLanguage}</Badge>
                                            : <Badge tone="gray">Cannot be called</Badge>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </Card>
            )}
            {patients.length >= PATIENT_CAP && (
                <p className="text-xs text-rose-600">Showing the first {PATIENT_CAP} patients. Tell BeanHealth — this centre has outgrown one list.</p>
            )}

            {editing && (
                <PatientEditor
                    patient={editing === 'new' ? null : editing}
                    labs={labs}
                    onClose={() => setEditing(null)}
                    onSaved={() => { load(); if (editing === 'new') setEditing(null); }}
                />
            )}
            {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
        </div>
    );
};

export default PatientsScreen;
