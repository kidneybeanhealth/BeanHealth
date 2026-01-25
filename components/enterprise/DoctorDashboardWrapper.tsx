import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import EnterpriseDoctorDashboard from '../EnterpriseDoctorDashboard';

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
    const [loading, setLoading] = useState(true);

    const getSessionKey = () => `enterprise_doctor_session_${profile?.id}`;

    useEffect(() => {
        fetchDoctor();
    }, [doctorId, profile?.id]);

    const fetchDoctor = async () => {
        if (!doctorId || !profile?.id) return;
        
        try {
            const { data, error } = await supabase
                .from('hospital_doctors')
                .select('*')
                .eq('id', doctorId)
                .eq('hospital_id', profile.id)
                .single();

            if (error) throw error;
            setDoctor(data);
        } catch (error) {
            console.error('Error fetching doctor:', error);
            navigate('/enterprise-dashboard/doctors');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        // Clear doctor session
        const sessionKey = getSessionKey();
        sessionStorage.removeItem(sessionKey);
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
        />
    );
};

export default DoctorDashboardWrapper;
