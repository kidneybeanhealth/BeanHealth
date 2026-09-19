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
import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    DEFAULT_LABEL_SETTINGS, DOT_MM, buildLabelSvg, printLabels,
    type LabelPatient, type LabelSettings,
} from './patientLabel';

interface Props {
    isOpen: boolean;
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

const LabelDesignerModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave, isSaving = false, patient }) => {
    const [draft, setDraft] = useState<LabelSettings>(settings);
    const [zoom, setZoom] = useState(1.6);
    const [useSample, setUseSample] = useState(!patient);

    const set = <K extends keyof LabelSettings>(k: K, v: LabelSettings[K]) =>
        setDraft(prev => ({ ...prev, [k]: v }));

    const subject: LabelPatient = (useSample || !patient) ? SAMPLE : patient;
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
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-1">×</button>
                </div>

                <div className="flex-1 overflow-auto p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
                    {/* Preview */}
                    <div className="space-y-3">
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

                        <div className="bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] rounded-xl border border-gray-200 p-6 overflow-auto flex items-start justify-center">
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
                            <strong>Setting it up.</strong> Print one label, measure what came out, and correct
                            Width and Height until the artwork lands inside the sticker. If everything sits
                            slightly high or to one side, leave the sizes alone and use the two Offset controls.
                            If the scanner struggles, raise Bar width to 4 dots.
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="space-y-3">
                        <Group title="Stock">
                            <Num label="Width" value={draft.widthMm} min={25} max={108} step={0.5} onChange={v => set('widthMm', v)} />
                            <Num label="Height" value={draft.heightMm} min={12} max={150} step={0.5} onChange={v => set('heightMm', v)} />
                            <Num label="Offset across" value={draft.offsetXMm} min={-10} max={10} step={0.25} onChange={v => set('offsetXMm', v)} />
                            <Num label="Offset down" value={draft.offsetYMm} min={-10} max={10} step={0.25} onChange={v => set('offsetYMm', v)} hint="Use these when the print is off-register, not the sizes." />
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
