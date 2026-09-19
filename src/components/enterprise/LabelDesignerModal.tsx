/**
 * LabelDesignerModal — calibrate and print the case-record label
 *
 * The exact label stock is a guess until someone at the desk prints one and
 * looks at it. That is not a failure of research; it is what happened with the
 * token printer, where no amount of measuring matched the physical roll and the
 * thing that finally worked was a control the receptionist could nudge. So this
 * screen hands every dimension over: stock size, margins, a whole-label offset
 * for a printer that feeds off-register, each text size, and the barcode's bar
 * width in printer dots.
 *
 * The preview is built by the same `buildLabelSvg` that the printer gets, so
 * what is on screen cannot drift from what comes out.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    DEFAULT_LABEL_SETTINGS, DOT_MM, buildLabelSvg, printLabels,
    type LabelPatient, type LabelSettings,
} from './patientLabel';
import {
    LabelColumnsMissingError, fetchTodayRegistrations, searchPatientsForLabel, updatePatientLabelDetails,
    type LabelCandidate,
} from '../../services/labelPrintService';

interface Props {
    isOpen: boolean;
    hospitalId: string;
    onClose: () => void;
    settings: LabelSettings;
    onSave: (s: LabelSettings) => Promise<void> | void;
    isSaving?: boolean;
    /** Print a real patient instead of the sample when opened from a card. */
    patient?: LabelPatient | null;
}

const SAMPLE: LabelPatient = {
    mrNumber: 'KNH/26/022020',
    name: 'JAGANNATHAN.G',
    age: 54,
    gender: 'Male',
    phone: '99949 81419',
    altPhone: '90436 17616',
    fatherHusbandName: 'Mr.Govindaraju',
    place: 'NO:B1, Samudhra Appartment, 6th Street, Periyarnagar',
    addressLine2: 'Marudhamalai Road, Vadavalli',
    cityPincode: 'Coimbatore - 641 041',
    registeredAt: new Date().toISOString(),
};

