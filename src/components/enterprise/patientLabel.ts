/**
 * patientLabel — the case-record sticker, as one SVG in millimetres
 *
 * Replaces the label the hospital's HIS prints on a TSC TTP-244 Pro, which they
 * cannot re-brand or re-lay-out from that software.
 *
 * ── Why one builder ──────────────────────────────────────────────────────────
 * The preview on screen and the sheet that reaches the printer are the SAME
 * string. This codebase has been bitten three times by a print template that
 * drifted from the thing it was previewing, most recently a third dead copy of
 * the Past Records sheet that kept turning up in greps after the layout changed.
 * A label is worse than a list: reception checks the preview, prints a hundred,
 * and finds out at the filing cabinet.
 *
 * ── Why SVG in millimetres ───────────────────────────────────────────────────
 * The user units ARE millimetres (viewBox 0 0 widthMm heightMm), so every
 * coordinate in this file is a physical measurement. Nothing is converted, so
 * nothing rounds. Browsers rasterise this at the printer driver's own dpi.
 *
 * ── Why everything is adjustable ─────────────────────────────────────────────
 * The exact label stock is not known yet, and the token printer taught us that
 * "measure it once and hard-code it" does not survive contact with a real
 * printer: that one ended up with a manual spacing control the receptionist
 * nudges until it sits right. So the defaults below are a considered guess at
 * 100 x 50 mm, and every dimension, offset and text size is a setting the desk
 * can change without us. Guessing wrong costs a slider drag, not a release.
 */
import { encodeCode128B } from '../../utils/code128';

/** One dot on a 203 dpi head. Bar widths must be whole multiples of this. */
export const DOT_MM = 25.4 / 203;

export interface LabelSettings {
    /** Physical stock. The two numbers most likely to be wrong on day one. */
    widthMm: number;
    heightMm: number;
    /** Nudges the whole label to fix a printer that feeds a little off-register. */
    offsetXMm: number;
    offsetYMm: number;
    paddingXMm: number;
    paddingTopMm: number;

    headerText: string;
    headerRightText: string;
    showHeaderBar: boolean;
    headerHeightMm: number;
    headerFontMm: number;

    mrLabelFontMm: number;
    mrFontMm: number;
    ageFontMm: number;
    nameFontMm: number;
    bodyFontMm: number;
    footnoteFontMm: number;
    /** Extra air between stacked lines; negative tightens a crowded label. */
    lineGapMm: number;

    /** Bar width in printer dots. 2 is dense, 3 is the safe default, 4 is wide. */
    barcodeModuleDots: number;
    barcodeHeightMm: number;
    barcodeGapMm: number;
    showBarcodeText: boolean;

    showAddress: boolean;
    showFooterBlock: boolean;
    /** Push the barcode to the bottom edge instead of letting it follow the text. */
    barcodeBottomAligned: boolean;
    copies: number;
}

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
    // 100 x 50 mm is the common 4 x 2 inch die-cut stock for a 4 inch TSC, and
    // matches the proportions of the label the hospital sent. It is a starting
    // point to be corrected at the desk, not a measurement.
    widthMm: 100,
    heightMm: 50,
    offsetXMm: 0,
    offsetYMm: 0,
    paddingXMm: 2.5,
    paddingTopMm: 1.5,

    headerText: 'KONGUNAD KIDNEY CENTRE',
    headerRightText: 'KKC OP',
    showHeaderBar: true,
    headerHeightMm: 5.2,
    headerFontMm: 3.1,

    mrLabelFontMm: 2.2,
    mrFontMm: 5.6,
    ageFontMm: 3.0,
    nameFontMm: 4.6,
    bodyFontMm: 2.7,
    footnoteFontMm: 2.0,
    lineGapMm: 0.6,

    barcodeModuleDots: 3,
    barcodeHeightMm: 9,
    barcodeGapMm: 1.2,
    showBarcodeText: false,

    showAddress: true,
    showFooterBlock: true,
    barcodeBottomAligned: false,
    copies: 1,
};

export interface LabelPatient {
    mrNumber: string;
    name: string;
    age?: number | string | null;
    gender?: string | null;
    phone?: string | null;
    /** Not stored today. Declared so adding the column later needs no rewrite. */
    altPhone?: string | null;
    fatherHusbandName?: string | null;
    /** The single free-text `place` we hold today. */
    place?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    cityPincode?: string | null;
    registeredAt?: string | null;
}

const esc = (v: unknown): string =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const FONT = "Helvetica, Arial, 'Liberation Sans', sans-serif";

