import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EnterprisePharmacyDashboard from '../EnterprisePharmacyDashboard';
import { LogoIcon } from '../icons/LogoIcon';
import { supabase, getProxiedUrl } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const PharmacyDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { profile, refreshProfile, signOut } = useAuth();

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
            } else {
                setHospitalSettings({
                    hospitalName: profile.name || '',
                    address: '',
                    contactNumber: '',
                    email: profile.email || '',
                    avatarUrl: profile.avatar_url || ''
                });
                if (profile.avatar_url) {
                    setAvatarPreview(profile.avatar_url);
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
                .from('hospital_profiles' as any)
                .upsert({
                    id: profile.id,
                    hospital_name: hospitalSettings.hospitalName,
                    address: hospitalSettings.address,
                    contact_number: hospitalSettings.contactNumber,
                    updated_at: new Date().toISOString()
                } as any) as any);

            if (profileError) throw profileError;

            // Sync with users table
            await (supabase.from('users') as any)
                .update({
                    name: hospitalSettings.hospitalName,
                    avatar_url: avatarUrl,
                    email: hospitalSettings.email
                })
                .eq('id', profile.id);

            await refreshProfile();
            toast.success('Settings saved successfully!', { id: toastId });
            setShowSettingsModal(false);
            setAvatarFile(null);
        } catch (error: any) {
            console.error('Save settings error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('pharmacy_authenticated');
        navigate('/enterprise-dashboard/pharmacy');
    };

    if (!profile?.id) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-black font-sans selection:bg-secondary-100 selection:text-secondary-900">
            {/* Nav - Floating Glassmorphism Header */}
            <div className="sticky top-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-100 via-gray-100/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent" />

                <header className="pointer-events-auto relative mt-2 sm:mt-4 w-full max-w-7xl h-16 sm:h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-xl saturate-150 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-[#8AC43C]/15 flex items-center transition-all duration-300 shadow-sm md:shadow-2xl dark:shadow-[0_0_20px_rgba(138,196,60,0.1)]">
                    <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
                        {/* Left Section - Back + BeanHealth Logo & Enterprise Tagline */}
                        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                            <button
                                onClick={() => navigate('/enterprise-dashboard')}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0"
                                title="Back to Dashboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

                            <div className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform overflow-hidden">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                                    <LogoIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <h2 className="text-sm sm:text-lg md:text-xl font-bold leading-none tracking-tight">
                                        <span className="text-primary-500 dark:text-[#e6b8a3]">Bean</span>
                                        <span className="text-secondary-500">Health</span>
                                    </h2>
                                    <p className="text-[7px] sm:text-[9px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5 uppercase truncate">Enterprise Portal</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Section - Hospital Logo & Name + Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
                            {/* Hospital Info */}
                            <button
                                onClick={() => { fetchHospitalSettings(); setShowSettingsModal(true); }}
                                className="flex items-center gap-3 p-1 rounded-xl transition-transform active:scale-95 cursor-pointer group"
                                title="Hospital Settings"
                            >
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-transform group-hover:scale-105">
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={profile?.name || 'Hospital'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {profile?.name?.charAt(0) || 'H'}
                                        </span>
                                    )}
                                </div>
                                <span className="hidden sm:inline-block text-sm md:text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">{profile?.name || 'Hospital'}</span>
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
            </div>

            <EnterprisePharmacyDashboard
                hospitalId={profile.id}
            />

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all">
                        <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Hospital Settings</h3>
                            <button
                                onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 space-y-6">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-200">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Hospital Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold text-gray-400">
                                                {hospitalSettings.hospitalName?.charAt(0) || 'H'}
                                            </span>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-3">Click to update hospital logo</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Hospital Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={hospitalSettings.hospitalName}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, hospitalName: e.target.value })}
                                />
                            </div>

                            <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingSettings}
                                        className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 shadow-lg transition-colors disabled:opacity-50"
                                    >
                                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => signOut()}
                                    className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Sign Out from Portal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacyDashboard;
