import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EnterprisePharmacyDashboard from '../EnterprisePharmacyDashboard';

const PharmacyDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const handleLogout = () => {
        sessionStorage.removeItem('pharmacy_authenticated');
        navigate('/enterprise-dashboard/pharmacy');
    };

    if (!profile?.id) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="h-16 md:h-18 flex items-center justify-between">
                        {/* Left Section - Back + BeanHealth Logo & Enterprise Tagline */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/enterprise-dashboard')}
                                className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                title="Back to Dashboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200" />
                            <img 
                                src="/beanhealth-logo.png" 
                                alt="BeanHealth" 
                                className="h-14 w-14 object-contain"
                            />
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">BeanHealth</h1>
                                <p className="text-sm font-semibold tracking-widest uppercase text-green-600">ENTERPRISE</p>
                            </div>
                        </div>

                        {/* Right Section - Hospital Logo & Name + Actions */}
                        <div className="flex items-center gap-4">
                            {/* Hospital Info */}
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 bg-white">
                                    {profile?.avatar_url ? (
                                        <img 
                                            src={profile.avatar_url} 
                                            alt={profile?.name || 'Hospital'} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-gray-700">
                                            {profile?.name?.charAt(0) || 'H'}
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-semibold text-gray-900">{profile?.name || 'Hospital'}</span>
                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                                title="Logout from Pharmacy"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pharmacy Dashboard Content */}
            <EnterprisePharmacyDashboard 
                hospitalId={profile.id} 
                onBack={() => navigate('/enterprise-dashboard')} 
            />
        </div>
    );
};

export default PharmacyDashboard;
