import React from 'react';
import { LogoutIcon } from './icons/LogoutIcon';
import ThemeToggle from './ThemeToggle';

interface SimpleHeaderProps {
  userName: string;
  userRole: string;
  onSignOut: () => void;
}

const SimpleHeader: React.FC<SimpleHeaderProps> = ({ userName, userRole, onSignOut }) => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            BeanHealth
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {userRole === 'doctor' ? 'Doctor Portal' : 'Patient Dashboard'}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {userName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {userRole}
              </p>
            </div>
            
            <div className="h-8 w-8 bg-rose-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {userName && userName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          
          <button
            onClick={onSignOut}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Sign Out"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default SimpleHeader;