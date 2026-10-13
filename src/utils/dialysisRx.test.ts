import { describe, it, expect } from 'vitest';
import { asRxTemplate, summariseDialysisHistory } from './dialysisRx';

const notes = 'Place: \nPhone: \nDiagnosis: CKD5D\nReview: 2026-09-12\nTests: RFT\nSpecialistToReview: Cardio\nSaltIntake: ';

describe('asRxTemplate', () => {
    it('clears a review date that has already passed, in both places', () => {
        const t = asRxTemplate({ next_review_date: '2026-09-12', notes }, '2026-10-13');
        expect(t.next_review_date).toBeNull();
        expect(t.notes).toContain('\nReview: \n');
        expect(t.notes).not.toContain('2026-09-12');
    });

    it('leaves the specialist line alone — it also contains "Review:"', () => {
        const t = asRxTemplate({ next_review_date: '2026-09-12', notes }, '2026-10-13');
        expect(t.notes).toContain('SpecialistToReview: Cardio');
        expect(t.notes).toContain('Diagnosis: CKD5D');
        expect(t.notes).toContain('Tests: RFT');
    });

    it('keeps a review date that is today or still ahead', () => {
        const rx = { next_review_date: '2026-11-14', notes: notes.replace('2026-09-12', '2026-11-14') };
        expect(asRxTemplate(rx, '2026-10-13')).toBe(rx);
        expect(asRxTemplate({ next_review_date: '2026-10-13', notes }, '2026-10-13').next_review_date).toBe('2026-10-13');
    });

    it('reads the date from notes when the column is empty (older rows)', () => {
        const t = asRxTemplate({ next_review_date: null, notes }, '2026-10-13');
        expect(t.notes).not.toContain('2026-09-12');
    });

    it('leaves a prescription with no review date untouched', () => {
        const rx = { next_review_date: null, notes: 'Diagnosis: CKD' };
        expect(asRxTemplate(rx, '2026-10-13')).toBe(rx);
    });
});

describe('summariseDialysisHistory', () => {
    it('counts per patient and keeps the newest date', () => {
        const s = summariseDialysisHistory([
            { patient_id: 'raju', created_at: '2026-10-12T05:48:00Z' },
            { patient_id: 'raju', created_at: '2026-09-11T11:04:00Z' },
            { patient_id: 'raju', created_at: '2026-08-27T04:19:00Z' },
            { patient_id: 'other', created_at: '2026-10-01T04:00:00Z' },
        ]);
        expect(s.raju).toEqual({ count: 3, lastAt: '2026-10-12T05:48:00Z' });
        expect(s.other.count).toBe(1);
        expect(s.nobody).toBeUndefined();
    });
});
