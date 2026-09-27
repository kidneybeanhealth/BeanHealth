/**
 * Import a patient list — CSV, Excel, or pasted from WhatsApp.
 *
 * Three steps, and nothing is written until the last:
 *   1. bring the list in (a file, or pasted text)
 *   2. check which column is which (files only — a paste has a fixed shape)
 *   3. see every row classified as new / update / skip, with its problems and
 *      warnings, then import
 * A silent 30% drop is how a centre stops trusting its list, so every skipped
 * row is shown with the reason it was skipped.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCentre } from '../session';
import { buildImportPreview, commitImport, type ImportPreviewRow, type ImportResult } from '../services/patients';
import { IMPORT_FIELDS, guessMapping, parseCsv, parseWhatsAppText, parseXlsx, type Mapping, type Table } from '../services/importers';
import { Badge, Button, Modal, cx, fmtDays } from '../ui/kit';

type Source = 'file' | 'whatsapp';
type Step = 'input' | 'map' | 'preview' | 'done';

const ImportModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
    const centre = useCentre();
    const [source, setSource] = useState<Source>('file');
    const [step, setStep] = useState<Step>('input');
    const [table, setTable] = useState<Table | null>(null);
    const [fileName, setFileName] = useState('');
    const [paste, setPaste] = useState('');
    const [mapping, setMapping] = useState<Mapping>({});
    const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [only, setOnly] = useState<'all' | 'skip' | 'warn'>('all');
    const [result, setResult] = useState<ImportResult | null>(null);

    const readFile = async (f: File) => {
        setBusy(true);
        try {
            const lower = f.name.toLowerCase();
            let t: Table;
            if (lower.endsWith('.xlsx')) t = await parseXlsx(f);
            else if (lower.endsWith('.csv') || lower.endsWith('.txt')) t = parseCsv(await f.text());
            else if (lower.endsWith('.xls')) throw new Error('Old .xls files cannot be read. Open it in Excel and save as .xlsx or .csv.');
            else throw new Error('Choose a .csv or .xlsx file.');
            if (!t.headers.length || !t.rows.length) throw new Error('That file has no rows under the header.');
            setTable(t);
            setFileName(f.name);
            setMapping(guessMapping(t.headers));
            setStep('map');
        } catch (e: any) {
            toast.error(e?.message || 'Could not read that file');
        } finally {
            setBusy(false);
        }
    };

    const readPaste = async () => {
        const t = parseWhatsAppText(paste);
        if (!t.rows.length) { toast.error('No patients found in that text'); return; }
        setTable(t);
        setMapping({ mrNumber: 0, name: 1, phone: 2, dialysisDays: 3 });
        await runPreview(t, { mrNumber: 0, name: 1, phone: 2, dialysisDays: 3 }, true);
    };

    const runPreview = async (t: Table, m: Mapping, idFromPhone: boolean) => {
        setBusy(true);
        try {
            setPreview(await buildImportPreview(centre.id, t.rows, m, { idFromPhone, firstLine: idFromPhone ? 1 : 2 }));
            setStep('preview');
        } catch (e: any) {
            toast.error(e?.message || 'Could not check the list');
        } finally {
            setBusy(false);
        }
    };

    const commit = async () => {
        if (!preview) return;
        setBusy(true);
        try {
            const r = await commitImport(centre.id, preview, source === 'whatsapp' ? 'connect_whatsapp' : 'connect_import');
            setResult(r);
            setStep('done');
        } catch (e: any) {
            toast.error(e?.message || 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    const tally = useMemo(() => {
        const t = { insert: 0, update: 0, skip: 0, warn: 0 };
        for (const r of preview || []) { t[r.action]++; if (r.warnings.length) t.warn++; }
        return t;
    }, [preview]);

    const requiredMissing = IMPORT_FIELDS.filter(f => f.required && mapping[f.key] === undefined);
    const shownRows = (preview || []).filter(r => only === 'all' || (only === 'skip' ? r.action === 'skip' : r.warnings.length > 0));

    const footer = step === 'map' ? (
        <>
            <Button onClick={() => setStep('input')}>Back</Button>
            <Button tone="primary" disabled={busy || requiredMissing.length > 0} onClick={() => table && runPreview(table, mapping, false)}>
                {busy ? 'Checking…' : 'Check the list'}
            </Button>
        </>
    ) : step === 'preview' ? (
        <>
            <Button onClick={() => setStep(source === 'file' ? 'map' : 'input')}>Back</Button>
            <Button tone="primary" disabled={busy || tally.insert + tally.update === 0} onClick={commit}>
                {busy ? 'Importing…' : `Import ${tally.insert + tally.update} patient${tally.insert + tally.update === 1 ? '' : 's'}`}
            </Button>
        </>
    ) : step === 'done' ? (
        <Button tone="primary" onClick={onDone}>Done</Button>
    ) : null;

    return (
        <Modal open onClose={onClose} wide title="Import patients" footer={footer}>
            {step === 'input' && (
                <div className="space-y-4">
                    <div className="flex gap-1.5">
                        {([['file', 'CSV or Excel file'], ['whatsapp', 'Paste from WhatsApp']] as const).map(([k, label]) => (
                            <button
                                key={k} type="button" onClick={() => setSource(k)}
                                className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', source === k ? 'border-[#5FA01F] bg-[#F0F9E6] text-[#3F7A12]' : 'border-gray-200 bg-white text-gray-600')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {source === 'file' ? (
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center hover:border-[#5FA01F]">
                            <span className="text-sm font-semibold text-gray-800">{busy ? 'Reading…' : 'Choose a .csv or .xlsx file'}</span>
                            <span className="mt-1 text-xs text-gray-500">The export from your hospital system. The first row must be the column names.</span>
                            <input type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
                        </label>
                    ) : (
                        <div>
                            <textarea
                                value={paste} onChange={e => setPaste(e.target.value)} rows={10}
                                placeholder={'One patient per line, as it came on WhatsApp:\n1. Ravi Kumar 98765 43210 MWF\n2. Lakshmi S KC/1042 91234 56789 TTS'}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#5FA01F]"
                            />
                            <p className="mt-1.5 text-[11px] text-gray-500">
                                Each line needs a name and a mobile number. A patient ID and dialysis days (MWF, TTS, Mon/Wed/Fri) are picked up when present.
                                Without an ID, the phone number becomes the patient's ID so pasting the same list again updates them instead of adding them twice.
                            </p>
                            <div className="mt-3 flex justify-end">
                                <Button tone="primary" onClick={readPaste} disabled={busy || !paste.trim()}>{busy ? 'Checking…' : 'Check the list'}</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 'map' && table && (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{fileName}</span> · {table.rows.length} rows. Check which column holds what.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {IMPORT_FIELDS.map(f => (
                            <label key={f.key} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                                <span className="w-32 shrink-0">
                                    <span className="block text-xs font-semibold text-gray-800">{f.label}{f.required && <span className="text-rose-600"> *</span>}</span>
                                    {f.hint && <span className="block text-[10px] text-gray-400">{f.hint}</span>}
                                </span>
                                <select
                                    value={mapping[f.key] ?? ''}
                                    onChange={e => setMapping(prev => { const n = { ...prev }; if (e.target.value === '') delete n[f.key]; else n[f.key] = Number(e.target.value); return n; })}
                                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                                >
                                    <option value="">— not in this file —</option>
                                    {table.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                    {requiredMissing.length > 0 && (
                        <p className="text-xs text-rose-600">Choose a column for: {requiredMissing.map(f => f.label).join(', ')}.</p>
                    )}
                </div>
            )}

            {step === 'preview' && preview && (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <Badge tone="green">{tally.insert} new</Badge>
                        <Badge tone="sky">{tally.update} update</Badge>
                        <Badge tone={tally.skip ? 'rose' : 'gray'}>{tally.skip} skipped</Badge>
                        <Badge tone={tally.warn ? 'amber' : 'gray'}>{tally.warn} with warnings</Badge>
                    </div>
                    <p className="text-xs text-gray-500">Nothing has been saved yet. Updates never erase a detail the list leaves blank.</p>
                    <div className="flex gap-1.5">
                        {([['all', 'All rows'], ['skip', 'Skipped'], ['warn', 'Warnings']] as const).map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setOnly(k)}
                                className={cx('rounded-full border px-2.5 py-1 text-[11px] font-semibold', only === k ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-600')}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="max-h-[45vh] overflow-auto rounded-xl border border-gray-200">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                                <tr><th className="px-2 py-1.5">Line</th><th className="px-2 py-1.5">Action</th><th className="px-2 py-1.5">Patient</th><th className="px-2 py-1.5">Phone</th><th className="px-2 py-1.5">Care</th><th className="px-2 py-1.5">Notes</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {shownRows.map(r => (
                                    <tr key={r.line} className={r.action === 'skip' ? 'bg-rose-50/50' : ''}>
                                        <td className="px-2 py-1.5 text-gray-400">{r.line}</td>
                                        <td className="px-2 py-1.5">
                                            <Badge tone={r.action === 'insert' ? 'green' : r.action === 'update' ? 'sky' : 'rose'}>{r.action === 'insert' ? 'New' : r.action === 'update' ? 'Update' : 'Skip'}</Badge>
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <span className="font-semibold text-gray-900">{r.input.name || '—'}</span>
                                            <span className="block font-mono text-[10px] text-gray-400">{r.input.mrNumber || '—'}</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600">{r.input.phone || r.input.attenderPhone || '—'}</td>
                                        <td className="px-2 py-1.5 text-gray-600">
                                            {r.input.programme || '—'}{r.input.dialysisDays?.length ? ` · ${fmtDays(r.input.dialysisDays)}` : ''}{r.input.preferredLanguage ? ` · ${r.input.preferredLanguage}` : ''}
                                        </td>
                                        <td className="px-2 py-1.5">
                                            {r.problems.map(p => <span key={p} className="block text-rose-700">{p}</span>)}
                                            {r.warnings.map(w => <span key={w} className="block text-amber-700">{w}</span>)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {step === 'done' && result && (
                <div className="space-y-3">
                    <p className="text-base font-bold text-gray-900">Imported</p>
                    <div className="flex flex-wrap gap-2">
                        <Badge tone="green">{result.inserted} added</Badge>
                        <Badge tone="sky">{result.updated} updated</Badge>
                        <Badge tone="violet">{result.reviews} reviews scheduled</Badge>
                        <Badge tone={result.skipped ? 'rose' : 'gray'}>{result.skipped} skipped</Badge>
                    </div>
                    {result.errors.length > 0 && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                            <p className="font-bold">{result.errors.length} row{result.errors.length === 1 ? '' : 's'} failed while saving</p>
                            {result.errors.slice(0, 20).map(e => <p key={e}>{e}</p>)}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default ImportModal;
