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
 * It rasterises the exact poster in the preview iframe (what the receptionist
 * checked is what the file holds) at 3x, about 290 dpi on A4 — enough for a
 * crisp QR and clean Tamil. Print stays for a laptop wanting vector output.
 */
import { POSTER_PAGE_MM, type PosterSize } from './feedbackPoster';

/** CSS pixels per millimetre, the same constant the browser uses (96 dpi). */
const PX_PER_MM = 96 / 25.4;

/** Every face the poster uses. The sample text pulls in the Tamil subset too. */
const POSTER_FONT_FACES = [
    '400 16px Tinos', '700 16px Tinos',
    '400 16px "Noto Serif Tamil"', '600 16px "Noto Serif Tamil"', '700 16px "Noto Serif Tamil"',
    '500 16px Inter', '600 16px Inter',
];

/**
 * Load the poster's webfonts into THIS document, not just the iframe.
 *
 * html2canvas draws onto a canvas owned by the app page, and a canvas can only
 * use fonts its own document has loaded. The poster loads Tinos and Noto Serif
 * Tamil inside its iframe, so without this the canvas fell back to a narrower
 * system font while keeping the iframe's word positions: Tamil came out with
 * gaps between words, and on Android (no Times New Roman) the English would too.
 */
async function loadPosterFontsHere(posterDoc: Document): Promise<void> {
    const href = posterDoc.querySelector('link[href*="fonts.googleapis.com/css2"]')?.getAttribute('href');
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
    if (!fonts?.load) return;
    await Promise.race([
        Promise.all(POSTER_FONT_FACES.map(face => fonts.load(face, 'Aஅ').catch(() => null))),
        new Promise(r => setTimeout(r, 5000)),
    ]);
}

/** Build the PDF from the poster document inside `frame`. */
export async function buildPosterPdf(frame: HTMLIFrameElement, size: PosterSize) {
    const doc = frame.contentDocument;
    const sheet = doc?.querySelector('.sheet') as HTMLElement | null;
    if (!doc || !sheet) throw new Error('The poster has not finished loading');

    // A rasterised fallback font cannot be fixed afterwards, unlike a print.
    const fonts = (doc as any).fonts?.ready as Promise<unknown> | undefined;
    if (fonts) await Promise.race([fonts, new Promise(r => setTimeout(r, 4000))]);
    await loadPosterFontsHere(doc);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const page = POSTER_PAGE_MM[size];

    const canvas = await html2canvas(sheet, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: Math.round(page.w * PX_PER_MM),
        height: Math.round(page.h * PX_PER_MM),
        windowWidth: Math.round(page.w * PX_PER_MM),
        windowHeight: Math.round(page.h * PX_PER_MM),
    });

    // Explicit orientation and format: this is the whole point of the file.
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: size === 'A5' ? 'a5' : 'a4', compress: true });
    // PNG, not JPEG: compression artefacts on QR module edges cost scans.
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, page.w, page.h, undefined, 'FAST');
    return pdf;
}

/** Build and save. On a phone this lands in Downloads like any other file. */
export async function downloadPosterPdf(frame: HTMLIFrameElement, size: PosterSize, fileName: string): Promise<void> {
    const pdf = await buildPosterPdf(frame, size);
    pdf.save(fileName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim());
}
