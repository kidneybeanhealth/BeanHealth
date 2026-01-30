/**
 * Hybrid Voice Announcement Service
 * Engine 1: Native Speech (SpeechSynthesis) - Reliable on Mac/Chrome
 * Engine 2: Audio Stream (MP3) - Reliable for Smart TVs/Speakers
 * 
 * Automatically selects the best engine based on browser capabilities.
 */

class VoiceAnnouncementService {
    private synth: SpeechSynthesis | null = null;
    private masterPlayer: HTMLAudioElement | null = null;
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
     * Get list of available audio output devices
     * No microphone permission needed - only queries output devices
     */
    async getAudioDevices(): Promise<MediaDeviceInfo[]> {
        try {
            // Enumerate devices without requesting microphone permission
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

            // If no devices found or labels are empty, return default device
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
            // Fallback to default device
            return [{
                deviceId: 'default',
                groupId: '',
                kind: 'audiooutput',
                label: 'System Default Speaker (Detected)',
                toJSON: () => ({})
            } as MediaDeviceInfo];
        }
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
     * Initialize the master audio channel (user-triggered)
     * Optimized for TV browsers - works with default speakers
     */
    async initializeChannel(): Promise<boolean> {
        console.log('[Voice] Initializing channel...');
        this.status.error = 'Connecting...';

        // Base64 1-second silent WAV to unlock audio without hitting Google TTS
        const SILENT_SOUND = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhAAQACABAAAABkYXRhAgAAAAEA';

        try {
            // Unlocking Speech API
            if (this.synth) {
                this.synth.cancel();
                const utter = new SpeechSynthesisUtterance('');
                this.synth.speak(utter);
            }

            // Creating Master Player (HTMLAudioElement)
            if (!this.masterPlayer) {
                this.masterPlayer = new Audio();
                this.masterPlayer.autoplay = false;
                this.masterPlayer.volume = 1.0;
            }

            // Route to selected device if supported (Chrome/Edge only)
            if (this.selectedDeviceId && this.selectedDeviceId !== 'default' && (this.masterPlayer as any).setSinkId) {
                try {
                    await (this.masterPlayer as any).setSinkId(this.selectedDeviceId);
                    console.log(`[Voice] Route confirmed: ${this.status.selectedDeviceLabel}`);
                } catch (sinkError) {
                    console.warn('[Voice] setSinkId not supported, using default speaker', sinkError);
                    this.selectedDeviceId = 'default';
                    this.status.selectedDeviceLabel = 'Default Speaker';
                }
            }

            // Play/Pause silent audio to "unlock" the audio context
            const unlockPromise = (async () => {
                this.masterPlayer!.src = SILENT_SOUND;
                await this.masterPlayer!.play();
                this.masterPlayer!.pause();
                this.masterPlayer!.currentTime = 0;
                return true;
            })();

            // 5 second timeout for hardware handshake
            const timeoutPromise = new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error('Hardware timeout')), 5000)
            );

            await Promise.race([unlockPromise, timeoutPromise]);

            this.status.error = null;
            console.log('[Voice] Channel unlocked successfully');
            return true;
        } catch (e: any) {
            console.error('[Voice] Initialization failed', e);
            // If native speech is working, we can still call it a success
            if (this.status.engine === 'SPEECH' && this.voices.length > 0) {
                this.status.error = null;
                console.log('[Voice] Fallback to native speech engine');
                return true;
            }
            this.status.error = `Setup Error: ${e.message || 'Check speaker connection'}`;
            return false;
        }
    }

    /**
     * Plays a specific audio file for a token number (1-60).
     * Files should be located in /public/audio/tokens/token-{number}.mp3
     */
    announceTokenFormatted(tokenNumber: string, repeat: number = 2) {
        // Extract the numeric part (e.g., "A-123" -> 123)
        const match = tokenNumber.match(/\d+/);
        if (!match) {
            // Fallback: Use standard announcement/beep if no number found
            this.announcePatientCall(tokenNumber, repeat);
            return;
        }

        const number = parseInt(match[0], 10);

        // Check if we have a file for this number (1 to 60)
        // All files are normalized to .mp3
        if (number >= 1 && number <= 60) {
            const audioPath = `/audio/tokens/token-${number}.mp3`;
            console.log(`[Voice] Attempting to play local file: ${audioPath} (Repeat: ${repeat})`);
            this.playLocalFile(audioPath, tokenNumber, repeat);
        } else {
            // Fallback for > 60: Play existing beep sound
            console.log('[Voice] Token outside 1-60 range, playing standard beep');
            this.playStandardBeep();
        }
    }

    private playStandardBeep() {
        try {
            const beep = new Audio('/Announcement sound effect.mp3');
            beep.volume = 1.0;

            beep.play().catch(e => console.warn('[Voice] Beep failed', e));

            // Play second beep for attention (matching original UI behavior)
            beep.onended = () => {
                const beep2 = new Audio('/Announcement sound effect.mp3');
                beep2.volume = 1.0;
                beep2.play().catch(e => console.warn('[Voice] Second beep failed', e));
            };
        } catch (e) {
            console.error('[Voice] Standard beep error', e);
        }
    }

    private playLocalFile(path: string, fallbackText: string, repeatCount: number) {
        if (!this.masterPlayer) this.masterPlayer = new Audio();

        let currentRepeat = 0;

        // Safety: If the file fails to load/play, fallback to Standard Beep (not TTS)
        const fallback = () => {
            console.warn(`[Voice] Local file failed (${path}), falling back to Standard Beep`);
            this.playStandardBeep();
        };

        const playNext = () => {
            if (currentRepeat >= repeatCount) return;

            this.masterPlayer!.src = path;
            this.masterPlayer!.onerror = fallback;

            this.masterPlayer!.onended = () => {
                currentRepeat++;
                // Add a small delay between repeats (e.g. 1 second)
                setTimeout(playNext, 1000);
            };

            this.masterPlayer!.play().catch(e => {
                console.error('[Voice] Playback failed', e);
                fallback();
            });
        };

        playNext();
    }

    announcePatientCall(tokenNumber: string, repeat: number = 2): void {
        const numStr = tokenNumber.replace(/^[A-Za-z-]+/, '').trim();
        const digits = numStr.split('').join(' ');
        const message = `Token number ${digits}`;

        this.status.lastSpoken = message;

        // Use native if voices are available, otherwise use MP3
        if (this.status.engine === 'SPEECH' && this.synth) {
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
            utterance.lang = 'en-IN';
            utterance.rate = 0.9;
            utterance.onend = () => setTimeout(() => speak(count + 1), 1200);
            this.synth!.speak(utterance);
        };
        speak(0);
    }

    private playAudio(text: string, repeatCount: number): void {
        if (!this.masterPlayer) return;

        let currentRepeat = 0;
        const url = this.getTtsUrl(text);

        const playNext = async () => {
            if (currentRepeat >= repeatCount) return;

            try {
                this.masterPlayer!.src = url;
                this.masterPlayer!.onended = () => {
                    currentRepeat++;
                    setTimeout(playNext, 1500);
                };
                await this.masterPlayer!.play();
            } catch (err) {
                console.error('[Voice] Master player playback failed', err);
                this.status.error = 'Speaker blocked. Re-activate in settings.';
            }
        };

        playNext();
    }

    stop(): void {
        if (this.synth) this.synth.cancel();
        if (this.masterPlayer) {
            this.masterPlayer.pause();
            this.masterPlayer.src = '';
        }
    }

    getEngineStatus() {
        return this.status;
    }
}

export const voiceService = new VoiceAnnouncementService();
export default VoiceAnnouncementService;
