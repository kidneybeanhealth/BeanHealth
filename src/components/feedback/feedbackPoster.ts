/**
 * feedbackPoster — the printed QR poster, as one HTML document
 *
 * The on-screen preview and the sheet that reaches the printer are the SAME
 * string: the modal shows this document in an iframe and prints that iframe.
 * Same rule as the case-record label, for the same reason — a print template
 * that drifts from its preview is found out on the wall, not on the screen.
 *
 * ── Why a designed page and not a bare QR ────────────────────────────────
 * A black square on a wall is not self-explanatory. A patient has to know whose
 * it is, what it is for and that it is safe to scan before they will point a
 * phone at it. So the hospital's name leads, the purpose follows in both
 * languages, the QR sits in the middle where the eye lands, and the reassurance
 * — no app, no login, anonymous — is right under it. BeanHealth is a quiet
 * footer: this is the hospital's poster.
 *
 * ── Sizing ───────────────────────────────────────────────────────────────
 * Every dimension is a multiple of --u, which is 1mm on A4 and 1/√2 mm on A5.
 * A5 is A4 scaled by exactly 1/√2, so one layout serves both with nothing
 * re-flowing and nothing to keep in sync.
 *
 * ── Printing on a plain office printer ───────────────────────────────────
 * Must survive black-and-white. Colour is decoration only: every word is
 * dark on white, and the QR carries no colour at all.
 *
 * ── Type ─────────────────────────────────────────────────────────────────
 * Two voices, on purpose. The hospital's poster is set in Times New Roman, at
 * the hospital's request: a formal, institutional face for an institution's
 * notice. Tinos is loaded as its fallback — it is metric-compatible with Times
 * New Roman, so a machine without the font lays out identically instead of
 * reflowing. Times New Roman has no Tamil glyphs, so Tamil is set in Noto Serif
 * Tamil to stay in the same serif register.
 *
 * The "Powered by BeanHealth" signature is set in Inter 600, because that is
 * what beanhealth.in renders the wordmark in (measured, not assumed: the site's
 * CSS names Manrope for headings and Tailwind defaults to Nunito, but the brand
 * word itself computes to Inter). Our mark should look like our mark.
 *
 * Tamil here is machine-written and UNVERIFIED, like the form's. Have the
 * hospital read it before the first poster goes up.
 */

export type PosterSize = 'A4' | 'A5';

export interface PosterInput {
    hospitalName: string;
    /** A data: URL, so the print never waits on a network image. Null hides it. */
    hospitalLogoDataUrl: string | null;
    /** Printed small under the QR when it differs from the hospital name. */
    locationLabel: string;
    url: string;
    qrSvg: string;
    beanLogoSvg: string;
    size: PosterSize;
}

const esc = (v: unknown): string =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** Strip any fixed width/height so the SVG fills whatever box it is placed in. */
const fluidSvg = (svg: string): string =>
    svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1');

export const POSTER_PAGE_MM: Record<PosterSize, { w: number; h: number }> = {
    A4: { w: 210, h: 297 },
    A5: { w: 148, h: 210 },
};

