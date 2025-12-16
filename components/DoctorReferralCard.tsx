import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface DoctorReferralCardProps {
    doctorId: string;
}

const DoctorReferralCard: React.FC<DoctorReferralCardProps> = ({ doctorId }) => {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [doctorName, setDoctorName] = useState<string>('');
    const [specialty, setSpecialty] = useState<string>('');
    const [linkedPatientsCount, setLinkedPatientsCount] = useState(0);
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
                .single();

            if (doctorError) throw doctorError;

            setDoctorName(doctorData?.name || '');
            setSpecialty(doctorData?.specialty || 'General Practice');
            setReferralCode(doctorData?.referral_code || null);

            const { count, error: countError } = await supabase
                .from('patient_doctor_relationships')
                .select('id', { count: 'exact', head: true })
                .eq('doctor_id', doctorId);

            if (!countError) {
                setLinkedPatientsCount(count || 0);
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
        <div className="bg-white dark:bg-[#1e1e1e] p-6 md:p-8 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-extrabold text-[#222222] dark:text-white">Refer Patients</h3>
                    <p className="text-sm font-medium text-[#717171] dark:text-[#a0a0a0] mt-1">
                        Share your unique code
                    </p>
                </div>
                <span className="px-3 py-1 bg-[#F7F7F7] dark:bg-[#2c2c2c] text-[#222222] dark:text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-100 dark:border-gray-700">
                    {specialty}
                </span>
            </div>

            {/* Referral Code Display */}
            <div className="bg-[#F7F7F7] dark:bg-[#2c2c2c] p-6 rounded-xl mb-6 flex flex-col items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 relative group cursor-pointer" onClick={handleCopyCode}>
                <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-[0.2em] mb-2">CODE</p>
                <p className="text-3xl font-mono font-bold text-[#222222] dark:text-white tracking-widest selection:bg-[#FF385C] selection:text-white">
                    {referralCode}
                </p>
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-xs font-bold text-[#222222] dark:text-white">Click to copy</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    onClick={handleCopyCode}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all border ${copied
                        ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                        : 'bg-white border-gray-200 text-[#222222] hover:border-black dark:bg-transparent dark:border-gray-700 dark:text-white dark:hover:border-white'
                        }`}
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                    onClick={handleShareCode}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-[#FF385C] hover:bg-[#d90b3e] text-white rounded-xl font-bold text-sm transition-all shadow-sm transform active:scale-95"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                </button>
            </div>

            {/* Use Instructions as Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-[#2c2c2c] flex items-center justify-center text-[#717171] dark:text-[#a0a0a0]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium text-[#717171] dark:text-[#a0a0a0] leading-relaxed">
                        Patients enter this code during signup to instantly link their profile to your dashboard.
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#222222] dark:text-[#e0e0e0]">
                        {linkedPatientsCount} Active Patients
                    </p>
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-[#1e1e1e]"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorReferralCard;
