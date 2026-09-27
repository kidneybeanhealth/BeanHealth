import { describe, it, expect } from 'vitest';
import { buildWorklist, isoWeekday, addDays, nextSessionAfter, type EngineInput, type EnginePatient } from './engine';
import { DEFAULT_SETTINGS, resolveSettings, type ConnectSettings } from './settings';

// Monday 28 September 2026.
const TODAY = '2026-09-28';
const NOW = new Date('2026-09-28T10:00:00Z');

const patient = (over: Partial<EnginePatient> = {}): EnginePatient => ({
    id: 'p1', name: 'Ravi', mrNumber: 'KC/001', programme: 'dialysis', dialysisDays: [1, 3, 5],
    phoneE164: '+919800000001', attenderPhoneE164: null,
    doNotCall: false, callHold: false, isDeceased: false, stopped: false,
    ...over,
});

const settings = (over: (s: ConnectSettings) => void = () => {}): ConnectSettings => {
    const s = structuredClone(DEFAULT_SETTINGS);
    over(s);
    return s;
};

const run = (over: Partial<EngineInput>) => buildWorklist({
    today: TODAY, now: NOW, settings: DEFAULT_SETTINGS,
    patients: [patient()], sessions: [], labs: [], reviews: [], attempts: [],
    ...over,
});

describe('dates', () => {
    it('knows the weekday of a date key without timezone drift', () => {
        expect(isoWeekday('2026-09-28')).toBe(1); // Monday
        expect(isoWeekday('2026-09-27')).toBe(7); // Sunday
        expect(addDays('2026-09-28', -3)).toBe('2026-09-25');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });
    it('finds the next scheduled session', () => {
        expect(nextSessionAfter([1, 3, 5], TODAY)).toBe('2026-09-30'); // Wed
        expect(nextSessionAfter(null, TODAY)).toBeNull();
    });
});

describe('missed dialysis sessions', () => {
    it('never treats an UNMARKED session as missed — it is listed for a human instead', () => {
        const r = run({});
        expect(r.items.filter(i => i.reason === 'missed_session')).toHaveLength(0);
        // Mon 21, Wed 23, Fri 25 Sep are scheduled in the 7-day window; today is excluded.
        expect(r.unmarked.map(u => u.date)).toEqual(['2026-09-25', '2026-09-23', '2026-09-21']);
    });

    it('raises a call when a session was marked missed', () => {
        const r = run({ sessions: [{ patientId: 'p1', date: '2026-09-25', status: 'missed' }] });
        const item = r.items.find(i => i.reason === 'missed_session')!;
        expect(item).toBeDefined();
        expect(item.priority).toBe(2);
        expect(item.detail).toContain('Fri 25 Sep');
        expect(item.detail).toContain('next scheduled Wed 30 Sep');
    });

    it('treats a missed session followed by an attended one as recovered', () => {
        const r = run({ sessions: [
            { patientId: 'p1', date: '2026-09-23', status: 'missed' },
            { patientId: 'p1', date: '2026-09-25', status: 'attended' },
        ] });
        expect(r.items.filter(i => i.reason === 'missed_session')).toHaveLength(0);
    });

    it('escalates a streak to urgent', () => {
        const r = run({ sessions: [
            { patientId: 'p1', date: '2026-09-23', status: 'missed' },
            { patientId: 'p1', date: '2026-09-25', status: 'missed' },
        ] });
        const item = r.items.find(i => i.reason === 'missed_session')!;
        expect(item.streak).toBe(2);
        expect(item.priority).toBe(1);
        expect(item.title).toMatch(/2 dialysis sessions/);
    });

    it('ignores centre-cancelled sessions in both the streak and recovery', () => {
        const r = run({ sessions: [
            { patientId: 'p1', date: '2026-09-21', status: 'missed' },
            { patientId: 'p1', date: '2026-09-23', status: 'cancelled' },
            { patientId: 'p1', date: '2026-09-25', status: 'missed' },
        ] });
        expect(r.items.find(i => i.reason === 'missed_session')!.streak).toBe(2);
    });

    it('stops calling about a miss older than the lookback window', () => {
        const r = run({ sessions: [{ patientId: 'p1', date: '2026-09-14', status: 'missed' }] });
        expect(r.items.filter(i => i.reason === 'missed_session')).toHaveLength(0);
    });

    it('only applies to the dialysis programme', () => {
        const r = run({
            patients: [patient({ programme: 'ckd' })],
            sessions: [{ patientId: 'p1', date: '2026-09-25', status: 'missed' }],
        });
        expect(r.items.filter(i => i.reason === 'missed_session')).toHaveLength(0);
        expect(r.unmarked).toHaveLength(0);
    });
});

