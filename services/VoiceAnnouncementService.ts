/**
 * Hybrid Voice Announcement Service
 * Engine 1: Local MP3 files  — Most reliable (token-{n}.mp3 in /public/audio/tokens/)
 * Engine 2: Native Speech (SpeechSynthesis) — Fallback on desktop Chrome/Edge
 * Engine 3: Google TTS Stream — Last resort for devices with no local audio
 *
 * Key reliability guarantees:
 *  - Each announcement cancels any in-flight audio/speech before starting
 *  - Chrome SpeechSynthesis stuck-bug workaround via watchdog timer
 *  - Every audio path has an onerror fallback to a local beep
 *  - initializeChannel() never interrupts an active announcement (heartbeat-safe)
 *  - Dedicated Audio element per playback — no shared-state race conditions
 */

class VoiceAnnouncementService {
    private synth: SpeechSynthesis | null = null;

    // masterPlayer is kept only for the initial channel-unlock (setSinkId handshake).
    // All real playback uses freshly-created Audio elements via createRoutedAudio().
    private masterPlayer: HTMLAudioElement | null = null;

    // The currently-active playback element (null when silent)
    private currentPlayback: HTMLAudioElement | null = null;

    // Watchdog timer that recovers from Chrome's stuck SpeechSynthesis bug
    private speechWatchdog: ReturnType<typeof setTimeout> | null = null;

    // True while an announcement is in progress — prevents heartbeat interruption
    public isSpeaking: boolean = false;

    private voices: SpeechSynthesisVoice[] = [];
    private selectedDeviceId: string | null = null;

    // Status for UI dashboard
    public status: {
        engine: 'NONE' | 'SPEECH' | 'AUDIO';
        voiceCount: number;
        lastSpoken: string;
        error: string | null;
        selectedDeviceLabel: string;
    } = {
            engine: 'NONE',
            voiceCount: 0,
            lastSpoken: '',
            error: null,
            selectedDeviceLabel: 'Default Speaker'
        };

    constructor() {
        if (typeof window !== 'undefined') {
            this.synth = window.speechSynthesis;
            this.initNativeVoices();
            // Load saved device if any
            this.selectedDeviceId = localStorage.getItem('bh_selected_audio_device');
            this.status.selectedDeviceLabel = localStorage.getItem('bh_selected_audio_label') || 'Default Speaker';
        }
    }

    private initNativeVoices() {
        if (!this.synth) return;

        const loadVoices = () => {
            this.voices = this.synth!.getVoices();
            this.status.voiceCount = this.voices.length;

            if (this.voices.length > 0) {
                this.status.engine = 'SPEECH';
                console.log(`[Voice] Native engine ready with ${this.voices.length} voices`);
            } else {
                this.status.engine = 'AUDIO';
                console.log('[Voice] No native voices detected. Switching to AUDIO engine.');
            }
        };

        loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
    }

