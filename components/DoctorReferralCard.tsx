import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitials } from '../utils/avatarUtils';

interface Patient {
    id: string;
    name: string;
    email: string;
}

interface DoctorReferralCardProps {
    doctorId: string;
}

const DoctorReferralCard: React.FC<DoctorReferralCardProps> = ({ doctorId }) => {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [doctorName, setDoctorName] = useState<string>('');
    const [specialty, setSpecialty] = useState<string>('');
    const [linkedPatientsCount, setLinkedPatientsCount] = useState(0);
    const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadDoctorData();
    }, [doctorId]);

    const loadDoctorData = async () => {
        setIsLoading(true);
        try {
            const { data: doctorData, error: doctorError } = await supabase
                .from('users')
                .select('name, specialty, referral_code')
                .eq('id', doctorId)
                .single() as { data: { name: string; specialty: string; referral_code: string } | null; error: any };

            if (doctorError) throw doctorError;
            if (!doctorData) throw new Error('Doctor not found');

            setDoctorName(doctorData.name || '');
            setSpecialty(doctorData.specialty || 'General Practice');
            setReferralCode(doctorData.referral_code || null);

            // Fetch patient relationships with patient data
            const { data: relationships, error: relError } = await supabase
                .from('patient_doctor_relationships')
                .select('patient_id, created_at')
                .eq('doctor_id', doctorId)
                .order('created_at', { ascending: false });

            if (!relError && relationships) {
                setLinkedPatientsCount(relationships.length);

                // Fetch the 3 most recent patients' details
                if (relationships.length > 0) {
                    const recentPatientIds = relationships.slice(0, 3).map((r: { patient_id: string }) => r.patient_id);
                    const { data: patientsData, error: patientsError } = await supabase
                        .from('users')
                        .select('id, name, email')
                        .in('id', recentPatientIds);

                    if (!patientsError && patientsData) {
                        setRecentPatients(patientsData as Patient[]);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading doctor data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (referralCode) {
            try {
                await navigator.clipboard.writeText(referralCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                const textArea = document.createElement('textarea');
                textArea.value = referralCode;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        }
    };

    const handleShareCode = async () => {
        if (referralCode && navigator.share) {
            try {
                await navigator.share({
                    title: 'Doctor Referral Code',
                    text: `Connect with Dr. ${doctorName} on BeanHealth CKD!\n\nReferral Code: ${referralCode}\n\nUse this code when setting up your patient profile to link with your doctor.`
                });
            } catch (error) {
                console.error('Share failed:', error);
            }
        } else {
            handleCopyCode();
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse h-[400px]">
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mb-8"></div>
                <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded mb-8"></div>
                <div className="space-y-4">
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded"></div>
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (!referralCode) {
        return (
            <div className="bg-white dark:bg-[#1e1e1e] p-8 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)]">
                <h3 className="text-xl font-bold text-[#222222] dark:text-white mb-4">Referral Code</h3>
                <div className="p-4 bg-gray-50 dark:bg-[#2c2c2c] rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-[#717171] dark:text-[#a0a0a0]">
                        Code not available. Please verify your profile update.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#1e1e1e] p-7 md:p-8 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 transition-all duration-500 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h3 className="text-xl font-extrabold text-[#222222] dark:text-white tracking-tight">Refer Patients</h3>
                    <p className="text-xs font-bold text-[#8AC43C] uppercase tracking-widest mt-1">
                        {specialty}
                    </p>
                </div>
                <div className="flex -space-x-1.5 p-1 bg-gray-50 dark:bg-white/5 rounded-full">
                    {recentPatients.length > 0 ? (
                        recentPatients.slice(0, 3).map((patient) => (
                            <div
                                key={patient.id}
                                className="h-7 w-7 rounded-full bg-[#222222] dark:bg-white flex items-center justify-center text-white dark:text-[#222222] text-[10px] font-bold border-2 border-white dark:border-[#1e1e1e] shadow-sm transform transition-transform hover:scale-110 hover:z-10 cursor-pointer"
                                title={patient.name || patient.email}
                            >
                                {getInitials(patient.name || '', patient.email)}
                            </div>
                        ))
                    ) : (
                        <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-[#1e1e1e]"></div>
                    )}
                </div>
            </div>

            {/* Referral Code Display - Modern Integrated Look */}
            <div className="relative group mb-8">
                <div
                    onClick={handleCopyCode}
                    className="w-full bg-[#F9F9F9] dark:bg-white/5 rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-500 group-hover:bg-[#8AC43C]/5 group-hover:scale-[1.02] cursor-pointer"
                >
                    <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-[0.3em] mb-3 opacity-50">Unique Code</p>
                    <p className="text-2xl font-mono font-black text-[#222222] dark:text-white tracking-[0.15em] selection:bg-[#8AC43C] selection:text-white transition-colors group-hover:text-[#8AC43C]">
                        {referralCode}
                    </p>
                </div>

                {/* Floating Action Hint */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <span className="flex items-center gap-1.5 px-4 py-1.5 bg-[#222222] dark:bg-white shadow-xl rounded-full text-[10px] font-bold text-white dark:text-[#222222] uppercase tracking-wider">
                        {copied ? 'Copied' : 'Click to copy'}
                    </span>
                </div>
            </div>

            {/* Actions & Sharing */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleShareCode}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-6 bg-[#8AC43C] hover:bg-[#7ab332] text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-[#8AC43C]/20 transform active:scale-95 group"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Send to Patient
                </button>
            </div>

            {/* Minimal Footer Info */}
            <div className="mt-8 flex items-center gap-4 text-center">
                <div className="flex-1 h-[1px] bg-gray-100 dark:bg-white/5"></div>
                <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-widest whitespace-nowrap">
                    {linkedPatientsCount} Total Patients
                </p>
                <div className="flex-1 h-[1px] bg-gray-100 dark:bg-white/5"></div>
            </div>

            <p className="mt-6 text-[10px] font-medium text-[#717171] dark:text-[#a0a0a0] text-center leading-relaxed max-w-[180px] mx-auto opacity-70">
                Patient signs up using this code to link their account
            </p>
        </div>
    );
};

export default DoctorReferralCard;

