import React from 'react';

type StaffRole = 'doctor' | 'receptionist' | 'pharmacy';

interface RoleSelectionProps {
    clinicName: string;
    onRoleSelect: (role: StaffRole) => void;
    onLogout: () => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ clinicName, onRoleSelect, onLogout }) => {
    const roles = [
        {
            id: 'doctor' as StaffRole,
            title: 'Doctor',
            titleTa: 'மருத்துவர்',
            description: 'Access patient queue, write prescriptions, manage consultations',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'from-blue-500 to-blue-600',
            hoverColor: 'hover:from-blue-600 hover:to-blue-700',
            bgLight: 'bg-blue-50',
            iconColor: 'text-blue-500'
        },
        {
            id: 'receptionist' as StaffRole,
            title: 'Receptionist',
            titleTa: 'வரவேற்பாளர்',
            description: 'Register patients, manage appointments, assign to doctors',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            color: 'from-emerald-500 to-emerald-600',
            hoverColor: 'hover:from-emerald-600 hover:to-emerald-700',
            bgLight: 'bg-emerald-50',
            iconColor: 'text-emerald-500'
        },
        {
            id: 'pharmacy' as StaffRole,
            title: 'Pharmacy',
            titleTa: 'மருந்தகம்',
            description: 'View prescriptions, dispense medicines, manage inventory',
            icon: (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
            color: 'from-amber-500 to-amber-600',
            hoverColor: 'hover:from-amber-600 hover:to-amber-700',
            bgLight: 'bg-amber-50',
            iconColor: 'text-amber-500'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{clinicName}</h1>
                        <p className="text-sm text-gray-500">Select your role to continue</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            </div>

            {/* Role Selection */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-4xl">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            உங்கள் பணியைத் தேர்ந்தெடுக்கவும்
                        </h2>
                        <p className="text-gray-600">Select Your Role</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {roles.map((role) => (
                            <button
                                key={role.id}
                                onClick={() => onRoleSelect(role.id)}
                                className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-transparent hover:-translate-y-1 text-left"
                            >
                                {/* Icon */}
                                <div className={`w-20 h-20 rounded-2xl ${role.bgLight} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <div className={role.iconColor}>
                                        {role.icon}
                                    </div>
                                </div>

                                {/* Title */}
                                <h3 className="text-xl font-bold text-gray-900 mb-1">
                                    {role.title}
                                </h3>
                                <p className="text-sm text-gray-500 mb-3">
                                    {role.titleTa}
                                </p>

                                {/* Description */}
                                <p className="text-sm text-gray-600 mb-6">
                                    {role.description}
                                </p>

                                {/* CTA */}
                                <div className={`flex items-center gap-2 text-sm font-medium bg-gradient-to-r ${role.color} text-white px-4 py-2.5 rounded-lg group-hover:gap-3 transition-all justify-center`}>
                                    <span>Continue</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Info text */}
                    <p className="text-center text-sm text-gray-400 mt-8">
                        You can switch roles anytime by logging out and selecting a different role
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RoleSelection;
