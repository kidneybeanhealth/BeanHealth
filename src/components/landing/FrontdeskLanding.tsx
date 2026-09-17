/**
 * BeanHealth Frontdesk — product page (/frontdesk)
 *
 * A separate page, not a section of the main landing, because it sells to a
 * different buyer with a different motion: a clinic administrator who has an
 * HMIS already and wants overdue patients phoned without changing anything.
 *
 * Shares the main landing's visual system (page-shell, glass-panel, the same
 * greens and type) so the two pages read as one company. The one thing this
 * page owns is the call ledger in the hero: one call unfolding — dial, ring,
 * connect, the conversation, the English account — cycling through the
 * languages the agent actually speaks.
 *
 * Every claim is something the product does today. The sample record is shaped
 * exactly like call_summary output; the guardrails are the design rules in
 * docs/SARVAM_VOICE_AGENT.md.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '@/styles/beanhealth-landing.css';
import '@/styles/frontdesk-landing.css';

const HOSPITAL = 'Beanhealth Hospital';

/** One demo call, per language. Same call, same outcome — only the speech changes. */
const CALL_LANGS: { key: string; label: string; native: string; agent1: string; reply: string; agent2: string }[] = [
    {
        key: 'ta', label: 'Tamil', native: 'தமிழ்',
        agent1: `வணக்கம், நான் ஆஷா, ${HOSPITAL}-லிருந்து பேசுகிறேன்.`,
        reply: 'அப்பா இப்போ இல்ல… இரண்டு நாள் கழிச்சு வர்றோம்.',
        agent2: 'சரி. OP நேரத்தில் வந்தால் போதும், நேரம் ஒதுக்க வேண்டாம்.',
    },
    {
        key: 'hi', label: 'Hindi', native: 'हिन्दी',
        agent1: `नमस्ते, मैं आशा बोल रही हूँ, ${HOSPITAL} से।`,
        reply: 'पापा अभी नहीं हैं… दो दिन बाद आएँगे।',
        agent2: 'ठीक है। OP समय में आ जाइए, अपॉइंटमेंट की ज़रूरत नहीं है।',
    },
    {
        key: 'te', label: 'Telugu', native: 'తెలుగు',
        agent1: `నమస్కారం, నేను ఆశ, ${HOSPITAL} నుండి మాట్లాడుతున్నాను.`,
        reply: 'నాన్న ఇప్పుడు లేరు… రెండు రోజుల తర్వాత వస్తాం.',
        agent2: 'సరే. OP సమయంలో వస్తే చాలు, అపాయింట్‌మెంట్ అవసరం లేదు.',
    },
    {
        key: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ',
        agent1: `ನಮಸ್ಕಾರ, ನಾನು ಆಶಾ, ${HOSPITAL} ನಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.`,
        reply: 'ಅಪ್ಪ ಈಗ ಇಲ್ಲ… ಎರಡು ದಿನ ಬಿಟ್ಟು ಬರ್ತೀವಿ.',
        agent2: 'ಸರಿ. OP ಸಮಯದಲ್ಲಿ ಬಂದರೆ ಸಾಕು, ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬೇಡ.',
    },
    {
        key: 'en', label: 'English', native: '',
        agent1: `Hello, this is Asha calling from ${HOSPITAL}.`,
        reply: 'Father isn’t here right now… we’ll come in two days.',
        agent2: 'That’s fine. Just come during OP hours, no appointment needed.',
    },
];

const CYCLE_MS = 9500;

const Arrow = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

/**
 * The signature. Replays the same call in each language on a timer; a click
 * on a language tab jumps there and restarts the clock. Paused while hovered
 * so a reader is never yanked mid-sentence, and never auto-advances for
 * anyone who has asked for reduced motion.
 */
