import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    getLegacyDoctorSessionKey,
    loadDoctorActorSession,
    saveDoctorActorSession,
    clearDoctorActorSession,
} from '../../utils/doctorActorSession';

interface DoctorProtectedRouteProps {
    children: React.ReactNode;
}

// Session timeout: 4 hours
const DOCTOR_SESSION_TIMEOUT = 4 * 60 * 60 * 1000;

const DoctorProtectedRoute: React.FC<DoctorProtectedRouteProps> = ({ children }) => {
    const { doctorId } = useParams<{ doctorId: string }>();
    const { profile, loading, isInitialized } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

    useEffect(() => {
        if (!isInitialized || loading || !profile?.id || !doctorId) return;

        let cancelled = false;
        setIsReady(false);
        setIsValidSession(null);

        const validate = async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));

            let paAuthEnabled = false;
            try {
                const { data } = await (supabase
                    .from('hospital_profiles' as any)
                    .select('enable_pa_actor_auth')
                    .eq('id', profile.id)
                    .maybeSingle() as any);
                paAuthEnabled = Boolean(data?.enable_pa_actor_auth);
            } catch (_e) {
                paAuthEnabled = false;
            }

            if (paAuthEnabled) {
                const actorSession = loadDoctorActorSession(profile.id, doctorId);
                if (!actorSession) {
                    if (!cancelled) {
                        setIsValidSession(false);
                        setIsReady(true);
                    }
                    return;
                }

                const { data, error } = await (supabase as any).rpc('doctor_actor_validate', {
                    p_hospital_id: profile.id,
                    p_chief_doctor_id: doctorId,
                    p_session_token: actorSession.sessionToken,
                });
                const validated = Array.isArray(data) ? data[0] : null;

                if (error || !validated?.session_id) {
                    clearDoctorActorSession(profile.id, doctorId);
                    if (!cancelled) {
                        setIsValidSession(false);
                        setIsReady(true);
                    }
                    return;
                }

                saveDoctorActorSession({
                    ...actorSession,
                    actorType: validated.actor_type,
                    assistantId: validated.assistant_id || null,
                    actorDisplayName: validated.actor_display_name,
                    sessionId: validated.session_id,
                    expiresAt: validated.expires_at,
                    canManageTeam: Boolean(validated.can_manage_team),
                });

                // Keep legacy key alive for compatibility with existing dashboard/session logic.
                const legacyKey = getLegacyDoctorSessionKey(profile.id);
                sessionStorage.setItem(legacyKey, JSON.stringify({
                    doctorId,
                    timestamp: Date.now(),
                }));

                if (!cancelled) {
                    setIsValidSession(true);
                    setIsReady(true);
                }
                return;
            }

            // Legacy doctor-only passcode flow
            const sessionKey = getLegacyDoctorSessionKey(profile.id);
            const savedSession = sessionStorage.getItem(sessionKey);

            if (!savedSession) {
                if (!cancelled) {
                    setIsValidSession(false);
                    setIsReady(true);
                }
                return;
            }

            try {
                const { doctorId: savedDoctorId, timestamp } = JSON.parse(savedSession);
                const isValid = savedDoctorId === doctorId &&
                    (Date.now() - timestamp) < DOCTOR_SESSION_TIMEOUT;

                if (!isValid) {
                    sessionStorage.removeItem(sessionKey);
                }

                if (!cancelled) {
                    setIsValidSession(isValid);
                    setIsReady(true);
                }
            } catch (_e) {
                sessionStorage.removeItem(sessionKey);
                if (!cancelled) {
                    setIsValidSession(false);
                    setIsReady(true);
                }
            }
        };

        validate();

        return () => {
            cancelled = true;
        };
    }, [isInitialized, loading, profile?.id, doctorId]);

    if (!isReady || loading || !isInitialized || isValidSession === null) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                    <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">Loading doctor dashboard...</p>
                </div>
            </div>
        );
    }

    if (profile?.role !== 'enterprise') {
        return <Navigate to="/" replace />;
    }

    if (!doctorId) {
        return <Navigate to="/enterprise-dashboard/doctors" replace />;
    }

    if (!isValidSession) {
        return <Navigate to={`/enterprise-dashboard/doctors/${doctorId}`} replace />;
    }

    return <>{children}</>;
};

export default DoctorProtectedRoute;
