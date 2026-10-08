/**
 * PatientFeedbackForm — what the QR opens
 *
 * A public page. No login, no app install, no account. Somebody scans a poster
 * in a waiting room or from a dialysis chair and this has to load and be
 * understood in about ten seconds, on a phone, often by a patient in their
 * sixties or seventies with one arm immobilised.
 *
 * Everything below follows from that:
 *   · one scroll, one button, no steps to page through
 *   · 56px targets, because a fistula arm makes precise tapping hard
 *   · anonymous unless the patient says otherwise, in plain words
 *   · the answer is queued and retried, because hospital wifi drops
 *
 * It renders outside ProtectedRoute and asks nothing of AuthContext.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getProxiedUrl } from '../../lib/supabase';
import {
    resolveFeedbackLocation, submitFeedback, FeedbackCodeError,
    type ResolvedLocation, type VoiceNote,
} from '../../services/feedbackService';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import {
    VISIT_TYPES, SCALE, SECTIONS, DOCTOR_VISITS, questionsFor, optionalFor, fixedVisitTypeFor, doctorDisplayName,
    type Lang, type VisitTypeId, type FeedbackQuestion, type SectionId,
} from './feedbackQuestions';

/** UI chrome. Question wording lives in the catalogue, next to the ids. */
const T = {
    en: {
        heading: 'How was your visit?',
        headingRestroom: 'How is this restroom?',
        headingReception: 'How was the reception desk?',
        doctorQ: 'Which doctor did you see?',
        notSure: 'Not sure',
        alsoUsedQ: 'Did you also use any of these today?',
        alsoUsedSub: 'Tap the ones you used and rate them below.',
        sub: 'A minute of your time helps us fix what is not working.',
        visitQ: 'What brought you in today?',
        rateQ: 'How would you rate these?',
        commentQ: 'Anything else you want to tell us?',
        commentSub: 'Speak it or type it — whichever is easier.',
        orType: 'Or type it',
        commentPh: 'Optional — write in Tamil or English',
        share: 'Share this with my doctor',
        shareOn: 'Your name and MR number will be shown to your doctor with this feedback.',
        shareOff: 'Sent anonymously. The hospital sees the ratings, not who gave them.',
        mr: 'MR number',
        submit: 'Send feedback',
        sending: 'Sending…',
        thanks: 'Thank you',
        thanksSub: 'This reaches the hospital today.',
        thanksNamed: 'Your doctor will see it at your next visit.',
        dupe: 'You have already sent feedback from this phone today. Thank you again.',
        again: 'Send another response',
        nextPatient: 'Next patient',
        desk: 'Clinic device',
        needOne: 'Please rate something, record a voice note, or write a comment.',
        closed: 'This feedback form is not available.',
        loading: 'Opening…',
        privacy: 'We store your ratings, comment and any voice note, for the hospital only. We do not store your phone number, your location, or anything that identifies your device.',
    },
    ta: {
        heading: 'உங்கள் வருகை எப்படி இருந்தது?',
        headingRestroom: 'இந்தக் கழிப்பறை எப்படி இருக்கிறது?',
        headingReception: 'வரவேற்பு மேசை எப்படி இருந்தது?',
        doctorQ: 'எந்த மருத்துவரைப் பார்த்தீர்கள்?',
        notSure: 'தெரியவில்லை',
        alsoUsedQ: 'இன்று இவற்றில் எதையாவது பயன்படுத்தினீர்களா?',
        alsoUsedSub: 'பயன்படுத்தியவற்றைத் தொட்டு, கீழே மதிப்பிடுங்கள்.',
        sub: 'உங்கள் ஒரு நிமிடம், சரி செய்ய வேண்டியதை எங்களுக்குக் காட்டும்.',
        visitQ: 'இன்று எதற்காக வந்தீர்கள்?',
        rateQ: 'இவற்றை எப்படி மதிப்பிடுவீர்கள்?',
        commentQ: 'வேறு ஏதாவது சொல்ல விரும்புகிறீர்களா?',
        commentSub: 'பேசலாம் அல்லது தட்டச்சு செய்யலாம் — எது எளிதோ அது.',
        orType: 'அல்லது தட்டச்சு செய்யுங்கள்',
        commentPh: 'விருப்பம் — தமிழிலோ ஆங்கிலத்திலோ எழுதலாம்',
        share: 'இதை என் மருத்துவரிடம் பகிரவும்',
        shareOn: 'உங்கள் பெயரும் MR எண்ணும் உங்கள் மருத்துவருக்குத் தெரியும்.',
        shareOff: 'பெயர் இல்லாமல் அனுப்பப்படும். மதிப்பீடுகள் மட்டுமே மருத்துவமனைக்குத் தெரியும்.',
        mr: 'MR எண்',
        submit: 'கருத்தை அனுப்பு',
        sending: 'அனுப்புகிறது…',
        thanks: 'நன்றி',
        thanksSub: 'இது இன்றே மருத்துவமனையை அடையும்.',
        thanksNamed: 'அடுத்த வருகையின்போது உங்கள் மருத்துவர் இதைப் பார்ப்பார்.',
        dupe: 'இன்று இந்த ஃபோனிலிருந்து ஏற்கனவே கருத்து அனுப்பப்பட்டுள்ளது. மீண்டும் நன்றி.',
        again: 'மற்றொரு கருத்து அனுப்பு',
        nextPatient: 'அடுத்த நோயாளர்',
        desk: 'மருத்துவமனை சாதனம்',
        needOne: 'ஏதாவது மதிப்பிடுங்கள், குரல் பதிவு செய்யுங்கள், அல்லது கருத்து எழுதுங்கள்.',
        closed: 'இந்த படிவம் இப்போது கிடைக்கவில்லை.',
        loading: 'திறக்கிறது…',
        privacy: 'உங்கள் மதிப்பீடுகள், கருத்து மற்றும் குரல் பதிவு மருத்துவமனைக்கு மட்டும் சேமிக்கப்படும். உங்கள் ஃபோன் எண், இருப்பிடம் அல்லது சாதன விவரம் எதுவும் சேமிக்கப்படாது.',
    },
} as const;