const fmtDate = (iso?: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const mon = d.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '').slice(0, 3);
    return `${String(d.getDate()).padStart(2, '0')}-${mon}-${d.getFullYear()}`;
};
const fmtStamp = (d: Date): string => {
    const mon = d.toLocaleDateString('en-GB', { month: 'short' }).replace('.', '').slice(0, 3);
    const yy = String(d.getFullYear()).slice(-2);
    return `${String(d.getDate()).padStart(2, '0')}-${mon}-${yy} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Honorific matching the hospital's own label, which prints Mr./Ms. before the name. */
const honorific = (gender?: string | null): string => {
    const g = String(gender || '').trim().toLowerCase();
    if (g.startsWith('m')) return 'Mr. ';
    if (g.startsWith('f')) return 'Ms. ';
    return '';
};

export interface BuildLabelResult {
    svg: string;
    /** True when content ran past the bottom edge — the preview warns on this. */
    overflowed: boolean;
    barcodeWidthMm: number;
}

/**
 * Build one label.
 *
 * Lays out top-down against a cursor so that turning a block off (address,
 * footer) closes the gap instead of leaving a hole, and so a taller font pushes
 * what follows rather than overlapping it.
 */
export function buildLabelSvg(patient: LabelPatient, s: LabelSettings): BuildLabelResult {
    const W = s.widthMm;
    const H = s.heightMm;
    const left = s.paddingXMm + s.offsetXMm;
    const right = W - s.paddingXMm + s.offsetXMm;
    const innerW = right - left;

    const parts: string[] = [];
    let y = s.paddingTopMm + s.offsetYMm;

    // ── Header bar ───────────────────────────────────────────────────────────
    if (s.showHeaderBar) {
        const barY = y;
        parts.push(
            `<rect x="${left}" y="${barY}" width="${innerW}" height="${s.headerHeightMm}" fill="#000"/>`,
            `<text x="${left + 1.2}" y="${barY + s.headerHeightMm * 0.73}" font-family="${FONT}" font-size="${s.headerFontMm}" font-weight="700" fill="#fff">${esc(s.headerText)}</text>`,
        );
        if (s.headerRightText) {
            parts.push(
                `<text x="${right - 1.2}" y="${barY + s.headerHeightMm * 0.73}" text-anchor="end" font-family="${FONT}" font-size="${s.headerFontMm * 0.88}" font-weight="700" fill="#fff">${esc(s.headerRightText)}</text>`,
            );
        }
        y = barY + s.headerHeightMm + s.lineGapMm + 0.4;
    }

    // ── MR number, with age / gender on the right ────────────────────────────
    const mrBaseline = y + s.mrFontMm * 0.82;
    parts.push(
        `<text x="${left}" y="${mrBaseline}" font-family="${FONT}" font-size="${s.mrLabelFontMm}" fill="#000">MRD No</text>`,
        `<text x="${left + s.mrLabelFontMm * 4.2}" y="${mrBaseline}" font-family="${FONT}" font-size="${s.mrFontMm}" font-weight="700" fill="#000">${esc(patient.mrNumber || '')}</text>`,
    );
    const ageBits = [patient.age ? `${patient.age} Y` : '', patient.gender || ''].filter(Boolean).join(' / ');
    if (ageBits) {
        parts.push(
            `<text x="${right}" y="${mrBaseline}" text-anchor="end" font-family="${FONT}" font-size="${s.ageFontMm}" fill="#000">${esc(ageBits)}</text>`,
        );
    }
    y = mrBaseline + s.lineGapMm + 0.6;

    // ── Name ─────────────────────────────────────────────────────────────────
    const nameBaseline = y + s.nameFontMm * 0.82;
    parts.push(
        `<text x="${left}" y="${nameBaseline}" font-family="${FONT}" font-size="${s.nameFontMm}" font-weight="700" fill="#000">${esc(honorific(patient.gender) + (patient.name || ''))}</text>`,
    );
    y = nameBaseline + s.lineGapMm * 0.8;

    // Hairline under the name, as on the hospital's own label.
    parts.push(`<rect x="${left}" y="${y}" width="${innerW}" height="0.2" fill="#000"/>`);
    y += 0.2 + s.lineGapMm + 0.3;

    // ── Body lines ───────────────────────────────────────────────────────────
    const bodyLine = (text: string) => {
        if (!text) return;
        const baseline = y + s.bodyFontMm * 0.82;
        parts.push(
            `<text x="${left}" y="${baseline}" font-family="${FONT}" font-size="${s.bodyFontMm}" fill="#000">${esc(text)}</text>`,
        );
        y = baseline + s.lineGapMm * 0.7;
    };

    const phones = [patient.phone, patient.altPhone].filter(Boolean).join(' / ');
    if (phones) bodyLine(`Ph ${phones}`);
    if (patient.fatherHusbandName) bodyLine(`S/O ${patient.fatherHusbandName}`);
    if (s.showAddress) {
        // Today only `place` is stored, so it carries the address line. The
        // structured fields render the moment they exist.
        bodyLine(patient.addressLine1 || patient.place || '');
        bodyLine(patient.addressLine2 || '');
        bodyLine(patient.cityPincode || '');
    }

    // ── Barcode and the footer block, bottom-aligned ─────────────────────────
    const moduleMm = s.barcodeModuleDots * DOT_MM;
    let barcodeWidthMm = 0;
    let barcodeFailed = false;
    const textBlockMm = s.showBarcodeText ? s.footnoteFontMm + 0.4 : 0;
    const naturalTop = y + s.barcodeGapMm;
    const bottomTop = H - s.paddingTopMm - s.barcodeHeightMm - textBlockMm + s.offsetYMm;
    // Following the text matches the hospital's own label, where the bars sit
    // directly under the address. Bottom-aligning is there for stock so short
    // that a long address would otherwise push the bars off the sticker.
    const barcodeTop = s.barcodeBottomAligned ? Math.max(naturalTop, bottomTop) : naturalTop;

    try {
        const widths = encodeCode128B(patient.mrNumber || '');
        barcodeWidthMm = widths.reduce((a, b) => a + b, 0) * moduleMm;
        let x = left;
        let isBar = true;
        for (const w of widths) {
            const barW = w * moduleMm;
            if (isBar) {
                parts.push(`<rect x="${x.toFixed(4)}" y="${barcodeTop.toFixed(4)}" width="${barW.toFixed(4)}" height="${s.barcodeHeightMm}" fill="#000"/>`);
            }
            x += barW;
            isBar = !isBar;
        }
        if (s.showBarcodeText) {
            parts.push(
                `<text x="${left + barcodeWidthMm / 2}" y="${barcodeTop + s.barcodeHeightMm + s.footnoteFontMm}" text-anchor="middle" font-family="${FONT}" font-size="${s.footnoteFontMm}" fill="#000">${esc(patient.mrNumber)}</text>`,
            );
        }
    } catch {
        // An unencodable MR number must be loud, not a blank strip that reception
        // sticks on a folder and discovers at the scanner months later.
        barcodeFailed = true;
        parts.push(
            `<text x="${left}" y="${barcodeTop + s.barcodeHeightMm * 0.6}" font-family="${FONT}" font-size="${s.bodyFontMm}" font-weight="700" fill="#000">MR number cannot be barcoded</text>`,
        );
    }

    if (s.showFooterBlock) {
        const fx = left + barcodeWidthMm + 2.4;
        if (fx < right - 12) {
            const lh = s.footnoteFontMm * 1.35;
            const top = barcodeTop;
            parts.push(`<rect x="${fx - 1.2}" y="${top}" width="0.2" height="${s.barcodeHeightMm}" fill="#000"/>`);
            const reg = fmtDate(patient.registeredAt);
            const lines = [
                reg ? `Registered ${reg}` : '',
                `Printed ${fmtStamp(new Date())}`,
                s.headerRightText,
            ].filter(Boolean);
            lines.forEach((line, i) => {
                parts.push(
                    `<text x="${fx}" y="${top + s.footnoteFontMm + i * lh}" font-family="${FONT}" font-size="${s.footnoteFontMm}" fill="#000">${esc(line)}</text>`,
                );
            });
        }
    }

    const contentBottom = barcodeTop + s.barcodeHeightMm + textBlockMm;
    const overflowed = contentBottom > H + 0.01 || y > barcodeTop + 0.01 || barcodeWidthMm > innerW + 0.01 || barcodeFailed;

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">` +
        `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>` +
        parts.join('') +
        `</svg>`;

    return { svg, overflowed, barcodeWidthMm };
}

