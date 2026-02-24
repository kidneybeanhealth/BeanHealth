import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { User, Doctor, Patient } from '../../types';
import { getInitials } from '../../utils/avatarUtils';
import { XIcon } from '../icons/XIcon';
import { LogoutIcon } from '../icons/LogoutIcon';

interface ProfileModalProps {
    user: User | Doctor | Patient | null;
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
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

    // Helper to format dates
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => {
        if (!value) return null;
        return (
            <div className="flex justify-between items-center py-4 border-b border-gray-100 dark:border-white/5 last:border-0 group">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                    {label}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {value}
                </span>
            </div>
        );
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                ref={modalRef}
                className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-scale-in"
            >
                {/* Header Actions */}
                <div className="flex justify-between items-center p-4 absolute top-0 left-0 right-0 z-10">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/10 dark:bg-black/20 backdrop-blur-md hover:bg-black/5 dark:hover:bg-white/10 transition-all text-gray-900 dark:text-white border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                    {/* Optional: Add share/edit actions here if needed */}
                </div>

                {/* Profile Hero */}
                <div className="pt-16 pb-8 px-6 flex flex-col items-center bg-gray-50 dark:bg-[#2C2C2E]/50 border-b border-gray-100 dark:border-white/5">
                    <div className="relative group cursor-pointer mb-4">
                        <div className="h-24 w-24 rounded-full p-1 bg-white dark:bg-[#1C1C1E] shadow-sm">
                            <div className="h-full w-full rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-3xl shadow-inner transition-transform group-hover:scale-105">
                                {initials}
                            </div>
                        </div>
                        <div className="absolute bottom-1 right-1 w-6 h-6 bg-[#8AC43C] rounded-full border-4 border-white dark:border-[#1C1C1E] flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">
                        {user.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {user.email}
                    </p>

                    <span className="mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#8AC43C]/10 text-[#719e34] dark:text-[#8AC43C] border border-[#8AC43C]/20">
                        {isDoctor ? 'Doctor' : 'Patient'}
                    </span>
                </div>

                {/* Details Section */}
                <div className="px-6 py-4">
                    <div className="space-y-0.5">
                        {!isDoctor && (
                            <>
                                <DetailItem label="Patient ID" value={user.patientId || (user as any).patient_id} />
                                {(user as any).beanhealth_id && (
                                    <DetailItem
                                        label="BeanHealth ID"
                                        value={
                                            <span className="font-mono text-xs px-2 py-0.5 bg-[#8AC43C]/10 text-[#719e34] rounded-md">
                                                {(user as any).beanhealth_id}
                                            </span>
                                        }
                                    />
                                )}
                                <DetailItem label="Date of Birth" value={formatDate(user.dateOfBirth || (user as any).date_of_birth)} />
                                <DetailItem label="Condition" value={user.condition} />
                                <DetailItem
                                    label="Plan"
                                    value={user.subscriptionTier || (user as any).subscription_tier || 'Free Trial'}
                                />
                            </>
                        )}

                        {isDoctor && (
                            <>
                                <DetailItem label="Specialty" value={user.specialty} />
                                <DetailItem label="License ID" value={user.id?.substring(0, 8).toUpperCase()} />
                                <DetailItem label="Member Since" value={formatDate((user as any).created_at)} />
                            </>
                        )}

                        {/* Common Fields */}
                        <div className="pt-2 mt-2 border-t border-gray-100 dark:border-white/5">
                            {/* <DetailItem 
                                label="App Version" 
                                value={<span className="text-xs text-gray-400">2.0.1</span>} 
                            /> */}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-8 mb-2">
                        <button
                            onClick={() => {
                                onClose();
                                onLogout();
                            }}
                            className="w-full py-4 px-6 bg-gradient-to-r from-[#FF385C] to-[#E31C5F] hover:from-[#FF1E46] hover:to-[#D70466] text-white rounded-2xl font-bold text-sm tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_8px_20px_-8px_rgba(255,56,92,0.6)] dark:shadow-none"
                        >
                            <LogoutIcon className="w-5 h-5" />
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ProfileModal;
