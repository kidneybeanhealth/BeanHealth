/**
 * feedbackPosterPdf — the poster as a real PDF file
 *
 * Print works on a laptop because desktop Chrome honours the poster's
 * `@page { size: A4 portrait }`. Chrome on Android does not reliably: it laid
 * the portrait poster on a LANDSCAPE A4 page and shrank it to half the width,
 * which is what the PA's phone saved (Oct 2026). A phone's print dialog is not
 * something this page can control, so the dependable path is to build the PDF
 * here, with the page size and orientation set explicitly — the same file on
 * every device, and one that can be sent on WhatsApp to whoever prints it.
 *
 * ── How the page becomes pixels ───────────────────────────────────────────
 * The poster HTML is wrapped in an SVG <foreignObject> and drawn onto a canvas,
 * so the BROWSER's own layout engine paints it — the same engine that draws the
 * preview, so the file matches the preview exactly. The first version used
 * html2canvas, which re-implements layout and got it visibly wrong: ticks sat
 * at the bottom of their circles, "Powered by BeanHealth" dropped below the bean
 * mark, and Tamil words spread apart. Those are html2canvas's own text-metric
 * approximations, not fixable from the poster side.
 *
 * An SVG drawn as an image may not fetch anything, so the webfonts are embedded
 * as data URIs (latin + Tamil subsets only, ~0.5 MB, fetched once per session).
 * That also makes the file independent of the device's own fonts: an Android
 * phone has no Times New Roman, and gets the embedded Tinos instead.
 *
 * Safari can refuse to export a canvas that has drawn a foreignObject (it marks
 * the canvas "tainted"). When that happens this falls back to html2canvas, with
 * the poster's fonts loaded into the page first — slightly less faithful, never
 * broken.
 */
import { POSTER_PAGE_MM, type PosterSize } from './feedbackPoster';

/** CSS pixels per millimetre, the same constant the browser uses (96 dpi). */
const PX_PER_MM = 96 / 25.4;

/** 3x ≈ 290 dpi on A4: a crisp QR and clean Tamil, about 0.3 MB of PDF. */
const SCALE = 3;

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });

const fontsHref = (html: string): string | null =>
    new DOMParser().parseFromString(html, 'text/html')
        .querySelector('link[href*="fonts.googleapis.com/css2"]')?.getAttribute('href') ?? null;

let embeddedFontCss: Promise<string> | null = null;

/**
 * The poster's @font-face rules with every font file inlined. Google serves 39
 * faces across scripts for this request; only the latin and Tamil ones are
 * kept, because the poster uses nothing else.
 */
function embeddedFonts(href: string): Promise<string> {
    if (!embeddedFontCss) {
        embeddedFontCss = (async () => {
            const css = await (await fetch(href)).text();
            const faces = css.split('@font-face').slice(1).map(b => '@font-face' + b.slice(0, b.indexOf('}') + 1));
            const wanted = faces.filter(f => {
                const range = (f.match(/unicode-range:([^;]+);/) || [, ''])[1];
                return /U\+0000-00FF/i.test(range) || /U\+0B[89A-F]/i.test(range);
            });
            const inlined = await Promise.all(wanted.map(async face => {
                const url = face.match(/url\(([^)]+)\)/)?.[1];
                if (!url) return face;
                const data = await blobToDataUrl(await (await fetch(url)).blob());
                return face.replace(url, data);
            }));
            return inlined.join('\n');
        })().catch(err => { embeddedFontCss = null; throw err; });
    }
    return embeddedFontCss;
}

/** Paint the poster with the browser's own engine, via SVG foreignObject. */
async function paintNatively(html: string, size: PosterSize): Promise<HTMLCanvasElement> {
    const page = POSTER_PAGE_MM[size];
    const W = Math.round(page.w * PX_PER_MM);
    const H = Math.round(page.h * PX_PER_MM);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const href = fontsHref(html);
    doc.querySelectorAll('link').forEach(l => l.remove());   // cannot load inside an SVG image
    if (href) {
        const style = doc.createElement('style');
        style.textContent = await embeddedFonts(href);
        doc.head.prepend(style);
    }
    const xhtml = new XMLSerializer().serializeToString(doc.documentElement);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}">`
        + `<foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    // Drawn twice: some engines paint an SVG image once before its embedded
    // fonts are decoded. The second pass is free and lands the real glyphs.
    for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (pass === 0) await new Promise(r => setTimeout(r, 60));
    }
    canvas.toDataURL('image/png');   // throws here, not later, if the canvas is tainted
    return canvas;
}

/** Every face the poster uses. The sample text pulls in the Tamil subset too. */
const POSTER_FONT_FACES = [
    '400 16px Tinos', '700 16px Tinos',
    '400 16px "Noto Serif Tamil"', '600 16px "Noto Serif Tamil"', '700 16px "Noto Serif Tamil"',
    '500 16px Inter', '600 16px Inter',
];

/**
 * Fallback only. html2canvas draws onto a canvas owned by the app page, and a
 * canvas can only use fonts its own document has loaded, so the poster's fonts
 * are loaded here first — otherwise Tamil comes out with gaps between words.
 */
async function paintWithHtml2canvas(frame: HTMLIFrameElement, size: PosterSize): Promise<HTMLCanvasElement> {
    const doc = frame.contentDocument;
    const sheet = doc?.querySelector('.sheet') as HTMLElement | null;
    if (!doc || !sheet) throw new Error('The poster has not finished loading');

    const href = doc.querySelector('link[href*="fonts.googleapis.com/css2"]')?.getAttribute('href');
    if (href && !document.querySelector('link[data-poster-fonts]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.posterFonts = '1';
        await new Promise<void>(resolve => {
            link.onload = () => resolve();
            link.onerror = () => resolve();
            document.head.appendChild(link);
        });
    }
    const fonts = (document as any).fonts;
    if (fonts?.load) {
        await Promise.race([
            Promise.all(POSTER_FONT_FACES.map(face => fonts.load(face, 'Aஅ').catch(() => null))),
            new Promise(r => setTimeout(r, 5000)),
        ]);
    }

    const { default: html2canvas } = await import('html2canvas');
    const page = POSTER_PAGE_MM[size];
    return html2canvas(sheet, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: Math.round(page.w * PX_PER_MM),
        height: Math.round(page.h * PX_PER_MM),
        windowWidth: Math.round(page.w * PX_PER_MM),
        windowHeight: Math.round(page.h * PX_PER_MM),
    });
}

/**
 * Build the PDF. `html` is the poster document (what the preview iframe holds);
 * `frame` is that iframe, used only by the fallback.
 */
export async function buildPosterPdf(html: string, frame: HTMLIFrameElement | null, size: PosterSize) {
    let canvas: HTMLCanvasElement;
    try {
        canvas = await paintNatively(html, size);
    } catch (err) {
        if (!frame) throw err;
        console.warn('[poster pdf] native paint failed, using html2canvas', err);
        canvas = await paintWithHtml2canvas(frame, size);
    }

    const { jsPDF } = await import('jspdf');
    const page = POSTER_PAGE_MM[size];
    // Explicit orientation and format: this is the whole point of the file.
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: size === 'A5' ? 'a5' : 'a4', compress: true });
    // PNG, not JPEG: compression artefacts on QR module edges cost scans.
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, page.w, page.h, undefined, 'FAST');
    return pdf;
}

/** Build and save. On a phone this lands in Downloads like any other file. */
export async function downloadPosterPdf(html: string, frame: HTMLIFrameElement | null, size: PosterSize, fileName: string): Promise<void> {
    const pdf = await buildPosterPdf(html, frame, size);
    pdf.save(fileName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim());
}