describe('labs due', () => {
    it('does not call about a test that was never recorded, but counts it', () => {
        const r = run({});
        expect(r.items.filter(i => i.reason === 'lab_due')).toHaveLength(0);
        expect(r.labsNoBaseline).toBe(1);
    });

    it('reminds within the lead window, as routine', () => {
        // CBC every 30 days: done 30 Aug → due 29 Sep, which is tomorrow (lead 3).
        const r = run({ labs: [{ patientId: 'p1', testCode: 'cbc', doneOn: '2026-08-30' }] });
        const item = r.items.find(i => i.reason === 'lab_due')!;
        expect(item.priority).toBe(3);
        expect(item.title).toBe('Lab tests due soon');
    });

    it('marks an overdue test as today-priority', () => {
        const r = run({ labs: [{ patientId: 'p1', testCode: 'cbc', doneOn: '2026-08-01' }] });
        expect(r.items.find(i => i.reason === 'lab_due')!.priority).toBe(2);
    });

    it('collapses several due tests into ONE item — one call, not four', () => {
        const r = run({ labs: [
            { patientId: 'p1', testCode: 'cbc', doneOn: '2026-08-01' },
            { patientId: 'p1', testCode: 'rft', doneOn: '2026-08-05' },
        ] });
        const labs = r.items.filter(i => i.reason === 'lab_due');
        expect(labs).toHaveLength(1);
        expect(labs[0].detail).toMatch(/CBC.*Kidney function/);
    });

    it('uses the latest record of a test', () => {
        const r = run({ labs: [
            { patientId: 'p1', testCode: 'cbc', doneOn: '2026-06-01' },
            { patientId: 'p1', testCode: 'cbc', doneOn: '2026-09-20' },
        ] });
        expect(r.items.filter(i => i.reason === 'lab_due')).toHaveLength(0);
    });
});

describe('reviews', () => {
    it('reminds the day before', () => {
        const r = run({ patients: [patient({ programme: 'general' })], reviews: [{ patientId: 'p1', reviewDate: '2026-09-29' }] });
        const item = r.items.find(i => i.reason === 'review_due')!;
        expect(item.callable).toBe(true);
        expect(item.priority).toBe(3);
    });

    it('flags an overdue review inside the window', () => {
        const r = run({ patients: [patient({ programme: 'general' })], reviews: [{ patientId: 'p1', reviewDate: '2026-09-10' }] });
        expect(r.items.find(i => i.reason === 'review_overdue')!.detail).toContain('18 days ago');
    });

    it('stops reminding once a review is too far overdue for a reminder to fix', () => {
        const r = run({ patients: [patient({ programme: 'general' })], reviews: [{ patientId: 'p1', reviewDate: '2026-07-01' }] });
        expect(r.items).toHaveLength(0);
    });

    it('prefers an upcoming review over an old missed one', () => {
        const r = run({ patients: [patient({ programme: 'general' })], reviews: [
            { patientId: 'p1', reviewDate: '2026-09-10' },
            { patientId: 'p1', reviewDate: '2026-09-29' },
        ] });
        expect(r.items.map(i => i.reason)).toEqual(['review_due']);
    });
});

