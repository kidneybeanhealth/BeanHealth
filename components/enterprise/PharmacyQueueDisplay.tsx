import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LogoIcon } from '../icons/LogoIcon';
import { toast } from 'react-hot-toast';
import { voiceService } from '../../services/VoiceAnnouncementService';

interface QueueItem {
    id: string;
    hospital_id: string;
    prescription_id: string;
    patient_name: string;
    token_number: string;
    status: 'waiting' | 'calling' | 'dispensed' | 'skipped';
    called_at: string | null;
    created_at: string;
}

const PharmacyQueueDisplay: React.FC = () => {
    const { profile } = useAuth();
    const [currentPatient, setCurrentPatient] = useState<QueueItem | null>(null);
    const [waitingQueue, setWaitingQueue] = useState<QueueItem[]>([]);
    const [hospitalName, setHospitalName] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [audioEnabled, setAudioEnabled] = useState(true);

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch hospital name
    useEffect(() => {
        const fetchHospitalName = async () => {
            if (!profile?.id) return;
            const { data } = await supabase
                .from('users')
                .select('name')
                .eq('id', profile.id)
                .single();
            const userData = data as { name: string } | null;
            if (userData?.name) {
                setHospitalName(userData.name);
            }
        };
        fetchHospitalName();
    }, [profile?.id]);

    // Fetch queue data
    const fetchQueue = useCallback(async () => {
        if (!profile?.id) return;

        try {
            const { data: callingData } = await supabase
                .from('hospital_pharmacy_queue')
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('status', 'calling')
                .order('called_at', { ascending: false })
                .limit(1);

            if (callingData && callingData.length > 0) {
                setCurrentPatient(callingData[0] as QueueItem);
            } else {
                setCurrentPatient(null);
            }

            const { data: waitingData } = await supabase
                .from('hospital_pharmacy_queue')
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(6);

            setWaitingQueue((waitingData || []) as QueueItem[]);
        } catch (error) {
            console.error('Error fetching queue:', error);
        }
    }, [profile?.id]);

    // Initial fetch and realtime subscription
    useEffect(() => {
        if (!profile?.id) return;

        fetchQueue();

        const channel = supabase
            .channel(`pharmacy-queue-display-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_pharmacy_queue',
                    filter: `hospital_id=eq.${profile.id}`
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE' && payload.new.status === 'calling') {
                        // Use voice service to announce the token with custom audio file
                        voiceService.announceTokenFormatted(payload.new.token_number);
                    }
                    fetchQueue();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, fetchQueue]);

    // Play beep sound twice using the announcement sound effect
    const playBeepSound = () => {
        try {
            // Import the audio file from project root
            const beepAudio = new Audio('/Announcement sound effect.mp3');
            beepAudio.volume = 1.0;

            // Play the sound
            beepAudio.play().catch(err => console.log('Audio playback failed:', err));

            // Play again after the first one ends
            beepAudio.onended = () => {
                const secondBeep = new Audio('/Announcement sound effect.mp3');
                secondBeep.volume = 1.0;
                secondBeep.play().catch(err => console.log('Second beep failed:', err));
            };
        } catch (e) {
            console.log('Beep sound not supported:', e);
        }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);



    const handleTestAudio = async () => {
        const initialized = await voiceService.initializeChannel();
        if (initialized) {
            toast.success("Testing Announcement (Token 1)", {
                icon: '🔊',
                duration: 3000
            });
            // Test with Token 1 to verify file playback
            voiceService.announceTokenFormatted('1');
        } else {
            toast.error("Audio initialization failed");
        }
    };

    return (
        <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-col overflow-hidden">


            {/* Header - White with shadow */}
            <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-100">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{hospitalName || 'Hospital'}</h1>
                            <p className="text-blue-600 text-sm font-semibold tracking-wide">PHARMACY QUEUE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-3xl font-mono font-bold text-gray-900">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-gray-500 text-sm">
                                {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleTestAudio}
                                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-blue-100"
                                title="Test Voice Announcement"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                                Test Sound
                            </button>
                            <button
                                onClick={toggleFullscreen}
                                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                            >
                                {isFullscreen ? (
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - Side by Side */}
            <main className="flex-1 flex gap-5 p-5 min-h-0">
                {/* LEFT: Now Serving - 60% */}
                <div className="w-3/5 flex flex-col">
                    <div className="text-center mb-4">
                        <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-emerald-200 rounded-xl shadow-sm">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-gray-700 text-base font-semibold">NOW SERVING / இப்போது</span>
                        </span>
                    </div>

                    {currentPatient ? (
                        <div
                            key={currentPatient.id}
                            className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-500"
                        >
                            {/* Animated top accent with pulse */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 animate-pulse"></div>

                            {/* Animated glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 animate-pulse"></div>

                            {/* Content */}
                            <div className="flex flex-col items-center justify-center w-full px-12 py-12 relative z-10">
                                {/* Token Label */}
                                <div className="mb-8 text-center animate-in slide-in-from-top-4 fade-in duration-700">
                                    <span className="text-gray-400 text-lg font-medium tracking-wider uppercase">Token Number</span>
                                    <div className="text-gray-400 text-sm mt-1">டோக்கன் எண்</div>
                                </div>

                                {/* Token Number - Clean & Large with attention-grabbing animation */}
                                <div className="mb-10 animate-in zoom-in-50 fade-in duration-700 delay-150">
                                    <p className="text-[12rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 tracking-tight drop-shadow-sm animate-pulse">
                                        {currentPatient.token_number.replace(/^[A-Za-z-]+/, '')}
                                    </p>
                                </div>

                                {/* Patient Name */}
                                <div className="w-full border-t border-gray-100 pt-8 space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300">
                                    <div className="bg-gray-50 rounded-xl px-8 py-4">
                                        <p className="text-4xl font-bold text-gray-900 uppercase tracking-wide text-center truncate">
                                            {currentPatient.patient_name}
                                        </p>
                                    </div>

                                    {/* Call to Action - Simple */}
                                    <div className="flex flex-col items-center gap-2 pt-2 animate-in slide-in-from-bottom-2 fade-in duration-700 delay-500">
                                        <div className="flex items-center gap-2 text-emerald-600">
                                            <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                            <p className="text-xl font-semibold">Please Proceed to Pharmacy</p>
                                        </div>
                                        <p className="text-lg font-medium text-emerald-700">தயவுசெய்து மருந்தகத்திற்கு செல்லவும்</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-200 flex flex-col items-center justify-center">
                            <div className="w-24 h-24 mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-3xl font-semibold text-gray-400">No Patient Being Served</p>
                            <p className="text-xl text-gray-400 mt-1">நோயாளி இல்லை</p>
                            <p className="text-gray-400 mt-4">Waiting for next patient...</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Queue - 40% */}
                <div className="w-2/5 flex flex-col min-h-0">
                    <div className="text-center mb-3">
                        <span className="text-gray-500 text-sm font-bold tracking-widest uppercase">
                            UP NEXT ({waitingQueue.length})
                        </span>
                    </div>

                    <div className="flex-1 bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col min-h-0">
                        {waitingQueue.length > 0 ? (
                            <div className="flex-1 overflow-auto">
                                {waitingQueue.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0 ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''
                                            }`}
                                    >
                                        {/* Position */}
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            {index + 1}
                                        </div>

                                        {/* Token */}
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl ${index === 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {item.token_number.replace(/^[A-Za-z-]+/, '')}
                                        </div>

                                        {/* Name */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold truncate ${index === 0 ? 'text-gray-900 text-lg' : 'text-gray-600'
                                                }`}>
                                                {item.patient_name}
                                            </p>
                                            {index === 0 && (
                                                <span className="text-yellow-600 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                                                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                                                    Preparing...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-gray-300 text-lg font-medium">Queue is empty</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>



            <footer className="flex-shrink-0 px-5 pb-4 relative">
                <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-2xl shadow-lg p-4">
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                            <LogoIcon className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-white font-bold text-lg">Powered by BeanHealth</p>
                            <p className="text-white/80 text-sm">Smart Healthcare Management</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PharmacyQueueDisplay;
