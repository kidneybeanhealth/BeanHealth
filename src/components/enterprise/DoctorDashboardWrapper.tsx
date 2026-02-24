import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import EnterpriseDoctorDashboard from '../EnterpriseDoctorDashboard';
import {
    getLegacyDoctorSessionKey,
    loadDoctorActorSession,
    saveDoctorActorSession,
    clearDoctorActorSession,
    type DoctorActorSession,
} from '../../utils/doctorActorSession';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
}

const DoctorDashboardWrapper: React.FC = () => {
    const navigate = useNavigate();
    const { doctorId } = useParams<{ doctorId: string }>();
    const { profile } = useAuth();
    const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
    const [actorSession, setActorSession] = useState<DoctorActorSession | null>(null);
    const [paActorAuthEnabled, setPaActorAuthEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    const getLegacySessionKey = () => getLegacyDoctorSessionKey(profile?.id || '');

    useEffect(() => {
        fetchDoctor();
    }, [doctorId, profile?.id]);

    const fetchDoctor = async () => {
        if (!doctorId || !profile?.id) return;

        try {
            const [doctorResult, featureResult] = await Promise.all([
                supabase
                    .from('hospital_doctors')
                    .select('*')
                    .eq('id', doctorId)
                    .eq('hospital_id', profile.id)
                    .single(),
                (supabase
                    .from('hospital_profiles' as any)
                    .select('enable_pa_actor_auth')
                    .eq('id', profile.id)
                    .maybeSingle() as any),
            ]);

            const { data, error } = doctorResult;

            if (error) throw error;
            setDoctor(data);

            const featureEnabled = Boolean(featureResult?.data?.enable_pa_actor_auth);
            setPaActorAuthEnabled(featureEnabled);

            if (featureEnabled) {
                const storedActorSession = loadDoctorActorSession(profile.id, doctorId);
                if (!storedActorSession) {
                    setActorSession(null);
                } else {
                    const { data: validatedRows, error: validateError } = await (supabase as any).rpc('doctor_actor_validate', {
                        p_hospital_id: profile.id,
                        p_chief_doctor_id: doctorId,
                        p_session_token: storedActorSession.sessionToken,
                    });
                    const validated = Array.isArray(validatedRows) ? validatedRows[0] : null;

                    if (validateError || !validated?.session_id) {
                        clearDoctorActorSession(profile.id, doctorId);
                        setActorSession(null);
                    } else {
                        const nextActorSession: DoctorActorSession = {
                            ...storedActorSession,
                            actorType: validated.actor_type,
                            assistantId: validated.assistant_id || null,
                            actorDisplayName: validated.actor_display_name,
                            sessionId: validated.session_id,
                            expiresAt: validated.expires_at,
                            canManageTeam: Boolean(validated.can_manage_team),
                        };
                        saveDoctorActorSession(nextActorSession);
                        setActorSession(nextActorSession);
                    }
                }
            } else {
                setActorSession(null);
            }
        } catch (error) {
            console.error('Error fetching doctor:', error);
            navigate('/enterprise-dashboard/doctors');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        console.log('[DoctorDashboardWrapper] handleBack triggered');

        if (profile?.id && doctorId && paActorAuthEnabled && actorSession?.sessionToken) {
            console.log('[DoctorDashboardWrapper] Revoking actor session...');
            (supabase as any)
                .rpc('doctor_actor_logout', {
                    p_hospital_id: profile.id,
                    p_chief_doctor_id: doctorId,
                    p_session_token: actorSession.sessionToken,
                })
                .then(() => {
                    console.log('[DoctorDashboardWrapper] actor_logout successful');
                })
                .catch((error: any) => {
                    console.warn('[DoctorDashboardWrapper] doctor_actor_logout failed:', error);
                });
        }

        if (profile?.id && doctorId) {
            console.log('[DoctorDashboardWrapper] Clearing local actor session');
            clearDoctorActorSession(profile.id, doctorId);
        }

        const sessionKey = getLegacySessionKey();
        sessionStorage.removeItem(sessionKey);
        console.log('[DoctorDashboardWrapper] Navigating back to doctor list');
        navigate('/enterprise-dashboard/doctors');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!doctor) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-800 font-medium mb-4">Doctor not found</p>
                    <button
                        onClick={() => navigate('/enterprise-dashboard/doctors')}
                        className="text-primary-600 font-semibold hover:underline"
                    >
                        Back to Doctors
                    </button>
                </div>
            </div>
        );
    }

    return (
        <EnterpriseDoctorDashboard
            doctor={doctor}
            onBack={handleBack}
            actorSession={actorSession}
            paActorAuthEnabled={paActorAuthEnabled}
        />
    );
};

export default DoctorDashboardWrapper;
