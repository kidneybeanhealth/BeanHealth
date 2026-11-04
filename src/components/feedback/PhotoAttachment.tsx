/**
 * PhotoAttachment — show it instead of describing it
 *
 * A dirty restroom, a broken bed rail, a leaking tap: easier to photograph than
 * to describe on a phone keyboard. One photo per response, from the camera or
 * the gallery.
 *
 *   · Take a photo opens a live viewfinder in the page, so the browser asks for
 *     camera permission in its usual way. After the shutter the patient sees the
 *     photo and chooses Retake or Use this photo. Without getUserMedia (an old
 *     browser) it falls back to the phone's own camera app.
 *   · From gallery opens the picker, then the same "Is this photo okay?" step.
 *   · Once attached, Remove takes it off again.
 *
 * Like the voice note, nothing is uploaded until Send: a patient who takes a
 * photo and walks away leaves nothing on the server. The camera is switched off
 * the moment the shutter is pressed, and whenever the viewfinder closes.
 *
 * The phone's Back button closes the viewfinder instead of leaving the form.
 * Patients press Back to dismiss things, and here that would throw away every
 * answer they had given.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from './feedbackQuestions';
import type { FeedbackPhoto } from '../../services/feedbackService';
import { photoFromFile, photoFromVideo } from './feedbackPhoto';

const T = {
    en: {
        title: 'Add a photo',
        optional: 'optional',
        camera: 'Take a photo',
        gallery: 'From gallery',
        aim: 'Point the camera and tap the round button',
        starting: 'Opening the camera…',
        cancel: 'Cancel',
        flip: 'Switch camera',
        shutter: 'Take photo',
        askOk: 'Is this photo okay?',
        retake: 'Retake',
        another: 'Choose another',
        use: 'Use this photo',
        preparing: 'Preparing photo…',
        ready: 'Photo ready to send',
        remove: 'Remove',
        privacy: "Hospital staff will see this photo. Location details are removed from it. Please avoid other patients' faces.",
        denied: 'Camera access was blocked. You can choose a photo from the gallery instead.',
        noCamera: 'No camera was found. You can choose a photo from the gallery instead.',
        unreadable: 'This photo could not be opened. Please try another one.',
    },
    ta: {
        title: 'புகைப்படம் சேர்க்கவும்',
        optional: 'விருப்பம்',
        camera: 'புகைப்படம் எடு',
        gallery: 'கேலரியிலிருந்து',
        aim: 'கேமராவைக் காட்டி, வட்டப் பொத்தானைத் தட்டவும்',
        starting: 'கேமரா திறக்கிறது…',
        cancel: 'ரத்து',
        flip: 'கேமராவை மாற்று',
        shutter: 'படம் எடு',
        askOk: 'இந்தப் புகைப்படம் சரியா?',
        retake: 'மீண்டும் எடு',
        another: 'வேறு படம்',
        use: 'இதைப் பயன்படுத்து',
        preparing: 'புகைப்படம் தயாராகிறது…',
        ready: 'புகைப்படம் அனுப்பத் தயார்',
        remove: 'நீக்கு',
        privacy: 'இந்தப் புகைப்படத்தை மருத்துவமனை ஊழியர்கள் பார்ப்பார்கள். இருப்பிட விவரங்கள் நீக்கப்படும். மற்ற நோயாளிகளின் முகங்களைத் தவிர்க்கவும்.',
        denied: 'கேமரா அனுமதி மறுக்கப்பட்டது. கேலரியிலிருந்து புகைப்படம் தேர்ந்தெடுக்கலாம்.',
        noCamera: 'கேமரா கிடைக்கவில்லை. கேலரியிலிருந்து புகைப்படம் தேர்ந்தெடுக்கலாம்.',
        unreadable: 'இந்தப் புகைப்படத்தைத் திறக்க இயலவில்லை. வேறொன்றை முயற்சிக்கவும்.',
    },
} as const;

type Phase = 'idle' | 'camera' | 'review' | 'busy';
type Notice = 'denied' | 'noCamera' | 'unreadable' | null;
type Facing = 'environment' | 'user';

/** An object URL for a blob, revoked when the blob changes or the view goes. */
const useBlobUrl = (blob: Blob | null | undefined): string | null => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!blob) { setUrl(null); return; }
        const u = URL.createObjectURL(blob);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [blob]);
    return url;
};

export interface PhotoAttachmentProps {
    lang: Lang;
    value: FeedbackPhoto | null;
    onChange: (p: FeedbackPhoto | null) => void;
}

