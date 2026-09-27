/**
 * FeedbackPosterModal — the printable QR
 *
 * The hospital has to be able to make the poster themselves. A QR they have to
 * ask us to regenerate is a QR that never gets replaced when it fades, gets
 * covered, or moves to a different wall.
 *
 * Printed on ordinary A5 from the office printer, not the label printer: this
 * is a sheet in a stand, not a sticker, so none of the TSC dot-alignment
 * arithmetic applies. The QR is drawn at 70mm, which a phone reads from about
 * an arm and a half away — the distance from a dialysis chair to the wall.
 *
 * Error correction is M. H would survive more damage but costs modules, and
 * modules cost physical size at a fixed sheet width; a laminated indoor poster
 * is not getting scuffed the way a parcel label does.
 */
import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { FeedbackLocation } from '../../services/feedbackService';

/**
 * The permanent address a poster points at — never the address the dashboard
 * happens to be open on.
 *
 * This used to be `window.location.origin`, so a poster printed from a Vercel
 * preview link or from localhost carried that URL in its QR. Preview URLs are
 * replaced on every push; a laminated poster is on the wall for a year. Set
 * VITE_PUBLIC_APP_URL to change the domain, e.g. for a hospital on its own.
 */
const PUBLIC_APP_URL = String(import.meta.env.VITE_PUBLIC_APP_URL || 'https://beanhealth.in').replace(/\/+$/, '');
const feedbackUrl = (code: string) => `${PUBLIC_APP_URL}/f/${encodeURIComponent(code)}`;

export interface FeedbackPosterModalProps {
    locations: FeedbackLocation[];
    onClose: () => void;
}

const FeedbackPosterModal: React.FC<FeedbackPosterModalProps> = ({ locations, onClose }) => {
    const active = useMemo(() => locations.filter(l => l.isActive), [locations]);
    const [selected, setSelected] = useState<string>(active[0]?.code || '');
    const [svg, setSvg] = useState<string>('');
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!selected && active[0]) setSelected(active[0].code);
    }, [active, selected]);

    const loc = active.find(l => l.code === selected) || active[0] || null;
    const url = loc ? feedbackUrl(loc.code) : '';

    useEffect(() => {
        if (!url) { setSvg(''); return; }
        let cancelled = false;
        QRCode.toString(url, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 2,              // quiet zone, in modules. Below 2 scanners struggle.
            color: { dark: '#111827', light: '#ffffff' },
        })
            .then(s => { if (!cancelled) { setSvg(s); setErr(null); } })
            .catch(e => { if (!cancelled) setErr(e?.message || 'Could not draw the QR code'); });
        return () => { cancelled = true; };
    }, [url]);

    const print = () => {
        if (!loc || !svg) return;
        // Same approach as the patient label: a hidden same-origin frame, so the
        // receptionist never leaves the dashboard and pop-up blocking cannot
        // silently swallow the print.
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;left:-10000px;top:0;border:0;width:148mm;height:210mm;';
        document.body.appendChild(frame);
        const doc = frame.contentWindow?.document;
        if (!doc) { frame.remove(); return; }

        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Feedback poster</title>
<style>
  @page { size: A5 portrait; margin: 0; }
  :root { color-scheme: only light; }
  html,body { margin:0; padding:0; background:#fff; color:#111827;
              font-family: Helvetica, Arial, 'Liberation Sans', sans-serif; }
  .sheet { width:148mm; height:210mm; padding:14mm 12mm; box-sizing:border-box;
           display:flex; flex-direction:column; align-items:center; text-align:center; }
  h1 { font-size:9mm; line-height:1.15; margin:0 0 3mm; }
  h2 { font-size:5.5mm; line-height:1.3; margin:0 0 2mm; font-weight:700; color:#374151; }
  .ta { font-size:5mm; color:#4b5563; margin:0 0 7mm; }
  .qr { width:70mm; height:70mm; }
  .qr svg { width:100%; height:100%; display:block; }
  .url { margin-top:5mm; font-size:4mm; letter-spacing:.02em; color:#6b7280; }
  .foot { margin-top:auto; font-size:3.6mm; line-height:1.5; color:#6b7280; }
  .rule { width:30mm; height:0.6mm; background:#f97316; margin:6mm auto; }
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
</style></head><body><div class="sheet">
  <h1>How was your visit?</h1>
  <h2>உங்கள் வருகை எப்படி இருந்தது?</h2>
  <div class="rule"></div>
  <p class="ta">Scan with your phone camera · உங்கள் ஃபோன் காமிராவால் ஸ்கேன் செய்யுங்கள்</p>
  <div class="qr">${svg}</div>
  <p class="url">${url.replace(/^https?:\/\//, '')}</p>
  <p class="foot">
    ${loc.label}<br/>
    Takes under a minute. No app, no login.<br/>
    Answers are anonymous unless you choose to add your MR number.
  </p>
</div></body></html>`);
        doc.close();

        const go = () => {
            try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* the browser reports its own refusal */ }
            window.setTimeout(() => frame.remove(), 1000);
        };
        if (doc.readyState === 'complete') window.setTimeout(go, 60);
        else frame.onload = () => window.setTimeout(go, 60);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Feedback QR</h3>
                        <p className="text-xs text-gray-500">Print it, laminate it, put it where patients wait.</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-1 text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
                </div>

                {active.length === 0 ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        No feedback poster is set up yet. Run <code className="font-mono text-xs">sql/20260927_patient_feedback.sql</code>,
                        which creates one covering the whole hospital.
                    </p>
                ) : (
                    <>
                        {active.length > 1 && (
                            <div className="mb-4">
                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Poster</label>
                                <select
                                    value={selected}
                                    onChange={e => setSelected(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                                >
                                    {active.map(l => <option key={l.code} value={l.code}>{l.label} · {l.code}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="mb-4 flex flex-col items-center rounded-xl border border-gray-200 bg-gray-50 p-5">
                            {err ? (
                                <p className="py-10 text-sm text-rose-700">{err}</p>
                            ) : svg ? (
                                <div className="h-48 w-48 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                            ) : (
                                <div className="h-48 w-48 animate-pulse rounded-lg bg-gray-200" />
                            )}
                            <p className="mt-3 break-all text-center font-mono text-[11px] text-gray-500">{url}</p>
                        </div>

                        {!url.startsWith(window.location.origin) && (
                            <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-900">
                                This poster opens <strong>{PUBLIC_APP_URL.replace(/^https?:\/\//, '')}</strong>, not the address
                                you are on now. That is intended: the poster stays on a wall long after this link changes.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={print}
                            disabled={!svg}
                            className="min-h-[48px] w-full rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
                        >
                            Print A5 poster
                        </button>

                        <p className="mt-3 text-[11px] leading-5 text-gray-400">
                            One poster covers the whole hospital today. To tell dialysis stations or wards
                            apart later, add a row to <code className="font-mono">hospital_feedback_locations</code> and
                            print its own poster — every response then records which one it came from, and
                            nothing in the app changes.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default FeedbackPosterModal;