const CallLedger: React.FC = () => {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduced = useRef(
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    useEffect(() => {
        if (paused || reduced.current) return;
        const t = window.setTimeout(() => setIndex((i) => (i + 1) % CALL_LANGS.length), CYCLE_MS);
        return () => window.clearTimeout(t);
    }, [index, paused]);

    const lang = CALL_LANGS[index];

    return (
        <div className="fd-ledger-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="fd-langs" role="tablist" aria-label="Call language">
                {CALL_LANGS.map((l, i) => (
                    <button
                        key={l.key}
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        className="fd-lang"
                        onClick={() => setIndex(i)}
                    >
                        {l.label}{l.native && <span className="native">{l.native}</span>}
                    </button>
                ))}
                <span className="fd-lang-more">+ 6 more</span>
            </div>

            {/* Keyed on the language so the CSS stagger restarts from the dial tone. */}
            <div key={lang.key} className="fd-ledger glass-panel" role="figure" aria-label={`A follow-up call in ${lang.label}, as it is recorded`}>
                <div className="fd-ledger-head">
                    <span><strong>MR. ARUMUGAM P</strong> &middot; review due 11 Aug</span>
                    <span>Dr. Meena R</span>
                </div>
                <div className="fd-ledger-line"><span className="t">10:02:14</span><span className="state ringing">Dialling &bull;&bull;&bull;&bull;&bull;&bull;47</span></div>
                <div className="fd-ledger-line"><span className="t">10:02:19</span><span className="state ok">Connected &middot; {lang.label}</span></div>
                <div className="fd-ledger-line"><span className="t">10:02:20</span><span><span className="who agent">Agent</span> &nbsp;<span className="say" lang={lang.key}>{lang.agent1}</span></span></div>
                <div className="fd-ledger-line"><span className="t">10:02:31</span><span><span className="who pt">Son</span> &nbsp;<span className="say" lang={lang.key}>{lang.reply}</span></span></div>
                <div className="fd-ledger-line"><span className="t">10:03:02</span><span><span className="who agent">Agent</span> &nbsp;<span className="say" lang={lang.key}>{lang.agent2}</span></span></div>
                <div className="fd-ledger-line"><span className="t">10:03:41</span><span className="state end">Call ended &middot; 1m 22s</span></div>
                <div className="fd-account">
                    <div className="label">Agent&rsquo;s account of the call &middot; always in English</div>
                    Spoke with the patient&rsquo;s son. Review since 11 August had passed. He said <q>we will come after
                    two days</q> and understood there is no fixed appointment &mdash; arrive in OP hours. No health
                    concerns raised.
                    <div className="chips">
                        <span className="fd-chip ok">WILL COME</span>
                        <span className="fd-chip">Spoke to: family</span>
                        <span className="fd-chip">Prefers: Thursday</span>
                    </div>
                </div>
                {!paused && !reduced.current && (
                    <div className="fd-lang-progress" aria-hidden="true"><span style={{ ['--fd-cycle' as string]: `${CYCLE_MS}ms` }} /></div>
                )}
            </div>
        </div>
    );
};

const FrontdeskLanding: React.FC = () => (
    <div className="fd page-shell">
        <nav className="fd-nav" aria-label="Frontdesk">
            <div className="fd-nav-pill">
                <Link to="/" className="fd-wordmark">
                    BeanHealth <span className="slash">/</span> <span className="prod">Frontdesk</span>
                </Link>
                <div className="fd-nav-links">
                    <a href="#how" className="hide-sm">How it works</a>
                    <a href="#record" className="hide-sm">What comes back</a>
                    <a href="#rules" className="hide-sm">What it never does</a>
                    <a href="#start" className="fd-btn fd-btn-primary">Send us a CSV <Arrow /></a>
                </div>
            </div>
        </nav>

        <main>
            {/* ── Hero ── */}
            <header className="fd-hero">
                <div className="fd-wrap">
                    <div>
                        <span className="fd-eyebrow">Outbound follow-up, in the patient&rsquo;s language</span>
                        <h1 className="fd-h1">
                            Every patient who didn&rsquo;t come back <em>gets a phone call.</em>
                        </h1>
                        <p className="fd-lede">
                            Export a CSV from the HMIS you already use. Frontdesk rings the patients who are due, speaks to
                            them in Tamil, Hindi or nine other languages, and writes down what they said &mdash; on the
                            patient&rsquo;s record, before your morning round.
                        </p>
                        <div className="fd-hero-actions">
                            <a href="#start" className="fd-btn fd-btn-primary">Send us a CSV <Arrow /></a>
                            <a href="#record" className="fd-btn fd-btn-ghost">See what comes back</a>
                        </div>
                        <p className="fd-hero-note">
                            No integration. No app for the patient to install. Nothing for your software vendor to approve.
                        </p>
                    </div>

                    <CallLedger />
                </div>
            </header>

            {/* ── Facts ── */}
            <section className="fd-strip" aria-label="At a glance">
                <div className="fd-wrap">
                    <div className="fd-fact glass-panel"><span className="n">1 CSV</span><span className="l">is the whole integration</span></div>
                    <div className="fd-fact glass-panel"><span className="n">11 languages</span><span className="l">mirrored to whoever answers the phone</span></div>
                    <div className="fd-fact glass-panel"><span className="n">0 appointments</span><span className="l">moved by the agent. It reports; a person decides.</span></div>
                </div>
            </section>

            {/* ── How ── */}
            <section className="fd-section" id="how">
                <div className="fd-wrap">
                    <span className="fd-kicker">How it works</span>
                    <h2 className="fd-h2">Three steps. None of them are for your IT department.</h2>
                    <p className="fd-sub">Every hospital system can produce a report. That report is the integration.</p>
                    <ol className="fd-steps">
                        <li className="fd-step glass-panel">
                            <span className="num">STEP 1 &middot; 5 MIN</span>
                            <h3>Export the follow-up list</h3>
                            <p>From your HMIS, as CSV or Excel. Patient, phone, review date, last visit, doctor. If a column is missing, we work with what you have.</p>
                            <span className="who">Done by: your reception</span>
                        </li>
                        <li className="fd-step glass-panel">
                            <span className="num">STEP 2 &middot; 2 MIN</span>
                            <h3>Upload and check the preview</h3>
                            <p>You see every row before anything is dialled &mdash; numbers that won&rsquo;t connect, duplicates, dates that didn&rsquo;t parse. Nothing is called until you approve the list.</p>
                            <span className="who">Done by: your reception</span>
                        </li>
                        <li className="fd-step glass-panel">
                            <span className="num">STEP 3 &middot; SAME DAY</span>
                            <h3>Calls go out, notes come back</h3>
                            <p>Each patient is called once, in their language. What they said lands on their record within minutes of the call ending, ready for your team to act on.</p>
                            <span className="who">Done by: Frontdesk</span>
                        </li>
                    </ol>
                </div>
            </section>

            {/* ── What comes back ── */}
            <section className="fd-section" id="record">
                <div className="fd-wrap">
                    <span className="fd-kicker">What comes back</span>
                    <h2 className="fd-h2">One record per call, written for the person who has to act on it.</h2>
                    <div className="fd-record">
                        <div className="fd-card glass-panel" aria-label="Example call record">
                            <div className="hd">
                                <span className="name">MRS. VALARMATHI R</span>
                                <span className="mr">BH/23/007796</span>
                            </div>
                            <div className="row">
                                <div className="label">Outcome</div>
                                <p><span className="fd-chip ok">WILL COME</span> &nbsp;<span className="fd-chip">Answered &middot; 1m 12s</span></p>
                            </div>
                            <div className="row">
                                <div className="label">In her words</div>
                                <p>&ldquo;Next week, Tuesday.&rdquo;</p>
                            </div>
                            <div className="row">
                                <div className="label">Agent&rsquo;s account</div>
                                <p>Spoke with the patient. Review since 21 April had passed. She agreed to come <q>next week</q>, specifically Tuesday, and confirmed she will bring her prescriptions and reports. No health concerns discussed.</p>
                            </div>
                            <div className="red">
                                <div className="label">If a red flag is raised</div>
                                Breathlessness, swelling or reduced urine: the agent tells the patient to come in now, reads out your front desk number, and the record is marked <strong>REVIEW NOW</strong> so it is the first thing your team sees.
                            </div>
                        </div>
                        <div className="fd-anno">
                            <div>
                                <h4>The patient&rsquo;s own words are kept</h4>
                                <p>Not paraphrased into a status code. Reception reads what was actually said and decides what to do with it.</p>
                            </div>
                            <div>
                                <h4>Labelled as the agent&rsquo;s account</h4>
                                <p>The summary is written by the agent and says so. It is never presented as a transcript, because a paraphrase that looks like a quote is worse than no record.</p>
                            </div>
                            <div>
                                <h4>Always in English</h4>
                                <p>The call happens in the patient&rsquo;s language. The note is written in English, so your whole team reads every call the same way.</p>
                            </div>
                            <div>
                                <h4>Every call is on the bill, line by line</h4>
                                <p>Who was called, when, whether it connected, what it cost. Unanswered calls are listed and not charged.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Guardrails ── */}
            <section className="fd-section" id="rules">
                <div className="fd-wrap">
                    <span className="fd-kicker">What it never does</span>
                    <h2 className="fd-h2">An automated caller should know exactly how little it is allowed to decide.</h2>
                    <ul className="fd-rules">
                        <li><span className="k">Never moves an appointment</span><span className="v">A patient saying &ldquo;I&rsquo;ll come tomorrow&rdquo; is recorded, not booked. The agent cannot know whether a doctor saw that patient the same afternoon. A person reschedules.</span></li>
                        <li><span className="k">Never gives medical advice</span><span className="v">It reminds, it listens, and on a red-flag symptom it says <em>come in now</em> and gives your front desk number. It does not interpret, reassure, or suggest.</span></li>
                        <li><span className="k">Never invents a name</span><span className="v">The patient is addressed by the name on your record and nothing else. If someone on the line gives a different name, that is noted as who answered &mdash; never substituted.</span></li>
                        <li><span className="k">Never calls again after &ldquo;don&rsquo;t call&rdquo;</span><span className="v">A patient or family member who asks not to be phoned is marked, and the system refuses to dial them from then on.</span></li>
                        <li><span className="k">Never keeps a number you didn&rsquo;t give it</span><span className="v">Numbers typed in for a campaign are used for that call and discarded. Only the last two digits are kept, so you can confirm the right person was reached.</span></li>
                    </ul>
                </div>
            </section>

            {/* ── Proof ── */}
            <section className="fd-section">
                <div className="fd-wrap">
                    <span className="fd-kicker">Where it comes from</span>
                    <h2 className="fd-h2">Built inside a kidney centre, not for one.</h2>
                    <p className="fd-sub">
                        Frontdesk is the follow-up layer of the system that runs a nephrology centre in Coimbatore &mdash;
                        reception, queue, prescriptions, pharmacy and admissions. The rules above were learned there, on
                        real missed follow-ups, before this became a product.
                    </p>
                    <div className="fd-proof-grid">
                        <div className="fd-proof-item glass-panel"><strong>3,000+ patients</strong>under follow-up tracking at one centre</div>
                        <div className="fd-proof-item glass-panel"><strong>Two doctors, one list</strong>a patient due with both is shown under both, not filed under one</div>
                        <div className="fd-proof-item glass-panel"><strong>Printed call sheet</strong>the same list reception carries for the 10 AM round, now with the calls already made</div>
                        <div className="fd-proof-item glass-panel"><strong>Full system available</strong>clinics that want the whole desk can run <Link to="/#kidney-os" style={{ textDecoration: 'underline' }}>Kidney Care OS</Link></div>
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="fd-section fd-cta" id="start">
                <div className="fd-wrap">
                    <div>
                        <span className="fd-kicker">Start</span>
                        <h2 className="fd-h2">Send us one CSV. We&rsquo;ll call the first batch with you watching.</h2>
                        <p className="fd-sub">
                            The first campaign is run together, one call at a time, so your team hears what patients hear
                            before anything runs on its own. These are the only columns we need.
                        </p>
                        <div className="fd-hero-actions">
                            <a href="mailto:harish@beanhealth.in?subject=Frontdesk%20%E2%80%94%20first%20CSV" className="fd-btn fd-btn-primary">Email us your CSV <Arrow /></a>
                            <Link to="/#cta" className="fd-btn fd-btn-ghost">Book a 20-minute call</Link>
                        </div>
                    </div>
                    <div className="fd-columns glass-panel" aria-label="Columns the CSV needs">
                        <div className="hd">Your export &middot; six columns</div>
                        <div className="r"><span className="c">patient_id</span><span className="d">Your MR number. Used as-is.</span></div>
                        <div className="r"><span className="c">name</span><span className="d">As you&rsquo;d want it spoken.</span></div>
                        <div className="r"><span className="c">phone</span><span className="d">Any Indian format. We normalise it.</span></div>
                        <div className="r"><span className="c">review_date</span><span className="d">When they were told to return.</span></div>
                        <div className="r"><span className="c">last_visit <span className="opt">optional</span></span><span className="d">So the agent can say how long it has been.</span></div>
                        <div className="r"><span className="c">doctor <span className="opt">optional</span></span><span className="d">So the agent can say who they are due to see.</span></div>
                    </div>
                </div>
            </section>
        </main>

        <footer className="fd-foot">
            <div className="fd-wrap">
                <span>BeanHealth Frontdesk &middot; reports, never reschedules.</span>
                <span><Link to="/">BeanHealth</Link></span>
            </div>
        </footer>
    </div>
);

export default FrontdeskLanding;
