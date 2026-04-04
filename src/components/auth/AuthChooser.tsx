import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorIcon } from '../icons/DoctorIcon';
import { UserIcon } from '../icons/UserIcon';


interface AuthChooserProps {
    onNext: (role: 'patient' | 'doctor') => void;
    onEnterpriseLogin?: () => void;
    onHospitalPatientLogin?: () => void;
}

const AuthChooser: React.FC<AuthChooserProps> = ({ onNext, onEnterpriseLogin: onAdminLogin, onHospitalPatientLogin }) => {
    const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | null>(null);
    const navigate = useNavigate();

    const handleRoleSelect = (role: 'patient' | 'doctor') => {
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

                {/* Hospital Patient Card */}
                <button
                    onClick={() => onHospitalPatientLogin?.()}
                    className="w-full p-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 hover:border-orange-400 hover:shadow-md transition-all duration-200 text-left flex items-center gap-4 group"
                >
                    <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base !text-gray-900">
                            I Visited a Hospital
                        </h3>
                        <p className="text-xs sm:text-sm !text-gray-500">
                            Login with your phone number
                        </p>
                    </div>
                </button>

                {/* Enterprise Card */}
                <button
                    onClick={() => onAdminLogin?.()}
                    className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-secondary-900/50 hover:shadow-md transition-all duration-200 text-left flex items-center gap-4 group"
                >
                    <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary-900 group-hover:text-white transition-colors">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base !text-gray-900">
                            Enterprise Login
                        </h3>
                        <p className="text-xs sm:text-sm !text-gray-500">
                            Hospital & Organization Access
                        </p>
                    </div>
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

            {/* Divider */}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Patient App (Beta) */}
            <button
                onClick={() => navigate('/patient-app')}
                className="w-full p-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 hover:border-emerald-400 hover:shadow-md transition-all duration-200 text-left flex items-center gap-4 group"
            >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base !text-gray-900">
                        Patient App
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full align-middle">
                            Beta
                        </span>
                    </h3>
                    <p className="text-xs sm:text-sm !text-gray-500">
                        View prescriptions & health dashboard
                    </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

        </div>
    );
};

export default AuthChooser;
