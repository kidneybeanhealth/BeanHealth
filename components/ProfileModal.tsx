import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { User, Doctor, Patient } from '../types';
import { getInitials } from '../utils/avatarUtils';
import { XIcon } from './icons/XIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { ProfileIcon } from './icons/ProfileIcon';

interface ProfileModalProps {
    user: User | Doctor | Patient | null;
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    // Future: onUpdateProfile?: (updatedUser: Partial<User>) => Promise<void>;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, onClose, onLogout }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !user || !mounted) return null;

    const initials = getInitials(user.name, user.email);
    const isDoctor = user.role === 'doctor';
    const roleLabel = isDoctor ? 'Medical Doctor' : 'Patient';

    // Helper to format dates
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Helper for labeled value row
    const InfoRow = ({ label, value, subValue }: { label: string; value: string | number | undefined | null; subValue?: string }) => {
        if (!value && value !== 0) return null;
        return (
            <div className="py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
                    {label}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {value}
                    {subValue && <span className="text-gray-500 font-normal ml-1">({subValue})</span>}
                </p>
            </div>
        );
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-[32px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-hidden transform transition-all animate-scale-in"
            >
                {/* Header / Banner */}
                <div className="relative h-24 bg-gradient-to-r from-[#F0F2F5] to-[#F7F9FC] dark:from-[#2C2C2E] dark:to-[#1C1C1E] dark:border-b dark:border-white/5">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-gray-700 dark:text-white"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Info */}
                <div className="px-6 pb-6 -mt-12 relative">
                    <div className="flex justify-between items-end mb-4">
                        {/* Avatar */}
                        <div className="h-24 w-24 rounded-full p-1 bg-white dark:bg-[#1C1C1E]">
                            <div className="h-full w-full rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-3xl shadow-inner">
                                {initials}
                            </div>
                        </div>

                        {/* Sign Out Button (Top Right Action) */}
                        <button
                            onClick={() => {
                                onClose();
                                onLogout();
                            }}
                            className="mb-2 flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 font-semibold text-sm transition-colors"
                        >
                            <LogoutIcon className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {user.name}
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#8AC43C]/10 text-[#719e34] dark:text-[#8AC43C]">
                                {roleLabel}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {user.email}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 pt-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <ProfileIcon className="w-4 h-4 text-[#8AC43C]" />
                            Profile Details
                        </h3>

                        <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4 border border-gray-100 dark:border-white/5">
                            {!isDoctor && (
                                <>
                                    <InfoRow label="Patient ID" value={user.patientId || (user as any).patient_id || 'Pending'} />
                                    <InfoRow label="Date of Birth" value={formatDate(user.dateOfBirth || (user as any).date_of_birth)} />
                                    <InfoRow label="Condition" value={user.condition || 'General Health'} />
                                    <InfoRow
                                        label="Subscription"
                                        value={user.subscriptionTier || (user as any).subscription_tier || 'Free Trial'}
                                        subValue={user.urgentCredits || (user as any).urgent_credits ? `${user.urgentCredits || (user as any).urgent_credits} credits` : undefined}
                                    />
                                </>
                            )}


                            {isDoctor && (
                                <>
                                    <InfoRow label="Specialty" value={user.specialty || 'General Practice'} />
                                    <InfoRow label="License / ID" value={user.id?.substring(0, 8).toUpperCase()} subValue="System ID" />
                                    <InfoRow label="Joined" value={formatDate((user as any).created_at)} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-4 text-center">
                        <p className="text-[10px] text-gray-400 dark:text-gray-600">
                            BeanHealth ID: {user.id}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ProfileModal;
