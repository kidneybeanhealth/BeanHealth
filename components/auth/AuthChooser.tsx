import React, { useState } from 'react';
import { DoctorIcon } from '../icons/DoctorIcon';
import { UserIcon } from '../icons/UserIcon';

interface AuthChooserProps {
    onNext: () => void;
}

const AuthChooser: React.FC<AuthChooserProps> = ({ onNext }) => {
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
        <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-3">
                <h2 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 dark:text-white">
                    Welcome to BeanHealth
                </h2>
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
                    Select your role to continue
                </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Patient Card */}
                <button
                    onClick={() => handleRoleSelect('patient')}
                    className={`group relative p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-rose-200 dark:focus:ring-rose-900/50 ${
                        selectedRole === 'patient'
                            ? 'border-rose-500 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 shadow-lg ring-4 ring-rose-200 dark:ring-rose-800/50'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md'
                    }`}
                >
                    {/* Selection Indicator */}
                    {selectedRole === 'patient' && (
                        <div className="absolute top-4 right-4 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center animate-scale-in">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                    
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            selectedRole === 'patient'
                                ? 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-xl scale-110'
                                : 'bg-gradient-to-br from-rose-400 to-rose-600 group-hover:shadow-lg group-hover:scale-105'
                        }`}>
                            <UserIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                Patient
                            </h3>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                                Track your health records, medications, and connect with doctors
                            </p>
                        </div>
                        
                        {/* Features List */}
                        <div className="pt-2 space-y-2 text-left w-full">
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Access medical records</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Track medications</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Chat with doctors</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Doctor Card */}
                <button
                    onClick={() => handleRoleSelect('doctor')}
                    className={`group relative p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900/50 ${
                        selectedRole === 'doctor'
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg ring-4 ring-blue-200 dark:ring-blue-800/50'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                    }`}
                >
                    {/* Selection Indicator */}
                    {selectedRole === 'doctor' && (
                        <div className="absolute top-4 right-4 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center animate-scale-in">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                    
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            selectedRole === 'doctor'
                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl scale-110'
                                : 'bg-gradient-to-br from-blue-400 to-blue-600 group-hover:shadow-lg group-hover:scale-105'
                        }`}>
                            <DoctorIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                Doctor
                            </h3>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                                Manage patients, prescribe medications, and provide care
                            </p>
                        </div>
                        
                        {/* Features List */}
                        <div className="pt-2 space-y-2 text-left w-full">
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Manage patient records</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Write prescriptions</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Collaborate with patients</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            <button 
                onClick={handleContinue}
                disabled={!selectedRole}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 transform focus:outline-none focus:ring-4 ${
                    selectedRole
                        ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus:ring-rose-200 dark:focus:ring-rose-800/50'
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