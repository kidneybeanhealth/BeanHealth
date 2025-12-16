import React from 'react';
import { View } from '../types';
import { DashboardIcon } from './icons/DashboardIcon';
import { RecordsIcon } from './icons/RecordsIcon';
import { UploadIcon } from './icons/UploadIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { LogoIcon } from './icons/LogoIcon';
import { BillingIcon } from './icons/BillingIcon';
import { XIcon } from './icons/XIcon';
import { DoctorIcon } from './icons/DoctorIcon';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isOpen, onClose }) => {
  const navItems: { view: View; label: string; icon: React.ReactElement }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { view: 'records', label: 'Records', icon: <RecordsIcon /> },
    { view: 'upload', label: 'Upload', icon: <UploadIcon /> },
    { view: 'doctors', label: 'Doctors', icon: <DoctorIcon /> },
    { view: 'messages', label: 'Messages', icon: <MessagesIcon /> },
    { view: 'billing', label: 'Billing', icon: <BillingIcon /> },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        ></div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white dark:bg-slate-900 flex-shrink-0 flex flex-col transform transition-all duration-300 ease-out md:relative md:translate-x-0 md:z-10 border-r border-slate-200/60 dark:border-slate-800 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header - Minimal & Clean */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-2xl p-2 -ml-2 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="bg-slate-900 dark:bg-white p-2.5 rounded-xl">
              <LogoIcon className="h-6 w-6 text-white dark:text-slate-900" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
              BeanHealth
            </h1>
          </button>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <XIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Navigation - Ultra Clean */}
        <nav className="flex-1 px-4 py-8 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.view}>
                <button
                  onClick={() => {
                    setActiveView(item.view);
                    onClose();
                  }}
                  className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 ${activeView === item.view
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <span className={`${activeView === item.view ? 'text-white dark:text-slate-900' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'} transition-colors duration-200`}>
                    {item.icon}
                  </span>
                  <span className="font-medium text-[15px]">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer - Minimal */}
        <div className="p-6 border-t border-slate-200/60 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-200/60 dark:border-slate-700/60">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Need help?</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">Reach out to our support team</p>
            <button className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 border border-slate-200 dark:border-slate-600">
              Contact Support
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-medium">
            © 2025 BeanHealth
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