export function buildFeedbackPosterHtml(p: PosterInput): string {
    const unit = p.size === 'A5' ? `${(1 / Math.SQRT2).toFixed(5)}mm` : '1mm';
    const page = POSTER_PAGE_MM[p.size];
    const displayUrl = p.url.replace(/^https?:\/\//, '');
    // Case-insensitive: the profile stores "KONGUNAD KIDNEY CENTRE" and the
    // location row "Kongunad Kidney Centre", which are the same place and must
    // not print twice. Only a genuinely different spot (a station, a ward) shows.
    const norm = (v: string) => (v || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const showLocation = !!p.locationLabel && norm(p.locationLabel) !== norm(p.hospitalName);
    const initial = esc((p.hospitalName || 'H').trim().charAt(0).toUpperCase());

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(p.hospitalName)} — Patient Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&family=Noto+Serif+Tamil:wght@400;600;700&family=Inter:wght@500;600&display=block" rel="stylesheet" />
<style>
  @page { size: ${p.size} portrait; margin: 0; }
  :root {
    color-scheme: only light;
    --u: ${unit};
    --ink: #111827;
    --muted: #4b5563;
    --soft: #9ca3af;
    --line: #e5e7eb;
    --accent: #f97316;
    --accent-soft: #fff7ed;
    --bean: #3A2524;
    --leaf: #8AC43C;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Times New Roman', Tinos, Times, 'Noto Serif Tamil', serif;
    color: var(--ink);
  }
  .ta { font-family: 'Noto Serif Tamil', 'Nirmala UI', 'Latha', 'Times New Roman', Tinos, serif; }

  .sheet {
    width: ${page.w}mm; height: ${page.h}mm;
    padding: calc(var(--u) * 16) calc(var(--u) * 18) calc(var(--u) * 11);
    display: flex; flex-direction: column; align-items: center; text-align: center;
    position: relative; overflow: hidden;
  }
  /* A band of the accent across the top edge. Decoration only; prints as a
     grey rule in black-and-white and loses nothing. */
  .sheet::before {
    content: ''; position: absolute; left: 0; right: 0; top: 0;
    height: calc(var(--u) * 3.2); background: var(--accent);
  }

  .hosp { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 3); }
  .logo {
    width: calc(var(--u) * 20); height: calc(var(--u) * 20);
    border-radius: calc(var(--u) * 4.5); object-fit: contain;
    border: calc(var(--u) * 0.35) solid var(--line); background: #fff;
  }
  .logo-fallback {
    width: calc(var(--u) * 20); height: calc(var(--u) * 20);
    border-radius: calc(var(--u) * 4.5); background: var(--accent-soft);
    color: var(--accent); font-weight: 700; font-size: calc(var(--u) * 10);
    display: flex; align-items: center; justify-content: center;
  }
  .hosp-name {
    font-size: calc(var(--u) * 10.5); font-weight: 700; line-height: 1.1;
    letter-spacing: 0.03em; margin: 0;
  }

  .kicker {
    margin-top: calc(var(--u) * 5.5);
    display: inline-flex; align-items: center; gap: calc(var(--u) * 2.4);
    padding: calc(var(--u) * 1.8) calc(var(--u) * 5);
    border-radius: 999px; background: var(--accent-soft);
    border: calc(var(--u) * 0.35) solid #fed7aa;
  }
  .kicker b {
    font-size: calc(var(--u) * 4.4); font-weight: 700; letter-spacing: 0.16em;
    text-transform: uppercase; color: #c2410c;
  }
  .kicker span { font-size: calc(var(--u) * 4); font-weight: 700; color: #c2410c; }
  .kicker i { width: calc(var(--u) * 1.3); height: calc(var(--u) * 1.3); border-radius: 50%; background: #fdba74; }

  .headline {
    margin: calc(var(--u) * 8) 0 0; font-size: calc(var(--u) * 14); font-weight: 700;
    line-height: 1.05; letter-spacing: 0;
  }
  .headline-ta { margin: calc(var(--u) * 2.4) 0 0; font-size: calc(var(--u) * 6.4); font-weight: 600; color: var(--muted); }
  .sub { margin: calc(var(--u) * 4) 0 0; font-size: calc(var(--u) * 5); line-height: 1.45; color: var(--muted); font-weight: 400; }
  .sub .ta { display: block; font-size: calc(var(--u) * 4); }

  .qr-wrap { position: relative; margin-top: calc(var(--u) * 8); padding: calc(var(--u) * 5); }
  /* Corner brackets — the conventional "point your camera here" cue. */
  .qr-wrap i {
    position: absolute; width: calc(var(--u) * 11); height: calc(var(--u) * 11);
    border-color: var(--accent); border-style: solid; border-width: 0;
  }
  .qr-wrap i:nth-child(1) { left: 0; top: 0; border-left-width: calc(var(--u) * 1.4); border-top-width: calc(var(--u) * 1.4); border-top-left-radius: calc(var(--u) * 4); }
  .qr-wrap i:nth-child(2) { right: 0; top: 0; border-right-width: calc(var(--u) * 1.4); border-top-width: calc(var(--u) * 1.4); border-top-right-radius: calc(var(--u) * 4); }
  .qr-wrap i:nth-child(3) { left: 0; bottom: 0; border-left-width: calc(var(--u) * 1.4); border-bottom-width: calc(var(--u) * 1.4); border-bottom-left-radius: calc(var(--u) * 4); }
  .qr-wrap i:nth-child(4) { right: 0; bottom: 0; border-right-width: calc(var(--u) * 1.4); border-bottom-width: calc(var(--u) * 1.4); border-bottom-right-radius: calc(var(--u) * 4); }
  .qr {
    width: calc(var(--u) * 92); height: calc(var(--u) * 92);
    padding: calc(var(--u) * 3); background: #fff;
    border: calc(var(--u) * 0.35) solid var(--line); border-radius: calc(var(--u) * 4);
  }
  .qr svg { display: block; width: 100%; height: 100%; }
  .url {
    margin-top: calc(var(--u) * 2.5); font-size: calc(var(--u) * 4.6); font-weight: 700;
    letter-spacing: 0.02em; color: var(--ink);
  }
  .loc { margin-top: calc(var(--u) * 1); font-size: calc(var(--u) * 4); color: var(--soft); font-weight: 700; }

  .points {
    margin-top: calc(var(--u) * 7); display: flex; justify-content: center;
    gap: calc(var(--u) * 5); flex-wrap: wrap;
  }
  .pt { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.6); min-width: calc(var(--u) * 38); }
  .pt b { font-size: calc(var(--u) * 4.5); font-weight: 700; }
  .pt span { font-size: calc(var(--u) * 3.5); color: var(--muted); }
  .pt .tick {
    width: calc(var(--u) * 6.4); height: calc(var(--u) * 6.4); border-radius: 50%;
    background: #ecfdf5; color: #059669; font-weight: 700; font-size: calc(var(--u) * 3.8);
    display: flex; align-items: center; justify-content: center; margin-bottom: calc(var(--u) * 1);
    border: calc(var(--u) * 0.35) solid #a7f3d0;
  }

  .foot {
    margin-top: auto; width: 100%; padding-top: calc(var(--u) * 5);
    border-top: calc(var(--u) * 0.35) solid var(--line);
    display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 2.2);
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .foot small { font-size: calc(var(--u) * 3.6); color: var(--soft); font-weight: 500; letter-spacing: 0.01em; }
  .bean { width: calc(var(--u) * 9.5); height: calc(var(--u) * 9.5); }
  .bean svg { display: block; width: 100%; height: 100%; }
  .word { font-size: calc(var(--u) * 6); font-weight: 600; letter-spacing: -0.01em; }
  .word .b { color: var(--bean); }
  .word .h { color: var(--leaf); }
</style></head>
<body><div class="sheet">
  <div class="hosp">
    ${p.hospitalLogoDataUrl
        ? `<img class="logo" src="${esc(p.hospitalLogoDataUrl)}" alt="" />`
        : `<div class="logo-fallback">${initial}</div>`}
    <h1 class="hosp-name">${esc(p.hospitalName)}</h1>
  </div>

  <div class="kicker"><b>Patient Review</b><i></i><span class="ta">நோயாளர் கருத்து</span></div>

  <h2 class="headline">How was your visit?</h2>
  <p class="headline-ta ta">உங்கள் வருகை எப்படி இருந்தது?</p>
  <p class="sub">
    Scan with your phone camera. It takes under a minute.
    <span class="ta">உங்கள் ஃபோன் காமிராவால் ஸ்கேன் செய்யுங்கள் — ஒரு நிமிடம் போதும்.</span>
  </p>

  <div class="qr-wrap"><i></i><i></i><i></i><i></i>
    <div class="qr">${fluidSvg(p.qrSvg)}</div>
  </div>
  <div class="url">${esc(displayUrl)}</div>
  ${showLocation ? `<div class="loc">${esc(p.locationLabel)}</div>` : ''}

  <div class="points">
    <div class="pt"><div class="tick">✓</div><b>No app needed</b><span class="ta">ஆப் தேவையில்லை</span></div>
    <div class="pt"><div class="tick">✓</div><b>No login</b><span class="ta">உள்நுழைவு இல்லை</span></div>
    <div class="pt"><div class="tick">✓</div><b>Anonymous by default</b><span class="ta">இயல்பாக பெயர் இல்லாமல்</span></div>
  </div>

  <div class="foot">
    <small>Powered by</small>
    <span class="bean">${fluidSvg(p.beanLogoSvg)}</span>
    <span class="word"><span class="b">Bean</span><span class="h">Health</span></span>
  </div>
</div></body></html>`;
}