/**
 * Wrap labels in a page sized to the stock.
 *
 * `@page size` is what stops the browser printing a 100x50 label onto A4 with a
 * 20mm margin. colour adjust is forced because the header bar is a solid black
 * fill, which "economy" print settings would otherwise drop.
 */
export function buildLabelPrintHtml(svgs: string[], s: LabelSettings, title = 'Patient label'): string {
    const pages = svgs
        .map((svg, i) => `<div class="pg"${i === svgs.length - 1 ? ' style="page-break-after:auto"' : ''}>${svg}</div>`)
        .join('');
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>
  @page { size: ${s.widthMm}mm ${s.heightMm}mm; margin: 0; }
  :root { color-scheme: only light; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pg { width: ${s.widthMm}mm; height: ${s.heightMm}mm; overflow: hidden; page-break-after: always; }
  svg { display: block; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head>
<body>${pages}<script>window.onload=function(){window.print();};</script></body></html>`;
}

/** Open the print window. Returns false when the pop-up was blocked. */
export function printLabels(patients: LabelPatient[], s: LabelSettings): boolean {
    const svgs: string[] = [];
    const copies = Math.max(1, Math.min(20, Math.round(s.copies || 1)));
    for (const p of patients) {
        const { svg } = buildLabelSvg(p, s);
        for (let i = 0; i < copies; i++) svgs.push(svg);
    }
    const w = window.open('', '_blank', `width=900,height=600`);
    if (!w) return false;
    w.document.open();
    w.document.write(buildLabelPrintHtml(svgs, s));
    w.document.close();
    return true;
}
