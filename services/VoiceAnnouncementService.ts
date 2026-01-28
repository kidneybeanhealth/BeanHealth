/**
 * Voice Announcement Service
 * Uses Web Speech API for Tamil voice announcements
 * 
 * Announcement format: "டோக்கன் நம்பர் [NUMBER], pharmacy-க்கு வரவும்"
 * (Token number X, please come to pharmacy)
 */

// Tamil number words
const TAMIL_NUMBERS: { [key: string]: string } = {
    '0': 'பூஜ்ஜியம்',
    '1': 'ஒன்று',
    '2': 'இரண்டு',
    '3': 'மூன்று',
    '4': 'நான்கு',
    '5': 'ஐந்து',
    '6': 'ஆறு',
    '7': 'ஏழு',
    '8': 'எட்டு',
    '9': 'ஒன்பது',
    '10': 'பத்து',
    '11': 'பதினொன்று',
    '12': 'பன்னிரண்டு',
    '13': 'பதிமூன்று',
    '14': 'பதினான்கு',
    '15': 'பதினைந்து',
    '16': 'பதினாறு',
    '17': 'பதினேழு',
    '18': 'பதினெட்டு',
    '19': 'பத்தொன்பது',
    '20': 'இருபது',
    '30': 'முப்பது',
    '40': 'நாற்பது',
    '50': 'ஐம்பது',
    '60': 'அறுபது',
    '70': 'எழுபது',
    '80': 'எண்பது',
    '90': 'தொண்ணூறு',
    '100': 'நூறு'
};

class VoiceAnnouncementService {
    private synth: SpeechSynthesis | null = null;
    private voices: SpeechSynthesisVoice[] = [];
    private isInitialized: boolean = false;

    constructor() {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            this.synth = window.speechSynthesis;
            this.init();
        }
    }

    private init() {
        if (this.synth) {
            const loadVoices = () => {
                this.voices = this.synth!.getVoices();
                if (this.voices.length > 0) {
                    this.isInitialized = true;
                    console.log('[Voice] Available Voices:', this.voices.map(v => `${v.name} (${v.lang})`));
                }
            };

            loadVoices();
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = loadVoices;
            }
        }
    }

    /**
     * Pre-warm the speech synth (call this on first user interaction)
     */
    preWarm(): void {
        if (!this.synth) return;
        console.log('[Voice] Pre-warming synthesizer...');
        const utterance = new SpeechSynthesisUtterance('');
        this.synth.speak(utterance);
    }

    /**
     * Get Tamil voice if available
     */
    private getTamilVoice(): SpeechSynthesisVoice | null {
        if (!this.synth) return null;

        this.voices = this.synth.getVoices();

        // 1. Precise Tamil (India)
        let voice = this.voices.find(v => v.lang === 'ta-IN');

        // 2. Any Tamil
        if (!voice) {
            voice = this.voices.find(v => v.lang.startsWith('ta'));
        }

        // 3. Name contains Tamil
        if (!voice) {
            voice = this.voices.find(v => v.name.toLowerCase().includes('tamil'));
        }

        if (voice) {
            console.log('[Voice] Selected Tamil voice:', voice.name, `(${voice.lang})`);
            return voice;
        }

        // 4. Fallback to any Indian English voice
        const indianVoice = this.voices.find(v => v.lang === 'en-IN');
        if (indianVoice) {
            console.log('[Voice] No Tamil voice. Falling back to Indian English:', indianVoice.name);
            return indianVoice;
        }

        console.warn('[Voice] No suitable voice found for Tamil announcement.');
        return null;
    }

    /**
     * Convert number to Tamil words
     */
    private numberToTamil(num: number): string {
        if (num <= 20) {
            return TAMIL_NUMBERS[num.toString()] || num.toString();
        }

        if (num < 100) {
            const tens = Math.floor(num / 10) * 10;
            const ones = num % 10;
            if (ones === 0) {
                return TAMIL_NUMBERS[tens.toString()] || num.toString();
            }
            return `${TAMIL_NUMBERS[tens.toString()] || tens} ${TAMIL_NUMBERS[ones.toString()] || ones}`;
        }

        if (num === 100) {
            return TAMIL_NUMBERS['100'];
        }

        // For numbers > 100, just use the number
        return num.toString();
    }

    /**
     * Check if voice synthesis is available
     */
    isAvailable(): boolean {
        return this.synth !== null && typeof window !== 'undefined';
    }

    /**
     * Convert number to English words (for phonetic fallback)
     */
    private numberToEnglish(num: number): string {
        const words: { [key: number]: string } = {
            0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
            6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten'
        };
        // For token numbers, speaking digit by digit is often clearer
        if (num > 10) {
            return num.toString().split('').join(' ');
        }
        return words[num] || num.toString();
    }

    /**
     * Announce patient call
     * Uses Tamil script if Tamil voice is available, otherwise uses Phonetic English
     */
    announcePatientCall(tokenNumber: string, repeat: number = 2): void {
        if (!this.synth) return;

        const numStr = tokenNumber.replace(/^[A-Za-z-]+/, '').trim();
        const num = parseInt(numStr) || 0;

        const voice = this.getTamilVoice();
        const isTamilVoice = !!(voice && (voice.lang.startsWith('ta') || voice.name.toLowerCase().includes('tamil')));

        const englishNumber = this.numberToEnglish(num);
        const message = `Token number ${englishNumber}`;

        console.log('[Voice] Final Text:', message);
        this.speakWithRepeat(message, repeat, isTamilVoice ? 'ta-IN' : 'en-IN');
    }

    /**
     * Speak message with optional repeat
     */
    private speakWithRepeat(message: string, repeatCount: number, lang: string): void {
        if (!this.synth) return;

        this.synth.cancel();

        let currentRepeat = 0;
        const speak = () => {
            if (currentRepeat >= repeatCount) return;

            const utterance = new SpeechSynthesisUtterance(message);
            const voice = this.getTamilVoice();
            if (voice) utterance.voice = voice;

            utterance.lang = lang;
            utterance.rate = lang === 'ta-IN' ? 0.85 : 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onend = () => {
                currentRepeat++;
                if (currentRepeat < repeatCount) {
                    setTimeout(speak, 1200);
                }
            };

            this.synth!.speak(utterance);
        };

        speak();
    }

    /**
     * Speak custom message
     */
    speak(message: string, lang: string = 'ta-IN'): void {
        if (!this.synth) return;

        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.volume = 1.0;

        const voice = this.getTamilVoice();
        if (voice) {
            utterance.voice = voice;
        }

        this.synth.speak(utterance);
    }

    /**
     * Stop any ongoing speech
     */
    stop(): void {
        if (this.synth) {
            this.synth.cancel();
        }
    }

    /**
     * Get list of available voices (for debugging)
     */
    getAvailableVoices(): SpeechSynthesisVoice[] {
        if (!this.synth) return [];
        return this.synth.getVoices();
    }
}

// Export singleton instance
export const voiceService = new VoiceAnnouncementService();
export default VoiceAnnouncementService;
