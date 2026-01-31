import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const [isInitialized, setIsInitialized] = useState(false);
    const lastCalledTokenRef = useRef<string | null>(null);

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch hospital name
    useEffect(() => {
        if (!profile?.id) return;
        (async () => {
            const { data } = await supabase
                .from('users')
                .select('name')
                .eq('id', profile.id)
                .single();
            const userData = data as { name: string } | null;
            if (userData?.name) setHospitalName(userData.name);
        })();
    }, [profile?.id]);

    // Main fetch function
    const fetchQueue = useCallback(async () => {
        if (!profile?.id) {
            console.log('[QueueDisplay] No profile.id, skipping fetch');
            return;
        }

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch currently calling patient
            const { data: callingData, error: callingError } = await (supabase
                .from('hospital_pharmacy_queue' as any) as any)
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('status', 'calling')
                .gte('created_at', today.toISOString())
                .order('called_at', { ascending: false })
                .limit(1);

            if (callingError) {
                console.error('[QueueDisplay] Error fetching calling:', callingError);
            }

            const newCalling = callingData && callingData.length > 0 ? callingData[0] as QueueItem : null;

            // Announce if new patient is being called
            if (newCalling && newCalling.token_number !== lastCalledTokenRef.current) {
                console.log('[QueueDisplay] New patient calling:', newCalling.token_number);
                lastCalledTokenRef.current = newCalling.token_number;
                voiceService.announceTokenFormatted(newCalling.token_number);
            }

            setCurrentPatient(newCalling);

            // Fetch waiting queue
            const { data: waitingData, error: waitingError } = await (supabase
                .from('hospital_pharmacy_queue' as any) as any)
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('status', 'waiting')
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: true })
                .limit(10);

            if (waitingError) {
                console.error('[QueueDisplay] Error fetching waiting:', waitingError);
            }

            console.log('[QueueDisplay] Fetched:', { calling: newCalling?.token_number || 'none', waiting: waitingData?.length || 0 });
            setWaitingQueue((waitingData || []) as QueueItem[]);
        } catch (error) {
            console.error('[QueueDisplay] Fetch error:', error);
        }
    }, [profile?.id]);

    // Main polling effect - runs every 5 seconds
    useEffect(() => {
        if (!profile?.id || !isInitialized) return;

        console.log('[QueueDisplay] Starting polling for hospital:', profile.id);
        fetchQueue(); // Initial fetch

        const pollInterval = setInterval(() => {
            fetchQueue();
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [profile?.id, isInitialized, fetchQueue]);

    // Fullscreen handlers
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
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleTestAudio = async () => {
        const initialized = await voiceService.initializeChannel();
        if (initialized) {
            toast.success("Testing Announcement (Token 1)", { icon: '🔊', duration: 3000 });
            voiceService.announceTokenFormatted('1');
        } else {
            toast.error("Audio initialization failed");
        }
    };

    const handleInitialize = async () => {
        const success = await voiceService.initializeChannel();
        setIsInitialized(true);
        if (success) {
            toast.success('Display Started & Audio Enabled');
        } else {
            toast.error('Audio setup failed (Check browser permissions)');
        }
    };

    // Initialization screen
    if (!isInitialized) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-blue-600 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pharmacy Display</h1>
                        <p className="text-gray-500 text-sm">Click start to enable audio announcements.</p>
                    </div>
                    <button
                        onClick={handleInitialize}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95"
                    >
                        Start Display
                    </button>
                    <p className="text-xs text-gray-400">Powered by BeanHealth</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-col overflow-hidden">
            {/* Header */}
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
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                                Test
                            </button>
                            <button
                                onClick={toggleFullscreen}
                                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex gap-5 p-5 min-h-0">
                {/* NOW SERVING - Left 60% */}
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
                        <div className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 animate-pulse"></div>
                            <div className="flex flex-col items-center justify-center w-full px-12 py-12">
                                <div className="mb-8 text-center">
                                    <span className="text-gray-400 text-lg font-medium tracking-wider uppercase">Token Number</span>
                                    <div className="text-gray-400 text-sm mt-1">டோக்கன் எண்</div>
                                </div>
                                <div className="mb-10">
                                    <p className="text-[12rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 tracking-tight animate-pulse">
                                        {currentPatient.token_number.replace(/^[A-Za-z-]+/, '')}
                                    </p>
                                </div>
                                <div className="w-full border-t border-gray-100 pt-8 space-y-6">
                                    <div className="bg-gray-50 rounded-xl px-8 py-4">
                                        <p className="text-4xl font-bold text-gray-900 uppercase tracking-wide text-center truncate">
                                            {currentPatient.patient_name}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 pt-2">
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

                {/* UP NEXT - Right 40% */}
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
                                        className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0 ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''}`}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>
                                            {index + 1}
                                        </div>
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl ${index === 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-100 text-gray-600'}`}>
                                            {item.token_number.replace(/^[A-Za-z-]+/, '')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold truncate ${index === 0 ? 'text-gray-900 text-lg' : 'text-gray-600'}`}>
                                                {item.patient_name}
                                            </p>
                                            {index === 0 && (
                                                <span className="text-yellow-600 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                                                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                                                    Next in line
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

            {/* Footer */}
            <footer className="flex-shrink-0 px-5 pb-4">
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
