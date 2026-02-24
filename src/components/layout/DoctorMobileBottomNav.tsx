
import React from 'react';
import { DashboardIcon } from '../icons/DashboardIcon';
import { MessagesIcon } from '../icons/MessagesIcon';
import { UserGroupIcon } from '../icons/UserGroupIcon';
import { AlertIcon } from '../icons/AlertIcon';

// Define the view type locally to match DoctorDashboardMain
export type DoctorView = 'dashboard' | 'messages' | 'patient-detail' | 'monitoring' | 'alerts';

interface DoctorMobileBottomNavProps {
    activeView: DoctorView;
    setActiveView: (view: DoctorView) => void;
    unreadMessageCount?: number;
    hasUrgentMessages?: boolean;
    alertCount?: number;
    hasUrgentAlerts?: boolean;
}

const DoctorMobileBottomNav: React.FC<DoctorMobileBottomNavProps> = ({
    activeView,
    setActiveView,
    unreadMessageCount = 0,
    hasUrgentMessages = false,
    alertCount = 0,
    hasUrgentAlerts = false
}) => {
    const navItems = [
        { view: 'dashboard' as DoctorView, label: 'Home', icon: DashboardIcon },
        { view: 'monitoring' as DoctorView, label: 'Patients', icon: UserGroupIcon },
        { view: 'alerts' as DoctorView, label: 'Alerts', icon: AlertIcon },
        { view: 'messages' as DoctorView, label: 'Chat', icon: MessagesIcon },
    ];

    // Helper to check if a main nav item is active (handling sub-views)
    const isItemActive = (itemView: DoctorView) => {
        if (activeView === itemView) return true;
        // patient-detail is associated with monitoring
        if (itemView === 'monitoring' && activeView === 'patient-detail') return true;
        return false;
    };

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
                    const isActive = isItemActive(item.view);
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

                                {/* Notification Dot for Messages */}
                                {item.view === 'messages' && unreadMessageCount > 0 && !isActive && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasUrgentMessages ? 'bg-red-500' : 'bg-[#8AC43C]'}`}></span>
                                        <span className={`relative inline-flex rounded-full h-3 w-3 ${hasUrgentMessages ? 'bg-red-500' : 'bg-[#8AC43C]'} ring-2 ring-white dark:ring-[#121212]`}></span>
                                    </span>
                                )}

                                {/* Notification Dot for Alerts */}
                                {item.view === 'alerts' && alertCount > 0 && !isActive && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasUrgentAlerts ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                                        <span className={`relative inline-flex rounded-full h-3 w-3 ${hasUrgentAlerts ? 'bg-red-500' : 'bg-amber-500'} ring-2 ring-white dark:ring-[#121212]`}></span>
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

export default DoctorMobileBottomNav;
