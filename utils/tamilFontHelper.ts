/**
 * Tamil Font Helper for jsPDF
 * 
 * This module handles loading and registering the Noto Sans Tamil font
 * for proper Tamil text rendering in PDFs.
 */

import jsPDF from 'jspdf';

// Font data will be loaded dynamically
let tamilFontBase64: string | null = null;
let fontLoadPromise: Promise<string> | null = null;

/**
 * Load the Tamil font base64 data
 */
async function loadTamilFontData(): Promise<string> {
    if (tamilFontBase64) return tamilFontBase64;

    if (fontLoadPromise) return fontLoadPromise;

    fontLoadPromise = fetch('/fonts/NotoSansTamil-Regular.ttf')
        .then(response => response.arrayBuffer())
        .then(buffer => {
            const binary = new Uint8Array(buffer);
            let base64 = '';
            binary.forEach(byte => {
                base64 += String.fromCharCode(byte);
            });
            tamilFontBase64 = btoa(base64);
            return tamilFontBase64;
        })
        .catch(err => {
            console.error('Failed to load Tamil font:', err);
            throw err;
        });

    return fontLoadPromise;
}

/**
 * Register Tamil font with a jsPDF document instance
 */
export async function registerTamilFont(doc: jsPDF): Promise<void> {
    try {
        const fontData = await loadTamilFontData();
        doc.addFileToVFS('NotoSansTamil-Regular.ttf', fontData);
        doc.addFont('NotoSansTamil-Regular.ttf', 'NotoSansTamil', 'normal');
        console.log('Tamil font registered successfully');
    } catch (error) {
        console.error('Failed to register Tamil font:', error);
    }
}

/**
 * Check if Tamil font is available
 */
export function isTamilFontLoaded(): boolean {
    return tamilFontBase64 !== null;
}

/**
 * Bilingual labels for prescription
 */
export const BILINGUAL_LABELS = {
    NAME: { en: 'NAME', ta: 'பெயர்' },
    FATHER_HUSBAND: { en: 'FATHER/HUSBAND', ta: 'தந்தை/கணவர்' },
    PLACE: { en: 'PLACE', ta: 'ஊர்' },
    PHONE: { en: 'PHONE', ta: 'தொலைபேசி' },
    AGE: { en: 'AGE', ta: 'வயது' },
    GENDER: { en: 'M/F', ta: 'ஆண்/பெண்' },
    DRUG_ALLERGY: { en: 'Drug Allergy', ta: 'மருந்து ஒவ்வாமை' },
    DIAGNOSIS: { en: 'Diagnosis', ta: 'நோய் கண்டறிதல்' },
    REG_NO: { en: 'REG. No.', ta: 'பதிவு எண்' },
    DATE: { en: 'DATE', ta: 'தேதி' },
    DRUGS: { en: 'DRUGS', ta: 'மருந்துகள்' },
    NUMBER: { en: 'Number', ta: 'எண்' },
    MORNING: { en: 'Morning', ta: 'காலை' },
    NOON: { en: 'Noon', ta: 'மதியம்' },
    NIGHT: { en: 'Night', ta: 'இரவு' },
    TIMING: { en: 'B/F A/F', ta: 'உணவு' },
    REVIEW_DATE: { en: 'To Come for review on', ta: 'மறுபரிசீலனைக்கு வர வேண்டிய தேதி' },
    TESTS_REVIEW: { en: 'Tests to be done on review', ta: 'சோதனைகள்' },
    SPECIALISTS: { en: 'Specialists to be seen', ta: 'நிபுணர்கள்' },
    DOCTOR_SIGNATURE: { en: 'DOCTOR SIGNATURE', ta: 'மருத்துவர் கையொப்பம்' },
};

/**
 * Helper to format bilingual text
 */
export function formatBilingual(label: { en: string; ta: string }, separator: string = ' / '): string {
    return `${label.en}${separator}${label.ta}`;
}
