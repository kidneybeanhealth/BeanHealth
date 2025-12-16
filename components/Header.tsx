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
    <header className="sticky top-0 z-40 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex-shrink-0 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4 flex-1 min-w-0">
             <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Toggle menu"
            >
                <MenuIcon className="h-6 w-6" />
            </button>
            <div className="animate-fade-in min-w-0 flex-1">
                <h2 className="text-xl lg:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight truncate">
                  Welcome back, {user.name}
                </h2>
                <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {user.role === 'patient' ? "Your health at a glance" : "Manage your patients"}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
            <ThemeToggle />
            <button
              onClick={() => setIsUploaderOpen(true)}
              className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200"
              aria-label="Update profile photo"
            >
              {user.avatarUrl || user.avatar_url ? (
                <div className="h-11 w-11 lg:h-12 lg:w-12 ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-300 dark:group-hover:ring-slate-600 transition-all duration-200 rounded-full overflow-hidden bg-white dark:bg-slate-800">
                  <img
                    src={user.avatarUrl || user.avatar_url}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`h-11 w-11 lg:h-12 lg:w-12 ${colorClass} ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-slate-300 dark:group-hover:ring-slate-600 transition-all duration-200 rounded-full flex items-center justify-center`}>
                  <span className="text-white font-semibold text-sm lg:text-base">{initials}</span>
                </div>
              )}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Log out"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
        </div>
        {isUploaderOpen && (
            <ProfilePhotoUploader onClose={() => setIsUploaderOpen(false)} onSave={handleSaveAvatar} />
        )}
    </header>
  );
};

export default Header;
