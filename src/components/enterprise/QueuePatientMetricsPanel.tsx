/**
 * QueuePatientMetricsPanel — live-queue patient metrics
 * ─────────────────────────────────────────────────────
 * Replaces the old read-only "Patient App metrics" block. The doctor (or their
 * assistant) can now record metrics directly before prescribing, and review the
 * history either as a table or as a chart.
 *
 *   • Record  — BP / glucose / weight / fluid / salt / urine for a chosen date
 *   • Latest  — snapshot cards from the metrics profile
 *   • History — date-wise table  ⇄  trend chart (toggle)
 *
 * Entry writes to the same hospital-scoped tables the patient app uses, so
 * clinician-entered and patient-submitted values live on one timeline.
 */
import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    saveQueuePatientMetrics,
    type QueuePatientMetricsSnapshot,
} from '../../services/departmentPatientMetricsService';

const todayKey = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtDate = (value: string): string => {
    try {
        return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return value; }
};

const fmtShort = (value: string): string => {
    try {
        return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch { return value; }
};

const fmtTimestamp = (value: string | null): string => {
    if (!value) return 'No updates yet';
    try {
        return `Updated ${new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch { return 'No updates yet'; }
};

const emptyForm = {
    date: todayKey(),
    systole: '', diastole: '', glucose: '', glucoseType: 'random',
    weight: '', fluid: '', salt: '', urine: '',
};

/** Chart series the user can switch between. */
const CHART_SERIES = [
    { key: 'bp', label: 'Blood Pressure', unit: 'mmHg', lines: [
        { dataKey: 'systole', name: 'Systolic', color: '#e11d48' },
        { dataKey: 'diastole', name: 'Diastolic', color: '#fb7185' },
    ] },
    { key: 'glucose', label: 'Glucose', unit: 'mg/dL', lines: [{ dataKey: 'glucose', name: 'Glucose', color: '#7c3aed' }] },
    { key: 'weight', label: 'Weight', unit: 'kg', lines: [{ dataKey: 'weight', name: 'Weight', color: '#0891b2' }] },
    { key: 'fluid', label: 'Fluid Intake', unit: 'ml', lines: [{ dataKey: 'fluidMl', name: 'Fluid', color: '#2563eb' }] },
    { key: 'salt', label: 'Salt Intake', unit: 'g', lines: [{ dataKey: 'saltGm', name: 'Salt', color: '#d97706' }] },
    { key: 'urine', label: 'Urine Output', unit: 'ml', lines: [{ dataKey: 'urineMl', name: 'Urine', color: '#059669' }] },
] as const;

interface Props {
    hospitalId: string;
    patientId: string;
    patientName?: string;
    appAccessEnabled?: boolean;
    metrics?: QueuePatientMetricsSnapshot | null;
    /** Called after a successful save so the parent can refetch the snapshot. */
    onSaved?: () => void;
    /** Which source the shown history came from, and how to change it. */
    source?: 'opd' | 'patient_app';
    onSourceChange?: (source: 'opd' | 'patient_app') => void;
}

const QueuePatientMetricsPanel: React.FC<Props> = ({
    hospitalId, patientId, appAccessEnabled, metrics, onSaved,
    source = 'opd', onSourceChange,
}) => {
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [historyView, setHistoryView] = useState<'table' | 'graph'>('table');
    const [chartKey, setChartKey] = useState<string>('bp');
    // The entry form stays minimised by default — it only opens on demand and
    // re-collapses after a successful save.
    const [formOpen, setFormOpen] = useState(false);
    const [confirmEdit, setConfirmEdit] = useState(false);

    const set = (k: keyof typeof emptyForm, v: string) => setForm(f => ({ ...f, [k]: v }));

    /** The already-recorded entry for the date currently chosen in the form. */
    const selectedDayRecord = useMemo(
        () => metrics?.timelineDays.find(d => d.date === form.date) || null,
        [metrics, form.date]
    );
    const selectedDateHasData = Boolean(selectedDayRecord?.hasAnyData);

    /** Opening on a date that already has values asks first, so nothing is overwritten blindly. */
    const requestOpenForm = () => {
        if (selectedDateHasData) setConfirmEdit(true);
        else setFormOpen(true);
    };

    /** Load the day's stored values so "edit" starts from what's there. */
    const beginEdit = () => {
        const raw = selectedDayRecord?.raw;
        setForm(f => ({
            ...f,
            systole: raw?.systole != null ? String(raw.systole) : '',
            diastole: raw?.diastole != null ? String(raw.diastole) : '',
            glucose: raw?.glucose != null ? String(raw.glucose) : '',
            weight: raw?.weight != null ? String(raw.weight) : '',
            fluid: raw?.fluidMl != null ? String(raw.fluidMl) : '',
            salt: raw?.saltGm != null ? String(raw.saltGm) : '',
            urine: '', // append-only — a value here adds another reading, never replaces
        }));
        setConfirmEdit(false);
        setFormOpen(true);
    };

    /** Compact one-line summary shown while the form is collapsed. */
    const collapsedSummary = useMemo(() => {
        const d = selectedDayRecord;
        if (!d || !d.hasAnyData) return null;
        const bits: string[] = [];
        if (d.bloodPressure !== '--') bits.push(`BP ${d.bloodPressure}`);
        if (d.bloodGlucose !== '--') bits.push(`Glucose ${d.bloodGlucose}`);
        if (d.weight !== '--') bits.push(`Wt ${d.weight} kg`);
        if (d.fluidIntake !== '--') bits.push(`Fluid ${d.fluidIntake} ml`);
        if (d.saltIntake !== '--') bits.push(`Salt ${d.saltIntake} g`);
        if (d.urineOutput !== '--') bits.push(`Urine ${d.urineOutput} ml`);
        return bits.join(' · ');
    }, [selectedDayRecord]);

    const num = (v: string): number | null => {
        const t = v.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    };

    const handleSave = async () => {
        // Reject negatives/zero up front — the DB rejects non-positive urine and
        // silently ignoring bad input would look like a failed save.
        const numericFields: [string, string][] = [
            ['BP systolic', form.systole], ['BP diastolic', form.diastole],
            ['Glucose', form.glucose], ['Weight', form.weight],
            ['Fluid intake', form.fluid], ['Salt intake', form.salt], ['Urine output', form.urine],
        ];
        for (const [label, raw] of numericFields) {
            const t = raw.trim();
            if (!t) continue;
            const n = Number(t);
            if (!Number.isFinite(n)) {
                toast.error(`${label} must be a number`);
                return;
            }
            if (n <= 0) {
                toast.error(`${label} must be greater than 0`);
                return;
            }
        }

        const payload = {
            hospitalId,
            patientId,
            recordedDate: form.date || todayKey(),
            systole: num(form.systole),
            diastole: num(form.diastole),
            glucose: num(form.glucose),
            glucoseType: form.glucoseType as 'fasting' | 'post_meal' | 'random',
            weight: num(form.weight),
            fluidMl: num(form.fluid),
            saltGm: num(form.salt),
            urineMl: num(form.urine),
        };

        const hasAny = [payload.systole, payload.diastole, payload.glucose, payload.weight,
            payload.fluidMl, payload.saltGm, payload.urineMl].some(v => v !== null);
        if (!hasAny) {
            toast.error('Enter at least one metric');
            return;
        }
        // BP is only meaningful as a pair
        if ((payload.systole === null) !== (payload.diastole === null)) {
            toast.error('Enter both systolic and diastolic values');
            return;
        }

        setSaving(true);
        try {
            await saveQueuePatientMetrics(payload);
            toast.success('Metrics saved');
            setForm({ ...emptyForm, date: form.date });
            setFormOpen(false); // collapse once the day is recorded
            onSaved?.();
        } catch (err: any) {
            console.error('Save metrics failed:', err);
            toast.error(err?.message || 'Could not save metrics');
        } finally {
            setSaving(false);
        }
    };

    // Chart wants oldest → newest; the timeline is stored newest first
    const chartData = useMemo(() => {
        const days = metrics?.timelineDays || [];
        return [...days].reverse().map(d => ({
            date: fmtShort(d.date),
            systole: d.raw?.systole ?? null,
            diastole: d.raw?.diastole ?? null,
            glucose: d.raw?.glucose ?? null,
            weight: d.raw?.weight ?? null,
            fluidMl: d.raw?.fluidMl ?? null,
            saltGm: d.raw?.saltGm ?? null,
            urineMl: d.raw?.urineMl ?? null,
        }));
    }, [metrics]);

    const activeSeries = CHART_SERIES.find(s => s.key === chartKey) || CHART_SERIES[0];
    const hasChartData = chartData.some(row =>
        activeSeries.lines.some(l => (row as any)[l.dataKey] !== null && (row as any)[l.dataKey] !== undefined));

    const inputCls = 'w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none';
    const labelCls = 'text-[10px] font-bold text-slate-500 uppercase tracking-wide';

    return (
        <div className="space-y-4">
            {/* ── Record metrics ─────────────────────────────────────── */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Record Metrics</p>
                        {!formOpen && (
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                {collapsedSummary
                                    ? <><span className="font-semibold text-emerald-700">Recorded</span> · {collapsedSummary}</>
                                    : <span className="text-slate-500">Nothing recorded for this date yet.</span>}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className={labelCls}>Date</label>
                        <input
                            type="date"
                            value={form.date}
                            max={todayKey()}
                            onChange={e => { set('date', e.target.value); setConfirmEdit(false); setFormOpen(false); }}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-400"
                        />
                        {!formOpen && (
                            <button
                                type="button"
                                onClick={requestOpenForm}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
                            >
                                {selectedDateHasData ? 'Edit Metrics' : 'Record Metrics'}
                            </button>
                        )}
                        {formOpen && (
                            <button
                                type="button"
                                onClick={() => setFormOpen(false)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>

                {/* Guard against silently overwriting a day that already has values */}
                {confirmEdit && !formOpen && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-amber-900 font-medium flex-1 min-w-0">
                            Metrics are already recorded for {fmtDate(form.date)}. Do you want to edit them?
                        </p>
                        <button type="button" onClick={() => setConfirmEdit(false)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                            Cancel
                        </button>
                        <button type="button" onClick={beginEdit}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700">
                            Yes, Edit
                        </button>
                    </div>
                )}

                {formOpen && (
                <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 mt-3">
                    <div>
                        <label className={labelCls}>BP Systolic</label>
                        <input type="number" inputMode="numeric" value={form.systole}
                            onChange={e => set('systole', e.target.value)} placeholder="120" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>BP Diastolic</label>
                        <input type="number" inputMode="numeric" value={form.diastole}
                            onChange={e => set('diastole', e.target.value)} placeholder="80" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Glucose (mg/dL)</label>
                        <input type="number" inputMode="decimal" value={form.glucose}
                            onChange={e => set('glucose', e.target.value)} placeholder="110" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Glucose Type</label>
                        <select value={form.glucoseType} onChange={e => set('glucoseType', e.target.value)} className={inputCls}>
                            <option value="random">Random</option>
                            <option value="fasting">Fasting</option>
                            <option value="post_meal">Post Meal</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Weight (kg)</label>
                        <input type="number" inputMode="decimal" step="0.1" value={form.weight}
                            onChange={e => set('weight', e.target.value)} placeholder="80.0" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Fluid Intake (ml)</label>
                        <input type="number" inputMode="numeric" value={form.fluid}
                            onChange={e => set('fluid', e.target.value)} placeholder="1500" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Salt Intake (g)</label>
                        <input type="number" inputMode="decimal" step="0.1" value={form.salt}
                            onChange={e => set('salt', e.target.value)} placeholder="5.0" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Urine Output (ml)</label>
                        <input type="number" inputMode="numeric" value={form.urine}
                            onChange={e => set('urine', e.target.value)} placeholder="1200" className={inputCls} />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Saving…' : 'Save Metrics'}
                    </button>
                    <span className="text-[11px] text-slate-500">
                        Blank fields are ignored. Urine output adds a new reading; other values correct the day’s entry.
                    </span>
                </div>
                </>
                )}
            </div>

            {/* ── Latest snapshot ────────────────────────────────────── */}
            {metrics && metrics.sections.length > 0 && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                            {metrics.profileLabel}
                        </div>
                        <div className="text-xs font-medium text-slate-500">{fmtTimestamp(metrics.lastUpdatedAt)}</div>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {metrics.sections.map(section => (
                            <div key={section.key} className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{section.title}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {section.cards.map(card => (
                                        <div key={card.key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{card.label}</div>
                                            <div className={`mt-1 text-base font-bold ${card.value === '--' ? 'text-slate-400' : 'text-slate-900'}`}>
                                                {card.value}
                                                {card.unit && <span className="ml-1 text-xs font-semibold text-slate-500">{card.unit}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ── History: table ⇄ graph ─────────────────────────────── */}
            {metrics && metrics.timelineDays.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {source === 'opd' ? 'OPD Recorded History' : 'Patient App History'}
                            </div>
                            <div className="text-sm font-semibold text-slate-800 mt-0.5">
                                {`${fmtDate(metrics.timelineEndDate)} to ${fmtDate(metrics.timelineStartDate)} (latest to oldest)`}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {onSourceChange && (
                                <div className="inline-flex p-0.5 bg-slate-200/70 rounded-lg">
                                    {([['opd', 'OPD'], ['patient_app', 'Patient App']] as const).map(([key, label]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => onSourceChange(key)}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${source === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                                {metrics.timelineDays.length} days
                            </span>
                            <div className="inline-flex p-0.5 bg-slate-200/70 rounded-lg">
                                {(['table', 'graph'] as const).map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setHistoryView(v)}
                                        className={`px-3 py-1 rounded-md text-xs font-bold capitalize transition-colors ${historyView === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {historyView === 'table' ? (
                        <div className="overflow-x-auto">
                            <div className="min-w-[860px]">
                                <div className="grid grid-cols-[130px_120px_170px_90px_110px_100px_110px] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/70">
                                    <span>Date</span><span>BP</span><span>Glucose</span><span>Weight</span>
                                    <span>Fluid</span><span>Salt</span><span>Urine</span>
                                </div>
                                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                    {metrics.timelineDays.map(day => (
                                        <div key={day.date}
                                            className={`grid grid-cols-[130px_120px_170px_90px_110px_100px_110px] px-4 py-2.5 text-sm ${day.hasAnyData ? 'bg-white' : 'bg-slate-50/40'}`}>
                                            <div className="font-semibold text-slate-800">{fmtDate(day.date)}</div>
                                            <div className={day.bloodPressure === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}>
                                                {day.bloodPressure === '--' ? '--' : `${day.bloodPressure} mmHg`}
                                            </div>
                                            <div className={day.bloodGlucose === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}>
                                                {day.bloodGlucose === '--' ? '--'
                                                    : day.bloodGlucoseType && day.bloodGlucoseType !== '--'
                                                        ? `${day.bloodGlucose} mg/dL (${day.bloodGlucoseType})`
                                                        : `${day.bloodGlucose} mg/dL`}
                                            </div>
                                            <div className={day.weight === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}>
                                                {day.weight === '--' ? '--' : `${day.weight} kg`}
                                            </div>
                                            <div className={day.fluidIntake === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}>
                                                {day.fluidIntake === '--' ? '--' : `${day.fluidIntake} ml`}
                                            </div>
                                            <div className={day.saltIntake === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}>
                                                {day.saltIntake === '--' ? '--' : `${day.saltIntake} g`}
                                            </div>
                                            <div className={day.urineOutput === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}>
                                                {day.urineOutput === '--' ? '--' : `${day.urineOutput} ml`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {CHART_SERIES.map(s => (
                                    <button
                                        key={s.key}
                                        type="button"
                                        onClick={() => setChartKey(s.key)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${chartKey === s.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                            {hasChartData ? (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={8} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={48}
                                                label={{ value: activeSeries.unit, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }} />
                                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            {activeSeries.lines.map(l => (
                                                <Line key={l.dataKey} type="monotone" dataKey={l.dataKey} name={l.name}
                                                    stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 text-center py-16">No {activeSeries.label.toLowerCase()} recorded in this range.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Informational only — entry above always works, app access just affects patient-submitted data */}
            {appAccessEnabled === false && (
                <p className="text-[11px] text-slate-500">
                    Patient App access is off for this patient, so they cannot submit their own readings. Metrics recorded here are unaffected.
                </p>
            )}
        </div>
    );
};

export default QueuePatientMetricsPanel;
