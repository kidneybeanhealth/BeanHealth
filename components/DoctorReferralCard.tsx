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
            // Get doctor info and referral code
            const { data: doctorData, error: doctorError } = await supabase
                .from('users')
                .select('name, specialty, referral_code')
                .eq('id', doctorId)
                .single();

            if (doctorError) throw doctorError;

            setDoctorName(doctorData?.name || '');
            setSpecialty(doctorData?.specialty || 'General Practice');
            setReferralCode(doctorData?.referral_code || null);

            // Get linked patients count
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
                // Fallback for older browsers
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
            // Fallback to copy
            handleCopyCode();
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200/40 dark:border-gray-700/40 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
        );
    }

    if (!referralCode) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200/40 dark:border-gray-700/40">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Referral Code</h3>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        ⚠️ Referral code not generated yet. Please run the database schema update.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-6 rounded-3xl border border-cyan-200/50 dark:border-cyan-800/50">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Your Referral Code</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Share with patients to connect
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 text-sm font-medium rounded-full">
                        {specialty}
                    </span>
                </div>
            </div>

            {/* Referral Code Display */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl mb-4 shadow-sm">
                <p className="text-3xl font-mono font-bold text-center text-cyan-600 dark:text-cyan-400 tracking-wider">
                    {referralCode}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={handleCopyCode}
                    className={`flex-1 py-3 px-4 font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${copied
                            ? 'bg-green-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    {copied ? (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Code
                        </>
                    )}
                </button>
                <button
                    onClick={handleShareCode}
                    className="flex-1 py-3 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-xl text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{linkedPatientsCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Linked Patients</p>
                </div>
                <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-xl text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">Active</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Code Status</p>
                </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-white/80 dark:bg-gray-800/80 rounded-xl">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">How it works</h4>
                <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                    <li>Share this code with your patient</li>
                    <li>Patient enters the code during their profile setup</li>
                    <li>You'll see them appear in your patient list</li>
                    <li>View their health data and communicate securely</li>
                </ol>
            </div>
        </div>
    );
};

export default DoctorReferralCard;