const PhotoAttachment: React.FC<PhotoAttachmentProps> = ({ lang, value, onChange }) => {
    const t = T[lang];
    const [phase, setPhase] = useState<Phase>('idle');
    const [notice, setNotice] = useState<Notice>(null);
    // Taken or picked, waiting for "Use this photo".
    const [pending, setPending] = useState<FeedbackPhoto | null>(null);
    const [pendingFrom, setPendingFrom] = useState<'camera' | 'nativeCamera' | 'gallery'>('camera');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [camReady, setCamReady] = useState(false);
    const [facing, setFacing] = useState<Facing>('environment');
    const [canFlip, setCanFlip] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const galleryRef = useRef<HTMLInputElement>(null);
    const nativeCameraRef = useRef<HTMLInputElement>(null);
    // Bumped whenever the viewfinder closes, so a camera that finishes starting
    // after the patient pressed Cancel is switched straight back off.
    const cameraGenRef = useRef(0);

    const valueUrl = useBlobUrl(value?.blob);
    const pendingUrl = useBlobUrl(pending?.blob);

    const stopCamera = useCallback(() => {
        cameraGenRef.current += 1;
        streamRef.current?.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
        setStream(null);
        setCamReady(false);
    }, []);

    // Leaving the page with the viewfinder open must not leave the camera on.
    useEffect(() => () => {
        streamRef.current?.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
    }, []);

    const startCamera = useCallback(async (want: Facing) => {
        stopCamera();
        const gen = cameraGenRef.current;
        setNotice(null);
        setPhase('camera');
        let s: MediaStream;
        try {
            // `ideal`, not `exact`: a laptop or a desk tablet with one camera
            // still opens rather than failing on "no back camera".
            s = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: want }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            });
        } catch (e: any) {
            if (gen !== cameraGenRef.current) return;
            const name = e?.name || '';
            setNotice(name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' ? 'noCamera' : 'denied');
            setPhase('idle');
            return;
        }
        if (gen !== cameraGenRef.current) { s.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = s;
        setStream(s);
        setFacing(want);
        // Only after permission do device labels and counts come back.
        navigator.mediaDevices.enumerateDevices?.()
            .then(ds => setCanFlip(ds.filter(d => d.kind === 'videoinput').length > 1))
            .catch(() => setCanFlip(false));
    }, [stopCamera]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v || !stream) return;
        v.srcObject = stream;
        v.play().catch(() => { /* autoplay is allowed for a muted stream; ignore a race */ });
    }, [stream]);

    const openCamera = () => {
        setNotice(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            // No in-page camera: hand over to the phone's camera app.
            nativeCameraRef.current?.click();
            return;
        }
        startCamera('environment');
    };

    const shoot = async () => {
        const v = videoRef.current;
        if (!v || !camReady) return;
        // Disables the shutter: one press, one photo.
        setCamReady(false);
        try {
            const p = await photoFromVideo(v);
            stopCamera();
            setPending(p);
            setPendingFrom('camera');
            setPhase('review');
        } catch {
            stopCamera();
            setNotice('unreadable');
            setPhase('idle');
        }
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>, from: 'gallery' | 'nativeCamera') => {
        const file = e.target.files?.[0];
        // Cleared so picking the same file again still fires a change.
        e.target.value = '';
        if (!file) return;
        setNotice(null);
        setPhase('busy');
        try {
            const p = await photoFromFile(file);
            setPending(p);
            setPendingFrom(from);
            setPhase('review');
        } catch {
            setPending(null);
            setNotice('unreadable');
            setPhase('idle');
        }
    };

    const closeOverlay = useCallback(() => {
        stopCamera();
        setPending(null);
        setPhase('idle');
    }, [stopCamera]);

    const retake = () => {
        setPending(null);
        if (pendingFrom === 'gallery') { setPhase('idle'); galleryRef.current?.click(); return; }
        if (pendingFrom === 'nativeCamera') { setPhase('idle'); nativeCameraRef.current?.click(); return; }
        startCamera(facing);
    };

    const accept = () => {
        if (!pending) return;
        onChange(pending);
        setPending(null);
        setPhase('idle');
    };

    // The viewfinder and the review are one full-screen overlay. While it is
    // open: no page scroll behind it, Escape closes it, and Back closes it.
    const overlayOpen = phase === 'camera' || phase === 'review';
    const closedByBackRef = useRef(false);
    useEffect(() => {
        if (!overlayOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        try { window.history.pushState({ ...(window.history.state || {}), bhFeedbackPhoto: true }, ''); } catch { /* ignore */ }
        const onPop = () => { closedByBackRef.current = true; closeOverlay(); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeOverlay(); };
        window.addEventListener('popstate', onPop);
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('popstate', onPop);
            window.removeEventListener('keydown', onKey);
            // Closed by a button: take back the history entry we added, so the
            // next Back leaves the page as the patient expects.
            if (!closedByBackRef.current && window.history.state?.bhFeedbackPhoto) window.history.back();
            closedByBackRef.current = false;
        };
    }, [overlayOpen, closeOverlay]);

    const hidden = (
        <>
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e, 'gallery')} />
            <input ref={nativeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e, 'nativeCamera')} />
        </>
    );

    const overlay = overlayOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={phase === 'camera' ? t.camera : t.askOk}>
            {phase === 'camera' ? (
                <>
                    <div className="relative min-h-0 flex-1">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            onLoadedMetadata={() => setCamReady(true)}
                            onPlaying={() => setCamReady(true)}
                            className={`h-full w-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`}
                        />
                        {!camReady && (
                            <div className="absolute inset-0 flex items-center justify-center gap-3 text-white/80">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                                <span className="text-sm font-medium">{t.starting}</span>
                            </div>
                        )}
                        {camReady && (
                            <p className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-center text-sm font-semibold text-white">
                                {t.aim}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-3 items-center bg-black px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                        <button
                            type="button"
                            onClick={closeOverlay}
                            className="min-h-[48px] justify-self-start rounded-xl px-3 text-sm font-bold text-white hover:bg-white/10"
                        >
                            {t.cancel}
                        </button>
                        <button
                            type="button"
                            onClick={shoot}
                            disabled={!camReady}
                            aria-label={t.shutter}
                            className="flex h-[76px] w-[76px] items-center justify-center justify-self-center rounded-full border-4 border-white/90 disabled:opacity-40"
                        >
                            <span className="h-[60px] w-[60px] rounded-full bg-white" />
                        </button>
                        {canFlip ? (
                            <button
                                type="button"
                                onClick={() => startCamera(facing === 'environment' ? 'user' : 'environment')}
                                aria-label={t.flip}
                                title={t.flip}
                                className="flex h-12 w-12 items-center justify-center justify-self-end rounded-full bg-white/15 text-white hover:bg-white/25"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.6 15A7 7 0 0018.4 15M18.4 9A7 7 0 005.6 9" />
                                </svg>
                            </button>
                        ) : <span />}
                    </div>
                </>
            ) : (
                <>
                    <p className="bg-black px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] text-center text-base font-bold text-white">{t.askOk}</p>
                    <div className="flex min-h-0 flex-1 items-center justify-center bg-black px-2">
                        {pendingUrl && <img src={pendingUrl} alt="" className="max-h-full max-w-full object-contain" />}
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-black px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                        <button
                            type="button"
                            onClick={retake}
                            className="min-h-[56px] rounded-2xl border border-white/40 text-base font-bold text-white hover:bg-white/10"
                        >
                            {pendingFrom === 'gallery' ? t.another : t.retake}
                        </button>
                        <button
                            type="button"
                            onClick={accept}
                            className="min-h-[56px] rounded-2xl bg-orange-500 text-base font-bold text-white hover:bg-orange-600"
                        >
                            {t.use}
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    if (value) {
        return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t.ready}
                </p>
                {valueUrl && (
                    <div className="flex justify-center overflow-hidden rounded-lg bg-white ring-1 ring-emerald-100">
                        <img src={valueUrl} alt="" className="max-h-64 w-auto max-w-full object-contain" />
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="mt-2 min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-4 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                    {t.remove}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-emerald-900/80">{t.privacy}</p>
            </div>
        );
    }

    return (
        <div>
            {hidden}
            <p className="mb-2 text-sm font-semibold text-gray-800">
                {t.title} <span className="text-xs font-normal text-gray-400">· {t.optional}</span>
            </p>
            {phase === 'busy' ? (
                <div className="flex min-h-[56px] items-center justify-center gap-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                    <span className="text-sm font-medium">{t.preparing}</span>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={openCamera}
                        className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-900 transition-colors hover:bg-sky-100"
                    >
                        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5A1.5 1.5 0 014.5 7h2.3l1.4-2h7.6l1.4 2h2.3A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-9z" />
                            <circle cx="12" cy="13" r="3.5" />
                        </svg>
                        {t.camera}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setNotice(null); galleryRef.current?.click(); }}
                        className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-900 transition-colors hover:bg-sky-100"
                    >
                        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="16" rx="2" />
                            <circle cx="8.5" cy="9.5" r="1.5" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16l-5-5-8 8" />
                        </svg>
                        {t.gallery}
                    </button>
                </div>
            )}
            {notice && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{t[notice]}</p>
            )}
            {overlay}
        </div>
    );
};

export default PhotoAttachment;
