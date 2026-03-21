import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

interface InlineAudioRecorderProps {
    onRecordingComplete: (audioBlob: Blob, duration: number) => void;
    onCancel: () => void;
    maxDurationSeconds?: number;
}

export const InlineAudioRecorder: React.FC<InlineAudioRecorderProps> = ({
    onRecordingComplete,
    onCancel,
    maxDurationSeconds = 300
}) => {
    const [isRecording, setIsRecording] = useState(true);
    const [duration, setDuration] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioLevels, setAudioLevels] = useState<number[]>(Array(24).fill(0.1));
    const [playbackProgress, setPlaybackProgress] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const cleanup = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl);
    }, [audioUrl]);

    // Real-time audio level visualization
    const updateAudioLevels = useCallback(() => {
        if (analyzerRef.current && isRecording) {
            const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
            analyzerRef.current.getByteFrequencyData(dataArray);

            // Sample 24 frequency bands for visualization
            const levels: number[] = [];
            const step = Math.floor(dataArray.length / 24);
            for (let i = 0; i < 24; i++) {
                const value = dataArray[i * step] / 255;
                // Add some smoothing and minimum height
                levels.push(Math.max(0.1, value * 0.9 + 0.1));
            }
            setAudioLevels(levels);

            animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
        }
    }, [isRecording]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });

            streamRef.current = stream;
            chunksRef.current = [];

            // Set up audio analyzer for real-time visualization
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyzerRef.current = audioContextRef.current.createAnalyser();
            analyzerRef.current.fftSize = 256;
            analyzerRef.current.smoothingTimeConstant = 0.7;
            source.connect(analyzerRef.current);

            // Start visualization
            updateAudioLevels();

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
                setRecordedBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);

            timerRef.current = setInterval(() => {
                setDuration(prev => {
                    const newDuration = prev + 1;
                    if (newDuration >= maxDurationSeconds) stopRecording();
                    return newDuration;
                });
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            onCancel();
        }
    }, [maxDurationSeconds, onCancel, updateAudioLevels]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [isRecording]);

    useEffect(() => {
        startRecording();
        return () => cleanup();
    }, []);

    const handleCancel = () => {
        cleanup();
        onCancel();
    };

    const handleSend = () => {
        if (recordedBlob) {
            onRecordingComplete(recordedBlob, duration);
        }
    };

    const togglePlayback = () => {
        if (audioRef.current && audioUrl) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current && duration > 0) {
            const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setPlaybackProgress(progress);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Recording state - Airbnb style inline
    if (isRecording) {
        return (
            <div className="flex-1 flex items-center gap-3 bg-gray-100 dark:bg-[#252525] rounded-full px-3 py-1.5 transition-all duration-300">
                {/* Cancel Button */}
                <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 -ml-1 rounded-full text-[#717171] hover:text-[#222] dark:hover:text-white hover:bg-white dark:hover:bg-[#333] transition-all duration-200"
                    aria-label="Cancel recording"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Recording Indicator & Duration */}
                <div className="flex items-center gap-2 min-w-[60px]">
                    <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-[#FF385C]" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#FF385C] animate-ping opacity-75" />
                    </div>
                    <span className="text-xs font-bold text-[#222] dark:text-white tabular-nums">
                        {formatDuration(duration)}
                    </span>
                </div>

                {/* Real-time Audio Waveform */}
                <div className="flex-1 flex items-center justify-center gap-[2px] h-8 px-2">
                    {audioLevels.map((level, i) => (
                        <div
                            key={i}
                            className="w-[3px] bg-[#222] dark:bg-white rounded-full transition-all duration-75"
                            style={{
                                height: `${Math.max(4, level * 24)}px`,
                                opacity: 0.3 + level * 0.7
                            }}
                        />
                    ))}
                </div>

                {/* Stop Button */}
                <button
                    type="button"
                    onClick={stopRecording}
                    className="p-2.5 rounded-full bg-[#222] dark:bg-white text-white dark:text-[#222] hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm"
                    aria-label="Stop recording"
                >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                </button>
            </div>
        );
    }

    // Recorded state - Preview before sending (Airbnb style)
    if (recordedBlob && audioUrl) {
        return (
            <div className="flex-1 flex items-center gap-3 bg-gray-100 dark:bg-[#252525] rounded-full px-3 py-1.5 transition-all duration-300">
                {/* Delete Button */}
                <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 -ml-1 rounded-full text-[#717171] hover:text-[#FF385C] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                    aria-label="Delete recording"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>

                {/* Play/Pause Button */}
                <button
                    type="button"
                    onClick={togglePlayback}
                    className="p-2 rounded-full bg-[#222] dark:bg-white text-white dark:text-[#222] hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                    ) : (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                {/* Playback Progress Bar */}
                <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#222] dark:bg-white rounded-full transition-all duration-100"
                            style={{ width: `${playbackProgress}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-[#222] dark:text-white tabular-nums min-w-[36px]">
                        {formatDuration(duration)}
                    </span>
                </div>

                {/* Send Button */}
                <button
                    type="button"
                    onClick={handleSend}
                    className="p-2.5 rounded-full bg-[#8AC43C] text-white hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm"
                    aria-label="Send voice message"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>

                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => {
                        setIsPlaying(false);
                        setPlaybackProgress(0);
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    className="hidden"
                />
            </div>
        );
    }

    return null;
};
