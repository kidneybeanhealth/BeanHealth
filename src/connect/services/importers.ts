/**
 * Getting a centre's patient list in — CSV, Excel, or pasted from WhatsApp.
 *
 * Three doors, one shape out: `{ headers, rows }` of strings, which the preview
 * in patients.ts classifies row by row before anything is written. Nothing here
 * touches the database.
 *
 * WhatsApp is the realistic third door. A coordinator is usually sent the list
 * as a message — "1. Ravi Kumar 98765 43210 MWF" — not as a file. Pasting that
 * text in is the whole feature; a photo of a handwritten register is not
 * attempted here, because a misread digit dials a stranger.
 */
import { CALL_LANGUAGES, type Programme } from '../protocol/settings';

export interface Table { headers: string[]; rows: string[][] }

// ── CSV ──────────────────────────────────────────────────────────────────

/** RFC-4180-tolerant: quoted fields, escaped quotes, CRLF, a BOM, a trailing newline. */
export function parseCsv(text: string): Table {
    const rows: string[][] = [];
    let row: string[] = [], field = '', inQ = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQ) {
            if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
            else field += c;
        } else if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && src[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(x => x.trim() !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(x => x.trim() !== '')) rows.push(row);
    const headers = (rows.shift() || []).map(h => h.trim());
    return { headers, rows };
}

// ── Excel ────────────────────────────────────────────────────────────────

const cellText = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) {
        // Excel dates arrive as Date at UTC midnight; format them as the date
        // the sheet showed, not shifted by the browser's offset.
        const y = v.getUTCFullYear(), m = v.getUTCMonth() + 1, d = v.getUTCDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (typeof v === 'number') {
        // A phone typed into a numeric cell must not come back as 9.87654321E9.
        return Number.isInteger(v) ? v.toFixed(0) : String(v);
    }
    return String(v).trim();
};

/**
 * First sheet of an .xlsx. The reader is loaded only when somebody actually
 * imports a spreadsheet, so it never weighs on the rest of Connect.
 */
export async function parseXlsx(file: File): Promise<Table> {
    const { readSheet } = await import('read-excel-file/browser');
    const data = await readSheet(file);
    const all = (data || []).map(r => (r || []).map(cellText));
    const nonEmpty = all.filter(r => r.some(c => c !== ''));
    const headers = (nonEmpty.shift() || []).map(h => h.trim());
    return { headers, rows: nonEmpty };
}

// ── WhatsApp paste ───────────────────────────────────────────────────────

