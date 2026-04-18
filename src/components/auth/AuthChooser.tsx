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
        navigate('/patient-app');
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="text-center">
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-[10px] sm:text-[11px] font-bold tracking-wide uppercase mb-2.5 sm:mb-3">
                    Choose Access
                </span>
                <h2 className="text-[22px] sm:text-[30px] font-extrabold mb-1 !text-gray-900 tracking-tight">
                    Get Started
                </h2>
                <p className="text-[13px] sm:text-base !text-gray-500 font-medium">
                    How would you like to use BeanHealth?
                </p>
            </div>

            {/* Role Cards */}
            <div className="space-y-3">
                {/* Patient App (Beta) */}
                <button
                    onClick={handleOpenPatientApp}
                    className="w-full p-3.5 sm:p-5 rounded-[20px] sm:rounded-[22px] border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50 hover:border-emerald-400 hover:shadow-[0_10px_24px_rgba(16,185,129,0.14)] transition-all duration-200 text-left flex items-center gap-3 sm:gap-4 group"
                >
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] sm:text-lg !text-gray-900 leading-tight">
                            Patient App
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full align-middle">
                                Beta
                            </span>
                        </h3>
                        <p className="text-[11px] sm:text-sm !text-gray-500 mt-0.5">
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
                    className={`w-full p-3.5 sm:p-5 rounded-[20px] sm:rounded-[22px] border-2 transition-all duration-200 text-left flex items-center gap-3 sm:gap-4 group ${selectedRole === 'doctor'
                        ? 'border-secondary-500 bg-secondary-50/80 shadow-[0_8px_20px_rgba(59,130,246,0.10)]'
                        : 'border-gray-200 bg-gray-50/90 hover:border-secondary-200'
                        }`}
                >
                    <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedRole === 'doctor'
                        ? 'bg-secondary-500 text-white'
                        : 'bg-secondary-100 text-secondary-500 group-hover:bg-secondary-200'
                        }`}>
                        <DoctorIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] sm:text-lg !text-gray-900 leading-tight">
                            I'm a Doctor
                        </h3>
                        <p className="text-[11px] sm:text-sm !text-gray-500 mt-0.5">
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
                    className="w-full p-3.5 sm:p-5 rounded-[20px] sm:rounded-[22px] border-2 border-gray-200 bg-white hover:border-secondary-900/50 hover:shadow-md transition-all duration-200 text-left flex items-center gap-3 sm:gap-4 group"
                >
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary-900 group-hover:text-white transition-colors">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] sm:text-lg !text-gray-900 leading-tight">
                            Enterprise Login
                        </h3>
                        <p className="text-[11px] sm:text-sm !text-gray-500 mt-0.5">
                            Hospital & Organization Access
                        </p>
                    </div>
                </button>
            </div>

            {/* Continue Button */}
            <button
                onClick={handleContinue}
                disabled={!selectedRole}
                className={`w-full py-3.5 rounded-2xl font-bold text-[15px] sm:text-base transition-all duration-200 ${selectedRole
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
