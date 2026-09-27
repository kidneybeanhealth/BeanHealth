import { describe, it, expect } from 'vitest';
import { parseCsv, parseWhatsAppText, parseDialysisDays, parseProgramme, parseLanguage, parseImportDate, guessMapping } from './importers';

describe('WhatsApp paste', () => {
    it('reads a numbered list with phones and schedules', () => {
        const t = parseWhatsAppText([
            '1. Ravi Kumar - 98765 43210 - MWF',
            '2) Lakshmi S  +91 91234 56789  TTS',
            '3. KNH/26/022020 Jagannathan G 9994981419 Mon/Wed/Fri',
        ].join('\n'));
        expect(t.rows).toEqual([
            ['', 'Ravi Kumar', '9876543210', 'MWF'],
            ['', 'Lakshmi S', '+919123456789', 'TTS'],
            ['KNH/26/022020', 'Jagannathan G', '9994981419', 'Mon/Wed/Fri'],
        ]);
    });

    it('strips WhatsApp export prefixes', () => {
        const t = parseWhatsAppText('[27/09/26, 10:15:22 AM] Asha Coordinator: Meena R 9003012345');
        expect(t.rows[0]).toEqual(['', 'Meena R', '9003012345', '']);
    });

    it('skips lines that are not patients', () => {
        const t = parseWhatsAppText('Today list\n---------\n\n12/09\nRaju 9876500000');
        // "Today list" has letters, so it survives as a nameless-phone row for the preview to flag.
        expect(t.rows.map(r => r[1])).toEqual(['Today list', 'Raju']);
    });

    it('lifts an unreadable schedule out of the name instead of keeping it as part of it', () => {
        expect(parseWhatsAppText('4. Ponnusamy R alternate days 94430 55555').rows[0])
            .toEqual(['', 'Ponnusamy R', '9443055555', 'alternate days']);
        expect(parseWhatsAppText('Devi twice a week 9443011111').rows[0][1]).toBe('Devi');
    });

    it('leaves a missing phone blank rather than guessing', () => {
        expect(parseWhatsAppText('Selvi TTS').rows[0]).toEqual(['', 'Selvi', '', 'TTS']);
    });
});

describe('dialysis days', () => {
    it.each([
        ['MWF', [1, 3, 5]], ['m/w/f', [1, 3, 5]], ['TTS', [2, 4, 6]], ['T-T-S', [2, 4, 6]],
        ['Mon/Wed/Fri', [1, 3, 5]], ['tue, thu, sat', [2, 4, 6]], ['1,3,5', [1, 3, 5]], ['Monday & Thursday', [1, 4]],
    ])('%s', (raw, days) => expect(parseDialysisDays(raw as string)).toEqual(days));

    it('refuses what it does not understand instead of guessing', () => {
        expect(parseDialysisDays('alternate days')).toBeNull();
        expect(parseDialysisDays('twice a week')).toBeNull();
        expect(parseDialysisDays('')).toBeNull();
    });
});

describe('field parsers', () => {
    it('programme', () => {
        expect(parseProgramme('HD')).toBe('dialysis');
        expect(parseProgramme('Hemodialysis')).toBe('dialysis');
        expect(parseProgramme('CKD')).toBe('ckd');
        expect(parseProgramme('Tx')).toBe('transplant');
        expect(parseProgramme('something')).toBeNull();
    });
    it('language', () => {
        expect(parseLanguage('tamil')).toBe('Tamil');
        expect(parseLanguage('hi')).toBe('Hindi');
        expect(parseLanguage('French')).toBeNull();
    });
    it('dates', () => {
        expect(parseImportDate('05/10/2026')).toBe('2026-10-05');
        expect(parseImportDate('2026-10-05')).toBe('2026-10-05');
        expect(parseImportDate('5.10.26')).toBe('2026-10-05');
        expect(parseImportDate('next week')).toBeNull();
    });
});

describe('CSV and mapping', () => {
    it('handles quotes, CRLF and a BOM, and maps common headers', () => {
        const t = parseCsv('﻿UHID,Patient Name,Mobile,HD Days,Language\r\n"KC/1","Kumar, R",9876543210,MWF,Tamil\r\n');
        expect(t.headers).toEqual(['UHID', 'Patient Name', 'Mobile', 'HD Days', 'Language']);
        expect(t.rows).toEqual([['KC/1', 'Kumar, R', '9876543210', 'MWF', 'Tamil']]);
        expect(guessMapping(t.headers)).toEqual({ mrNumber: 0, name: 1, phone: 2, dialysisDays: 3, language: 4 });
    });
});