/** A labelled number control. Slider for feel, box for a value they were told. */
const Num: React.FC<{
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; unit?: string; hint?: string;
}> = ({ label, value, min, max, step, onChange, unit = 'mm', hint }) => (
    <div className="py-1.5">
        <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-semibold text-gray-600">{label}</label>
            <div className="flex items-center gap-1">
                <input
                    type="number" value={value} min={min} max={max} step={step}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-16 px-1.5 py-0.5 text-xs text-right border border-gray-200 rounded"
                />
                <span className="text-[10px] text-gray-400 w-5">{unit}</span>
            </div>
        </div>
        <input
            type="range" value={value} min={min} max={max} step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 mt-1 accent-orange-500"
        />
        {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">{title}</h4>
        {children}
    </div>
);

const LabelDesignerModal: React.FC<Props> = ({ isOpen, hospitalId, onClose, settings, onSave, isSaving = false, patient }) => {
    const [draft, setDraft] = useState<LabelSettings>(settings);
    const [zoom, setZoom] = useState(1.6);
    const [useSample, setUseSample] = useState(!patient);

    const set = <K extends keyof LabelSettings>(k: K, v: LabelSettings[K]) =>
        setDraft(prev => ({ ...prev, [k]: v }));

    // ── Batch ────────────────────────────────────────────────────────────────
    // Labels come off a roll one at a time, so a batch is just more pages. The
    // only thing missing was a way to say which patients.
    const [mode, setMode] = useState<'layout' | 'batch'>('layout');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LabelCandidate[]>([]);
    const [searching, setSearching] = useState(false);
    const [picked, setPicked] = useState<LabelCandidate[]>([]);

    useEffect(() => {
        if (mode !== 'batch' || query.trim().length < 2) { setResults([]); return; }
        let cancelled = false;
        setSearching(true);
        const t = window.setTimeout(() => {
            searchPatientsForLabel(hospitalId, query)
                .then(r => { if (!cancelled) setResults(r); })
                .catch((e: any) => { if (!cancelled) toast.error(e?.message || 'Could not search patients'); })
                .finally(() => { if (!cancelled) setSearching(false); });
        }, 300);
        return () => { cancelled = true; window.clearTimeout(t); };
    }, [mode, query, hospitalId]);

    const addMany = useCallback((rows: LabelCandidate[]) => {
        setPicked(prev => {
            const seen = new Set(prev.map(p => p.id));
            // An MR number is what gets barcoded, so a row without one cannot
            // produce a usable label and is dropped rather than printed blank.
            const add = rows.filter(r => r.mrNumber && !seen.has(r.id));
            return [...prev, ...add];
        });
    }, []);

    const loadToday = async () => {
        try {
            const rows = await fetchTodayRegistrations(hospitalId);
            const usable = rows.filter(r => r.mrNumber);
            if (usable.length === 0) { toast('Nobody registered today yet', { icon: '\u2139\uFE0F' }); return; }
            addMany(usable);
            const skipped = rows.length - usable.length;
            toast.success(`Added ${usable.length} from today${skipped ? ` · ${skipped} without an MR number skipped` : ''}`);
        } catch (e: any) {
            toast.error(e?.message || 'Could not load today\u2019s registrations');
        }
    };

    // The patient currently open in the template. `form` is the live draft, so the
    // preview redraws as the receptionist types rather than after a save — the
    // point of editing here instead of in a separate dialog is seeing the label.
    const [form, setForm] = useState<LabelCandidate | null>(null);
    const [savingRow, setSavingRow] = useState(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    const focusIndex = form ? picked.findIndex(p => p.id === form.id) : -1;
    const openPatient = (row: LabelCandidate) => setForm({ ...row });
    const step = (delta: number) => {
        if (focusIndex < 0) return;
        const next = picked[focusIndex + delta];
        if (next) setForm({ ...next });
    };
    const field = <K extends keyof LabelCandidate>(k: K, v: LabelCandidate[K]) =>
        setForm(prev => (prev ? { ...prev, [k]: v } : prev));

    const saveRow = async () => {
        if (!form) return;
        setSavingRow(true);
        try {
            await updatePatientLabelDetails(hospitalId, form.id, {
                addressLine1: (form.addressLine1 as string) ?? null,
                addressLine2: (form.addressLine2 as string) ?? null,
                cityPincode: (form.cityPincode as string) ?? null,
                altPhone: (form.altPhone as string) ?? null,
                phone: (form.phone as string) ?? null,
                fatherHusbandName: (form.fatherHusbandName as string) ?? null,
                age: form.age ?? null,
                gender: (form.gender as string) ?? null,
            });
            setPicked(prev => prev.map(p => (p.id === form.id ? { ...form } : p)));
            setSavedIds(prev => new Set(prev).add(form.id));
            toast.success('Saved');
            // Straight on to the next one; working a list is the whole workflow.
            const next = picked[focusIndex + 1];
            if (next) setForm({ ...next });
        } catch (e: any) {
            toast.error(e instanceof LabelColumnsMissingError ? e.message : (e?.message || 'Could not save'));
        } finally {
            setSavingRow(false);
        }
    };

    const printBatch = () => {
        if (picked.length === 0) { toast.error('Pick at least one patient'); return; }
        if (!printLabels(picked, draft)) toast.error('Pop-up blocked — allow pop-ups to print');
    };

    const subject: LabelPatient = mode === 'batch'
        ? (form || picked[0] || SAMPLE)
        : ((useSample || !patient) ? SAMPLE : patient);
    const { svg, overflowed, barcodeWidthMm } = useMemo(
        () => buildLabelSvg(subject, draft),
        [subject, draft]
    );

    if (!isOpen) return null;

    const doPrint = () => {
        if (!printLabels([subject], draft)) {
            toast.error('Pop-up blocked — allow pop-ups to print');
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
            <div
                className="bg-gray-50 rounded-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Case record label</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            TSC TTP-244 Pro · 203 dpi · one dot is {DOT_MM.toFixed(3)} mm
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                        {(['layout', 'batch'] as const).map(m => (
                            <button
                                key={m} type="button" onClick={() => setMode(m)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                {m === 'layout' ? 'Layout' : `Print labels${picked.length ? ` (${picked.length})` : ''}`}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-1">×</button>
                </div>

                <div className="flex-1 min-h-0 overflow-auto lg:overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
                    {/* Preview — stays put while the controls scroll beside it. Adjusting
                        a size you cannot see is the one thing this screen must not do. */}
                    <div className="space-y-3 min-w-0 lg:min-h-0 lg:overflow-auto">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Preview</span>
                            <div className="flex items-center gap-1 ml-auto">
                                {[1, 1.6, 2.4].map(z => (
                                    <button
                                        key={z} type="button" onClick={() => setZoom(z)}
                                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${zoom === z ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600'}`}
                                    >
                                        {z}×
                                    </button>
                                ))}
                            </div>
                            {patient && (
                                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                                    <input type="checkbox" checked={useSample} onChange={e => setUseSample(e.target.checked)} />
                                    Use sample data
                                </label>
                            )}
                        </div>

                        <div className="bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] rounded-xl border border-gray-200 p-4 sm:p-6 overflow-auto flex items-start justify-center sticky top-0 z-10 lg:static">
                            <div
                                style={{ width: `${draft.widthMm * zoom}mm`, height: `${draft.heightMm * zoom}mm` }}
                                className="shadow-[0_2px_10px_rgba(0,0,0,0.18)] bg-white shrink-0"
                            >
                                <div
                                    style={{ width: `${draft.widthMm}mm`, height: `${draft.heightMm}mm`, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                                    dangerouslySetInnerHTML={{ __html: svg }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={`px-2 py-1 rounded-lg font-semibold border ${overflowed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                {overflowed ? 'Content does not fit the stock' : 'Fits the stock'}
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-600">
                                Barcode {barcodeWidthMm.toFixed(1)} mm wide · {draft.barcodeModuleDots} dots per bar
                            </span>
                            <span className="text-gray-400">
                                On-screen size is approximate. Print one and measure it.
                            </span>
                        </div>

                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11px] text-sky-800 leading-5">
                            <strong>Set the printer's stock first.</strong> Windows Settings, Printers, TSC
                            TTP-244 Pro, Printing preferences, and set the stock to {draft.widthMm} × {draft.heightMm} mm
                            with media type "labels with gaps". A driver left on its 4 × 6 inch default is why a
                            label prints sideways across three stickers.
                            <br /><br />
                            <strong>Then calibrate here.</strong> Print one label, measure it, and correct Width and
                            Height until the artwork lands inside the sticker. If it sits slightly high or to one
                            side, leave the sizes alone and use the two Offset controls. If the scanner struggles,
                            raise Bar width to 4 dots.
                        </div>
                    </div>

                    {/* Controls — the only column that scrolls on a wide screen. */}
                    <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                        {mode === 'batch' ? (
                        <>
                        <Group title="Pick patients">
                            <button
                                type="button"
                                onClick={loadToday}
                                className="w-full mb-2 px-3 py-2 rounded-lg text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                                Add everyone registered today
                            </button>
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by name or MR number…"
                                className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg"
                            />
                            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                                {searching && <p className="px-2.5 py-2 text-[11px] text-gray-400">Searching…</p>}
                                {!searching && query.trim().length >= 2 && results.length === 0 && (
                                    <p className="px-2.5 py-2 text-[11px] text-gray-400">No patients found</p>
                                )}
                                {results.map(r => {
                                    const already = picked.some(p => p.id === r.id);
                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            disabled={already || !r.mrNumber}
                                            onClick={() => addMany([r])}
                                            className="w-full text-left px-2.5 py-2 hover:bg-orange-50/60 disabled:opacity-45 disabled:hover:bg-transparent"
                                        >
                                            <span className="block text-xs font-semibold text-gray-900 truncate">{r.name}</span>
                                            <span className="block text-[10px] text-gray-500">
                                                {r.mrNumber || 'No MR number — cannot be barcoded'}
                                                {already ? ' · added' : ''}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Group>

                        <Group title={`Selected (${picked.length})`}>
                            {picked.length === 0 ? (
                                <p className="text-[11px] text-gray-400 py-1">
                                    Nothing selected yet. Labels feed one at a time off the roll, so a batch
                                    of ten simply prints ten labels in a row.
                                </p>
                            ) : (
                            <>
                            <p className="text-[10px] text-gray-500 mb-2">
                                Click a patient to load them into the template and fill in what is missing.
                            </p>
                                <div className="max-h-64 overflow-auto space-y-1.5 pr-0.5">
                                    {picked.map(pp => {
                                        const open = form?.id === pp.id;
                                        const hasAddress = Boolean(pp.addressLine1 || pp.place);
                                        return (
                                            <div
                                                key={pp.id}
                                                className={`group relative flex items-center gap-2 rounded-xl border transition-all ${
                                                    open
                                                        ? 'border-orange-400 bg-orange-50 shadow-sm ring-1 ring-orange-200'
                                                        : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50 hover:shadow-sm'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => openPatient(pp)}
                                                    className="flex-1 min-w-0 text-left pl-2.5 pr-1 py-2 cursor-pointer"
                                                    title="Open this patient in the template"
                                                >
                                                    <span className="flex items-center gap-1.5 min-w-0">
                                                        <span className="block text-xs font-semibold text-gray-900 truncate">
                                                            {savedIds.has(pp.id) && <span className="text-emerald-600 mr-1">✓</span>}
                                                            {pp.name}
                                                        </span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] text-gray-500 truncate">{pp.mrNumber}</span>
                                                        {!hasAddress && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 rounded px-1 py-px">
                                                                no address
                                                            </span>
                                                        )}
                                                    </span>
                                                    {/* The affordance. Without it the list reads as a static
                                                        summary and nobody discovers the editor behind it. */}
                                                    <span
                                                        className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${
                                                            open ? 'text-orange-700' : 'text-orange-600 opacity-70 group-hover:opacity-100'
                                                        }`}
                                                    >
                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        {open ? 'Editing now' : 'Click to edit'}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPicked(prev => prev.filter(x => x.id !== pp.id));
                                                        if (form?.id === pp.id) setForm(null);
                                                    }}
                                                    className="self-start mt-1.5 mr-1.5 w-6 h-6 shrink-0 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 text-base leading-none transition-colors"
                                                    title="Remove from this batch"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                            )}
                            {picked.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setPicked([])}
                                    className="mt-2 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                                >
                                    Clear all
                                </button>
                            )}
                        </Group>

                        {form && (
                            <Group title={`Editing · ${focusIndex + 1} of ${picked.length}`}>
                                <p className="text-[10px] text-gray-400 mb-2 leading-4">
                                    The preview on the left is this patient. Anything typed here shows up
                                    immediately and is saved to their record, so the next label already has it.
                                </p>
                                {([
                                    ['name', 'Name', false],
                                    ['fatherHusbandName', 'S/O or W/O', false],
                                    ['phone', 'Phone', false],
                                    ['altPhone', 'Second phone', false],
                                    ['addressLine1', 'Address line 1', false],
                                    ['addressLine2', 'Address line 2', false],
                                    ['cityPincode', 'City and pincode', false],
                                ] as const).map(([k, lbl]) => (
                                    <div key={k} className="mb-1.5">
                                        <label className="block text-[10px] font-semibold text-gray-500">{lbl}</label>
                                        <input
                                            value={(form[k] as string) || ''}
                                            onChange={e => field(k, e.target.value as any)}
                                            disabled={k === 'name'}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mt-0.5 disabled:bg-gray-50 disabled:text-gray-500"
                                            placeholder={k === 'addressLine1' && form.place ? `${form.place}` : ''}
                                        />
                                    </div>
                                ))}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-500">Age</label>
                                        <input
                                            value={(form.age as any) ?? ''}
                                            onChange={e => field('age', e.target.value as any)}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mt-0.5"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-500">Gender</label>
                                        <select
                                            value={(form.gender as string) || ''}
                                            onChange={e => field('gender', e.target.value as any)}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mt-0.5 bg-white"
                                        >
                                            <option value="">—</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => step(-1)}
                                        disabled={focusIndex <= 0}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                                    >
                                        ← Prev
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveRow}
                                        disabled={savingRow}
                                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                                    >
                                        {savingRow ? 'Saving…' : (focusIndex < picked.length - 1 ? 'Save and next' : 'Save')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => step(1)}
                                        disabled={focusIndex < 0 || focusIndex >= picked.length - 1}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </Group>
                        )}

                        <Group title="Print">
                            <Num label="Copies each" value={draft.copies} min={1} max={10} step={1} unit="" onChange={v => set('copies', v)} />
                            <button
                                type="button"
                                onClick={printBatch}
                                disabled={picked.length === 0}
                                className="w-full mt-2 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300"
                            >
                                Print {picked.length * Math.max(1, draft.copies)} label{picked.length * Math.max(1, draft.copies) === 1 ? '' : 's'}
                            </button>
                            <p className="text-[10px] text-gray-400 mt-1.5 leading-4">
                                One label per page, fed one at a time off the roll. Nothing is printed after
                                the last one, so no blank label is wasted.
                            </p>
                        </Group>
                        </>
                        ) : (
                        <>
                        <Group title="Stock">
                            <Num label="Width" value={draft.widthMm} min={25} max={108} step={0.5} onChange={v => set('widthMm', v)} />
                            <Num label="Height" value={draft.heightMm} min={12} max={150} step={0.5} onChange={v => set('heightMm', v)} />
                            <Num label="Offset across" value={draft.offsetXMm} min={-10} max={10} step={0.25} onChange={v => set('offsetXMm', v)} />
                            <Num label="Offset down" value={draft.offsetYMm} min={-10} max={10} step={0.25} onChange={v => set('offsetYMm', v)} hint="Use these when the print is off-register, not the sizes." />
                            <div className="py-1.5">
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Rotation</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {([0, 90, 180, 270] as const).map(d => (
                                        <button
                                            key={d} type="button" onClick={() => set('rotateDeg', d)}
                                            className={`px-1 py-1.5 rounded-lg text-[11px] font-bold border ${draft.rotateDeg === d ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600'}`}
                                        >
                                            {d}°
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 leading-4">
                                    Only if the print comes out sideways. First set the printer's own stock
                                    to {draft.widthMm} × {draft.heightMm} mm — a driver still on its 4 × 6 inch
                                    default is what makes one label run down three.
                                </p>
                            </div>
                            <Num label="Side padding" value={draft.paddingXMm} min={0} max={10} step={0.25} onChange={v => set('paddingXMm', v)} />
                            <Num label="Top padding" value={draft.paddingTopMm} min={0} max={10} step={0.25} onChange={v => set('paddingTopMm', v)} />
                        </Group>

                        <Group title="Header">
                            <label className="block text-[11px] font-semibold text-gray-600 mt-1">Hospital name</label>
                            <input
                                value={draft.headerText}
                                onChange={e => set('headerText', e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mt-1"
                            />
                            <label className="block text-[11px] font-semibold text-gray-600 mt-2">Right corner</label>
                            <input
                                value={draft.headerRightText}
                                onChange={e => set('headerRightText', e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mt-1"
                            />
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 mt-2">
                                <input type="checkbox" checked={draft.showHeaderBar} onChange={e => set('showHeaderBar', e.target.checked)} />
                                Black header bar
                            </label>
                            <Num label="Bar height" value={draft.headerHeightMm} min={3} max={12} step={0.2} onChange={v => set('headerHeightMm', v)} />
                            <Num label="Header text" value={draft.headerFontMm} min={1.5} max={6} step={0.1} onChange={v => set('headerFontMm', v)} />
                        </Group>

                        <Group title="Text sizes">
                            <Num label="MR number" value={draft.mrFontMm} min={2} max={10} step={0.1} onChange={v => set('mrFontMm', v)} />
                            <Num label="Name" value={draft.nameFontMm} min={2} max={9} step={0.1} onChange={v => set('nameFontMm', v)} />
                            <Num label="Age / gender" value={draft.ageFontMm} min={1.5} max={6} step={0.1} onChange={v => set('ageFontMm', v)} />
                            <Num label="Body lines" value={draft.bodyFontMm} min={1.5} max={5} step={0.1} onChange={v => set('bodyFontMm', v)} />
                            <Num label="Footnotes" value={draft.footnoteFontMm} min={1.2} max={4} step={0.1} onChange={v => set('footnoteFontMm', v)} />
                            <Num label="Line spacing" value={draft.lineGapMm} min={-0.5} max={3} step={0.1} onChange={v => set('lineGapMm', v)} />
                        </Group>

                        <Group title="Barcode">
                            <Num label="Bar width" value={draft.barcodeModuleDots} min={2} max={5} step={1} unit="dots" onChange={v => set('barcodeModuleDots', v)} hint="Whole dots only. Fractions are what make a barcode scan badly." />
                            <Num label="Height" value={draft.barcodeHeightMm} min={4} max={25} step={0.5} onChange={v => set('barcodeHeightMm', v)} />
                            <Num label="Gap above" value={draft.barcodeGapMm} min={0} max={8} step={0.2} onChange={v => set('barcodeGapMm', v)} />
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 mt-1">
                                <input type="checkbox" checked={draft.showBarcodeText} onChange={e => set('showBarcodeText', e.target.checked)} />
                                Print the number under the bars
                            </label>
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 mt-1">
                                <input type="checkbox" checked={draft.barcodeBottomAligned} onChange={e => set('barcodeBottomAligned', e.target.checked)} />
                                Pin to the bottom edge
                            </label>
                        </Group>

                        <Group title="Blocks">
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 py-1">
                                <input type="checkbox" checked={draft.showAddress} onChange={e => set('showAddress', e.target.checked)} />
                                Address lines
                            </label>
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 py-1">
                                <input type="checkbox" checked={draft.showFooterBlock} onChange={e => set('showFooterBlock', e.target.checked)} />
                                Registered / printed block
                            </label>
                            <Num label="Copies per print" value={draft.copies} min={1} max={10} step={1} unit="" onChange={v => set('copies', v)} />
                        </Group>
                        </>
                        )}
                    </div>
                </div>

                <div className="px-5 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setDraft(DEFAULT_LABEL_SETTINGS)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                    >
                        Reset
                    </button>
                    <span className="text-[11px] text-gray-400 hidden sm:inline">
                        Print a test, measure it, adjust, then save.
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={doPrint}
                            className="px-4 py-2 rounded-xl text-sm font-bold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        >
                            Print test label
                        </button>
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={async () => { await onSave(draft); }}
                            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                        >
                            {isSaving ? 'Saving…' : 'Save layout'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabelDesignerModal;
