import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface QueueItem {
    id: string;
    hospital_id: string;
    prescription_id: string;
    patient_name: string;
    token_number: string;
    status: 'waiting' | 'calling' | 'dispensed';
    called_at: string | null;
    created_at: string;
}

const PharmacyQueueDisplay: React.FC = () => {
    const { profile } = useAuth();
    const [currentPatient, setCurrentPatient] = useState<QueueItem | null>(null);
    const [waitingQueue, setWaitingQueue] = useState<QueueItem[]>([]);
    const [hospitalName, setHospitalName] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Fetch hospital name
    useEffect(() => {
        const fetchHospitalName = async () => {
            if (!profile?.id) return;
            const { data } = await supabase
                .from('users')
                .select('name')
                .eq('id', profile.id)
                .single();
            if (data?.name) {
                setHospitalName(data.name);
            }
        };
        fetchHospitalName();
    }, [profile?.id]);

    // Fetch queue data
    const fetchQueue = useCallback(async () => {
        if (!profile?.id) return;

        try {
            // Fetch currently calling patient
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

            // Fetch waiting queue
            const { data: waitingData } = await supabase
                .from('hospital_pharmacy_queue')
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(5);

            setWaitingQueue((waitingData || []) as QueueItem[]);
        } catch (error) {
            console.error('Error fetching queue:', error);
        }
    }, [profile?.id]);

    // Initial fetch and realtime subscription
    useEffect(() => {
        if (!profile?.id) return;

        fetchQueue();

        // Setup realtime subscription
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
                    console.log('Queue update:', payload);
                    // Play notification sound when a new patient is called
                    if (payload.eventType === 'UPDATE' && payload.new.status === 'calling') {
                        playNotificationSound();
                    }
                    fetchQueue();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, fetchQueue]);

    // Play notification sound
    const playNotificationSound = () => {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800; // Hz
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 300);

            // Play a second beep
            setTimeout(() => {
                const audioContext2 = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator2 = audioContext2.createOscillator();
                const gainNode2 = audioContext2.createGain();

                oscillator2.connect(gainNode2);
                gainNode2.connect(audioContext2.destination);

                oscillator2.frequency.value = 1000;
                oscillator2.type = 'sine';
                gainNode2.gain.value = 0.3;

                oscillator2.start();
                setTimeout(() => {
                    oscillator2.stop();
                    audioContext2.close();
                }, 300);
            }, 400);
        } catch (e) {
            console.log('Audio not supported');
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

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex flex-col">
            {/* Header */}
            <header className="py-6 px-8 border-b border-white/10">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{hospitalName || 'Hospital'}</h1>
                            <p className="text-blue-200 text-sm">Pharmacy Queue</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-3xl font-mono font-bold">
                                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-blue-200 text-sm">
                                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                        <button
                            onClick={toggleFullscreen}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        >
                            {isFullscreen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-8">
                {/* Now Serving Section */}
                <div className="w-full max-w-4xl mb-12">
                    <div className="text-center mb-6">
                        <span className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-lg font-semibold animate-pulse">
                            <span className="w-3 h-3 bg-emerald-400 rounded-full animate-ping"></span>
                            NOW SERVING
                        </span>
                    </div>

                    {currentPatient ? (
                        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-sm border-2 border-emerald-400/50 rounded-3xl p-12 text-center shadow-2xl shadow-emerald-500/20">
                            <div className="mb-6">
                                <span className="text-emerald-300 text-2xl font-semibold tracking-widest">TOKEN</span>
                                <p className="text-8xl md:text-9xl font-black text-white mt-2 tracking-tight" style={{ textShadow: '0 0 40px rgba(16, 185, 129, 0.5)' }}>
                                    {currentPatient.token_number.replace(/^[A-Za-z-]+/, '')}
                                </p>
                            </div>
                            <div className="border-t border-emerald-400/30 pt-6 mt-6">
                                <p className="text-5xl md:text-6xl font-bold text-white uppercase tracking-wide">
                                    {currentPatient.patient_name}
                                </p>
                            </div>
                            <p className="text-emerald-200 text-xl mt-8 animate-pulse">
                                Please proceed to Pharmacy Counter
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12 text-center">
                            <div className="w-24 h-24 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-4xl font-bold text-white/50">No Patient Being Served</p>
                            <p className="text-blue-200/50 text-lg mt-3">Waiting for next patient...</p>
                        </div>
                    )}
                </div>

                {/* Next in Queue Section */}
                {waitingQueue.length > 0 && (
                    <div className="w-full max-w-4xl">
                        <div className="text-center mb-4">
                            <span className="text-blue-300 text-lg font-semibold tracking-widest uppercase">
                                Next in Queue
                            </span>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                            {waitingQueue.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`flex items-center justify-between px-8 py-5 ${index !== waitingQueue.length - 1 ? 'border-b border-white/10' : ''
                                        } ${index === 0 ? 'bg-blue-500/10' : ''}`}
                                >
                                    <div className="flex items-center gap-6">
                                        {/* Position Number */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 text-white/40'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        {/* Token */}
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl ${index === 0 ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/70'
                                            }`}>
                                            {item.token_number.replace(/^[A-Za-z-]+/, '')}
                                        </div>
                                        <span className={`text-2xl font-semibold ${index === 0 ? 'text-white' : 'text-white/70'}`}>
                                            {item.patient_name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {index === 0 ? (
                                            <span className="text-yellow-300 text-sm font-medium px-4 py-1.5 bg-yellow-500/20 rounded-full flex items-center gap-2">
                                                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                                                Preparing...
                                            </span>
                                        ) : (
                                            <span className="text-white/40 text-sm">
                                                #{index + 1} in queue
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state when no queue */}
                {!currentPatient && waitingQueue.length === 0 && (
                    <div className="text-center text-white/30 mt-8">
                        <p className="text-xl">Queue is empty</p>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="py-4 px-8 border-t border-white/10 text-center">
                <p className="text-blue-200/50 text-sm">
                    Powered by <span className="font-semibold text-blue-300">BeanHealth</span>
                </p>
            </footer>
        </div>
    );
};

export default PharmacyQueueDisplay;