describe('who can be called', () => {
    const due = { reviews: [{ patientId: 'p1', reviewDate: '2026-09-29' }] };
    const gen = (o: Partial<EnginePatient> = {}) => [patient({ programme: 'general', ...o })];

    it('blocks do-not-call, hold and no-phone, with a reason a coordinator can act on', () => {
        expect(run({ ...due, patients: gen({ doNotCall: true }) }).items[0].blockedReason).toBe('Asked not to be called');
        expect(run({ ...due, patients: gen({ callHold: true }) }).items[0].blockedReason).toMatch(/hold/);
        expect(run({ ...due, patients: gen({ phoneE164: null }) }).items[0].blockedReason).toBe('No phone number');
    });

    it('accepts the attender phone when the patient has none', () => {
        expect(run({ ...due, patients: gen({ phoneE164: null, attenderPhoneE164: '+919800000002' }) }).items[0].callable).toBe(true);
    });

    it('blocks a purpose whose voice-agent script does not exist yet', () => {
        const r = run({ sessions: [{ patientId: 'p1', date: '2026-09-25', status: 'missed' }] });
        const item = r.items.find(i => i.reason === 'missed_session')!;
        expect(item.callable).toBe(false);
        expect(item.blockedReason).toMatch(/not set up/);
        const ready = run({
            settings: settings(s => { s.calls.purposesReady = ['review', 'missed_session']; }),
            sessions: [{ patientId: 'p1', date: '2026-09-25', status: 'missed' }],
        });
        expect(ready.items.find(i => i.reason === 'missed_session')!.callable).toBe(true);
    });

    it('allows only ONE call per patient per day, most important reason first', () => {
        const r = run({
            settings: settings(s => { s.calls.purposesReady = ['review', 'lab_due']; }),
            reviews: [{ patientId: 'p1', reviewDate: '2026-09-10' }],
            labs: [{ patientId: 'p1', testCode: 'cbc', doneOn: '2026-08-01' }],
        });
        const [first, second] = r.items;
        expect(first.reason).toBe('review_overdue');
        expect(first.callable).toBe(true);
        expect(second.reason).toBe('lab_due');
        expect(second.callable).toBe(false);
        expect(second.blockedReason).toMatch(/One call a day/);
    });

    it('gives the day\'s one call to a reason that can actually be dialled', () => {
        // Labs rank above a review reminder, but the lab script does not exist
        // yet — the review reminder must still go out, not wait behind it.
        const r = run({
            patients: gen({ programme: 'ckd' }),
            reviews: [{ patientId: 'p1', reviewDate: '2026-09-29' }],
            labs: [{ patientId: 'p1', testCode: 'rft_ckd', doneOn: '2026-07-01' }],
        });
        const lab = r.items.find(i => i.reason === 'lab_due')!;
        const review = r.items.find(i => i.reason === 'review_due')!;
        expect(lab.blockedReason).toMatch(/not set up/);
        expect(review.callable).toBe(true);
    });

    it('still allows only one call when both reasons are dialable', () => {
        const r = run({
            settings: settings(s => { s.calls.purposesReady = ['review', 'lab_due']; }),
            patients: gen({ programme: 'ckd' }),
            reviews: [{ patientId: 'p1', reviewDate: '2026-09-29' }],
            labs: [{ patientId: 'p1', testCode: 'rft_ckd', doneOn: '2026-07-01' }],
        });
        expect(r.items.filter(i => i.callable).map(i => i.reason)).toEqual(['lab_due']);
        expect(r.items.find(i => i.reason === 'review_due')!.blockedReason).toMatch(/One call a day/);
    });

    it('waits before retrying an unanswered call', () => {
        const r = run({ ...due, patients: gen(), attempts: [
            { patientId: 'p1', purpose: 'review', createdAt: '2026-09-28T07:00:00Z', status: 'completed', connected: false },
        ] });
        expect(r.items[0].blockedReason).toBe('Called 3h ago');
    });

    it('counts yesterday\'s reminder on the review day itself — no second reminder', () => {
        // Reminded the day before (the engine's own lead window); the item is
        // still "review is today" this morning and must not ring again.
        const r = run({ reviews: [{ patientId: 'p1', reviewDate: TODAY }], patients: gen(), attempts: [
            { patientId: 'p1', purpose: 'review', createdAt: '2026-09-27T09:00:00Z', status: 'completed', connected: true },
        ] });
        expect(r.items[0].callable).toBe(false);
        expect(r.items[0].blockedReason).toBe('Already reached about this');
    });

    it('hands off to a person after the maximum unanswered attempts', () => {
        const r = run({ patients: gen(), reviews: [{ patientId: 'p1', reviewDate: '2026-09-10' }], attempts: [
            { patientId: 'p1', purpose: 'review', createdAt: '2026-09-25T09:00:00Z', status: 'completed', connected: false },
            { patientId: 'p1', purpose: 'review', createdAt: '2026-09-26T09:00:00Z', status: 'completed', connected: false },
        ] });
        expect(r.items[0].blockedReason).toMatch(/ring by hand/);
    });

    it('does not dial over a call already in progress', () => {
        const r = run({ ...due, patients: gen(), attempts: [
            { patientId: 'p1', purpose: 'review', createdAt: '2026-09-28T09:59:00Z', status: 'placed', connected: false },
        ] });
        expect(r.items[0].blockedReason).toBe('A call is in progress');
    });

    it('leaves deceased and stopped patients out entirely', () => {
        expect(run({ ...due, patients: gen({ isDeceased: true }) }).items).toHaveLength(0);
        expect(run({ ...due, patients: gen({ stopped: true }) }).items).toHaveLength(0);
    });
});

describe('ordering', () => {
    it('puts urgent first, then the oldest', () => {
        const r = run({
            patients: [patient({ id: 'a', name: 'A' }), patient({ id: 'b', name: 'B' })],
            sessions: [
                { patientId: 'a', date: '2026-09-25', status: 'missed' },
                { patientId: 'b', date: '2026-09-23', status: 'missed' },
                { patientId: 'b', date: '2026-09-25', status: 'missed' },
            ],
        });
        expect(r.items.map(i => `${i.patientName}:${i.priority}`)).toEqual(['B:1', 'A:2']);
    });
});

describe('settings', () => {
    it('fills anything missing from the defaults and rejects wrong types', () => {
        const s = resolveSettings({ review: { leadDays: 2, overdueWindowDays: 'x' }, calls: { purposesReady: ['review', 'bogus'] } });
        expect(s.review.leadDays).toBe(2);
        expect(s.review.overdueWindowDays).toBe(DEFAULT_SETTINGS.review.overdueWindowDays);
        expect(s.calls.purposesReady).toEqual(['review']);
        expect(s.labs.tests.length).toBe(DEFAULT_SETTINGS.labs.tests.length);
    });
    it('survives garbage', () => {
        expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
        expect(resolveSettings('nope' as any)).toEqual(DEFAULT_SETTINGS);
    });
});
