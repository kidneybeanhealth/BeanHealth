import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogoIcon } from '../icons/LogoIcon';
import { supabase, getProxiedUrl } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useHospitalName } from '../../hooks/useHospitalName';

/**
 * Enterprise Dashboard Home - Department Selection Screen
 */
const EnterpriseDashboardHome: React.FC = () => {
    const { signOut, profile, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const { displayName } = useHospitalName('Hospital Admin');

    // Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [hospitalSettings, setHospitalSettings] = useState({
        hospitalName: profile?.name || '',
        address: '',
        contactNumber: '',
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || ''
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);

    const fetchHospitalSettings = async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('hospital_profiles' as any)
                .select('*')
                .eq('id', profile.id)
                .single() as { data: any; error: any };

            if (data && !error) {
                setHospitalSettings({
                    hospitalName: data.hospital_name || profile.name || '',
                    address: data.address || '',
                    contactNumber: data.contact_number || '',
                    email: data.email || profile.email || '',
                    avatarUrl: data.avatar_url || profile.avatar_url || ''
                });
                if (data.avatar_url || profile.avatar_url) {
                    setAvatarPreview(data.avatar_url || profile.avatar_url);
                }
            }
        } catch (err) {
            console.warn('Failed to fetch hospital settings:', err);
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setIsSavingSettings(true);
        const toastId = toast.loading('Saving settings...');

        try {
            let avatarUrl = hospitalSettings.avatarUrl;

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `hospital-${profile.id}-${Date.now()}.${fileExt}`;
                const filePath = `hospital-logos/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('medical-records')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) {
                    toast.error('Failed to upload image', { id: toastId });
                    setIsSavingSettings(false);
                    return;
                }

                const { data: urlData } = supabase.storage
                    .from('medical-records')
                    .getPublicUrl(filePath);

                avatarUrl = getProxiedUrl(urlData.publicUrl);
            }

            // Update hospital_profiles table
            const { error: profileError } = await (supabase
                .from('hospital_profiles' as any) as any)
                .update({
                    hospital_name: hospitalSettings.hospitalName,
                    address: hospitalSettings.address,
                    contact_number: hospitalSettings.contactNumber,
                    email: hospitalSettings.email,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (profileError) throw profileError;

            // Sync with users table (profile)
            const { error: userUpdateError } = await (supabase
                .from('users' as any) as any)
                .update({
                    name: hospitalSettings.hospitalName,
                    avatar_url: avatarUrl
                })
                .eq('id', profile.id);

            if (userUpdateError) throw userUpdateError;

            await refreshProfile();
            toast.success('Settings updated successfully', { id: toastId });
            setShowSettingsModal(false);
            setAvatarFile(null);
        } catch (err: any) {
            console.error('Settings Update Error:', err);
            toast.error(err.message || 'Failed to update settings', { id: toastId });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const departments = [
        {
            id: 'reception',
            title: 'Reception',
            desc: 'Patient registration, check-ins, and queue management.',
            path: '/enterprise-dashboard/reception',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            bgDecoration: 'bg-orange-50/50',
            hoverShadow: 'hover:shadow-[0_8px_30px_rgb(251,146,60,0.12)]',
            iconColor: 'text-orange-600'
        },
        {
            id: 'pharmacy',
            title: 'Pharmacy',
            desc: 'Prescription fulfillment, inventory, and dispensing logs.',
            path: '/enterprise-dashboard/pharmacy',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
            bgDecoration: 'bg-rose-50/50',
            hoverShadow: 'hover:shadow-[0_8px_30px_rgb(244,63,94,0.12)]',
            iconColor: 'text-rose-600'
        },
        {
            id: 'doctors',
            title: 'Doctors',
            desc: 'Clinical dashboards, consultation tools, and patient history.',
            path: '/enterprise-dashboard/doctors',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
            bgDecoration: 'bg-indigo-50/50',
            hoverShadow: 'hover:shadow-[0_8px_30px_rgb(99,102,241,0.12)]',
            iconColor: 'text-indigo-600'
        },
        {
            id: 'display',
            title: 'Token Display',
            desc: 'Live queue status for waiting areas.',
            path: '/enterprise-dashboard/pharmacy/display',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            ),
            bgDecoration: 'bg-emerald-50/50',
            hoverShadow: 'hover:shadow-[0_8px_30px_rgb(16,185,129,0.12)]',
            iconColor: 'text-emerald-600'
        }
    ];

    const [isExpanded, setIsExpanded] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);

    // Close pill when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isExpanded]);

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans selection:bg-primary-100 selection:text-primary-900">
            {/* Nav - Floating Glassmorphism Header */}
            <div className="sticky top-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-50 via-gray-50/80 to-transparent" />

                <header className="pointer-events-auto relative mt-2 sm:mt-6 w-full max-w-[95%] sm:max-w-[1500px] h-20 sm:h-22 bg-white/70 backdrop-blur-3xl saturate-150 rounded-[2rem] sm:rounded-[2.5rem] border border-white/40 flex items-center transition-all duration-500 shadow-xl shadow-gray-200/30">
                    <div className="w-full flex items-center justify-between px-3">
                        {/* Left Section - Logo & Title */}
                        <div className={`flex items-center gap-2.5 sm:gap-3 min-w-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'overflow-hidden max-w-0 opacity-0 px-0 sm:max-w-none sm:opacity-100 sm:px-0' : 'max-w-[500px] opacity-100'}`}>
                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center flex-shrink-0 bg-white border border-gray-100/50 shadow-[0_4px_15px_rgba(0,0,0,0.08)] transition-all duration-500 hover:scale-105 hover:rotate-3">
                                <LogoIcon className="w-10 h-10 sm:w-12 sm:h-12" />
                            </div>
                            <div className="flex flex-col justify-center min-w-0">
                                <h2 className="text-xl sm:text-2xl font-black leading-none tracking-tight truncate pl-1">
                                    <span className="text-[#3A2524]">Bean</span>
                                    <span className="text-[#8AC43C]">Health</span>
                                </h2>
                                <p className="text-[10px] sm:text-[10px] font-bold text-gray-400 tracking-[0.2em] mt-1.5 uppercase leading-none truncate pl-1">Enterprise Portal</p>
                            </div>
                        </div>

                        {/* Right Section - Hospital Profile (3D Effect) */}
                        <div
                            ref={pillRef}
                            className={`group relative flex items-center bg-white border border-gray-100 p-1 sm:p-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_4px_15px_-3px_rgba(0,0,0,0.08),0_2px_6px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] border-b-2 border-b-gray-200/50 ${isExpanded ? 'ml-0 shadow-lg ring-2 ring-gray-100 flex-1 w-full justify-between' : 'ml-2 flex-shrink-0'}`}
                            onClick={() => {
                                // Toggle on click for wrapper (redundant if button catches it, but safe)
                            }}
                        >
                            {/* Hospital Info Area */}
                            <button
                                onClick={(e) => {
                                    const isMobile = window.innerWidth < 640;
                                    if (isMobile) {
                                        // On mobile: Toggle expansion
                                        if (!isExpanded) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsExpanded(true);
                                            return;
                                        }
                                        // If already expanded, let it fall through to settings
                                    }
                                    // Desktop or Mobile (Expanded) -> Open Settings
                                    fetchHospitalSettings();
                                    setShowSettingsModal(true);
                                }}
                                className={`flex items-center gap-2 sm:gap-4 px-2 sm:pl-3 sm:pr-4 py-0.5 active:scale-95 transition-transform duration-200 ${isExpanded ? 'flex-1 min-w-0' : ''}`}
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center overflow-hidden border border-gray-100 bg-white shadow-inner transition-transform duration-500 group-hover:scale-95 flex-shrink-0">
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-base font-bold text-gray-700">
                                            {profile?.name?.charAt(0) || 'H'}
                                        </span>
                                    )}
                                </div>
                                <span className={`${isExpanded ? 'inline-block' : 'hidden'} sm:inline-block text-base sm:text-[16px] font-black text-gray-800 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis`}>
                                    {displayName}
                                </span>
                            </button>

                            {/* Smooth Sliding Drawer for Divider + Sign Out */}
                            <div className={`flex items-center transition-[max-width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isExpanded ? 'max-w-[200px]' : 'max-w-0 sm:group-hover:max-w-[200px]'}`}>
                                <div className="flex items-center pl-1 sm:pl-2 pr-1">
                                    {/* Divider */}
                                    <div className="w-px h-8 bg-gray-100 mx-2 sm:mx-3" />

                                    {/* Sign Out Button */}
                                    <button
                                        onClick={() => signOut()}
                                        className="flex items-center gap-2.5 px-3 py-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors duration-300 whitespace-nowrap"
                                    >
                                        <span className="text-sm font-bold">Sign Out</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
            </div>

            {/* Main Content Area */}
            <div className="pt-16 sm:pt-24 pb-20 px-6 relative z-10 transition-all duration-700">
                <div className="max-w-6xl mx-auto">
                    {/* Welcome Section */}
                    {/* Welcome Section */}
                    <div className="max-w-2xl mx-auto mb-8 sm:mb-10 px-4 text-center">
                        <p className="text-secondary-500 font-bold tracking-[0.3em] uppercase text-[10px] sm:text-[11px] mb-3">Enterprise Portal</p>
                        <h2 className="text-2xl sm:text-[3rem] font-black text-gray-900 mb-5 tracking-tight leading-[1.2]">
                            {displayName === 'Hospital Admin' ? 'Hospital Registry' : displayName}
                        </h2>
                        <p className="text-sm sm:text-lg text-gray-500/80 leading-relaxed font-medium max-w-xl mx-auto">
                            Welcome to the BeanHealth Enterprise Suite. Secure, efficient, and integrated management for your healthcare facility.
                        </p>
                    </div>

                    {/* Department Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {departments.map((item) => (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`group relative flex flex-col h-full p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] transition-all duration-300 ease-out border border-gray-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${item.hoverShadow} hover:border-gray-200 hover:scale-[1.01] hover:-translate-y-1 overflow-hidden`}
                            >
                                {/* Subtle Background Glow on Hover */}
                                <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${item.bgDecoration} blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700`} />

                                <div className="relative z-10 flex flex-col h-full">
                                    {/* Header Section: Icon + Title (Concise row on mobile, col on desktop) */}
                                    <div className="flex items-center gap-4 mb-4 sm:mb-8 sm:flex-col sm:items-start">
                                        <div className={`w-14 h-14 sm:w-16 sm:h-16 ${item.bgDecoration} rounded-[1.1rem] sm:rounded-[1.25rem] flex items-center justify-center shadow-sm border border-white`}>
                                            <div className={`${item.iconColor} flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8`}>
                                                {item.icon}
                                            </div>
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight group-hover:text-primary-900 transition-colors">
                                            {item.title}
                                        </h3>
                                    </div>

                                    {/* Content Area */}
                                    <div className="mb-6">
                                        <p className="text-[14px] leading-relaxed font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
                                            {item.desc}
                                        </p>
                                    </div>

                                    {/* Action Footer */}
                                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-gray-50 group-hover:border-gray-100 transition-colors">
                                        <span className="text-[10px] sm:text-[13px] font-black uppercase tracking-[0.2em] text-gray-900 transition-colors duration-300">
                                            Enter Workspace
                                        </span>
                                        <div className={`w-8 h-8 rounded-full ${item.bgDecoration} flex items-center justify-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500`}>
                                            <svg className={`w-3.5 h-3.5 ${item.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all animate-in fade-in zoom-in duration-300">
                        <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center z-10">
                            <h3 className="text-xl font-bold text-gray-900">Hospital Settings</h3>
                            <button
                                onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 shadow-inner">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Hospital Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold text-gray-300">
                                                {hospitalSettings.hospitalName?.charAt(0) || 'H'}
                                            </span>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 font-medium">Click to change hospital logo</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Hospital Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={hospitalSettings.hospitalName}
                                        onChange={(e) => setHospitalSettings({ ...hospitalSettings, hospitalName: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-0 outline-none transition-all"
                                        placeholder="Enter hospital name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contact Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={hospitalSettings.email}
                                        onChange={(e) => setHospitalSettings({ ...hospitalSettings, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-0 outline-none transition-all"
                                        placeholder="hospital@example.com"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowSettingsModal(false)}
                                    className="flex-1 px-4 py-3.5 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingSettings}
                                    className="flex-[2] bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                                >
                                    {isSavingSettings ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary-50/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-secondary-50/40 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>
        </div>
    );
};

export default EnterpriseDashboardHome;
