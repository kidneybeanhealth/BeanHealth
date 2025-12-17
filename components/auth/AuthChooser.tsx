import React, { useState } from 'react';
import { DoctorIcon } from '../icons/DoctorIcon';
import { UserIcon } from '../icons/UserIcon';

interface AuthChooserProps {
    onNext: () => void;
    onAdminLogin?: () => void;
}

const AuthChooser: React.FC<AuthChooserProps> = ({ onNext, onAdminLogin }) => {
    const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | null>(null);

    const handleRoleSelect = (role: 'patient' | 'doctor') => {
        setSelectedRole(role);
    };

    const handleContinue = () => {
        if (selectedRole) {
            onNext();
        }
    };

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="text-center space-y-3">
                <h2 className="text-4xl font-semibold text-gray-900 dark:text-white tracking-tight">
                    Welcome to BeanHealth
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                    Select your role to continue
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Patient Card - Minimalist */}
                <button
                    onClick={() => handleRoleSelect('patient')}
                    className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-secondary-700 ${selectedRole === 'patient'
                        ? 'border-secondary-700 dark:border-secondary-600 bg-secondary-700 dark:bg-secondary-600'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                >
                    {/* Selection Indicator */}
                    {selectedRole === 'patient' && (
                        <div className="absolute top-6 right-6 w-6 h-6 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}

                    <div className="flex flex-col space-y-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedRole === 'patient'
                            ? 'bg-white/10 dark:bg-gray-900/10'
                            : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                            <UserIcon className={`h-8 w-8 ${selectedRole === 'patient' ? 'text-white dark:text-white' : 'text-gray-600 dark:text-gray-300'}`} />
                        </div>
                        <div className="space-y-2">
                            <h3 className={`text-2xl font-semibold ${selectedRole === 'patient' ? 'text-white dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                                Patient
                            </h3>
                            <p className={`text-sm leading-relaxed ${selectedRole === 'patient' ? 'text-white/80 dark:text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                Track health records, medications, and connect with doctors
                            </p>
                        </div>

                        {/* Features List */}
                        <div className="pt-2 space-y-2">
                            <div className={`flex items-center gap-2 text-sm ${selectedRole === 'patient' ? 'text-white/70 dark:text-gray-900/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Medical records</span>
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${selectedRole === 'patient' ? 'text-white/70 dark:text-gray-900/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Medication tracking</span>
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${selectedRole === 'patient' ? 'text-white/70 dark:text-gray-900/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Doctor messaging</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Doctor Card - Minimalist */}
                <button
                    onClick={() => handleRoleSelect('doctor')}
                    className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-secondary-700 ${selectedRole === 'doctor'
                        ? 'border-secondary-700 dark:border-secondary-600 bg-secondary-700 dark:bg-secondary-600'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                >
                    {/* Selection Indicator */}
                    {selectedRole === 'doctor' && (
                        <div className="absolute top-6 right-6 w-6 h-6 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}

                    <div className="flex flex-col space-y-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedRole === 'doctor'
                            ? 'bg-white/10 dark:bg-gray-900/10'
                            : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                            <DoctorIcon className={`h-8 w-8 ${selectedRole === 'doctor' ? 'text-white dark:text-white' : 'text-gray-600 dark:text-gray-300'}`} />
                        </div>
                        <div className="space-y-2">
                            <h3 className={`text-2xl font-semibold ${selectedRole === 'doctor' ? 'text-white dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                                Doctor
                            </h3>
                            <p className={`text-sm leading-relaxed ${selectedRole === 'doctor' ? 'text-white/80 dark:text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                Manage patients, prescribe medications, and provide care
                            </p>
                        </div>

                        {/* Features List */}
                        <div className="pt-2 space-y-2">
                            <div className={`flex items-center gap-2 text-sm ${selectedRole === 'doctor' ? 'text-white/70 dark:text-gray-900/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Patient management</span>
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${selectedRole === 'doctor' ? 'text-white/70 dark:text-gray-900/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Write prescriptions</span>
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${selectedRole === 'doctor' ? 'text-white/70 dark:text-gray-900/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Secure messaging</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Admin Access Link - Subtle */}
            <div className="text-center">
                <button
                    onClick={() => onAdminLogin?.()}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors underline underline-offset-2"
                >
                    Admin Access
                </button>
            </div>

            <button
                onClick={handleContinue}
                disabled={!selectedRole}
                className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-medium text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-secondary-700 ${selectedRole
                    ? 'bg-secondary-700 dark:bg-secondary-600 text-white dark:text-white hover:bg-secondary-800 dark:hover:bg-secondary-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }`}
            >
                <span>Continue to Sign In</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </button>
        </div>
    );
};

export default AuthChooser;
