import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Enterprise Dashboard Home - Department Selection Screen
 */
const EnterpriseDashboardHome: React.FC = () => {
    const { signOut, profile } = useAuth();
    const navigate = useNavigate();

    const departments = [
        {
            id: 'reception',
            title: 'Reception',
            desc: 'Patient registration, check-ins, and queue management.',
            path: '/enterprise-dashboard/reception',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            bgColor: 'bg-orange-50',
            iconColor: 'text-orange-600',
            hoverRing: 'hover:ring-orange-100'
        },
        {
            id: 'pharmacy',
            title: 'Pharmacy',
            desc: 'Prescription fulfillment, inventory, and dispensing logs.',
            path: '/enterprise-dashboard/pharmacy',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
            bgColor: 'bg-rose-50',
            iconColor: 'text-rose-600',
            hoverRing: 'hover:ring-rose-100'
        },
        {
            id: 'doctors',
            title: 'Doctors',
            desc: 'Clinical dashboards, consultation tools, and patient history.',
            path: '/enterprise-dashboard/doctors',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
            bgColor: 'bg-secondary-50',
            iconColor: 'text-secondary-600',
            hoverRing: 'hover:ring-secondary-100'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 font-sans selection:bg-secondary-100 selection:text-secondary-900">
            {/* Nav - Professional Sticky Header */}
            <nav className="bg-white/95 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt="BeanHealth" className="w-full h-full object-contain" />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="font-bold text-base leading-tight tracking-tight text-gray-900">BeanHealth</h1>
                            <p className="text-xs font-semibold tracking-wider uppercase text-primary-600">Enterprise</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Hospital Avatar & Name */}
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-base font-bold text-gray-700">
                                        {profile?.name?.charAt(0) || 'H'}
                                    </span>
                                )}
                            </div>
                            <span className="hidden md:inline-block text-sm font-semibold text-gray-900">{profile?.name}</span>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            title="Sign Out"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <span className="inline-block text-secondary-600 font-semibold tracking-wider text-sm uppercase mb-4">
                        Enterprise Portal
                    </span>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-gray-900">
                        {profile?.name || 'Select your workspace'}
                    </h2>
                    <p className="text-lg md:text-xl leading-relaxed text-gray-600">
                        Welcome to the BeanHealth Enterprise Suite. Secure, efficient, and integrated management for your healthcare facility.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {departments.map((item) => (
                        <Link
                            key={item.id}
                            to={item.path}
                            className={`group bg-white p-8 md:p-10 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out text-left flex flex-col h-full ring-1 ring-transparent ${item.hoverRing} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                        >
                            <div className={`w-14 h-14 ${item.bgColor} ${item.iconColor} rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300`}>
                                {item.icon}
                            </div>
                            <h3 className="text-2xl font-bold mb-3 text-gray-900">{item.title}</h3>
                            <p className="leading-relaxed mb-auto text-base text-gray-600">{item.desc}</p>
                            <div className="mt-8 flex items-center text-sm font-semibold text-gray-900 opacity-70 group-hover:opacity-100 transition-opacity">
                                Enter Workspace <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EnterpriseDashboardHome;
