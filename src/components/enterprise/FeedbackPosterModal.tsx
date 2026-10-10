/**
 * FeedbackPosterModal — see the poster, print the poster
 *
 * One view, one print, used by both Reception and the Doctor dashboard through
 * FeedbackRegisterPanel. The preview is not a picture of the poster: it is the
 * poster, an iframe holding the exact document buildFeedbackPosterHtml produces,
 * and Print prints that same iframe. What the receptionist checks is what the
 * printer gets.
 *
 * The hospital has to be able to make this themselves. A QR they have to ask us
 * to regenerate never gets replaced when it fades, gets covered, or moves wall.
 *
 * Everything the page needs is inlined before it is shown — the QR as SVG, the
 * BeanHealth mark as SVG, the hospital logo as a data: URL — so a print never
 * fires before an image has arrived. Fonts are the one network dependency, and
 * printing waits for them.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';
import { getProxiedUrl } from '../../lib/supabase';
import { resolveFeedbackLocation, fetchHospitalLogo, type FeedbackLocation } from '../../services/feedbackService';
import { buildFeedbackPosterHtml, POSTER_PAGE_MM, type PosterSize } from '../feedback/feedbackPoster';
import { PUBLIC_APP_URL, feedbackUrl } from '../feedback/feedbackLinks';

// The address itself lives in feedbackLinks, shared with the dashboards' Open form button.

const PX_PER_MM = 96 / 25.4;

/** Read a URL into a data: URL, or null. A logo that will not load must not block the poster. */
async function toDataUrl(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return null;
        return await new Promise<string | null>(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

let beanLogoCache: string | null = null;
async function beanLogoSvg(): Promise<string> {
    if (beanLogoCache) return beanLogoCache;
    try {
        const res = await fetch('/logo.svg');
        if (res.ok) {
            const text = await res.text();
            if (text.includes('<svg')) { beanLogoCache = text; return text; }
        }
    } catch { /* fall through to an empty mark rather than failing the poster */ }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
}

export interface FeedbackPosterModalProps {
    hospitalId: string;
    locations: FeedbackLocation[];
    onClose: () => void;
}

const FeedbackPosterModal: React.FC<FeedbackPosterModalProps> = ({ hospitalId, locations, onClose }) => {
    const active = useMemo(() => locations.filter(l => l.isActive), [locations]);
    const [selected, setSelected] = useState<string>(active[0]?.code || '');
    const [size, setSize] = useState<PosterSize>('A4');
    const [html, setHtml] = useState<string>('');
    const [err, setErr] = useState<string | null>(null);
    const [printing, setPrinting] = useState(false);

    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [boxW, setBoxW] = useState(360);

    useEffect(() => {
        if (!selected && active[0]) setSelected(active[0].code);
    }, [active, selected]);

    const loc = active.find(l => l.code === selected) || active[0] || null;
    const url = loc ? feedbackUrl(loc.code) : '';

    // Assemble the poster. The header comes from the same RPC the patient's form
    // uses, so the poster names the hospital exactly as the page it opens does.
    useEffect(() => {
        if (!loc) { setHtml(''); return; }
        let cancelled = false;
        setErr(null);
        (async () => {
            try {
                const [resolved, ownLogo, qrSvg, bean] = await Promise.all([
                    resolveFeedbackLocation(loc.code).catch(() => null),
                    fetchHospitalLogo(hospitalId),
                    QRCode.toString(url, {
                        type: 'svg',
                        errorCorrectionLevel: 'M',
                        margin: 2,   // quiet zone, in modules — the margin the decode test passed at
                        color: { dark: '#111827', light: '#ffffff' },
                    }),
                    beanLogoSvg(),
                ]);
                const logoSrc = ownLogo || resolved?.hospitalLogo || null;
                const logo = logoSrc ? await toDataUrl(getProxiedUrl(logoSrc)) : null;
                if (cancelled) return;
                setHtml(buildFeedbackPosterHtml({
                    hospitalName: resolved?.hospitalName || loc.label,
                    hospitalLogoDataUrl: logo,
                    locationLabel: loc.label,
                    area: loc.area,
                    url,
                    qrSvg,
                    beanLogoSvg: bean,
                    size,
                }));
            } catch (e: any) {
                if (!cancelled) setErr(e?.message || 'Could not build the poster');
            }
        })();
        return () => { cancelled = true; };
    }, [loc?.code, loc?.label, loc?.area, url, size, hospitalId]);

    // Fit the real-size page into the preview box.
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => setBoxW(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const page = POSTER_PAGE_MM[size];
    const pageWpx = page.w * PX_PER_MM;
    const pageHpx = page.h * PX_PER_MM;
    const scale = Math.min(1, boxW / pageWpx);

    const print = async () => {
        const win = frameRef.current?.contentWindow;
        const doc = frameRef.current?.contentDocument;
        if (!win || !doc) { toast.error('The poster has not finished loading'); return; }
        setPrinting(true);
        try {
            // Printing before the webfonts arrive prints the fallback font; wait,
            // but not forever — an offline PC still gets a poster.
            const fonts = (doc as any).fonts?.ready as Promise<unknown> | undefined;
            if (fonts) await Promise.race([fonts, new Promise(r => setTimeout(r, 3000))]);
            win.focus();
            win.print();
        } catch {
            toast.error('Could not start the print');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={onClose}>
            <div
                className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Feedback QR poster</h3>
                        <p className="text-xs text-gray-500">This is exactly what prints. Laminate it and put it where patients wait.</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-1 text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
                </div>

                {active.length === 0 ? (
                    <p className="m-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        No feedback poster is set up yet. Run <code className="font-mono text-xs">sql/20260927_patient_feedback.sql</code>,
                        which creates one covering the whole hospital.
                    </p>
                ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-auto p-5 md:grid-cols-[minmax(0,1fr)_260px]">
                        {/* The poster itself */}
                        <div ref={boxRef} className="min-w-0">
                            <div
                                className="mx-auto overflow-hidden rounded-lg bg-white shadow-[0_2px_14px_rgba(0,0,0,0.16)] ring-1 ring-gray-200"
                                style={{ width: pageWpx * scale, height: pageHpx * scale }}
                            >
                                {err ? (
                                    <p className="p-6 text-sm text-rose-700">{err}</p>
                                ) : html ? (
                                    <iframe
                                        ref={frameRef}
                                        title="Feedback poster"
                                        srcDoc={html}
                                        style={{
                                            width: pageWpx, height: pageHpx, border: 0,
                                            transform: `scale(${scale})`, transformOrigin: 'top left',
                                        }}
                                    />
                                ) : (
                                    <div className="h-full w-full animate-pulse bg-gray-100" />
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-4">
                            {active.length > 1 && (
                                <div>
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

                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">Paper</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(['A4', 'A5'] as PosterSize[]).map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setSize(s)}
                                            className={`rounded-xl border px-3 py-2 text-left transition-colors ${size === s ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}
                                        >
                                            <span className={`block text-sm font-bold ${size === s ? 'text-orange-700' : 'text-gray-800'}`}>{s}</span>
                                            <span className="block text-[10px] text-gray-500">{s === 'A4' ? 'Wall poster' : 'Table stand'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={print}
                                disabled={!html || printing}
                                className="min-h-[48px] w-full rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
                            >
                                {printing ? 'Preparing…' : `Print ${size} poster`}
                            </button>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Opens</p>
                                <p className="mt-0.5 break-all font-mono text-[11px] text-gray-700">{url}</p>
                            </div>

                            {!url.startsWith(window.location.origin) && (
                                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-900">
                                    This poster opens <strong>{PUBLIC_APP_URL.replace(/^https?:\/\//, '')}</strong>, not the
                                    address you are on now. That is intended: a poster stays on a wall long after this link changes.
                                </p>
                            )}

                            <p className="text-[11px] leading-5 text-gray-400">
                                In the print dialog, set margins to <strong>None</strong> and turn off headers and footers.
                                Scan the printed copy once with a phone before putting it up.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedbackPosterModal;
