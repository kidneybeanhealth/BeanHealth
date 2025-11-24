import React from 'react';
import { View } from '../types';
import { DashboardIcon } from './icons/DashboardIcon';
import { RecordsIcon } from './icons/RecordsIcon';
import { UploadIcon } from './icons/UploadIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { LogoIcon } from './icons/LogoIcon';
import { BillingIcon } from './icons/BillingIcon';
import { XIcon } from './icons/XIcon';

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
    { view: 'messages', label: 'Messages', icon: <MessagesIcon /> },
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

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white dark:bg-gray-900 flex-shrink-0 flex flex-col transform transition-all duration-300 ease-out md:relative md:translate-x-0 md:z-10 border-r border-gray-200/60 dark:border-gray-800 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header - Minimal & Clean */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200/60 dark:border-gray-800">
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-2xl p-2 -ml-2 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="bg-gray-900 dark:bg-white p-2.5 rounded-xl">
              <LogoIcon className="h-6 w-6 text-white dark:text-gray-900"/>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
              BeanHealth
            </h1>
          </button>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <XIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
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
                  className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 ${
                    activeView === item.view
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`${activeView === item.view ? 'text-white dark:text-gray-900' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'} transition-colors duration-200`}>
                    {item.icon}
                  </span>
                  <span className="font-medium text-[15px]">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer - Minimal */}
        <div className="p-6 border-t border-gray-200/60 dark:border-gray-800">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-200/60 dark:border-gray-700/60">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Need help?</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">Reach out to our support team</p>
            <button className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 border border-gray-200 dark:border-gray-600">
              Contact Support
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center font-medium">
            © 2025 BeanHealth
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

