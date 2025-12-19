import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ChatService } from '../services/chatService';
import { ChatMessage } from '../types';
import toast from 'react-hot-toast';

interface NotificationContextType {
    unreadMessageCount: number;
    hasUrgentMessages: boolean;
    lastMessage: ChatMessage | null;
    isConnected: boolean;
    refreshUnreadCount: () => Promise<void>;
    markAsViewed: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadMessageCount: 0,
    hasUrgentMessages: false,
    lastMessage: null,
    isConnected: false,
    refreshUnreadCount: async () => { },
    markAsViewed: () => { },
});

export const useNotifications = () => {
    return useContext(NotificationContext);
};

interface NotificationProviderProps {
    userId: string;
    children: React.ReactNode;
    activeView?: string;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
    userId,
    children,
    activeView
}) => {
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [hasUrgentMessages, setHasUrgentMessages] = useState(false);
    const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const subscriptionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Create notification sound using Web Audio API
    const playNotificationSound = useCallback((isUrgent: boolean = false) => {
        try {
            // Create audio context if needed
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (isUrgent) {
                // Urgent: Two-tone alert
                oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
                oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1); // E5
                oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.3);
            } else {
                // Regular: Soft pleasant tone
                oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                oscillator.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.15);
            }
        } catch (e) {
            // Audio not supported or blocked
            console.log('[Notifications] Audio not available');
        }
    }, []);

    // Show minimal Airbnb-style toast notification
    const showMessageNotification = useCallback((message: ChatMessage, senderName?: string) => {
        const displayName = senderName || 'Someone';
        const isUrgent = message.isUrgent;

        // Don't show notification if already in messages view
        if (activeView === 'messages') {
            return;
        }

        // Play sound
        playNotificationSound(isUrgent);

        if (isUrgent) {
            // Urgent message - Minimal alert style
            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-in slide-in-from-top-2 fade-in duration-200' : 'animate-out slide-out-to-right-2 fade-out duration-150'
                        } max-w-[340px] w-full pointer-events-auto`}
                >
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3 p-3">
                            {/* Red dot indicator */}
                            <div className="flex-shrink-0">
                                <div className="relative">
                                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                    <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[#222] dark:text-white">
                                    <span className="font-semibold">{displayName}</span>
                                    <span className="text-[#717171] dark:text-gray-400"> · Urgent</span>
                                </p>
                                <p className="text-[12px] text-[#717171] dark:text-gray-500 truncate mt-0.5">
                                    {message.text || 'Voice message'}
                                </p>
                            </div>

                            {/* Dismiss */}
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="h-4 w-4 text-[#717171]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            ), {
                duration: 6000,
                position: 'top-right',
            });

            setHasUrgentMessages(true);
        } else {
            // Regular message - Clean minimal notification
            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-in slide-in-from-top-2 fade-in duration-200' : 'animate-out slide-out-to-right-2 fade-out duration-150'
                        } max-w-[340px] w-full pointer-events-auto`}
                >
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3 p-3">
                            {/* Green dot indicator */}
                            <div className="flex-shrink-0">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#8AC43C]" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[#222] dark:text-white">
                                    <span className="font-semibold">{displayName}</span>
                                    <span className="text-[#717171] dark:text-gray-400"> messaged you</span>
                                </p>
                                <p className="text-[12px] text-[#717171] dark:text-gray-500 truncate mt-0.5">
                                    {message.text || 'Voice message'}
                                </p>
                            </div>

                            {/* Dismiss */}
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="h-4 w-4 text-[#717171]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            ), {
                duration: 4000,
                position: 'top-right',
            });
        }
    }, [activeView, playNotificationSound]);

    // Fetch unread count
    const refreshUnreadCount = useCallback(async () => {
        if (!userId) return;
        try {
            const count = await ChatService.getUnreadMessageCount(userId);
            setUnreadMessageCount(count);
            console.log('[Notifications] Refreshed unread count:', count);
        } catch (error) {
            console.error('[Notifications] Error fetching unread count:', error);
        }
    }, [userId]);

    // Mark notifications as viewed
    const markAsViewed = useCallback(() => {
        setHasUrgentMessages(false);
        setLastMessage(null);
    }, []);

    // Subscribe to real-time messages
    useEffect(() => {
        if (!userId) return;

        console.log('[Notifications] Setting up subscription for user:', userId);

        // Initial load
        refreshUnreadCount();

        const setupSubscription = () => {
            if (subscriptionRef.current) {
                try {
                    subscriptionRef.current.unsubscribe();
                } catch (e) {
                    console.warn('[Notifications] Error unsubscribing:', e);
                }
            }

            try {
                subscriptionRef.current = ChatService.subscribeToMessages(userId, async (newMessage) => {
                    // Only notify for incoming messages
                    if (newMessage.senderId !== userId) {
                        console.log('[Notifications] New incoming message:', newMessage.id);

                        setLastMessage(newMessage);
                        setUnreadMessageCount(prev => prev + 1);

                        if (newMessage.isUrgent) {
                            setHasUrgentMessages(true);
                        }

                        // Get sender name for notification
                        try {
                            const { data: sender } = await (await import('../lib/supabase')).supabase
                                .from('users')
                                .select('name')
                                .eq('id', newMessage.senderId)
                                .single() as { data: { name: string } | null };

                            const senderName = sender?.name;
                            showMessageNotification(newMessage, senderName);
                        } catch {
                            showMessageNotification(newMessage);
                        }
                    }
                });

                setIsConnected(true);
                console.log('[Notifications] Subscription established');
            } catch (error) {
                console.error('[Notifications] Subscription error:', error);
                setIsConnected(false);
                setTimeout(setupSubscription, 5000);
            }
        };

        setupSubscription();

        // Refresh count periodically
        const refreshInterval = setInterval(refreshUnreadCount, 30000);

        return () => {
            clearInterval(refreshInterval);
            if (subscriptionRef.current) {
                try {
                    subscriptionRef.current.unsubscribe();
                } catch (e) {
                    console.warn('[Notifications] Cleanup error:', e);
                }
            }
        };
    }, [userId, refreshUnreadCount, showMessageNotification]);

    // Reset urgent flag when entering messages
    useEffect(() => {
        if (activeView === 'messages') {
            setHasUrgentMessages(false);
            refreshUnreadCount();
        }
    }, [activeView, refreshUnreadCount]);

    return (
        <NotificationContext.Provider
            value={{
                unreadMessageCount,
                hasUrgentMessages,
                lastMessage,
                isConnected,
                refreshUnreadCount,
                markAsViewed,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};
