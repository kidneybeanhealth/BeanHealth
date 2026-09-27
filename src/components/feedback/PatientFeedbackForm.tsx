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
import { useParams } from 'react-router-dom';
import { getProxiedUrl } from '../../lib/supabase';
import {
    resolveFeedbackLocation, submitFeedback, FeedbackCodeError,
    type ResolvedLocation,
} from '../../services/feedbackService';
import {
    VISIT_TYPES, SCALE, questionsFor,
    type Lang, type VisitTypeId,
} from './feedbackQuestions';

/** UI chrome. Question wording lives in the catalogue, next to the ids. */
const T = {
    en: {
        heading: 'How was your visit?',
        sub: 'A minute of your time helps us fix what is not working.',
        visitQ: 'What brought you in today?',
        rateQ: 'How would you rate these?',
        commentQ: 'Anything else you want to tell us?',
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
        googleQ: 'Happy to say it publicly?',
        google: 'Review us on Google',
        again: 'Send another response',
        needOne: 'Please rate at least one thing, or write a comment.',
        closed: 'This feedback form is not available.',
        loading: 'Opening…',
        privacy: 'We store your ratings and comment. We do not store your phone number, your location, or anything that identifies your device.',
    },
    ta: {
        heading: 'உங்கள் வருகை எப்படி இருந்தது?',
        sub: 'உங்கள் ஒரு நிமிடம், சரி செய்ய வேண்டியதை எங்களுக்குக் காட்டும்.',
        visitQ: 'இன்று எதற்காக வந்தீர்கள்?',
        rateQ: 'இவற்றை எப்படி மதிப்பிடுவீர்கள்?',
        commentQ: 'வேறு ஏதாவது சொல்ல விரும்புகிறீர்களா?',
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
        googleQ: 'இதை வெளிப்படையாகச் சொல்ல விருப்பமா?',
        google: 'Google-இல் விமர்சனம் எழுதுங்கள்',
        again: 'மற்றொரு கருத்து அனுப்பு',
        needOne: 'குறைந்தது ஒன்றையாவது மதிப்பிடுங்கள், அல்லது கருத்து எழுதுங்கள்.',
        closed: 'இந்த படிவம் இப்போது கிடைக்கவில்லை.',
        loading: 'திறக்கிறது…',
        privacy: 'உங்கள் மதிப்பீடுகளும் கருத்தும் சேமிக்கப்படும். உங்கள் ஃபோன் எண், இருப்பிடம் அல்லது சாதன விவரம் எதுவும் சேமிக்கப்படாது.',
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

const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=';

const PatientFeedbackForm: React.FC = () => {
    const { code = '' } = useParams<{ code: string }>();
    const [lang, setLang] = useState<Lang>('en');
    const t = T[lang];

    const [loc, setLoc] = useState<ResolvedLocation | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [visitType, setVisitType] = useState<VisitTypeId | null>(null);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [comment, setComment] = useState('');
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
            .then(r => { if (!cancelled) setLoc(r); })
            .catch(e => { if (!cancelled) setLoadError(e instanceof FeedbackCodeError ? e.message : 'Could not open the form'); });
        return () => { cancelled = true; };
    }, [code]);

    const questions = useMemo(() => questionsFor(visitType), [visitType]);

    // Answers to questions that no longer apply are dropped when the visit type
    // changes, so a patient who taps Dialysis then Admitted does not silently
    // submit a rating for a chair they never sat in.
    useEffect(() => {
        setRatings(prev => {
            const allowed = new Set(questionsFor(visitType).map(q => q.id));
            const next: Record<string, number> = {};
            for (const [k, v] of Object.entries(prev)) if (allowed.has(k)) next[k] = v;
            return next;
        });
    }, [visitType]);

    const answered = Object.keys(ratings).length;
    const canSend = answered > 0 || comment.trim().length > 0;

    const send = async () => {
        if (!canSend) { setError(t.needOne); return; }
        setSending(true);
        setError(null);
        try {
            const res = await submitFeedback({
                code, visitType, ratings, comment,
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
                {loc.locationLabel && loc.locationLabel !== loc.hospitalName && (
                    <p className="truncate text-xs text-gray-500">{loc.locationLabel}</p>
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

                    {/* Shown to everybody, whatever they scored.
                        Showing it only to happy patients is review gating: it is
                        against Google's policy and it is how a business gets its
                        reviews wiped. The point of this form is to hear the
                        unhappy ones first, not to filter who gets asked. */}
                    <div className="mt-7 border-t border-gray-100 pt-6">
                        <p className="text-sm text-gray-500">{t.googleQ}</p>
                        <a
                            href={GOOGLE_REVIEW_URL}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                        >
                            {t.google}
                        </a>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => { setDone(null); setRatings({}); setComment(''); setShare(false); setMrNumber(''); }}
                    className="mx-auto mt-5 block text-xs font-semibold text-gray-400 hover:text-gray-700"
                >
                    {t.again}
                </button>
            </>
        );
    }

    return shell(
        <>
            {header}

            <div className="mb-5">
                <h1 className="text-2xl font-bold leading-tight text-gray-900">{t.heading}</h1>
                <p className="mt-1 text-sm text-gray-500">{t.sub}</p>
            </div>

            {/* Visit type. First, because it decides what is worth asking. */}
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

            {/* Ratings */}
            <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-1 text-sm font-bold text-gray-900">{t.rateQ}</p>
                <p className="mb-4 text-xs text-gray-400">
                    {lang === 'ta' ? 'ஒவ்வொன்றும் விருப்பம்' : 'Every one of these is optional'}
                </p>
                <div className="divide-y divide-gray-100">
                    {questions.map(q => (
                        <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm font-semibold text-gray-800">{lang === 'ta' ? q.labelTa : q.label}</p>
                            {(lang === 'ta' ? q.hintTa : q.hint) && (
                                <p className="mt-0.5 text-xs text-gray-400">{lang === 'ta' ? q.hintTa : q.hint}</p>
                            )}
                            <div className="mt-2.5 flex items-stretch gap-1.5">
                                {SCALE.map(s => {
                                    const on = ratings[q.id] === s.value;
                                    return (
                                        <button
                                            key={s.value}
                                            type="button"
                                            aria-label={lang === 'ta' ? s.labelTa : s.label}
                                            aria-pressed={on}
                                            onClick={() => setRatings(prev => {
                                                const next = { ...prev };
                                                // Tapping the same face again clears it — the only
                                                // way back to "no answer" once one is given.
                                                if (next[q.id] === s.value) delete next[q.id];
                                                else next[q.id] = s.value;
                                                return next;
                                            })}
                                            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${on ? SCORE_TONE[s.value] : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                        >
                                            <span className="text-xl leading-none">{FACES[s.value - 1]}</span>
                                            <span className={`text-[9px] font-bold leading-tight ${on ? 'text-white/90' : 'text-gray-400'}`}>
                                                {lang === 'ta' ? s.labelTa : s.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Comment */}
            <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-bold text-gray-900" htmlFor="fb-comment">{t.commentQ}</label>
                <textarea
                    id="fb-comment"
                    value={comment}
                    onChange={e => setComment(e.target.value.slice(0, 1000))}
                    rows={4}
                    placeholder={t.commentPh}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
                <p className="mt-1 text-right text-[11px] text-gray-400">{comment.length}/1000</p>
            </section>

            {/* Identity — off by default, and it says so in words, not in a hint. */}
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