/** Faces beat stars: a 70-year-old reads them without a legend. */
const FACES = ['\u{1F61E}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}'];

const SCORE_TONE: Record<number, string> = {
    1: 'bg-rose-500 border-rose-500 text-white',
    2: 'bg-orange-400 border-orange-400 text-white',
    3: 'bg-amber-400 border-amber-400 text-white',
    4: 'bg-lime-500 border-lime-500 text-white',
    5: 'bg-emerald-500 border-emerald-500 text-white',
};

const PatientFeedbackForm: React.FC = () => {
    const { code = '' } = useParams<{ code: string }>();
    // Opened from a dashboard on a clinic tablet, handed from patient to patient.
    const [search] = useSearchParams();
    const desk = search.get('desk') === '1';
    const [lang, setLang] = useState<Lang>('en');
    const t = T[lang];

    const [loc, setLoc] = useState<ResolvedLocation | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [visitType, setVisitType] = useState<VisitTypeId | null>(null);
    // Optional questions the patient said apply ("I used the lab today").
    const [used, setUsed] = useState<Set<string>>(new Set());
    // A doctor id, 'unsure', or null for not answered.
    const [ratedDoctor, setRatedDoctor] = useState<string | null>(null);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [comment, setComment] = useState('');
    const [voice, setVoice] = useState<VoiceNote | null>(null);
    const [share, setShare] = useState(false);
    const [mrNumber, setMrNumber] = useState('');

    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<{ duplicate: boolean; identified: boolean } | null>(null);

    useEffect(() => {
        document.title = 'Patient feedback';
        let cancelled = false;
        // Clear first: without this a failed lookup sticks, and a retry on a
        // corrected code keeps showing the old error because the error branch
        // is checked before the loaded one.
        setLoc(null);
        setLoadError(null);
        resolveFeedbackLocation(code)
            .then(r => {
                if (cancelled) return;
                setLoc(r);
                // A place QR (OP, IP, Reception, Restroom) already knows the visit.
                setVisitType(fixedVisitTypeFor(r.area));
            })
            .catch(e => { if (!cancelled) setLoadError(e instanceof FeedbackCodeError ? e.message : 'Could not open the form'); });
        return () => { cancelled = true; };
    }, [code]);

    const fixedVisit = fixedVisitTypeFor(loc?.area);
    const questions = useMemo(() => questionsFor(visitType, used), [visitType, used]);
    const optional = useMemo(() => optionalFor(visitType), [visitType]);
    const seesDoctor = !!visitType && DOCTOR_VISITS.includes(visitType);
    const doctors = loc?.doctors || [];

    // Answers to questions that no longer apply are dropped when the visit type
    // changes, so a patient who taps Dialysis then Admitted does not silently
    // submit a rating for a chair they never sat in. Same when they untick
    // "I used the lab".
    useEffect(() => {
        setRatings(prev => {
            const allowed = new Set(questionsFor(visitType, used).map(q => q.id));
            const next: Record<string, number> = {};
            for (const [k, v] of Object.entries(prev)) if (allowed.has(k)) next[k] = v;
            return next;
        });
    }, [visitType, used]);

    useEffect(() => {
        setUsed(prev => {
            const offered = new Set(optionalFor(visitType).map(q => q.id));
            const next = new Set([...prev].filter(id => offered.has(id)));
            return next.size === prev.size ? prev : next;
        });
        if (!visitType || !DOCTOR_VISITS.includes(visitType)) setRatedDoctor(null);
    }, [visitType]);

    // Questions in section order, with a heading wherever the section changes.
    const sections = useMemo(() => {
        const out: { id: SectionId; questions: FeedbackQuestion[] }[] = [];
        for (const q of questions) {
            const last = out[out.length - 1];
            if (last && last.id === q.section) last.questions.push(q);
            else out.push({ id: q.section, questions: [q] });
        }
        return out;
    }, [questions]);

    const answered = Object.keys(ratings).length;
    const canSend = answered > 0 || comment.trim().length > 0 || !!voice;

    const send = async () => {
        if (!canSend) { setError(t.needOne); return; }
        setSending(true);
        setError(null);
        try {
            const res = await submitFeedback({
                code, visitType, ratings, comment, voice, desk,
                ratedDoctorId: seesDoctor && ratedDoctor && ratedDoctor !== 'unsure' ? ratedDoctor : null,
                mrNumber, shareWithDoctor: share && mrNumber.trim().length > 0,
                language: lang,
            });
            setDone(res);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e: any) {
            setError(e?.message || 'Could not send your feedback');
        } finally {
            setSending(false);
        }
    };

    const shell = (children: React.ReactNode) => (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
            <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-6 sm:pt-10">{children}</div>
        </div>
    );

    if (loadError) {
        return shell(
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <p className="text-base font-semibold text-gray-900">{t.closed}</p>
                <p className="mt-2 text-sm text-gray-500">{loadError}</p>
            </div>
        );
    }

    if (!loc) {
        return shell(
            <div className="flex items-center justify-center gap-3 py-24 text-gray-500">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                <span className="text-sm font-medium">{t.loading}</span>
            </div>
        );
    }

    const header = (
        <div className="mb-6 flex items-center gap-3">
            {loc.hospitalLogo ? (
                <img
                    src={getProxiedUrl(loc.hospitalLogo)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-contain ring-1 ring-gray-200"
                />
            ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-lg font-bold text-orange-700">
                    {loc.hospitalName.charAt(0)}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold leading-tight text-gray-900">{loc.hospitalName}</p>
                {loc.locationLabel && loc.locationLabel.toLowerCase() !== loc.hospitalName.toLowerCase() && (
                    <p className="truncate text-xs text-gray-500">{loc.locationLabel}</p>
                )}
                {desk && (
                    <span className="mt-0.5 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">{t.desk}</span>
                )}
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {(['en', 'ta'] as Lang[]).map(l => (
                    <button
                        key={l}
                        type="button"
                        onClick={() => setLang(l)}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${lang === l ? 'bg-orange-500 text-white' : 'text-gray-600'}`}
                    >
                        {l === 'en' ? 'EN' : 'தமிழ்'}
                    </button>
                ))}
            </div>
        </div>
    );

    if (done) {
        return shell(
            <>
                {header}
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                        <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{t.thanks}</p>
                    <p className="mt-1.5 text-sm text-gray-600">{done.duplicate ? t.dupe : t.thanksSub}</p>
                    {done.identified && !done.duplicate && (
                        <p className="mt-1 text-sm text-gray-600">{t.thanksNamed}</p>
                    )}
                    {/* Deliberately no public-review prompt here. This form is the
                        hospital's own feedback channel — read on the dashboards and
                        acted on internally — not a funnel to Google or anywhere else
                        public. Do not add one back without the hospital asking. */}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setDone(null); setRatings({}); setComment(''); setVoice(null);
                        setShare(false); setMrNumber(''); setVisitType(fixedVisit); setError(null);
                        setUsed(new Set()); setRatedDoctor(null);
                        window.scrollTo({ top: 0 });
                    }}
                    className={desk
                        ? 'mt-5 min-h-[56px] w-full rounded-2xl bg-orange-500 text-base font-bold text-white hover:bg-orange-600'
                        : 'mx-auto mt-5 block text-xs font-semibold text-gray-400 hover:text-gray-700'}
                >
                    {desk ? t.nextPatient : t.again}
                </button>
            </>
        );
    }

    return shell(
        <>
            {header}

            <div className="mb-5">
                <h1 className="text-2xl font-bold leading-tight text-gray-900">
                    {visitType === 'restroom' ? t.headingRestroom : visitType === 'reception' ? t.headingReception : t.heading}
                </h1>
                <p className="mt-1 text-sm text-gray-500">{t.sub}</p>
            </div>

            {/* Visit type. First, because it decides what is worth asking. A
                place QR already knows it, so the step is skipped there. */}
            {!fixedVisit && (
            <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-bold text-gray-900">{t.visitQ}</p>
                <div className="grid gap-2">
                    {VISIT_TYPES.map(v => {
                        const on = visitType === v.id;
                        return (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => setVisitType(on ? null : v.id)}
                                aria-pressed={on}
                                className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 text-left transition-colors ${on ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}
                            >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
                                    {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold text-gray-900">{lang === 'ta' ? v.labelTa : v.label}</span>
                                    <span className="block text-xs text-gray-500">{lang === 'ta' ? v.hintTa : v.hint}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
            )}

            {/* Ratings, by section. Nothing until the visit is known: every
                question now belongs to some kind of visit or place. */}
            {visitType && (
            <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-1 text-sm font-bold text-gray-900">{t.rateQ}</p>
                <p className="mb-4 text-xs text-gray-400">
                    {lang === 'ta' ? 'ஒவ்வொன்றும் விருப்பம்' : 'Every one of these is optional'}
                </p>

                {/* "I also used…" — the lab, TPA desk and pharmacy are only asked
                    about once the patient says they went there. */}
                {optional.length > 0 && (
                    <div className="mb-5 rounded-xl bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-800">{t.alsoUsedQ}</p>
                        <p className="mb-2.5 text-xs text-gray-500">{t.alsoUsedSub}</p>
                        <div className="flex flex-wrap gap-2">
                            {optional.map(q => {
                                const on = used.has(q.id);
                                return (
                                    <button
                                        key={q.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setUsed(prev => {
                                            const next = new Set(prev);
                                            if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                                            return next;
                                        })}
                                        className={`min-h-[44px] rounded-full border px-4 text-sm font-bold transition-colors ${on ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'}`}
                                    >
                                        {on ? '✓ ' : '+ '}{lang === 'ta' ? q.labelTa : q.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {sections.map(sec => {
                    const meta = SECTIONS.find(x => x.id === sec.id);
                    return (
                        <div key={sec.id} className="mt-5 first:mt-0">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-orange-600">
                                {lang === 'ta' ? meta?.labelTa : meta?.label}
                            </p>

                            {/* Which doctor — so each doctor sees their own. */}
                            {sec.id === 'doctor' && seesDoctor && doctors.length > 0 && (
                                <div className="mb-3">
                                    <p className="mb-2 text-sm font-semibold text-gray-800">{t.doctorQ}</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {[...doctors.map(d => ({ id: d.id, label: doctorDisplayName(d.name) })), { id: 'unsure', label: t.notSure }].map(d => {
                                            const on = ratedDoctor === d.id;
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => setRatedDoctor(on ? null : d.id)}
                                                    className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 text-left text-sm font-bold transition-colors ${on ? 'border-orange-400 bg-orange-50 text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'} ${d.id === 'unsure' ? 'sm:col-span-2' : ''}`}
                                                >
                                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
                                                        {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                    </span>
                                                    {d.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="divide-y divide-gray-100">
                                {sec.questions.map(q => (
                                    <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                                        <p className="text-sm font-semibold text-gray-800">{lang === 'ta' ? q.labelTa : q.label}</p>
                                        {(lang === 'ta' ? q.hintTa : q.hint) && (
                                            <p className="mt-0.5 text-xs text-gray-400">{lang === 'ta' ? q.hintTa : q.hint}</p>
                                        )}
                                        <div className="mt-2.5 flex items-stretch gap-1.5">
                                            {SCALE.map(sc => {
                                                const on = ratings[q.id] === sc.value;
                                                return (
                                                    <button
                                                        key={sc.value}
                                                        type="button"
                                                        aria-label={lang === 'ta' ? sc.labelTa : sc.label}
                                                        aria-pressed={on}
                                                        onClick={() => setRatings(prev => {
                                                            const next = { ...prev };
                                                            // Tapping the same face again clears it — the only
                                                            // way back to "no answer" once one is given.
                                                            if (next[q.id] === sc.value) delete next[q.id];
                                                            else next[q.id] = sc.value;
                                                            return next;
                                                        })}
                                                        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${on ? SCORE_TONE[sc.value] : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                                    >
                                                        <span className="text-xl leading-none">{FACES[sc.value - 1]}</span>
                                                        <span className={`text-[9px] font-bold leading-tight ${on ? 'text-white/90' : 'text-gray-400'}`}>
                                                            {lang === 'ta' ? sc.labelTa : sc.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </section>
            )}

            {/* Comment */}
            <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-gray-900">{t.commentQ}</p>
                <p className="mb-3 text-xs text-gray-500">{t.commentSub}</p>
                {/* Voice first: most patients will say far more than they would type. */}
                <VoiceNoteRecorder lang={lang} value={voice} onChange={setVoice} />
                <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-400" htmlFor="fb-comment">{t.orType}</label>
                <textarea
                    id="fb-comment"
                    value={comment}
                    onChange={e => setComment(e.target.value.slice(0, 1000))}
                    rows={3}
                    placeholder={t.commentPh}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-right text-[11px] text-gray-400">{comment.length}/1000</p>
            </section>

            {/* Identity — off by default, and it says so in words, not in a hint.
                Not offered on the restroom form: there is nothing for a doctor
                to follow up. */}
            {visitType !== 'restroom' && (
            <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <button
                    type="button"
                    onClick={() => setShare(v => !v)}
                    aria-pressed={share}
                    className="flex min-h-[48px] w-full items-center gap-3 text-left"
                >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${share ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`}>
                        {share && (
                            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{t.share}</span>
                </button>
                {share && (
                    <div className="mt-3">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="fb-mr">{t.mr}</label>
                        <input
                            id="fb-mr"
                            value={mrNumber}
                            onChange={e => setMrNumber(e.target.value)}
                            placeholder="KNH/26/022020"
                            className="min-h-[48px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                )}
                <p className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${share ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-600'}`}>
                    {share ? t.shareOn : t.shareOff}
                </p>
            </section>
            )}

            {error && (
                <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800">{error}</p>
            )}

            <button
                type="button"
                onClick={send}
                disabled={sending || !canSend}
                className="min-h-[56px] w-full rounded-2xl bg-orange-500 text-base font-bold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
                {sending ? t.sending : t.submit}
            </button>

            <p className="mt-4 px-1 text-[11px] leading-5 text-gray-400">{t.privacy}</p>
        </>
    );
};

export default PatientFeedbackForm;
