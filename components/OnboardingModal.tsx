import React, { useState } from 'react';

interface OnboardingModalProps {
    isOpen: boolean;
    onComplete: (data: OnboardingData) => Promise<{ patientId: string; doctorName?: string } | void>;
}

export interface OnboardingData {
    fullName: string;
    age: number;
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    referralCode?: string;
}

type OnboardingStep = 'welcome' | 'profile' | 'referral' | 'success';

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
    const [step, setStep] = useState<OnboardingStep>('welcome');
    const [formData, setFormData] = useState<OnboardingData>({
        fullName: '',
        age: 0,
        gender: 'prefer_not_to_say',
        referralCode: ''
    });
    const [generatedPatientId, setGeneratedPatientId] = useState<string>('');
    const [linkedDoctorName, setLinkedDoctorName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleContinue = async () => {
        if (step === 'welcome') {
            setStep('profile');
        } else if (step === 'profile') {
            if (!formData.fullName || !formData.age) {
                alert('Please fill in all required fields');
                return;
            }
            setStep('referral');
        } else if (step === 'referral') {
            setIsLoading(true);
            try {
                const result = await onComplete(formData);
                // Get patient ID and doctor name from server response
                if (result) {
                    setGeneratedPatientId(result.patientId || 'P-20251215-0042');
                    if (result.doctorName) {
                        setLinkedDoctorName(result.doctorName);
                    }
                }
                setStep('success');
            } catch (error: any) {
                console.error('Error completing onboarding:', error);
                const errorMessage = error?.message || 'Failed to complete setup. Please try again.';
                alert(errorMessage);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSkipReferral = () => {
        setFormData({ ...formData, referralCode: '' });
        handleContinue();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Welcome Step */}
                {step === 'welcome' && (
                    <div className="p-8 md:p-12">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                                Welcome to BeanHealth CKD!
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-400">
                                Let's set up your profile to get started with your kidney health journey
                            </p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-start gap-3 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl">
                                <span className="text-2xl">🏥</span>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Track Your Health</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Monitor vitals, labs, and medications</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <span className="text-2xl">👨‍⚕️</span>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Connect with Your Doctor</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Share data and get personalized care</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
                                <span className="text-2xl">📊</span>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Visualize Trends</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">See your progress over time</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleContinue}
                            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
                        >
                            Get Started
                        </button>
                    </div>
                )}

                {/* Profile Step */}
                {step === 'profile' && (
                    <div className="p-8 md:p-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            Complete Your Profile
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            Tell us a bit about yourself
                        </p>

                        <div className="space-y-6 mb-8">
                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Enter your full name"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            {/* Age */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Age <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={formData.age || ''}
                                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                                    placeholder="Enter your age"
                                    min="1"
                                    max="120"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            {/* Gender */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Gender <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleContinue}
                            disabled={!formData.fullName || !formData.age}
                            className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* Referral Code Step */}
                {step === 'referral' && (
                    <div className="p-8 md:p-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            Link to Your Doctor
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            Have a doctor's referral code? Enter it below to connect with your healthcare provider
                        </p>

                        <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Doctor's Referral Code (Optional)
                            </label>
                            <input
                                type="text"
                                value={formData.referralCode}
                                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                                placeholder="DR-XXXX-XXXX"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-gray-100 font-mono"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Format: DR-XXXX-XXXX (e.g., DR-NEPH-A7K2)
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSkipReferral}
                                className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all"
                            >
                                Skip for Now
                            </button>
                            <button
                                onClick={handleContinue}
                                disabled={isLoading}
                                className="flex-1 py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                            >
                                {isLoading ? 'Completing...' : 'Complete Setup'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Success Step */}
                {step === 'success' && (
                    <div className="p-8 md:p-12">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-6 flex items-center justify-center">
                                <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                                Setup Complete!
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                                Welcome to your CKD monitoring dashboard, {formData.fullName}
                            </p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
                                <p className="text-sm text-cyan-700 dark:text-cyan-400 mb-1">Your Patient ID</p>
                                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-300 font-mono">{generatedPatientId}</p>
                                <p className="text-xs text-cyan-600 dark:text-cyan-500 mt-2">Save this ID for future reference</p>
                            </div>

                            {linkedDoctorName && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                                    <p className="text-sm text-green-700 dark:text-green-400 mb-1">✅ Linked to</p>
                                    <p className="text-lg font-semibold text-green-900 dark:text-green-300">{linkedDoctorName}</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
