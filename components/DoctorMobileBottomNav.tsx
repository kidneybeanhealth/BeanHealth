
import React from 'react';
import { DashboardIcon } from './icons/DashboardIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';


// Define the view type locally to match DoctorDashboardMain
export type DoctorView = 'dashboard' | 'messages' | 'patient-detail' | 'monitoring' | 'alerts';

interface DoctorMobileBottomNavProps {
    activeView: DoctorView;
    setActiveView: (view: DoctorView) => void;
    unreadMessageCount?: number;
    hasUrgentMessages?: boolean;
}

const DoctorMobileBottomNav: React.FC<DoctorMobileBottomNavProps> = ({
    activeView,
    setActiveView,
    unreadMessageCount = 0,
    hasUrgentMessages = false
}) => {
    const navItems = [
        { view: 'dashboard' as DoctorView, label: 'Home', icon: DashboardIcon },
        { view: 'monitoring' as DoctorView, label: 'Monitoring', icon: UserGroupIcon },
        { view: 'messages' as DoctorView, label: 'Chat', icon: MessagesIcon },
    ];

    // Helper to check if a main nav item is active (handling sub-views)
    const isItemActive = (itemView: DoctorView) => {
        if (activeView === itemView) return true;
        if (itemView === 'monitoring' && activeView === 'alerts') return true;
        // Keep 'patient-detail' separate or associated with Dashboard/Monitoring?
        // Usually patient details come from searching or dashboard lists, so maybe Dashboard?
        // For now, only exact match or alerts->monitoring.
        return false;
    };

    return (
        <div className="fixed bottom-6 left-0 right-0 z-50 px-4 md:hidden pointer-events-none flex justify-center">
            <nav className="pointer-events-auto bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl saturate-150 border border-white/20 dark:border-white/10 rounded-[32px] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15),0_10px_20px_-5px_rgba(0,0,0,0.1)] p-1.5 flex items-center w-full max-w-[320px] mx-auto transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ring-1 ring-white/20 dark:ring-white/5">

                {navItems.map((item) => {
                    const isActive = isItemActive(item.view);
                    return (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={`
                group relative flex items-center justify-center h-12 rounded-[24px] 
                transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[width,transform,background-color]
                ${isActive
                                    ? 'flex-[2.5] bg-black dark:bg-white text-white dark:text-black shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.2)]'
                                    : 'flex-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 active:scale-90'
                                }
              `}
                            aria-label={item.label}
                            style={{
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >

                            {/* Icon Container with subtle scaling */}
                            <div className={`
                relative flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]
                ${isActive ? 'scale-95' : 'scale-100'}
              `}>
                                <item.icon className="w-[22px] h-[22px] stroke-[2px]" />

                                {/* Notification Dot for Messages */}
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
                ${isActive ? 'max-w-[100px] opacity-100 ml-2.5 translate-x-0' : 'max-w-0 opacity-0 ml-0 -translate-x-2'}
              `}>
                                <span className="text-[13px] font-bold tracking-tight leading-none">
                                    {item.label}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default DoctorMobileBottomNav;