/** A WhatsApp export prefix: "[27/09/26, 10:15:22 AM] Asha: " or "27/09/2026, 10:15 - Asha: ". */
const WA_PREFIX = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?[^:]{1,40}:\s*/;
/** A list marker at the start of a line: "1." "12)" "-" "•" "*". */
const LIST_MARK = /^\s*(?:\d{1,4}[.)]|[-•*])\s+/;
/** An Indian mobile written any of the usual ways. */
const PHONE = /(?:\+?91[\s-]?|0)?[6-9]\d{2}[\s-]?\d{2}[\s-]?\d{5}|(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}/;
/** An MR/UHID-like token: letters, then digits, with / or - allowed inside. */
const MR = /\b[A-Za-z]{1,6}[/-]?\d{2,}(?:[/-]\d+)*\b/;
const DAYS_TOKEN = /\b(MWF|TTS|TTHS|TTHSAT|M[\s/-]?W[\s/-]?F|T[\s/-]?T[\s/-]?S|(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:[a-z]*)?(?:\s*[/,&-]\s*(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*)+)\b/i;
/**
 * Schedule phrases that are not a fixed weekly pattern. They are lifted out of
 * the name all the same — "Ponnusamy R alternate days" is a patient called
 * Ponnusamy R — and land in the days column, where the preview flags them as
 * not understood instead of guessing which weekdays "alternate" means.
 */
const SCHEDULE_PHRASE = /\b(alternate\s+days?|alt\.?\s+days?|twice\s+(?:a|per)\s+week|thrice\s+(?:a|per)\s+week|[23]\s*(?:x|times)\s*(?:a|per)?\s*week|daily)\b/i;

/**
 * One patient per line. Anything the line does not carry is left blank for the
 * preview to warn about — this never guesses a name from a number or the
 * other way round.
 */
export function parseWhatsAppText(text: string): Table {
    const headers = ['MR number', 'Name', 'Phone', 'Dialysis days'];
    const rows: string[][] = [];
    for (const rawLine of text.split(/\r?\n/)) {
        let line = rawLine.replace(WA_PREFIX, '').replace(LIST_MARK, '').trim();
        if (!line) continue;
        // A line with no letters at all ("----", "12/09") is not a patient.
        if (!/[A-Za-z஀-௿ऀ-ॿ]/.test(line)) continue;

        const phoneM = line.match(PHONE);
        const phone = phoneM ? phoneM[0].replace(/[\s-]/g, '') : '';
        if (phoneM) line = line.replace(phoneM[0], ' ');

        const daysM = line.match(DAYS_TOKEN) || line.match(SCHEDULE_PHRASE);
        const days = daysM ? daysM[0] : '';
        if (daysM) line = line.replace(daysM[0], ' ');

        const mrM = line.match(MR);
        const mr = mrM ? mrM[0] : '';
        if (mrM) line = line.replace(mrM[0], ' ');

        const name = line.replace(/[|:;,()[\]]/g, ' ').replace(/\s[-–—]\s/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[-–—]\s*|\s*[-–—]$/g, '');
        rows.push([mr, name, phone, days]);
    }
    return { headers, rows };
}

// ── Field parsers shared by every door ───────────────────────────────────

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd, dd/mm/yy → yyyy-mm-dd, or null. */
export function parseImportDate(raw: string): string | null {
    const v = (raw || '').trim();
    if (!v) return null;
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
    if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
}

const DAY_NAMES: [RegExp, number][] = [
    [/^mon/i, 1], [/^tue/i, 2], [/^wed/i, 3], [/^thu/i, 4], [/^fri/i, 5], [/^sat/i, 6], [/^sun/i, 7],
];

/**
 * Dialysis days as centres write them: "MWF", "TTS", "Mon/Wed/Fri",
 * "tue, thu, sat", "1,3,5". Returns ISO weekdays sorted, or null when the text
 * is not understood — never a guess, because a wrong schedule is a wrong
 * "you missed your session" call.
 */
export function parseDialysisDays(raw: string): number[] | null {
    const v = (raw || '').trim();
    if (!v) return null;
    const compact = v.replace(/[\s/,&.-]/g, '').toUpperCase();
    if (compact === 'MWF') return [1, 3, 5];
    if (compact === 'TTS' || compact === 'TTHS' || compact === 'TTHSAT' || compact === 'TUTHSA') return [2, 4, 6];
    if (/^[1-7](?:[\s,/-]*[1-7])*$/.test(v)) {
        const days = [...new Set(v.match(/[1-7]/g)!.map(Number))].sort();
        return days.length ? days : null;
    }
    const parts = v.split(/[\s/,&-]+/).filter(Boolean);
    const days: number[] = [];
    for (const p of parts) {
        const hit = DAY_NAMES.find(([re]) => re.test(p));
        if (!hit) return null;
        days.push(hit[1]);
    }
    const uniq = [...new Set(days)].sort();
    return uniq.length ? uniq : null;
}

export function parseProgramme(raw: string): Programme | null {
    const v = (raw || '').trim().toLowerCase();
    if (!v) return null;
    if (/^(dialysis|hd|haemodialysis|hemodialysis|pd|mhd)$/.test(v)) return 'dialysis';
    if (/^(ckd|chronic kidney disease|ckd follow ?up)$/.test(v)) return 'ckd';
    if (/^(transplant|tx|rt|renal transplant|kt)$/.test(v)) return 'transplant';
    if (/^(general|op|opd|other)$/.test(v)) return 'general';
    return null;
}

const LANG_CODES: Record<string, string> = { ta: 'Tamil', en: 'English', hi: 'Hindi', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam' };

export function parseLanguage(raw: string): string | null {
    const v = (raw || '').trim();
    if (!v) return null;
    const byName = CALL_LANGUAGES.find(l => l.toLowerCase() === v.toLowerCase());
    return byName || LANG_CODES[v.toLowerCase()] || null;
}

// ── Column mapping ───────────────────────────────────────────────────────

export type ImportField =
    | 'mrNumber' | 'name' | 'phone' | 'attenderName' | 'attenderPhone'
    | 'programme' | 'dialysisDays' | 'language'
    | 'reviewDate' | 'doctorName' | 'age' | 'gender' | 'place';

export const IMPORT_FIELDS: { key: ImportField; label: string; required: boolean; hint: string }[] = [
    { key: 'mrNumber', label: 'MR number', required: true, hint: 'Your patient ID. Used as-is.' },
    { key: 'name', label: 'Name', required: true, hint: 'As it should be spoken on a call.' },
    { key: 'phone', label: 'Phone', required: false, hint: 'Any Indian mobile format.' },
    { key: 'attenderName', label: 'Attender name', required: false, hint: 'Son, daughter, carer.' },
    { key: 'attenderPhone', label: 'Attender phone', required: false, hint: 'Dialled if the patient has none.' },
    { key: 'programme', label: 'Programme', required: false, hint: 'Dialysis, CKD, Transplant, General.' },
    { key: 'dialysisDays', label: 'Dialysis days', required: false, hint: 'MWF, TTS, Mon/Wed/Fri, 1,3,5.' },
    { key: 'language', label: 'Call language', required: false, hint: 'Tamil, English, Hindi …' },
    { key: 'reviewDate', label: 'Review date', required: false, hint: 'dd/mm/yyyy or yyyy-mm-dd.' },
    { key: 'doctorName', label: 'Doctor', required: false, hint: 'Matched or created.' },
    { key: 'age', label: 'Age', required: false, hint: '' },
    { key: 'gender', label: 'Gender', required: false, hint: 'M / F.' },
    { key: 'place', label: 'Place', required: false, hint: '' },
];

export type Mapping = Partial<Record<ImportField, number>>;

/** Best-effort header → field guess, so most exports map themselves. */
export function guessMapping(headers: string[]): Mapping {
    const m: Mapping = {};
    const rules: [ImportField, RegExp][] = [
        ['mrNumber', /^(mr|mrn|mr[ _-]?no\.?|mr[ _-]?number|patient[ _-]?id|uhid|reg[ _-]?no\.?|ip[ _-]?no\.?|id)$/i],
        ['name', /^(name|patient[ _-]?name|full[ _-]?name|patient)$/i],
        ['phone', /^(phone|mobile|contact|cell|phone[ _-]?(no|number)|mobile[ _-]?(no|number)|contact[ _-]?no)$/i],
        ['attenderName', /^(attender|attendant|care[ _-]?taker|caretaker|guardian|attender[ _-]?name|relative)$/i],
        ['attenderPhone', /^(attender[ _-]?(phone|mobile|no)|attendant[ _-]?phone|caretaker[ _-]?phone|alt[ _-]?(phone|mobile|no)|alternate[ _-]?(number|phone)|relative[ _-]?phone)$/i],
        ['programme', /^(programme|program|category|type|treatment|modality)$/i],
        ['dialysisDays', /^(dialysis[ _-]?days|days|schedule|hd[ _-]?days|session[ _-]?days|slot[ _-]?days)$/i],
        ['language', /^(language|lang|call[ _-]?language|preferred[ _-]?language)$/i],
        ['reviewDate', /^(review|review[ _-]?date|next[ _-]?review|follow[ _-]?up|followup[ _-]?date|next[ _-]?visit)$/i],
        ['doctorName', /^(doctor|dr|consultant|physician|doctor[ _-]?name|nephrologist)$/i],
        ['age', /^age$/i],
        ['gender', /^(gender|sex)$/i],
        ['place', /^(place|city|village|town|address|area)$/i],
    ];
    headers.forEach((h, i) => {
        const clean = h.trim();
        for (const [field, re] of rules) if (m[field] === undefined && re.test(clean)) { m[field] = i; break; }
    });
    return m;
}
