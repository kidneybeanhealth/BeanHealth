import React from 'react';
import { DoctorIcon } from '../icons/DoctorIcon';
import { UserIcon } from '../icons/UserIcon';

interface AuthChooserProps {
    onNext: () => void;
}

const AuthChooser: React.FC<AuthChooserProps> = ({ onNext }) => {
    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to BeanHealth
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose your role to get started
                </p>
            </div>
            
            <div className="space-y-3">
                {/* Patient Card */}
                <div className="group flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-rose-900 dark:hover:border-rose-800 bg-white dark:bg-gray-800 transition-colors cursor-pointer">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-rose-900 rounded-lg flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            Patient
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Track health records and medications
                        </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-rose-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>

                {/* Doctor Card */}
                <div className="group flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-rose-900 dark:hover:border-rose-800 bg-white dark:bg-gray-800 transition-colors cursor-pointer">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-rose-900 rounded-lg flex items-center justify-center">
                            <DoctorIcon className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            Doctor
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Manage patients and provide care
                        </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-rose-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            <button 
                onClick={onNext}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-900 hover:bg-rose-800 active:bg-rose-950 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm"
            >
                <span>Continue to sign in</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </button>
        </div>
    );
};

export default AuthChooser;