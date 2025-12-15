import React from 'react';
import { DoctorPortalView } from '../types';
import { LogoIcon } from './icons/LogoIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { XIcon } from './icons/XIcon';

interface DoctorSidebarProps {
  activeView: DoctorPortalView;
  setActiveView: (view: DoctorPortalView) => void;
  isOpen: boolean;
  onClose: () => void;
}

const DoctorSidebar: React.FC<DoctorSidebarProps> = ({ activeView, setActiveView, isOpen, onClose }) => {
  const navItems: { view: DoctorPortalView; label: string; icon: React.ReactElement }[] = [
    { view: 'dashboard', label: 'Patient Roster', icon: <UserGroupIcon /> },
    { view: 'messages', label: 'Messages', icon: <MessagesIcon /> },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 w-64 sm:w-72 bg-white dark:bg-slate-900 flex-shrink-0 flex flex-col border-r border-slate-200/60 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200/60 dark:border-slate-800">
         <button onClick={() => setActiveView('dashboard')} className="flex items-center space-x-3 focus:outline-none rounded-xl -ml-1 p-1">
            <div className="bg-slate-900 dark:bg-white p-2.5 rounded-xl">
              <LogoIcon className="h-6 w-6 text-white dark:text-slate-900"/>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">BeanHealth</h1>
        </button>
        <button onClick={onClose} className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <XIcon className="h-6 w-6 text-slate-500 dark:text-slate-400" />
        </button>
      </div>
      <nav className="flex-1 px-4 py-8">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.view}>
              <button
                onClick={() => setActiveView(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 ${
                  activeView === item.view
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{item.icon}</span>
                <span className="font-medium text-[15px]">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-6 border-t border-slate-200/60 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-medium">© 2025 BeanHealth. All rights reserved.</p>
      </div>
    </aside>
  );
};

export default DoctorSidebar;