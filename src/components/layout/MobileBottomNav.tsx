
import React from 'react';
import { View } from '../../types';
import { DashboardIcon } from '../icons/DashboardIcon';
import { RecordsIcon } from '../icons/RecordsIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { MessagesIcon } from '../icons/MessagesIcon';
import { BillingIcon } from '../icons/BillingIcon';
import { DoctorIcon } from '../icons/DoctorIcon';

interface MobileBottomNavProps {
    activeView: View;
    setActiveView: (view: View) => void;
    unreadMessageCount?: number;
    hasUrgentMessages?: boolean;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    activeView,
    setActiveView,
    unreadMessageCount = 0,
    hasUrgentMessages = false
}) => {
    const navItems = [
        { view: 'dashboard' as View, label: 'Home', icon: DashboardIcon },
        { view: 'records' as View, label: 'Records', icon: RecordsIcon },
        { view: 'upload' as View, label: 'Upload', icon: UploadIcon },
        { view: 'doctors' as View, label: 'Doctors', icon: DoctorIcon },
        { view: 'messages' as View, label: 'Chat', icon: MessagesIcon },
        { view: 'billing' as View, label: 'Billing', icon: BillingIcon },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 md:hidden pointer-events-none flex justify-center bg-gradient-to-t from-gray-100 via-gray-100/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent">
            {/* 
        Ultra-refined Glassmorphism Container
        - Increased blur to backdrop-blur-3xl for "liquid" feel
        - Subtle saturation boost (saturate-150)
        - Softer shadows and borders 
      */}
            <nav className="pointer-events-auto bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl saturate-150 border border-white/20 dark:border-white/10 rounded-[26px] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15),0_10px_20px_-5px_rgba(0,0,0,0.1)] p-1.5 flex items-center w-full max-w-[380px] mx-auto transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ring-1 ring-white/20 dark:ring-white/5">

                {navItems.map((item) => {
                    const isActive = activeView === item.view;
                    return (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={`
                group relative flex items-center justify-center h-11 rounded-[22px] 
                transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[width,transform,background-color]
                ${isActive
                                    ? 'flex-[2.5] bg-black dark:bg-white text-white dark:text-black shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.2)]'
                                    : 'flex-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 active:scale-90'
                                }
              `}
                            aria-label={item.label}
                            style={{
                                // Enhanced touch target/animation fluidity
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >

                            {/* Icon Container with subtle scaling */}
                            <div className={`
                relative flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]
                ${isActive ? 'scale-95' : 'scale-100'}
              `}>
                                <item.icon className="w-5 h-5 stroke-[2px]" />

                                {/* Notification Dot - Fluid Pulse */}
                                {item.view === 'messages' && unreadMessageCount > 0 && !isActive && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasUrgentMessages ? 'bg-red-500' : 'bg-[#8AC43C]'}`}></span>
                                        <span className={`relative inline-flex rounded-full h-3 w-3 ${hasUrgentMessages ? 'bg-red-500' : 'bg-[#8AC43C]'} ring-2 ring-white dark:ring-[#121212]`}></span>
                                    </span>
                                )}
                            </div>

                            {/* Label - Smooth Reveal with Mask */}
                            <div className={`
                overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]
                flex items-center
                ${isActive ? 'max-w-[100px] opacity-100 ml-2 translate-x-0' : 'max-w-0 opacity-0 ml-0 -translate-x-2'}
              `}>
                                <span className="text-xs font-bold tracking-tight leading-none">
                                    {item.label}
                                </span>
                            </div>

                            {/* Active State Background Glow (Optional subtle internal glow) */}
                            {isActive && (
                                <div className="absolute inset-0 rounded-[22px] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default MobileBottomNav;
