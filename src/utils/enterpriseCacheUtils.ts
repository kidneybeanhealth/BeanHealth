/**
 * Enterprise Cache Utilities
 * 
 * Production-ready utilities for managing enterprise portal cache and sessions.
 * Helps prevent login issues caused by stale cached data.
 */

/**
 * Session storage keys used by the enterprise portal
 */
export const ENTERPRISE_SESSION_KEYS = {
    RECEPTION: 'enterprise_reception_authenticated',
    PHARMACY: 'enterprise_pharmacy_authenticated',
    DOCTOR_SESSION_PREFIX: 'enterprise_doctor_session_',
    TAB_ID: 'beanhealth_tab_id',
    TRIAL_VERIFIED: 'beanhealth_trial_verified',
    AUTH_VIEW: 'authView',
} as const;

/**
 * Clear all enterprise department sessions
 * Use this when logging out or before a fresh login
 */
export function clearEnterpriseSessions(): void {
    try {
        // Clear known keys
        sessionStorage.removeItem(ENTERPRISE_SESSION_KEYS.RECEPTION);
        sessionStorage.removeItem(ENTERPRISE_SESSION_KEYS.PHARMACY);
        sessionStorage.removeItem(ENTERPRISE_SESSION_KEYS.AUTH_VIEW);

        // Clear all doctor sessions (dynamic keys)
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(ENTERPRISE_SESSION_KEYS.DOCTOR_SESSION_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        console.log('[EnterpriseCacheUtils] Cleared enterprise sessions');
    } catch (error) {
        console.warn('[EnterpriseCacheUtils] Failed to clear sessions:', error);
    }
}

/**
 * Clear all auth-related cache including Supabase tokens
 * Use this for complete logout or to fix corrupted auth state
 */
export function clearAllAuthCache(): void {
    try {
        // Clear Supabase auth token
        localStorage.removeItem('supabase.auth.token');

        // Clear all enterprise sessions
        clearEnterpriseSessions();

        // Clear trial verification
        sessionStorage.removeItem(ENTERPRISE_SESSION_KEYS.TRIAL_VERIFIED);

        console.log('[EnterpriseCacheUtils] Cleared all auth cache');
    } catch (error) {
        console.warn('[EnterpriseCacheUtils] Failed to clear auth cache:', error);
    }
}

/**
 * Check if there are stale enterprise sessions
 * Returns true if sessions exist but may be outdated
 */
export function hasStaleEnterpriseSessions(): boolean {
    try {
        const hasReception = sessionStorage.getItem(ENTERPRISE_SESSION_KEYS.RECEPTION) === 'true';
        const hasPharmacy = sessionStorage.getItem(ENTERPRISE_SESSION_KEYS.PHARMACY) === 'true';

        // Check for doctor sessions
        let hasDoctorSession = false;
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(ENTERPRISE_SESSION_KEYS.DOCTOR_SESSION_PREFIX)) {
                hasDoctorSession = true;
                break;
            }
        }

        return hasReception || hasPharmacy || hasDoctorSession;
    } catch (error) {
        return false;
    }
}

/**
 * Get active doctor session if exists
 * Returns the doctor ID if there's a valid session, null otherwise
 */
export function getActiveDoctorSession(hospitalId: string): { doctorId: string; timestamp: number } | null {
    try {
        const sessionKey = `${ENTERPRISE_SESSION_KEYS.DOCTOR_SESSION_PREFIX}${hospitalId}`;
        const savedSession = sessionStorage.getItem(sessionKey);

        if (!savedSession) return null;

        const session = JSON.parse(savedSession);
        const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours

        if (Date.now() - session.timestamp < SESSION_TIMEOUT) {
            return session;
        } else {
            // Session expired, clean it up
            sessionStorage.removeItem(sessionKey);
            return null;
        }
    } catch (error) {
        return null;
    }
}

/**
 * Validate session storage is accessible
 * Some browsers in private mode may block storage access
 */
export function isSessionStorageAvailable(): boolean {
    try {
        const testKey = '__bh_test__';
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn('[EnterpriseCacheUtils] Session storage not available');
        return false;
    }
}
