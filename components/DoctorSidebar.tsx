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
    <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-20 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
         <button onClick={() => setActiveView('dashboard')} className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md -ml-1 p-1">
            <LogoIcon className="h-8 w-8 text-indigo-600"/>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Beanhealth</h1>
        </button>
        <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
          <XIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul>
          {navItems.map((item) => (
            <li key={item.view} className="mb-2">
              <button
                onClick={() => setActiveView(item.view)}
                className={`w-full flex items-center p-3 rounded-lg text-left transition-all duration-200 ease-in-out ${
                  activeView === item.view
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">© 2025 Beanhealth. All rights reserved.</p>
      </div>
    </aside>
  );
};

export default DoctorSidebar;