    /**
     * Get list of available audio output devices.
     * Does NOT request microphone permission — only queries output devices.
     */
    async getAudioDevices(): Promise<MediaDeviceInfo[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

            if (audioOutputs.length === 0 || !audioOutputs[0].label) {
                return [{
                    deviceId: 'default',
                    groupId: '',
                    kind: 'audiooutput',
                    label: 'System Default Speaker',
                    toJSON: () => ({})
                } as MediaDeviceInfo];
            }
            return audioOutputs;
        } catch (e) {
            console.error('[Voice] Could not enumerate devices', e);
            return [{
                deviceId: 'default',
                groupId: '',
                kind: 'audiooutput',
                label: 'System Default Speaker (Detected)',
                toJSON: () => ({})
            } as MediaDeviceInfo];
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Stop any in-progress announcement cleanly.
     * Safe to call at any time — no-op when already silent.
     */
    private stopCurrentAnnouncement(): void {
        // Stop SpeechSynthesis and its watchdog
        if (this.speechWatchdog) {
            clearTimeout(this.speechWatchdog);
            this.speechWatchdog = null;
        }
        if (this.synth) this.synth.cancel();

        // Detach and stop the active audio element
        if (this.currentPlayback) {
            this.currentPlayback.onended = null;
            this.currentPlayback.onerror = null;
            this.currentPlayback.pause();
            this.currentPlayback.src = '';
            this.currentPlayback = null;
        }

        this.isSpeaking = false;
    }

    /**
     * Create a fresh Audio element already routed to the selected output device.
     * Each announcement gets its own element — no shared-state races.
     */
    private async createRoutedAudio(src: string): Promise<HTMLAudioElement> {
        const audio = new Audio();
        audio.volume = 1.0;

        if (
            this.selectedDeviceId &&
            this.selectedDeviceId !== 'default' &&
            typeof (audio as any).setSinkId === 'function'
        ) {
            try {
                await (audio as any).setSinkId(this.selectedDeviceId);
            } catch (e) {
                console.warn('[Voice] setSinkId failed for playback element', e);
            }
        }

        audio.src = src;
        return audio;
    }

    /**
     * Select a specific audio output device
     */
    async setAudioDevice(deviceId: string, label: string) {
        this.selectedDeviceId = deviceId;
        this.status.selectedDeviceLabel = label;
        localStorage.setItem('bh_selected_audio_device', deviceId);
        localStorage.setItem('bh_selected_audio_label', label);

        // If we have a master player, route it now
        if (this.masterPlayer && (this.masterPlayer as any).setSinkId) {
            try {
                await (this.masterPlayer as any).setSinkId(deviceId);
                console.log(`[Voice] Audio routed to: ${label}`);
            } catch (e) {
                console.error('[Voice] Failed to route audio to device', e);
            }
        }
    }

    private getTtsUrl(text: string): string {
        const encodedText = encodeURIComponent(text);
        return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`;
    }

    /**
     * Initialize the master audio channel (must be user-gesture triggered).
     * Safe to call from a heartbeat — early-exits if an announcement is active.
     */
    async initializeChannel(): Promise<boolean> {
        // Heartbeat safety: never interrupt an active announcement
        if (this.isSpeaking) return true;

        console.log('[Voice] Initializing channel...');
        this.status.error = 'Connecting...';

        // Silent WAV used to unlock the AudioContext without hitting external APIs
        const SILENT_SOUND = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhAAQACABAAAABkYXRhAgAAAAEA';

        try {
            // Unlock Speech API
            if (this.synth) {
                this.synth.cancel();
                const utter = new SpeechSynthesisUtterance('');
                this.synth.speak(utter);
            }

            // Create master player (unlock element — not used for real playback)
            if (!this.masterPlayer) {
                this.masterPlayer = new Audio();
                this.masterPlayer.autoplay = false;
                this.masterPlayer.volume = 1.0;
            }

            // Route master player to selected device if supported
            if (
                this.selectedDeviceId &&
                this.selectedDeviceId !== 'default' &&
                typeof (this.masterPlayer as any).setSinkId === 'function'
            ) {
                try {
                    await (this.masterPlayer as any).setSinkId(this.selectedDeviceId);
                    console.log(`[Voice] Route confirmed: ${this.status.selectedDeviceLabel}`);
                } catch (sinkError) {
                    console.warn('[Voice] setSinkId not supported, using default speaker', sinkError);
                    this.selectedDeviceId = 'default';
                    this.status.selectedDeviceLabel = 'Default Speaker';
                }
            }

            // Play/pause silent sound to unlock the audio context
            const unlockPromise = (async () => {
                this.masterPlayer!.src = SILENT_SOUND;
                await this.masterPlayer!.play();
                this.masterPlayer!.pause();
                this.masterPlayer!.currentTime = 0;
                return true;
            })();

            const timeoutPromise = new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error('Hardware timeout')), 5000)
            );

            await Promise.race([unlockPromise, timeoutPromise]);

            this.status.error = null;
            console.log('[Voice] Channel unlocked successfully');
            return true;
        } catch (e: any) {
            console.error('[Voice] Initialization failed', e);
            // Native speech still works even if audio unlock failed
            if (this.status.engine === 'SPEECH' && this.voices.length > 0) {
                this.status.error = null;
                console.log('[Voice] Fallback to native speech engine');
                return true;
            }
            this.status.error = `Setup Error: ${e.message || 'Check speaker connection'}`;
            return false;
        }
    }

    // ─── Public announcement API ──────────────────────────────────────────────

    /**
     * PRIMARY method: play the pre-recorded local MP3 for a token number.
     * Falls back to announcePatientCall() for tokens outside the 1-90 range.
     */
    announceTokenFormatted(tokenNumber: string, repeat: number = 2): void {
        this.stopCurrentAnnouncement();

        const match = tokenNumber.match(/\d+/);
        if (!match) {
            this.announcePatientCall(tokenNumber, repeat);
            return;
        }

        const number = parseInt(match[0], 10);
        this.status.lastSpoken = `Token ${number}`;
        this.isSpeaking = true;

        if (number >= 1 && number <= 90) {
            const audioPath = `/audio/tokens/token-${number}.mp3`;
            console.log(`[Voice] Playing local file: ${audioPath}`);
            this.playLocalFile(audioPath, tokenNumber, repeat);
        } else {
            // Out-of-range: fall back to TTS/speech path
            this.announcePatientCall(tokenNumber, repeat);
        }
    }

    /**
     * FALLBACK method: synthesise the announcement via Speech API or Google TTS.
     * Use announceTokenFormatted() in most cases — it's far more reliable.
     */
    announcePatientCall(tokenNumber: string, repeat: number = 2): void {
        this.stopCurrentAnnouncement();

        const numStr = tokenNumber.replace(/^[A-Za-z-]+/, '').trim();
        const digits = numStr.split('').join(' ');
        const message = `Token number ${digits}`;

        this.status.lastSpoken = message;
        this.isSpeaking = true;

        if (this.status.engine === 'SPEECH' && this.synth && this.voices.length > 0) {
            this.speakNative(message, repeat);
        } else {
            this.playAudio(message, repeat);
        }
    }

    // ─── Private playback implementations ────────────────────────────────────

    /**
     * Play a local MP3 file, repeating `repeatCount` times.
     * Creates a fresh Audio element per call — no shared state.
     */
    private playLocalFile(path: string, fallbackText: string, repeatCount: number): void {
        let currentRepeat = 0;

        const playNext = async () => {
            if (currentRepeat >= repeatCount) {
                this.isSpeaking = false;
                return;
            }

            try {
                const audio = await this.createRoutedAudio(path);
                this.currentPlayback = audio;

                audio.onerror = () => {
                    console.warn(`[Voice] Local file failed: ${path} — falling back to beep`);
                    this.currentPlayback = null;
                    this.isSpeaking = false;
                    this.playStandardBeep();
                };

                audio.onended = () => {
                    this.currentPlayback = null;
                    currentRepeat++;
                    setTimeout(playNext, 800);
                };

                await audio.play();
            } catch (e) {
                console.error('[Voice] playLocalFile play() threw', e);
                this.currentPlayback = null;
                this.isSpeaking = false;
                this.playStandardBeep();
            }
        };

        playNext();
    }

    /**
     * Play the announcement beep as a last-resort fallback.
     */
    private async playStandardBeep(): Promise<void> {
        try {
            const beep = await this.createRoutedAudio('/Announcement sound effect.mp3');
            this.currentPlayback = beep;
            beep.onended = () => { this.currentPlayback = null; this.isSpeaking = false; };
            beep.onerror = () => { this.currentPlayback = null; this.isSpeaking = false; };
            await beep.play();
        } catch (e) {
            console.error('[Voice] Standard beep failed', e);
            this.isSpeaking = false;
        }
    }

    /**
     * Chrome / Edge native SpeechSynthesis playback.
     * Includes a watchdog timer that fires after 8 s to recover from Chrome's
     * known "stuck utterance" bug where onend never fires.
     */
    private speakNative(text: string, repeatCount: number): void {
        if (!this.synth) { this.isSpeaking = false; return; }

        const speak = (count: number) => {
            if (count >= repeatCount) { this.isSpeaking = false; return; }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-IN';
            utterance.rate = 0.9;

            // Watchdog: if onend hasn't fired after 8 s, Chrome is stuck — advance
            if (this.speechWatchdog) clearTimeout(this.speechWatchdog);
            this.speechWatchdog = setTimeout(() => {
                console.warn('[Voice] SpeechSynthesis watchdog: Chrome stuck-bug recovery');
                this.speechWatchdog = null;
                this.synth?.cancel();
                speak(count + 1);
            }, 8000);

            utterance.onend = () => {
                if (this.speechWatchdog) { clearTimeout(this.speechWatchdog); this.speechWatchdog = null; }
                setTimeout(() => speak(count + 1), 1200);
            };

            utterance.onerror = (evt) => {
                if (this.speechWatchdog) { clearTimeout(this.speechWatchdog); this.speechWatchdog = null; }
                // 'interrupted' is normal (e.g., cancel() called) — don't log as error
                if (evt.error !== 'interrupted') {
                    console.warn('[Voice] SpeechSynthesis error:', evt.error, '— beep fallback');
                    this.isSpeaking = false;
                    this.playStandardBeep();
                }
            };

            this.synth!.speak(utterance);
        };

        speak(0);
    }

    /**
     * Google Translate TTS stream playback.
     * Uses a dedicated Audio element with onerror → beep fallback.
     */
    private playAudio(text: string, repeatCount: number): void {
        let currentRepeat = 0;
        const url = this.getTtsUrl(text);

        const playNext = async () => {
            if (currentRepeat >= repeatCount) {
                this.isSpeaking = false;
                return;
            }

            try {
                const audio = await this.createRoutedAudio(url);
                this.currentPlayback = audio;

                audio.onerror = () => {
                    console.warn('[Voice] TTS fetch failed — beep fallback');
                    this.currentPlayback = null;
                    this.status.error = 'TTS unavailable — using beep';
                    this.isSpeaking = false;
                    this.playStandardBeep();
                };

                audio.onended = () => {
                    this.currentPlayback = null;
                    currentRepeat++;
                    setTimeout(playNext, 1500);
                };

                await audio.play();
            } catch (err: any) {
                console.error('[Voice] TTS play() threw', err);
                this.currentPlayback = null;
                this.status.error = 'Speaker blocked. Re-activate in settings.';
                this.isSpeaking = false;
            }
        };

        playNext();
    }

    // ─── Public utilities ─────────────────────────────────────────────────────

    stop(): void {
        this.stopCurrentAnnouncement();
    }

    getEngineStatus() {
        return this.status;
    }
}

export const voiceService = new VoiceAnnouncementService();
export default VoiceAnnouncementService;
