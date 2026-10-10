import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS, questionsFor, optionalFor, fixedVisitTypeFor, questionLabel, doctorDisplayName } from './feedbackQuestions';

const ids = (v: Parameters<typeof questionsFor>[0], used: string[] = []) => questionsFor(v, new Set(used)).map(q => q.id);

describe('feedback questions', () => {
    it('never reuses an id', () => {
        const all = ALL_QUESTIONS.map(q => q.id);
        expect(new Set(all).size).toBe(all.length);
    });

    it('maps each place QR to its form, and the hospital QR to the chooser', () => {
        expect(fixedVisitTypeFor('opd')).toBe('opd');
        expect(fixedVisitTypeFor('ward')).toBe('inpatient');
        expect(fixedVisitTypeFor('Reception')).toBe('reception');
        expect(fixedVisitTypeFor('restroom')).toBe('restroom');
        expect(fixedVisitTypeFor('hospital')).toBeNull();
        expect(fixedVisitTypeFor(null)).toBeNull();
    });

    it('asks OP about the doctor first and overall last', () => {
        expect(ids('opd')).toEqual([
            'doctor_listened', 'doctor_explained', 'doctor_answered',
            'nursing', 'reception', 'waiting_time', 'overall',
        ]);
    });

    it('only asks about the lab, TPA and pharmacy once the patient says they used them', () => {
        expect(optionalFor('opd').map(q => q.id)).toEqual(['laboratory', 'insurance_tpa', 'pharmacy']);
        expect(ids('opd', ['laboratory'])).toContain('laboratory');
        expect(ids('opd')).not.toContain('laboratory');
    });

    it('gives dialysis its own five and no general overall', () => {
        const d = ids('dialysis');
        for (const id of ['dialysis_services', 'dialysis_staff_care', 'dialysis_cleanliness', 'dialysis_waiting', 'dialysis_overall']) expect(d).toContain(id);
        expect(d).not.toContain('overall');
    });

    it('gives admitted patients room, food and housekeeping', () => {
        expect(ids('inpatient')).toEqual(expect.arrayContaining(['room_ward', 'food', 'housekeeping', 'doctor_listened', 'overall']));
    });

    it('keeps the place forms short and on-topic', () => {
        expect(ids('restroom')).toEqual(['restroom', 'restroom_supplies', 'restroom_working']);
        expect(ids('reception')).toEqual(['reception', 'waiting_time']);
        expect(optionalFor('reception').map(q => q.id)).toEqual(['insurance_tpa']);
    });

    it('still labels answers to retired questions', () => {
        expect(questionLabel('staff_behaviour')).toBe('Staff behaviour');
        expect(questionLabel('made_up')).toBe('made_up');
    });

    it('titles a doctor exactly once', () => {
        expect(doctorDisplayName('Dr.A.Prabhakar')).toBe('Dr.A.Prabhakar');
        expect(doctorDisplayName('Dr. A. Divakar')).toBe('Dr. A. Divakar');
        expect(doctorDisplayName('A. Divakar')).toBe('Dr. A. Divakar');
    });
});

describe('poster titles', () => {
    it('names each place, and calls the hospital-wide poster Patient Feedback', async () => {
        const { posterTitleFor } = await import('./feedbackQuestions');
        expect(posterTitleFor('opd').en).toBe('Outpatient Feedback');
        expect(posterTitleFor('ward').en).toBe('Inpatient Feedback');
        expect(posterTitleFor('reception').en).toBe('Reception Feedback');
        expect(posterTitleFor('restroom').en).toBe('Restroom Feedback');
        expect(posterTitleFor('hospital')).toEqual({ en: 'Patient Feedback', ta: 'நோயாளர் கருத்து', isPlace: false });
    });
});
