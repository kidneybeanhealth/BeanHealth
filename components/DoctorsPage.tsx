import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';

interface DoctorsPageProps {
    patientId: string;
    onNavigateToChat: (doctorId: string) => void;
    onDoctorLinked?: () => void;  // Callback when doctor is linked/unlinked
}

interface LinkedDoctor {
    id: string;
    name: string;
    email: string;
    specialty?: string;
    referral_code?: string;
    linkedSince?: string;
}

interface Relationship {
    doctor_id: string;
    created_at: string;
    status?: string | null;
}

interface DoctorUser {
    id: string;
    name: string;
    specialty?: string;
    referral_code?: string;
    email: string;
    role: string;
}

const DoctorsPage: React.FC<DoctorsPageProps> = ({ patientId, onNavigateToChat, onDoctorLinked }) => {
    const [linkedDoctors, setLinkedDoctors] = useState<LinkedDoctor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [referralCode, setReferralCode] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [linkSuccess, setLinkSuccess] = useState('');

    useEffect(() => {
        loadLinkedDoctors();
    }, [patientId]);

    const loadLinkedDoctors = async () => {
        setIsLoading(true);
        try {
            // Step 1: Get all patient-doctor relationships for this patient
            const { data: relationships, error: relError } = await supabase
                .from('patient_doctor_relationships')
                .select('*')
                .eq('patient_id', patientId)
                .returns<Relationship[]>();

            if (relError) {
                console.error('Error fetching relationships:', relError);
                setIsLoading(false);
                return;
            }

            if (!relationships || relationships.length === 0) {
                setLinkedDoctors([]);
                setIsLoading(false);
                return;
            }

            // Step 2: Get doctor details for each relationship
            const doctorIds = relationships.map(rel => rel.doctor_id);

            const { data: doctors, error: docError } = await supabase
                .from('users')
                .select('id, name, email, specialty, referral_code')
                .in('id', doctorIds)
                .eq('role', 'doctor')
                .returns<DoctorUser[]>();

            if (docError) {
                console.error('Error fetching doctors:', docError);
                throw docError;
            }

            // Combine doctor data with relationship data
            const linkedDocs = (doctors || []).map(doctor => {
                const rel = relationships.find(r => r.doctor_id === doctor.id);
                return {
                    ...doctor,
                    linkedSince: rel?.created_at
                };
            });

            setLinkedDoctors(linkedDocs);
        } catch (error) {
            console.error('Error loading doctors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLinkDoctor = async () => {
        if (!referralCode.trim()) {
            setLinkError('Please enter a referral code');
            return;
        }

        setIsLinking(true);
        setLinkError('');
        setLinkSuccess('');

        try {
            // Find doctor by referral code
            const { data: doctor, error: doctorError } = await supabase
                .from('users')
                .select('id, name, specialty, referral_code')
                .eq('referral_code', referralCode.toUpperCase().trim())
                .eq('role', 'doctor')
                .maybeSingle();

            const foundDoctor = doctor as unknown as DoctorUser | null;

            if (doctorError || !foundDoctor) {
                setLinkError('Invalid referral code. Please check and try again.');
                return;
            }

            // Check if already linked
            const { data: existing } = await supabase
                .from('patient_doctor_relationships')
                .select('id')
                .eq('patient_id', patientId)
                .eq('doctor_id', foundDoctor.id)
                .maybeSingle();

            if (existing) {
                setLinkError('You are already linked with this doctor.');
                return;
            }

            // Create relationship
            const { error: linkError } = await (supabase
                .from('patient_doctor_relationships') as any)
                .insert({
                    patient_id: patientId,
                    doctor_id: foundDoctor.id
                });

            if (linkError) throw linkError;

            setLinkSuccess(`Successfully linked with Dr. ${foundDoctor.name}!`);
            setReferralCode('');
            loadLinkedDoctors();
            onDoctorLinked?.();  // Notify parent to refresh contacts
        } catch (error: any) {
            console.error('Error linking doctor:', error);
            const errorMsg = error?.message || 'Failed to link doctor. Please try again.';
            setLinkError(errorMsg);
        } finally {
            setIsLinking(false);
        }
    };

    const handleUnlinkDoctor = async (doctorId: string, doctorName: string) => {
        if (!confirm(`Are you sure you want to unlink from Dr. ${doctorName}? This will remove their access to your health records.`)) return;

        try {
            const { error } = await supabase
                .from('patient_doctor_relationships')
                .delete()
                .eq('patient_id', patientId)
                .eq('doctor_id', doctorId);

            if (error) throw error;

            // Optimistic update
            setLinkedDoctors(prev => prev.filter(d => d.id !== doctorId));

            // Notify parent
            onDoctorLinked?.();
        } catch (error) {
            console.error('Error unlinking doctor:', error);
            alert('Failed to unlink doctor. Please try again.');
        }
    };

    return (
        <div className="space-y-6 pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#222222] dark:text-white tracking-tight">
                        My Doctors
                    </h1>
                    <p className="text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-1">Connect and communicate with your healthcare providers</p>
                </div>
            </div>

            {/* Add Doctor Section */}
            <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20 transition-all">
                <h2 className="text-xl font-bold text-[#222222] dark:text-white mb-1">Add a Doctor</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                    Enter your doctor's referral code to connect.
                </p>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => {
                            setReferralCode(e.target.value.toUpperCase());
                            setLinkError('');
                            setLinkSuccess('');
                        }}
                        placeholder="DR-XXXX-XXXX"
                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-[#8AC43C]/20 border-none rounded-xl font-mono text-base text-center tracking-wider focus:outline-none focus:ring-1 focus:ring-[#8AC43C] text-[#222222] dark:text-gray-100 placeholder-gray-400"
                    />
                    <button
                        onClick={handleLinkDoctor}
                        disabled={isLinking || !referralCode.trim()}
                        className="px-6 py-3 bg-[#8AC43C] text-white font-bold text-sm rounded-full hover:bg-[#7ab332] transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLinking ? 'Linking...' : 'Link Doctor'}
                    </button>
                </div>

                {linkError && (
                    <p className="mt-2 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">{linkError}</p>
                )}
                {linkSuccess && (
                    <p className="mt-2 text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">{linkSuccess}</p>
                )}
            </div>

            {/* Linked Doctors List */}
            <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20 transition-all">
                <h2 className="text-xl font-bold text-[#222222] dark:text-white mb-4">Linked Doctors</h2>

                {isLoading ? (
                    <div className="text-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-[#8AC43C] mx-auto"></div>
                    </div>
                ) : linkedDoctors.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No doctors linked yet.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {linkedDoctors.map((doctor) => (
                            <div
                                key={doctor.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3 bg-gray-50/50 dark:bg-[#8AC43C]/20 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-[#8AC43C]/30 transition-all"
                            >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-black dark:bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                                        <span className="text-[10px] sm:text-xs font-bold text-white dark:text-black">
                                            {getInitials(doctor.name, doctor.email)}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[#222222] dark:text-white text-sm sm:text-base truncate">
                                            Dr. {doctor.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                            <p className="text-[10px] sm:text-xs font-medium text-[#717171] dark:text-[#a0a0a0] truncate">
                                                {doctor.specialty || 'General Practice'}
                                            </p>
                                            {doctor.linkedSince && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700 hidden sm:block"></span>
                                                    <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
                                                        Since {new Date(doctor.linkedSince).toLocaleDateString()}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                                    <button
                                        onClick={() => onNavigateToChat(doctor.id)}
                                        className="px-4 py-2 bg-[#8AC43C] dark:bg-white text-white dark:text-[#222222] text-xs font-bold rounded-full hover:bg-[#7ab332] dark:hover:bg-gray-100 transition-all shadow-sm hover:shadow-md active:scale-95"
                                    >
                                        Message
                                    </button>
                                    <button
                                        onClick={() => handleUnlinkDoctor(doctor.id, doctor.name)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-black/20 text-gray-600 dark:text-white/60 text-xs font-bold rounded-full hover:bg-gray-200 dark:hover:bg-black/40 dark:hover:text-white transition-all active:scale-95"
                                    >
                                        Unlink
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Help Section */}
            <div className="bg-gray-50 dark:bg-[#8AC43C]/[0.04] backdrop-blur-md p-6 rounded-2xl border border-transparent dark:border-[#8AC43C]/10 transition-all">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">How it works</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>1. Ask your doctor for their referral code (format: DR-XXXX-XXXX)</li>
                    <li>2. Enter the code above and click "Link Doctor"</li>
                    <li>3. Once linked, your doctor can see your health data and you can message them</li>
                    <li>4. You can unlink at any time to revoke access</li>
                </ul>
            </div>
        </div>
    );
};

export default DoctorsPage;
