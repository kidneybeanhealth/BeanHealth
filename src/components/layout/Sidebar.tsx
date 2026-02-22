import React from 'react';
import { View } from '../../types';
import { NutritionIcon } from '../icons/NutritionIcon';
import { DashboardIcon } from '../icons/DashboardIcon';
import { RecordsIcon } from '../icons/RecordsIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { MessagesIcon } from '../icons/MessagesIcon';
import { LogoIcon } from '../icons/LogoIcon';
import { BillingIcon } from '../icons/BillingIcon';
import { XIcon } from '../icons/XIcon';
import { DoctorIcon } from '../icons/DoctorIcon';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
  unreadMessageCount?: number;
  hasUrgentMessages?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  isOpen,
  onClose,
  unreadMessageCount = 0,
  hasUrgentMessages = false
}) => {
  const navItems: { view: View; label: string; icon: React.ReactElement }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { view: 'records', label: 'Records', icon: <RecordsIcon /> },
    { view: 'upload', label: 'Upload', icon: <UploadIcon /> },
    { view: 'doctors', label: 'Doctors', icon: <DoctorIcon /> },
    { view: 'messages', label: 'Messages', icon: <MessagesIcon /> },
    { view: 'nutrition', label: 'Nutrition', icon: <NutritionIcon /> },
    { view: 'billing', label: 'Billing', icon: <BillingIcon /> },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        ></div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-xl flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] md:sticky md:top-4 md:m-4 md:h-[calc(100vh-2rem)] md:rounded-3xl md:translate-x-0 md:z-10 md:border md:border-gray-200 md:dark:border-[#8AC43C]/15 md:shadow-2xl dark:shadow-[0_0_20px_rgba(138,196,60,0.1)] border-r border-gray-100 dark:border-[#8AC43C]/15 md:border-r-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header - Spacious & Clean */}
        <div className="h-24 flex items-center justify-between pl-5 sm:pl-8 pr-4 sm:pr-6">
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2.5 sm:gap-3.5 focus:outline-none rounded-xl transition-transform active:scale-95 duration-200 group"
          >
            <div className="rounded-2xl overflow-hidden transition-transform group-hover:scale-110 duration-300 drop-shadow-sm">
              <LogoIcon className="h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3A2524] dark:text-[#e6b8a3]">
              Bean<span className="text-[#8AC43C]">Health</span>
            </h1>
          </button>
          <button
            onClick={onClose}
            className="md:hidden p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 ml-2"
          >
            <XIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation - Minimal Pill Style */}
        <nav className="flex-1 px-4 pt-2 pb-8 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.view}>
                <button
                  onClick={() => {
                    setActiveView(item.view);
                    onClose();
                  }}
                  className={`group w-full flex items-center gap-3.5 px-4 py-3.5 rounded-full text-left transition-all duration-200 relative ${activeView === item.view
                    ? 'bg-gray-100 dark:bg-white/10 text-black dark:text-white font-bold'
                    : 'text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  <span className={`${activeView === item.view ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-200'
                    } transition-colors duration-200 relative`}>
                    {/* Scale icons slightly down for refined look */}
                    {React.cloneElement(item.icon as any, { className: 'w-5 h-5' })}

                    {/* Notification dot for messages */}
                    {item.view === 'messages' && unreadMessageCount > 0 && activeView !== 'messages' && (
                      <span className={`absolute -top-1 -right-1 flex h-2.5 w-2.5 ${hasUrgentMessages ? 'animate-ping-slow' : ''}`}>
                        <span className={`absolute inline-flex h-full w-full rounded-full ${hasUrgentMessages ? 'bg-red-500 animate-ping' : 'bg-[#8AC43C]'} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasUrgentMessages ? 'bg-red-500' : 'bg-[#8AC43C]'}`}></span>
                      </span>
                    )}
                  </span>
                  <span className="text-sm flex-1">{item.label}</span>

                  {/* Unread count badge for messages */}
                  {item.view === 'messages' && unreadMessageCount > 0 && activeView !== 'messages' && (
                    <span className={`text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center ${hasUrgentMessages
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-[#8AC43C] text-white'
                      }`}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer - Minimal Links */}
        <div className="p-6 pb-8 border-t border-gray-100 dark:border-white/5 space-y-4">
          <div className="px-4 text-center">
            <p className="text-xs font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest">
              © 2025 BeanHealth
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

