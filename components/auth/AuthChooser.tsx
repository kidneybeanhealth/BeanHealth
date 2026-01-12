import React, { useState } from 'react';
import { DoctorIcon } from '../icons/DoctorIcon';
import { UserIcon } from '../icons/UserIcon';
import { HospitalIcon } from '../icons/HospitalIcon';


interface AuthChooserProps {
    onNext: (role: 'patient' | 'doctor' | 'hospital') => void;
    onAdminLogin?: () => void;
}

const AuthChooser: React.FC<AuthChooserProps> = ({ onNext, onAdminLogin }) => {
    const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | 'hospital' | null>(null);

    const handleRoleSelect = (role: 'patient' | 'doctor' | 'hospital') => {
        setSelectedRole(role);
    };

    const handleContinue = () => {
        if (selectedRole) {
            onNext(selectedRole);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-semibold mb-1 !text-gray-900">
                    Get Started
                </h2>
                <p className="text-sm !text-gray-500">
                    How would you like to use BeanHealth?
                </p>
            </div>

            {/* Role Cards */}
            <div className="space-y-3">
                {/* Patient Card */}
                <button
                    onClick={() => handleRoleSelect('patient')}
                    className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4 group ${selectedRole === 'patient'
                        ? 'border-secondary-500 bg-secondary-50/50'
                        : 'border-gray-200 bg-gray-50 hover:border-secondary-200'
                        }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedRole === 'patient'
                        ? 'bg-secondary-500 text-white'
                        : 'bg-secondary-100 text-secondary-500 group-hover:bg-secondary-200'
                        }`}>
                        <UserIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base !text-gray-900">
                            I'm a Patient
                        </h3>
                        <p className="text-xs sm:text-sm !text-gray-500">
                            Track health, medications & connect with doctors
                        </p>
                    </div>
                    {selectedRole === 'patient' && (
                        <div className="w-6 h-6 rounded-full bg-secondary-500 flex items-center justify-center flex-shrink-0 animate-scale-in">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* Doctor Card */}
                <button
                    onClick={() => handleRoleSelect('doctor')}
                    className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4 group ${selectedRole === 'doctor'
                        ? 'border-secondary-500 bg-secondary-50/50'
                        : 'border-gray-200 bg-gray-50 hover:border-secondary-200'
                        }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedRole === 'doctor'
                        ? 'bg-secondary-500 text-white'
                        : 'bg-secondary-100 text-secondary-500 group-hover:bg-secondary-200'
                        }`}>
                        <DoctorIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base !text-gray-900">
                            I'm a Doctor
                        </h3>
                        <p className="text-xs sm:text-sm !text-gray-500">
                            Manage patients & provide care remotely
                        </p>
                    </div>
                    {selectedRole === 'doctor' && (
                        <div className="w-6 h-6 rounded-full bg-secondary-500 flex items-center justify-center flex-shrink-0 animate-scale-in">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* Hospital Card */}
                <button
                    onClick={() => handleRoleSelect('hospital')}
                    className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4 group ${selectedRole === 'hospital'
                        ? 'border-secondary-500 bg-secondary-50/50'
                        : 'border-gray-200 bg-gray-50 hover:border-secondary-200'
                        }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedRole === 'hospital'
                        ? 'bg-secondary-500 text-white'
                        : 'bg-secondary-100 text-secondary-500 group-hover:bg-secondary-200'
                        }`}>
                        <HospitalIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base !text-gray-900">
                            I'm a Hospital
                        </h3>
                        <p className="text-xs sm:text-sm !text-gray-500">
                            Manage your facility, staff and walk-in queues
                        </p>
                    </div>
                    {selectedRole === 'hospital' && (
                        <div className="w-6 h-6 rounded-full bg-secondary-500 flex items-center justify-center flex-shrink-0 animate-scale-in">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>
            </div>

            {/* Continue Button */}
            <button
                onClick={handleContinue}
                disabled={!selectedRole}
                className={`w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 ${selectedRole
                    ? 'bg-secondary-500 hover:bg-secondary-600 text-white shadow-lg hover:shadow-xl translate-y-0'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
            >
                Continue
            </button>


            {/* Admin Link */}
            <div className="text-center">
                <button
                    onClick={() => onAdminLogin?.()}
                    className="text-xs !text-gray-400 hover:text-secondary-500 transition-colors hover:underline"
                >
                    Admin Access
                </button>
            </div>
        </div>
    );
};

export default AuthChooser;
