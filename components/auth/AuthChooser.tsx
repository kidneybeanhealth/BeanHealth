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
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 
                    className="text-2xl font-semibold mb-1"
                    style={{ color: '#1a1a1a' }}
                >
                    Get Started
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    How would you like to use BeanHealth?
                </p>
            </div>

            {/* Role Cards */}
            <div className="space-y-3">
                {/* Patient Card */}
                <button
                    onClick={() => handleRoleSelect('patient')}
                    className="w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4"
                    style={{
                        borderColor: selectedRole === 'patient' ? '#8AC43C' : '#e5e7eb',
                        backgroundColor: selectedRole === 'patient' ? 'rgba(138, 196, 60, 0.06)' : '#fafafa'
                    }}
                >
                    <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ 
                            backgroundColor: selectedRole === 'patient' ? '#8AC43C' : '#e8f5e0'
                        }}
                    >
                        <UserIcon className={`h-6 w-6 ${selectedRole === 'patient' ? 'text-white' : 'text-[#8AC43C]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 
                            className="font-semibold text-base"
                            style={{ color: '#1a1a1a' }}
                        >
                            I'm a Patient
                        </h3>
                        <p style={{ color: '#6b7280', fontSize: '13px' }}>
                            Track health, medications & connect with doctors
                        </p>
                    </div>
                    {selectedRole === 'patient' && (
                        <div className="w-6 h-6 rounded-full bg-[#8AC43C] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* Doctor Card */}
                <button
                    onClick={() => handleRoleSelect('doctor')}
                    className="w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4"
                    style={{
                        borderColor: selectedRole === 'doctor' ? '#8AC43C' : '#e5e7eb',
                        backgroundColor: selectedRole === 'doctor' ? 'rgba(138, 196, 60, 0.06)' : '#fafafa'
                    }}
                >
                    <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ 
                            backgroundColor: selectedRole === 'doctor' ? '#8AC43C' : '#e8f5e0'
                        }}
                    >
                        <DoctorIcon className={`h-6 w-6 ${selectedRole === 'doctor' ? 'text-white' : 'text-[#8AC43C]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 
                            className="font-semibold text-base"
                            style={{ color: '#1a1a1a' }}
                        >
                            I'm a Doctor
                        </h3>
                        <p style={{ color: '#6b7280', fontSize: '13px' }}>
                            Manage patients & provide care remotely
                        </p>
                    </div>
                    {selectedRole === 'doctor' && (
                        <div className="w-6 h-6 rounded-full bg-[#8AC43C] flex items-center justify-center flex-shrink-0">
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
                className="w-full py-3.5 rounded-full font-semibold text-base transition-all duration-200"
                style={{
                    backgroundColor: selectedRole ? '#8AC43C' : '#e5e7eb',
                    color: selectedRole ? '#ffffff' : '#9ca3af',
                    cursor: selectedRole ? 'pointer' : 'not-allowed'
                }}
            >
                Continue
            </button>

            {/* Admin Link */}
            <div className="text-center">
                <button
                    onClick={() => onAdminLogin?.()}
                    className="text-xs transition-colors hover:underline"
                    style={{ color: '#9ca3af' }}
                >
                    Admin Access
                </button>
            </div>
        </div>
    );
};

export default AuthChooser;
