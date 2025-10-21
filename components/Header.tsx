import React, { useState } from 'react';
import { User } from '../types';
import { LogoutIcon } from './icons/LogoutIcon';
import ThemeToggle from './ThemeToggle';
import { MenuIcon } from './icons/MenuIcon';
import ProfilePhotoUploader from './ProfilePhotoUploader';
import { getInitials, getInitialsColor, getInitialsAvatarClasses } from '../utils/avatarUtils';

interface HeaderProps {
    user: User;
    onLogout: () => void;
    onMenuClick: () => void;
    onUpdateAvatar: (dataUrl: string) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuClick, onUpdateAvatar }) => {
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);

  const handleSaveAvatar = (dataUrl: string) => {
    if(user.role === 'patient') {
      onUpdateAvatar(dataUrl);
    }
    setIsUploaderOpen(false);
  };

  const initials = getInitials(user.name, user.email);
  const colorClass = getInitialsColor(user.name, user.email);
  const avatarClasses = getInitialsAvatarClasses('lg');

  return (
    <header className="sticky top-0 z-40 h-16 sm:h-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl flex-shrink-0 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
             <button 
              onClick={onMenuClick} 
              className="md:hidden p-2 sm:p-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-900"
              aria-label="Toggle menu"
            >
                <MenuIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <div className="animate-fade-in min-w-0 flex-1">
                <h2 className="text-base sm:text-xl lg:text-2xl font-display font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">
                  Welcome back, <span className="text-rose-700 dark:text-rose-400">{user.name}</span>
                </h2>
                <p className="hidden sm:block text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 truncate">
                  {user.role === 'patient' ? "Here's your latest health overview" : "Here's an overview of your patients"}
                </p>
            </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <ThemeToggle />
            <button 
              onClick={() => setIsUploaderOpen(true)} 
              className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-rose-900 focus:ring-offset-2 dark:focus:ring-offset-gray-800 hover:scale-105 active:scale-95 transition-all duration-200" 
              aria-label="Update profile photo"
            >
              <div className={`${avatarClasses} ${colorClass} ring-2 ring-white dark:ring-gray-800 group-hover:ring-rose-400 dark:group-hover:ring-rose-500 transition-all duration-200 shadow-sm`}>
                <span className="text-white font-semibold text-sm sm:text-base">{initials}</span>
              </div>
              <div className="absolute inset-0 bg-rose-500/15 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </button>
            <button 
              onClick={onLogout} 
              className="flex items-center justify-center p-2 sm:p-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Log out"
            >
              <LogoutIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
        </div>
        {isUploaderOpen && (
            <ProfilePhotoUploader onClose={() => setIsUploaderOpen(false)} onSave={handleSaveAvatar} />
        )}
    </header>
  );
};

export default Header;
