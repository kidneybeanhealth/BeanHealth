/**
 * Hybrid Voice Announcement Service
 * Engine 1: Native Speech (SpeechSynthesis) - Reliable on Mac/Chrome
 * Engine 2: Audio Stream (MP3) - Reliable for Smart TVs/Speakers
 * 
 * Automatically selects the best engine based on browser capabilities.
 */

class VoiceAnnouncementService {
    private synth: SpeechSynthesis | null = null;
    private lastAudio: HTMLAudioElement | null = null;
    private voices: SpeechSynthesisVoice[] = [];
    private isNativeSupported: boolean = false;

    // Status for UI dashboard
    public status: {
        engine: 'NONE' | 'SPEECH' | 'AUDIO';
        voiceCount: number;
        lastSpoken: string;
        error: string | null;
    } = {
            engine: 'NONE',
            voiceCount: 0,
            lastSpoken: '',
            error: null
        };

    constructor() {
        if (typeof window !== 'undefined') {
            this.synth = window.speechSynthesis;
            this.initNativeVoices();
        }
    }

    private initNativeVoices() {
        if (!this.synth) return;

        const loadVoices = () => {
            this.voices = this.synth!.getVoices();
            this.status.voiceCount = this.voices.length;

            if (this.voices.length > 0) {
                this.isNativeSupported = true;
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

    private getTtsUrl(text: string): string {
        const encodedText = encodeURIComponent(text);
        // Using a reliable Google Translate TTS proxy with standard client ID
        return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`;
    }

    /**
     * Pre-warm system on user interaction
     */
    preWarm(): void {
        console.log('[Voice] Pre-warming system...');
        try {
            // Pre-warm Speech
            if (this.synth) {
                const utter = new SpeechSynthesisUtterance('');
                this.synth.speak(utter);
            }
            // Pre-warm Audio (silent)
            const silent = new Audio(this.getTtsUrl(' '));
            silent.volume = 0;
            silent.play().catch(() => { });

            this.status.error = null;
        } catch (e) {
            console.error('[Voice] Pre-warm failed', e);
        }
    }

    announcePatientCall(tokenNumber: string, repeat: number = 2): void {
        const numStr = tokenNumber.replace(/^[A-Za-z-]+/, '').trim();
        const digits = numStr.split('').join(' ');
        const message = `Token number ${digits}`;

        this.status.lastSpoken = message;
        console.log(`[Voice] Announcing: "${message}" using ${this.status.engine}`);

        if (this.isNativeSupported && this.synth) {
            this.speakNative(message, repeat);
        } else {
            this.playAudio(message, repeat);
        }
    }

    private speakNative(text: string, repeatCount: number): void {
        if (!this.synth) return;

        this.synth.cancel();

        const speak = (count: number) => {
            if (count >= repeatCount) return;

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-IN'; // Clear Indian English accent
            utterance.rate = 0.9;
            utterance.onend = () => {
                setTimeout(() => speak(count + 1), 1200);
            };
            utterance.onerror = (e) => {
                console.error('[Voice] Speech error:', e);
                this.status.error = 'Native Speech Error. Trying Audio fallback...';
                this.playAudio(text, 1);
            };

            this.synth!.speak(utterance);
        };

        speak(0);
    }

    private playAudio(text: string, repeatCount: number): void {
        let currentRepeat = 0;
        const url = this.getTtsUrl(text);

        const playNext = () => {
            if (currentRepeat >= repeatCount) return;

            if (this.lastAudio) {
                this.lastAudio.pause();
                this.lastAudio.src = '';
            }

            const audio = new Audio(url);
            this.lastAudio = audio;

            audio.onended = () => {
                currentRepeat++;
                setTimeout(playNext, 1500);
            };

            audio.onerror = (e) => {
                console.error('[Voice] Audio Error:', e);
                this.status.error = 'MP3 stream failed. Check internet.';
            };

            audio.play().catch(err => {
                console.error('[Voice] Audio play blocked', err);
                this.status.error = 'Browser blocked audio. Click Activate.';
            });
        };

        playNext();
    }

    stop(): void {
        if (this.synth) this.synth.cancel();
        if (this.lastAudio) {
            this.lastAudio.pause();
            this.lastAudio = null;
        }
    }

    getEngineStatus() {
        return this.status;
    }
}

export const voiceService = new VoiceAnnouncementService();
export default VoiceAnnouncementService;
