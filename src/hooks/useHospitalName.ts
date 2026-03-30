import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useHospitalName = (fallback: string = 'Hospital Registry') => {
    const { profile, loading: authLoading } = useAuth();

    // Initialize from local storage to prevent flash of default content
    const [cachedName, setCachedName] = useState(() => {
        try {
            return localStorage.getItem('hospital_name_cache') || '';
        } catch (e) {
            return '';
        }
    });

    useEffect(() => {
        if (profile?.name) {
            setCachedName(profile.name);
            try {
                localStorage.setItem('hospital_name_cache', profile.name);
            } catch (e) {
                // Ignore storage errors
            }
        }
    }, [profile?.name]);

    // Return the best available name
    // Priority: 1. Profile Name (Live) -> 2. Cached Name (Storage) -> 3. Fallback (Default)
    const displayName = profile?.name || cachedName || fallback;

    // Return loading state if we have absolutely no name yet
    const isLoading = authLoading && !displayName;

    return { displayName, isLoading };
};
