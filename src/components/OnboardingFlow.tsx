/**
 * Unified Onboarding Flow Component
 * 
 * DESIGN UPDATE: Auto-height and Responsive
 * - Removed fixed minimum height
 * - Content defines height
 * - Responsive padding
 * - Clean minimal aesthetic
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OnboardingService } from '../services/onboardingService';
import { UserRole } from '../types';
import { DoctorIcon } from './icons/DoctorIcon';

// Step types for different user roles
type PatientStep = 'welcome' | 'profile' | 'date_of_birth' | 'referral' | 'success';
type DoctorStep = 'welcome' | 'profile' | 'specialty' | 'success';
type OnboardingStep = PatientStep | DoctorStep;

export interface OnboardingFormData {
    fullName: string;
    dateOfBirth?: string;
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    condition?: string;
    specialty?: string;
    referralCode?: string;
}

const OnboardingFlow: React.FC = () => {
    const { user, profile, refreshProfile } = useAuth();
    const [step, setStep] = useState<OnboardingStep>('welcome');
    const [formData, setFormData] = useState<OnboardingFormData>({
        fullName: profile?.name || user?.user_metadata?.full_name || '',
        dateOfBirth: profile?.date_of_birth || '',
        gender: 'prefer_not_to_say',
        condition: profile?.condition || '',
        specialty: profile?.specialty || '',
        referralCode: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<{
        patientId?: string;
        doctorName?: string;
        referralCode?: string;
    } | null>(null);

    const userRole: UserRole = profile?.role || 'patient';

    // Pre-populate form data from profile if available
    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                ...prev,
                fullName: profile.name || prev.fullName,
                dateOfBirth: profile.date_of_birth || prev.dateOfBirth,
                condition: profile.condition || prev.condition,
                specialty: profile.specialty || prev.specialty
            }));
        }
    }, [profile]);

    const handleContinue = async () => {
        setError(null);

        if (step === 'welcome') {
            setStep('profile');
        } else if (step === 'profile') {
            if (!formData.fullName.trim()) {
                setError('Please enter your full name');
                return;
            }
            if (userRole === 'patient') {
                setStep('date_of_birth');
            } else if (userRole === 'doctor') {
                setStep('specialty');
            } else {
                await completeOnboarding();
            }
        } else if (step === 'date_of_birth') {
            if (!formData.dateOfBirth) {
                setError('Please provide your date of birth');
                return;
            }
            setStep('referral');
        } else if (step === 'referral' || step === 'specialty') {
            await completeOnboarding();
        }
    };

    const completeOnboarding = async () => {
        if (!user?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await OnboardingService.completeOnboarding(user.id, {
                fullName: formData.fullName.trim(),
                age: formData.dateOfBirth ? calculateAge(formData.dateOfBirth) : 0,
                gender: formData.gender,
                referralCode: formData.referralCode?.trim(),
                dateOfBirth: formData.dateOfBirth,
                condition: formData.condition?.trim(),
                specialty: formData.specialty?.trim(),
                role: userRole
            });

            setSuccessData({
                patientId: result.patientId,
                doctorName: result.doctorName,
                referralCode: result.referralCode
            });
            setStep('success');
        } catch (err: any) {
            console.error('Onboarding error:', err);
            setError(err?.message || 'Failed to complete onboarding. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipReferral = () => {
        setFormData(prev => ({ ...prev, referralCode: '' }));
        completeOnboarding();
    };

    const handleFinish = async () => {
        setIsLoading(true);
        try {
            await refreshProfile();
            window.location.reload();
        } catch (err) {
            console.error('Error refreshing profile:', err);
            window.location.reload();
        }
    };

    const calculateAge = (dateOfBirth: string): number => {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const getRoleSpecificContent = () => {
        switch (userRole) {
            case 'doctor':
                return {
                    title: 'Welcome, Doctor',
                    subtitle: 'Let\'s get your practice set up.',
                    illustration: (
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-[#222222]/5 dark:bg-white/10 rounded-full flex items-center justify-center">
                                <DoctorIcon className="w-10 h-10 text-[#222222] dark:text-white" />
                            </div>
                        </div>
                    )
                };
            case 'admin':
                return {
                    title: 'Admin Setup',
                    subtitle: 'Secure profile configuration.',
                    illustration: (
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-[#222222]/5 dark:bg-white/10 rounded-full flex items-center justify-center">
                                <span className="text-4xl">⚙️</span>
                            </div>
                        </div>
                    )
                };
            default:
                return {
                    title: 'Welcome to BeanHealth',
                    subtitle: 'Your journey to better health starts here.',
                    illustration: (
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                <span className="text-4xl">👋</span>
                            </div>
                        </div>
                    )
                };
        }
    };

    const content = getRoleSpecificContent();

    // Reusable Input Component matched to Dashboard style
    const InputField = ({ label, value, onChange, placeholder, type = "text", autoFocus = false }: any) => (
        <div className="space-y-2">
            <label className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider block">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={onChange}
                autoFocus={autoFocus}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-transparent focus:border-[#222222] dark:focus:border-white rounded-xl text-[#222222] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 transition-all outline-none text-base"
                placeholder={placeholder}
            />
        </div>
    );

    const SelectField = ({ label, value, onChange, options }: any) => (
        <div className="space-y-2">
            <label className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider block">
                {label}
            </label>
            <div className="relative">
                <select
                    value={value}
                    onChange={onChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-transparent focus:border-[#222222] dark:focus:border-white rounded-xl text-[#222222] dark:text-white appearance-none cursor-pointer transition-all outline-none text-base"
                >
                    {options.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );

    // Primary Button - Matches "Connect with Doctor" button style
    const PrimaryButton = ({ onClick, children, disabled, className = "" }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full py-3.5 bg-[#222222] dark:bg-white text-white dark:text-[#222222] text-sm font-bold rounded-full transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            {children}
        </button>
    );

    const SecondaryButton = ({ onClick, children, disabled }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-[#222222] dark:text-white text-sm font-bold rounded-full transition-all hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
        >
            {children}
        </button>
    );

    // Progress Indicator
    const steps = userRole === 'patient'
        ? ['Welcome', 'Profile', 'Details', 'Referral', 'Done']
        : ['Welcome', 'Profile', 'Specialty', 'Done'];

    const currentStepIndex = (() => {
        if (userRole === 'patient') {
            switch (step) {
                case 'welcome': return 0;
                case 'profile': return 1;
                case 'date_of_birth': return 2;
                case 'referral': return 3;
                case 'success': return 4;
                default: return 0;
            }
        } else {
            switch (step) {
                case 'welcome': return 0;
                case 'profile': return 1;
                case 'specialty': return 2;
                case 'success': return 3;
                default: return 0;
            }
        }
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-opacity duration-300">
            <div className={`
                bg-white dark:bg-[#121212] w-full max-w-[480px] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.08)] 
                border border-white/20 dark:border-white/5 
                overflow-hidden transform transition-all duration-300 flex flex-col
                animate-fade-in-up md:min-w-[360px]
            `}>

                {/* Header / Nav */}
                <div className="px-6 md:px-8 pt-6 md:pt-8 pb-2 flex items-center justify-between">
                    {currentStepIndex > 0 && step !== 'success' ? (
                        <button
                            onClick={() => {
                                if (step === 'profile') setStep('welcome');
                                if (step === 'date_of_birth') setStep('profile');
                                if (step === 'referral') setStep('date_of_birth');
                                if (step === 'specialty') setStep('profile');
                            }}
                            className="text-[#222222] dark:text-white p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    ) : <div />}

                    {/* Dots Progress Indicator */}
                    <div className="flex gap-2">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentStepIndex
                                        ? 'bg-[#222222] dark:bg-white w-4'
                                        : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="w-8" /> {/* Spacer for centering */}
                </div>

                {/* Main Content */}
                <div className="p-6 md:p-8 flex flex-col animate-fade-in text-center">

                    {/* WELCOME */}
                    {step === 'welcome' && (
                        <div className="flex flex-col items-center justify-center py-6">
                            {'illustration' in content && content.illustration}

                            <h2 className="text-3xl font-bold text-[#222222] dark:text-white mb-3 tracking-tight">
                                {content.title}
                            </h2>
                            <p className="text-[#717171] dark:text-[#a0a0a0] font-medium mb-10 max-w-xs mx-auto">
                                {content.subtitle}
                            </p>

                            <div className="w-full mt-4">
                                <PrimaryButton onClick={handleContinue}>
                                    Get Started
                                </PrimaryButton>
                            </div>
                        </div>
                    )}

                    {/* PROFILE */}
                    {step === 'profile' && (
                        <div className="flex flex-col text-left">
                            <h2 className="text-2xl font-bold text-[#222222] dark:text-white mb-2 tracking-tight">Tell us about you</h2>
                            <p className="text-[#717171] dark:text-[#a0a0a0] text-sm mb-6">Basic details to set up your profile.</p>

                            <div className="space-y-6 mb-8">
                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium">
                                        {error}
                                    </div>
                                )}

                                <InputField
                                    label="Full Name"
                                    value={formData.fullName}
                                    onChange={(e: any) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Your Name"
                                    autoFocus
                                />

                                <SelectField
                                    label="Gender"
                                    value={formData.gender}
                                    onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}
                                    options={[
                                        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                                        { value: 'male', label: 'Male' },
                                        { value: 'female', label: 'Female' },
                                        { value: 'other', label: 'Other' }
                                    ]}
                                />
                            </div>

                            <PrimaryButton
                                onClick={handleContinue}
                                disabled={!formData.fullName.trim()}
                            >
                                Continue
                            </PrimaryButton>
                        </div>
                    )}

                    {/* DATE OF BIRTH */}
                    {step === 'date_of_birth' && (
                        <div className="flex flex-col text-left">
                            <h2 className="text-2xl font-bold text-[#222222] dark:text-white mb-2 tracking-tight">Health Details</h2>
                            <p className="text-[#717171] dark:text-[#a0a0a0] text-sm mb-6">Helps us personalize your insights.</p>

                            <div className="space-y-6 mb-8">
                                <InputField
                                    label="Date of Birth"
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e: any) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    autoFocus
                                />

                                <InputField
                                    label="Primary Condition (Optional)"
                                    value={formData.condition}
                                    onChange={(e: any) => setFormData({ ...formData, condition: e.target.value })}
                                    placeholder="e.g. Hypertension"
                                />
                            </div>

                            <PrimaryButton
                                onClick={handleContinue}
                                disabled={!formData.dateOfBirth}
                            >
                                Next
                            </PrimaryButton>
                        </div>
                    )}

                    {/* SPECIALTY */}
                    {step === 'specialty' && (
                        <div className="flex flex-col text-left">
                            <h2 className="text-2xl font-bold text-[#222222] dark:text-white mb-2 tracking-tight">Practice Details</h2>
                            <p className="text-[#717171] dark:text-[#a0a0a0] text-sm mb-6">What do you specialize in?</p>

                            <div className="space-y-6 mb-8">
                                <InputField
                                    label="Medical Specialty"
                                    value={formData.specialty}
                                    onChange={(e: any) => setFormData({ ...formData, specialty: e.target.value })}
                                    placeholder="e.g. Nephrology"
                                    autoFocus
                                />
                            </div>

                            <PrimaryButton
                                onClick={handleContinue}
                                disabled={isLoading || !formData.specialty?.trim()}
                            >
                                Complete Setup
                            </PrimaryButton>
                        </div>
                    )}

                    {/* REFERRAL */}
                    {step === 'referral' && (
                        <div className="flex flex-col text-left">
                            <h2 className="text-2xl font-bold text-[#222222] dark:text-white mb-2 tracking-tight">Doctor Referral</h2>
                            <p className="text-[#717171] dark:text-[#a0a0a0] text-sm mb-6">Connect with your provider (optional).</p>

                            <div className="space-y-6 mb-8">
                                <InputField
                                    label="Referral Code"
                                    value={formData.referralCode}
                                    onChange={(e: any) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                                    placeholder="DR-XXXX-XXXX"
                                    autoFocus
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <PrimaryButton
                                    onClick={handleContinue}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Processing...' : (formData.referralCode ? 'Link & Finish' : 'Finish Setup')}
                                </PrimaryButton>
                                <SecondaryButton
                                    onClick={handleSkipReferral}
                                    disabled={isLoading}
                                >
                                    Skip this step
                                </SecondaryButton>
                            </div>
                        </div>
                    )}

                    {/* SUCCESS */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <div className="w-16 h-16 bg-[#8AC43C]/20 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-[#8AC43C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            <h2 className="text-3xl font-bold text-[#222222] dark:text-white mb-2 tracking-tight">
                                You're All Set!
                            </h2>
                            <p className="text-[#717171] dark:text-[#a0a0a0] mb-8">
                                Welcome aboard, {formData.fullName.split(' ')[0]}.
                            </p>

                            {/* Success Info Cards */}
                            <div className="w-full space-y-4 mb-8">
                                {userRole === 'patient' && successData?.patientId && (
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                        <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Your Patient ID</p>
                                        <p className="text-xl font-mono font-bold text-[#222222] dark:text-white">{successData.patientId}</p>
                                    </div>
                                )}

                                {userRole === 'doctor' && successData?.referralCode && (
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                        <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Referral Code</p>
                                        <p className="text-xl font-mono font-bold text-[#222222] dark:text-white">{successData.referralCode}</p>
                                    </div>
                                )}
                            </div>

                            <PrimaryButton onClick={handleFinish}>
                                Go to Dashboard
                            </PrimaryButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingFlow;
