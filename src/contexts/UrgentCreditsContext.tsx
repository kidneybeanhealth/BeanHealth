import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UrgentCreditsContextType {
    credits: number;
    refreshCredits: () => Promise<void>;
    useCredit: () => Promise<boolean>;
    isLoading: boolean;
}

const UrgentCreditsContext = createContext<UrgentCreditsContextType>({
    credits: 0,
    refreshCredits: async () => { },
    useCredit: async () => false,
    isLoading: true,
});

export const useUrgentCredits = () => {
    return useContext(UrgentCreditsContext);
};

interface UrgentCreditsProviderProps {
    userId: string;
    initialCredits?: number;
    children: React.ReactNode;
}

export const UrgentCreditsProvider: React.FC<UrgentCreditsProviderProps> = ({
    userId,
    initialCredits = 5,
    children
}) => {
    const [credits, setCredits] = useState(initialCredits);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch credits from database
    const refreshCredits = useCallback(async () => {
        if (!userId) return;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('urgent_credits')
                .eq('id', userId)
                .single() as { data: { urgent_credits: number } | null; error: any };

            if (!error && data) {
                setCredits(data.urgent_credits ?? 0);
                console.log('[UrgentCredits] Refreshed credits:', data.urgent_credits);
            }
        } catch (error) {
            console.error('[UrgentCredits] Error fetching credits:', error);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Deduct one credit (for optimistic UI update)
    const useCredit = useCallback(async () => {
        if (credits <= 0) return false;

        // Optimistic update
        setCredits(prev => Math.max(0, prev - 1));

        // The actual deduction happens in ChatService.sendMessage
        // We just update the UI here
        return true;
    }, [credits]);

    // Initial load
    useEffect(() => {
        if (userId) {
            refreshCredits();
        }
    }, [userId, refreshCredits]);

    // Subscribe to real-time updates on the user's credits
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`urgent_credits_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${userId}`
                },
                (payload) => {
                    const newCredits = (payload.new as any)?.urgent_credits;
                    if (typeof newCredits === 'number') {
                        console.log('[UrgentCredits] Real-time update:', newCredits);
                        setCredits(newCredits);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return (
        <UrgentCreditsContext.Provider
            value={{
                credits,
                refreshCredits,
                useCredit,
                isLoading,
            }}
        >
            {children}
        </UrgentCreditsContext.Provider>
    );
};
