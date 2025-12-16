import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';

interface DoctorsPageProps {
    patientId: string;
    onNavigateToChat: (doctorId: string) => void;
}

interface LinkedDoctor {
    id: string;
    name: string;
    email: string;
    specialty?: string;
    referral_code?: string;
    linkedSince?: string;
}

const DoctorsPage: React.FC<DoctorsPageProps> = ({ patientId, onNavigateToChat }) => {
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
                .select('doctor_id, created_at, status')
                .eq('patient_id', patientId);

            if (relError) {
                console.error('Error fetching relationships:', relError);
                throw relError;
            }

            console.log('Relationships found:', relationships);

            if (!relationships || relationships.length === 0) {
                console.log('No relationships found for patient:', patientId);
                setLinkedDoctors([]);
                setIsLoading(false);
                return;
            }

            // Filter to only active or null status (backward compatible)
            const activeRelationships = relationships.filter(rel =>
                rel.status === 'active' || rel.status === null || rel.status === undefined
            );

            if (activeRelationships.length === 0) {
                console.log('No active relationships');
                setLinkedDoctors([]);
                setIsLoading(false);
                return;
            }

            // Step 2: Get doctor details for each relationship
            const doctorIds = activeRelationships.map(rel => rel.doctor_id);

            const { data: doctors, error: docError } = await supabase
                .from('users')
                .select('id, name, email, specialty, referral_code')
                .in('id', doctorIds)
                .eq('role', 'doctor');

            if (docError) {
                console.error('Error fetching doctors:', docError);
                throw docError;
            }

            console.log('Doctors found:', doctors);

            // Combine doctor data with relationship data
            const linkedDocs = (doctors || []).map(doctor => {
                const rel = activeRelationships.find(r => r.doctor_id === doctor.id);
                return {
                    ...doctor,
                    linkedSince: rel?.created_at
                };
            });

            console.log('Final linked doctors:', linkedDocs);
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
                .single();

            if (doctorError || !doctor) {
                setLinkError('Invalid referral code. Please check and try again.');
                return;
            }

            // Check if already linked
            const { data: existing } = await supabase
                .from('patient_doctor_relationships')
                .select('id')
                .eq('patient_id', patientId)
                .eq('doctor_id', doctor.id)
                .single();

            if (existing) {
                setLinkError('You are already linked with this doctor.');
                return;
            }

            // Create relationship
            const { error: linkError } = await supabase
                .from('patient_doctor_relationships')
                .insert({
                    patient_id: patientId,
                    doctor_id: doctor.id,
                    status: 'active',
                    notes: `Linked via referral code ${referralCode}`
                });

            if (linkError) throw linkError;

            setLinkSuccess(`Successfully linked with Dr. ${doctor.name}!`);
            setReferralCode('');
            loadLinkedDoctors();
        } catch (error) {
            console.error('Error linking doctor:', error);
            setLinkError('Failed to link doctor. Please try again.');
        } finally {
            setIsLinking(false);
        }
    };

    const handleUnlinkDoctor = async (doctorId: string) => {
        if (!confirm('Are you sure you want to unlink this doctor?')) return;

        try {
            const { error } = await supabase
                .from('patient_doctor_relationships')
                .update({ status: 'inactive' })
                .eq('patient_id', patientId)
                .eq('doctor_id', doctorId);

            if (error) throw error;

            loadLinkedDoctors();
        } catch (error) {
            console.error('Error unlinking doctor:', error);
            alert('Failed to unlink doctor');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Doctors</h1>
                <p className="text-slate-600 dark:text-slate-400">Connect and communicate with your healthcare providers</p>
            </div>

            {/* Add Doctor Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/40 dark:border-slate-700/40">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Add a Doctor</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Enter your doctor's referral code to connect with them. Ask your doctor for their code.
                </p>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => {
                            setReferralCode(e.target.value.toUpperCase());
                            setLinkError('');
                            setLinkSuccess('');
                        }}
                        placeholder="DR-XXXX-XXXX"
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono text-center tracking-wider focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                        onClick={handleLinkDoctor}
                        disabled={isLinking || !referralCode.trim()}
                        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLinking ? 'Linking...' : 'Link Doctor'}
                    </button>
                </div>

                {linkError && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">{linkError}</p>
                )}
                {linkSuccess && (
                    <p className="mt-3 text-sm text-green-600 dark:text-green-400">{linkSuccess}</p>
                )}
            </div>

            {/* Linked Doctors List */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/40 dark:border-slate-700/40">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Linked Doctors</h2>

                {isLoading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-200 border-t-cyan-600 mx-auto"></div>
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading doctors...</p>
                    </div>
                ) : linkedDoctors.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No doctors linked yet</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Enter a doctor's referral code above to get started
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {linkedDoctors.map((doctor) => (
                            <div
                                key={doctor.id}
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${getInitialsColor(doctor.name, doctor.email)} rounded-xl flex items-center justify-center`}>
                                        <span className="text-sm font-bold text-white">
                                            {getInitials(doctor.name, doctor.email)}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                                            Dr. {doctor.name}
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {doctor.specialty || 'General Practice'}
                                        </p>
                                        {doctor.linkedSince && (
                                            <p className="text-xs text-slate-500 dark:text-slate-500">
                                                Connected since {new Date(doctor.linkedSince).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onNavigateToChat(doctor.id)}
                                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-xl transition-colors"
                                    >
                                        Message
                                    </button>
                                    <button
                                        onClick={() => handleUnlinkDoctor(doctor.id)}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
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
            <div className="bg-cyan-50 dark:bg-cyan-900/20 p-6 rounded-2xl border border-cyan-200/50 dark:border-cyan-800/50">
                <h3 className="font-semibold text-cyan-900 dark:text-cyan-300 mb-2">How it works</h3>
                <ul className="text-sm text-cyan-800 dark:text-cyan-400 space-y-1">
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
