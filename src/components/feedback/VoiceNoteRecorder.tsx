/**
 * VoiceNoteRecorder — say it instead of typing it
 *
 * Most patients will not type a paragraph on a phone, and many who would are
 * more at ease speaking Tamil than typing it. One big button records, a second
 * tap stops, and they can listen back before sending. One recording per
 * response; recording again replaces it.
 *
 * The recording stays in memory until the form is sent — nothing is uploaded on
 * Stop — so a patient who records and walks away leaves nothing on the server.
 *
 * Capped at two minutes. That is long enough for a real complaint and short
 * enough that a phone left recording in a pocket does not produce a 3 MB file
 * the bucket refuses.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Lang } from './feedbackQuestions';
import type { VoiceNote } from '../../services/feedbackService';

const MAX_SECONDS = 120;

/** First container this browser can record. Safari records mp4; Chrome and Firefox webm/ogg. */
const pickMime = (): string => {
    const MR = (window as any).MediaRecorder;
    if (!MR?.isTypeSupported) return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'];
    return candidates.find(c => MR.isTypeSupported(c)) || '';
};

const T = {
    en: {
        record: 'Record a voice note',
        recordHint: 'Speak in Tamil or English · up to 2 minutes',
        stop: 'Tap to stop',
        recording: 'Recording',
        again: 'Record again',
        remove: 'Remove',
        saved: 'Voice note ready to send',
        privacy: 'Hospital staff will listen to this. No name is attached unless you add your MR number below.',
        denied: 'Microphone access was blocked. You can still type below.',
        unsupported: 'This phone cannot record here. You can still type below.',
    },
    ta: {
        record: 'குரல் பதிவு செய்யுங்கள்',
        recordHint: 'தமிழிலோ ஆங்கிலத்திலோ பேசலாம் · அதிகபட்சம் 2 நிமிடம்',
        stop: 'நிறுத்த தட்டவும்',
        recording: 'பதிவாகிறது',
        again: 'மீண்டும் பதிவு',
        remove: 'நீக்கு',
        saved: 'குரல் பதிவு அனுப்பத் தயார்',
        privacy: 'இதை மருத்துவமனை ஊழியர்கள் கேட்பார்கள். கீழே MR எண் சேர்க்காவிட்டால் பெயர் இணைக்கப்படாது.',
        denied: 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. கீழே தட்டச்சு செய்யலாம்.',
        unsupported: 'இந்த ஃபோனில் இங்கே பதிவு செய்ய இயலாது. கீழே தட்டச்சு செய்யலாம்.',
    },
} as const;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Phase = 'idle' | 'recording' | 'recorded' | 'denied' | 'unsupported';

export interface VoiceNoteRecorderProps {
    lang: Lang;
    value: VoiceNote | null;
    onChange: (v: VoiceNote | null) => void;
}

const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({ lang, value, onChange }) => {
    const t = T[lang];
    const [phase, setPhase] = useState<Phase>(value ? 'recorded' : 'idle');
    const [elapsed, setElapsed] = useState(0);
    const [playUrl, setPlayUrl] = useState<string | null>(null);

    const recRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startedRef = useRef(0);
    const tickRef = useRef<number | null>(null);

    // The parent clears the recording on "send another"; follow it back to idle.
    useEffect(() => {
        if (!value && phase === 'recorded') setPhase('idle');
    }, [value, phase]);

    // A playable URL for the current recording, revoked when it changes.
    useEffect(() => {
        if (!value) { setPlayUrl(null); return; }
        const u = URL.createObjectURL(value.blob);
        setPlayUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [value]);

    const releaseMic = () => {
        streamRef.current?.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
        if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    };

    // Leaving the page mid-recording must not leave the microphone open.
    useEffect(() => () => {
        try { if (recRef.current?.state === 'recording') recRef.current.stop(); } catch { /* already stopped */ }
        releaseMic();
    }, []);

    const stop = () => {
        const r = recRef.current;
        if (r && r.state === 'recording') r.stop();
    };

    const start = async () => {
        const mime = pickMime();
        // If a re-record fails, keep showing the recording that WILL be sent.
        // Falling back to the bare button would hide an attached note from the
        // patient while it still goes to the hospital.
        const fail = (why: Phase) => setPhase(value ? 'recorded' : why);
        if (!navigator.mediaDevices?.getUserMedia || !(window as any).MediaRecorder) {
            fail('unsupported');
            return;
        }
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            fail('denied');
            return;
        }
        streamRef.current = stream;
        chunksRef.current = [];

        let rec: MediaRecorder;
        try {
            // ~32 kbps is plenty for speech and keeps two minutes well under the bucket's 3 MB.
            rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
        } catch {
            releaseMic();
            fail('unsupported');
            return;
        }
        recRef.current = rec;
        rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
            const seconds = Math.min(MAX_SECONDS, (Date.now() - startedRef.current) / 1000);
            const type = rec.mimeType || mime || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type });
            releaseMic();
            // A tap-and-release shorter than a second is almost always an accident.
            if (blob.size === 0 || seconds < 1) { setPhase('idle'); onChange(null); return; }
            onChange({ blob, seconds, mimeType: type });
            setPhase('recorded');
        };

        startedRef.current = Date.now();
        setElapsed(0);
        rec.start(1000);
        setPhase('recording');
        tickRef.current = window.setInterval(() => {
            const s = (Date.now() - startedRef.current) / 1000;
            setElapsed(s);
            if (s >= MAX_SECONDS) stop();
        }, 250);
    };

    const discard = () => {
        onChange(null);
        setPhase('idle');
    };

    if (phase === 'recording') {
        const pct = Math.min(100, (elapsed / MAX_SECONDS) * 100);
        return (
            <button
                type="button"
                onClick={stop}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 px-4 text-left"
            >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/60" />
                    <span className="relative h-5 w-5 rounded-[5px] bg-rose-600" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold text-rose-800">{t.recording} · {clock(elapsed)}</span>
                        <span className="text-xs font-semibold text-rose-700">{t.stop}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-rose-200">
                        <span className="block h-full rounded-full bg-rose-500 transition-[width]" style={{ width: `${pct}%` }} />
                    </span>
                </span>
            </button>
        );
    }

    if (phase === 'recorded' && value) {
        return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t.saved} · {clock(value.seconds)}
                </p>
                {playUrl && <audio controls src={playUrl} className="w-full" preload="metadata" />}
                <div className="mt-2 flex gap-2">
                    <button
                        type="button"
                        onClick={start}
                        className="min-h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                        {t.again}
                    </button>
                    <button
                        type="button"
                        onClick={discard}
                        className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    >
                        {t.remove}
                    </button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-emerald-900/80">{t.privacy}</p>
            </div>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={start}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 px-4 text-left transition-colors hover:bg-orange-100"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0M12 18v3" />
                    </svg>
                </span>
                <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900">{t.record}</span>
                    <span className="block text-xs text-gray-500">{t.recordHint}</span>
                </span>
            </button>
            {(phase === 'denied' || phase === 'unsupported') && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    {phase === 'denied' ? t.denied : t.unsupported}
                </p>
            )}
        </div>
    );
};

export default VoiceNoteRecorder;
