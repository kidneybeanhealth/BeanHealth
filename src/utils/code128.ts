/**
 * code128 — Code 128B encoder, returning bar/space widths in modules.
 *
 * Written rather than pulled from a package for two reasons. The label has to
 * survive a 203 dpi thermal head, which means bar widths must land on whole
 * printer dots; a library that hands back a canvas or a scaled SVG has already
 * thrown that control away. And the hospital's current labels carry an "MW6
 * Demo" watermark from an unlicensed barcode component, which is one of the
 * things we are replacing, so the replacement should not carry a licence
 * question of its own.
 *
 * Code set B only. It covers ASCII 32..126, which is everything an MR number
 * holds including the slashes, and a thirteen character MRD comes to 178
 * modules — comfortably inside a 4 inch label even at 3 dots per module. Set C
 * would pack digit pairs tighter, but the win is a few millimetres and the cost
 * is a shift-state machine that has to be right every time, on a label a
 * hospital files for years.
 */

/** Widths for values 0..106: bar, space, bar, space, bar, space (stop has 7). */
const PATTERNS: string[] = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

export class Code128Error extends Error {}

/**
 * Encode `value` as Code 128B.
 *
 * Returns alternating widths in modules, starting with a BAR. Callers multiply
 * by their chosen module width; nothing here assumes pixels, millimetres or dots.
 */
export function encodeCode128B(value: string): number[] {
    if (!value) throw new Code128Error('Nothing to encode');

    const codes: number[] = [START_B];
    for (const ch of value) {
        const c = ch.charCodeAt(0);
        // Set B covers 32..126. A rupee sign or a stray Tamil character pasted
        // into an MR field would otherwise encode as garbage that scans as
        // something else, which is worse than refusing.
        if (c < 32 || c > 126) {
            throw new Code128Error(`Character "${ch}" cannot be encoded in Code 128B`);
        }
        codes.push(c - 32);
    }

    // Checksum: start value plus each data value weighted by its position.
    let sum = START_B;
    for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
    codes.push(sum % 103);
    codes.push(STOP);

    const widths: number[] = [];
    for (const code of codes) {
        for (const d of PATTERNS[code]) widths.push(Number(d));
    }
    return widths;
}

/** Total modules a value occupies, for fitting the barcode to the label. */
export function code128BModuleCount(value: string): number {
    return encodeCode128B(value).reduce((a, b) => a + b, 0);
}
