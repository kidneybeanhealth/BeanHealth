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
    { view: 'records', label: 'View Records', icon: <RecordsIcon /> },
    { view: 'upload', label: 'Upload Record', icon: <UploadIcon /> },
    { view: 'messages', label: 'Messages', icon: <MessagesIcon /> },
    { view: 'billing', label: 'Billing', icon: <BillingIcon /> },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        ></div>
      )}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 shadow-2xl flex-shrink-0 flex flex-col transform transition-all duration-300 ease-out md:relative md:translate-x-0 md:z-10 border-r border-gray-200 dark:border-gray-700 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button 
            onClick={() => setActiveView('dashboard')} 
            className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-rose-900 rounded-xl p-2 -ml-2 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="bg-gradient-to-br from-rose-500 to-rose-900 p-2.5 rounded-xl shadow-md ring-1 ring-white/20">
              <LogoIcon className="h-6 w-6 text-white"/>
            </div>
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Beanhealth
            </h1>
          </button>
          <button 
            onClick={onClose} 
            className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <XIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item, index) => (
              <li key={item.view} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                <button
                  onClick={() => {
                    setActiveView(item.view);
                    onClose();
                  }}
                  className={`group relative w-full flex items-center px-4 py-3.5 rounded-xl text-left transition-all duration-200 overflow-hidden ${
                    activeView === item.view
                      ? 'bg-gradient-to-r from-rose-500 to-rose-900 text-white shadow-md scale-[1.02]'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {activeView === item.view && (
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-900 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  )}
                  <span className={`relative mr-3.5 ${activeView === item.view ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-rose-900 dark:group-hover:text-rose-400'} transition-colors duration-200`}>
                    {item.icon}
                  </span>
                  <span className="relative font-semibold text-[15px]">{item.label}</span>
                  {activeView === item.view && (
                    <span className="relative ml-auto">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200/60 dark:border-gray-700/60">
          <div className="bg-gradient-to-br from-rose-50 to-rose-50 dark:from-rose-900/20 dark:to-indigo-900/20 rounded-xl p-4 mb-4 border border-rose-100 dark:border-sky-800/30">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Need help?</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">Contact our support team for assistance</p>
            <button className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 text-rose-900 dark:text-rose-400 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-[1.02] active:scale-95 transition-all duration-200 shadow-sm">
              Get Support
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center font-medium">
            © 2024 Beanhealth
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;