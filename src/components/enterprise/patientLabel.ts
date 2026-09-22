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
    /**
     * Quarter turns applied to the artwork before printing.
     *
     * Chrome rotates a landscape @page onto portrait media on its own, which is
     * how a 100x50 label ended up running lengthways down three stickers. The
     * real fix is to match the driver's stock, but a printer that cannot be
     * matched is fixed here instead of by reprinting until it looks right.
     */
    rotateDeg: 0 | 90 | 180 | 270;
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
    rotateDeg: 0,
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

/**
 * Every word on this label prints in capitals and bold, at the hospital's
 * request. The sticker is read across a counter and from a file drawer, often by
 * someone already holding three other folders, so legibility beats typography.
 *
 * Applied at render, never at entry: what reception typed stays stored as typed,
 * and the same patient record still reads normally everywhere else in the app.
 */
const up = (v: unknown): string => String(v ?? '').toUpperCase();

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

/*
 * There is deliberately no relation-prefix helper here any more.
 *
 * Reception types the prefix themselves — "W/O MR.HAKKIM" — so prepending one
 * printed "S/O W/O MR.HAKKIM" on a real patient's file. The first fix only
 * prefixed values that had none, which still guessed S/O or D/O from gender and
 * still got it wrong for a bare surname. The field is now printed exactly as
 * typed, like the name beside it. Same lesson as the honorific that printed
 * "Ms. MRS. JERENA", and as `formatDoctorLabel` for "Dr. Dr.A.Prabhakar":
 * anything reception types by hand may already carry its own prefix.
 */

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
            `<text x="${left + 1.2}" y="${barY + s.headerHeightMm * 0.73}" font-family="${FONT}" font-size="${s.headerFontMm}" font-weight="700" fill="#fff">${esc(up(s.headerText))}</text>`,
        );
        if (s.headerRightText) {
            parts.push(
                `<text x="${right - 1.2}" y="${barY + s.headerHeightMm * 0.73}" text-anchor="end" font-family="${FONT}" font-size="${s.headerFontMm * 0.88}" font-weight="700" fill="#fff">${esc(up(s.headerRightText))}</text>`,
            );
        }
        y = barY + s.headerHeightMm + s.lineGapMm + 0.4;
    }

    // ── MR number, with age / gender on the right ────────────────────────────
    const mrBaseline = y + s.mrFontMm * 0.82;
    // "MRD NO" is set less than half the size of the number beside it. Sharing
    // one baseline sat the caption on the digits' feet and read as bottom
    // aligned, so it is lifted by half the difference in cap height — roughly
    // 0.72 of the font size, halved — to centre against them.
    const mrLabelBaseline = mrBaseline - (s.mrFontMm - s.mrLabelFontMm) * 0.36;
    parts.push(
        `<text x="${left}" y="${mrLabelBaseline}" font-family="${FONT}" font-size="${s.mrLabelFontMm}" font-weight="700" fill="#000">MRD NO</text>`,
        `<text x="${left + s.mrLabelFontMm * 4.6}" y="${mrBaseline}" font-family="${FONT}" font-size="${s.mrFontMm}" font-weight="700" fill="#000">${esc(up(patient.mrNumber || ''))}</text>`,
    );
    const ageBits = [patient.age ? `${patient.age} Y` : '', patient.gender || ''].filter(Boolean).join(' / ');
    if (ageBits) {
        parts.push(
            `<text x="${right}" y="${mrBaseline}" text-anchor="end" font-family="${FONT}" font-size="${s.ageFontMm}" font-weight="700" fill="#000">${esc(up(ageBits))}</text>`,
        );
    }
    y = mrBaseline + s.lineGapMm + 0.6;

    // ── Name ─────────────────────────────────────────────────────────────────
    const nameBaseline = y + s.nameFontMm * 0.82;
    parts.push(
        `<text x="${left}" y="${nameBaseline}" font-family="${FONT}" font-size="${s.nameFontMm}" font-weight="700" fill="#000">${esc(up(patient.name || ''))}</text>`,
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
            `<text x="${left}" y="${baseline}" font-family="${FONT}" font-size="${s.bodyFontMm}" font-weight="700" fill="#000">${esc(up(text))}</text>`,
        );
        y = baseline + s.lineGapMm * 0.7;
    };

    const phones = [patient.phone, patient.altPhone].filter(Boolean).join(' / ');
    if (phones) bodyLine(`Ph: ${phones}`);
    // Printed as typed — see the note above `buildLabelSvg`'s imports.
    if (patient.fatherHusbandName) bodyLine(patient.fatherHusbandName);
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
                `<text x="${left + barcodeWidthMm / 2}" y="${barcodeTop + s.barcodeHeightMm + s.footnoteFontMm}" text-anchor="middle" font-family="${FONT}" font-size="${s.footnoteFontMm}" font-weight="700" fill="#000">${esc(up(patient.mrNumber))}</text>`,
            );
        }
    } catch {
        // An unencodable MR number must be loud, not a blank strip that reception
        // sticks on a folder and discovers at the scanner months later.
        barcodeFailed = true;
        parts.push(
            `<text x="${left}" y="${barcodeTop + s.barcodeHeightMm * 0.6}" font-family="${FONT}" font-size="${s.bodyFontMm}" font-weight="700" fill="#000">MR NUMBER CANNOT BE BARCODED</text>`,
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
                    `<text x="${fx}" y="${top + s.footnoteFontMm + i * lh}" font-family="${FONT}" font-size="${s.footnoteFontMm}" font-weight="700" fill="#000">${esc(up(line))}</text>`,
                );
            });
        }
    }

    const contentBottom = barcodeTop + s.barcodeHeightMm + textBlockMm;
    const overflowed = contentBottom > H + 0.01 || y > barcodeTop + 0.01 || barcodeWidthMm > innerW + 0.01 || barcodeFailed;

    // A quarter turn swaps the page's outer dimensions, so the viewBox swaps with
    // it and the artwork is rotated inside. Doing it here rather than with a CSS
    // transform on the print page keeps one source of truth and avoids the
    // rounding that transformed raster output picks up at 203 dpi.
    const rot = ((s.rotateDeg || 0) % 360 + 360) % 360;
    const quarter = rot === 90 || rot === 270;
    const outerW = quarter ? H : W;
    const outerH = quarter ? W : H;
    const transform =
        rot === 90 ? ` transform="rotate(90) translate(0,-${H})"` :
        rot === 270 ? ` transform="rotate(-90) translate(-${W},0)"` :
        rot === 180 ? ` transform="rotate(180) translate(-${W},-${H})"` : '';

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}mm" height="${outerH}mm" viewBox="0 0 ${outerW} ${outerH}" shape-rendering="crispEdges">` +
        `<rect x="0" y="0" width="${outerW}" height="${outerH}" fill="#fff"/>` +
        `<g${transform}>` + parts.join('') + `</g>` +
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
export function buildLabelPrintHtml(
    svgs: string[],
    s: LabelSettings,
    title = 'Patient label',
    /** Self-printing is for a standalone window. In a frame the caller drives it. */
    autoPrint = true,
): string {
    const quarterTurn = s.rotateDeg === 90 || s.rotateDeg === 270;
    const pageW = quarterTurn ? s.heightMm : s.widthMm;
    const pageH = quarterTurn ? s.widthMm : s.heightMm;
    const pages = svgs
        .map((svg, i) => `<div class="pg"${i === svgs.length - 1 ? ' style="page-break-after:auto"' : ''}>${svg}</div>`)
        .join('');
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>
  @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
  :root { color-scheme: only light; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pg { width: ${pageW}mm; height: ${pageH}mm; overflow: hidden; page-break-after: always; }
  svg { display: block; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head>
<body>${pages}${autoPrint ? '<script>window.onload=function(){window.print();};</script>' : ''}</body></html>`;
}

/**
 * A page-sized box with rulers, for proving where the printer actually puts ink.
 *
 * `@page` sizes the page the BROWSER composes. It cannot set the printer's
 * media. On Windows the driver's stock decides how much label material is fed,
 * and Chrome only uses our size if a matching form exists in the driver —
 * otherwise it falls back to the driver default and drops our page into that
 * area. A driver still on 4 x 6 inch feeds 152mm, which is three 50mm labels,
 * and no amount of rotating the artwork changes that: rotation changes the
 * picture, not the paper.
 *
 * So this prints a rectangle at the exact page bounds with 10mm ticks. If it
 * lands inside one sticker, the stock is right and the label will be too. If it
 * runs across three, the driver is wrong and nothing in this app can fix it.
 */
export function buildAlignmentSvg(s: LabelSettings): string {
    const quarter = s.rotateDeg === 90 || s.rotateDeg === 270;
    const W = quarter ? s.heightMm : s.widthMm;
    const H = quarter ? s.widthMm : s.heightMm;
    const parts: string[] = [
        `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`,
        // Inset by half the stroke so the border is not clipped by the edge.
        `<rect x="0.25" y="0.25" width="${(W - 0.5).toFixed(2)}" height="${(H - 0.5).toFixed(2)}" fill="none" stroke="#000" stroke-width="0.5"/>`,
    ];
    for (let x = 10; x < W; x += 10) {
        const long = x % 50 === 0;
        parts.push(`<rect x="${x}" y="0.5" width="0.3" height="${long ? 5 : 3}" fill="#000"/>`);
        parts.push(`<text x="${x + 0.8}" y="${long ? 8.4 : 6.4}" font-family="${FONT}" font-size="2.6" fill="#000">${x}</text>`);
    }
    for (let y = 10; y < H; y += 10) {
        const long = y % 50 === 0;
        parts.push(`<rect x="0.5" y="${y}" width="${long ? 5 : 3}" height="0.3" fill="#000"/>`);
        parts.push(`<text x="${long ? 6 : 4}" y="${y + 1}" font-family="${FONT}" font-size="2.6" fill="#000">${y}</text>`);
    }
    // The caption has to fit the narrow side too, or a rotated sheet prints it
    // running off both edges — on a diagnostic page that reads as a fault.
    const capSize = Math.min(2.5, W / 15);
    parts.push(
        `<text x="${W / 2}" y="${H / 2 - 1}" text-anchor="middle" font-family="${FONT}" font-size="${Math.min(4, W / 26)}" font-weight="700" fill="#000">${W} \u00d7 ${H} mm</text>`,
        `<text x="${W / 2}" y="${H / 2 + capSize + 1.6}" text-anchor="middle" font-family="${FONT}" font-size="${capSize}" fill="#000">If this box is not on ONE label,</text>`,
        `<text x="${W / 2}" y="${H / 2 + capSize * 2.4 + 1.6}" text-anchor="middle" font-family="${FONT}" font-size="${capSize}" fill="#000">the printer stock is wrong</text>`,
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${parts.join('')}</svg>`;
}

/**
 * Print without leaving the page.
 *
 * This used to open a window per print. Reception prints labels in quick
 * succession, and a tab appearing and needing dismissing between each one is
 * enough friction to make people avoid the feature. A hidden same-origin frame
 * carries its own document, so its `@page` rule still governs the sheet, and the
 * receptionist never leaves the dashboard. It also removes pop-up blocking as a
 * failure mode entirely.
 *
 * Driving a USB printer directly from the browser is deliberately not attempted:
 * on Windows the TSC driver owns the device, and claiming it for WebUSB needs a
 * driver swap that would stop the hospital's own HIS printing to the same
 * printer. To lose the print dialog as well, Chrome is launched with kiosk
 * printing from a dedicated shortcut, which prints straight to the default
 * printer.
 *
 * Returns false only when a frame could not be created at all.
 */
export function printLabels(patients: LabelPatient[], s: LabelSettings): boolean {
    const svgs: string[] = [];
    const copies = Math.max(1, Math.min(20, Math.round(s.copies || 1)));
    for (const p of patients) {
        const { svg } = buildLabelSvg(p, s);
        for (let i = 0; i < copies; i++) svgs.push(svg);
    }
    return printSvgPages(svgs, s);
}

/** Print the alignment box, through the same path a real label takes. */
export function printAlignmentTest(s: LabelSettings): boolean {
    return printSvgPages([buildAlignmentSvg(s)], s);
}

function printSvgPages(svgs: string[], s: LabelSettings): boolean {
    if (svgs.length === 0) return false;

    const quarterTurn = s.rotateDeg === 90 || s.rotateDeg === 270;
    const frame = document.createElement('iframe');
    frame.setAttribute('data-label-print', 'true');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    // Parked off-screen at its real size rather than hidden or zero-sized: a
    // display:none or 0x0 frame is never laid out, and some engines then print
    // a blank sheet.
    frame.style.cssText =
        `position:fixed;left:-10000px;top:0;border:0;` +
        `width:${quarterTurn ? s.heightMm : s.widthMm}mm;` +
        `height:${quarterTurn ? s.widthMm : s.heightMm}mm;`;
    document.body.appendChild(frame);

    const win = frame.contentWindow;
    const doc = win?.document;
    if (!win || !doc) { frame.remove(); return false; }

    doc.open();
    doc.write(buildLabelPrintHtml(svgs, s, 'Patient label', false));
    doc.close();

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        // Removing the frame while the dialog is still open cancels the job, so
        // this always trails the event rather than racing it.
        window.setTimeout(() => frame.remove(), 1000);
    };

    const go = () => {
        try {
            win.focus();
            win.print();
        } catch {
            /* A refused print is the browser's to report, not ours to retry. */
        }
        cleanup();
    };

    try { win.addEventListener('afterprint', cleanup); } catch { /* older engines */ }
    // A small delay lets the document lay out before the dialog snapshots it.
    if (doc.readyState === 'complete') window.setTimeout(go, 60);
    else frame.onload = () => window.setTimeout(go, 60);
    // Backstop, in case neither load nor afterprint ever fires.
    window.setTimeout(cleanup, 60000);

    return true;
}
