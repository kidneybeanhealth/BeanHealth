import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorIcon } from '../icons/DoctorIcon';


interface AuthChooserProps {
    onNext: (role: 'patient' | 'doctor') => void;
    onEnterpriseLogin?: () => void;
    onHospitalPatientLogin?: () => void;
}

const AuthChooser: React.FC<AuthChooserProps> = ({ onNext, onEnterpriseLogin: onAdminLogin, onHospitalPatientLogin }) => {
    const [selectedRole, setSelectedRole] = useState<'doctor' | null>(null);
    const navigate = useNavigate();

    const handleRoleSelect = (role: 'doctor') => {
        setSelectedRole(role);
    };

    const handleContinue = () => {
        if (selectedRole) {
            onNext(selectedRole);
        }
    };

    const handleOpenPatientApp = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        navigate('/patient-app');
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
                {/* Patient App (Beta) */}
                <button
                    onClick={handleOpenPatientApp}
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
        </div>
    );
};

export default AuthChooser;
