import React from 'react';
import { User } from '../types';
import { LogoutIcon } from './icons/LogoutIcon';
import ThemeToggle from './ThemeToggle';
import { MenuIcon } from './icons/MenuIcon';
import { getInitials } from '../utils/avatarUtils';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onMenuClick: () => void;
  showMenu?: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuClick, showMenu = true }) => {
  const initials = getInitials(user.name, user.email);

  return (
    <header className="flex-shrink-0 mx-4 mt-4 h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-2xl rounded-3xl border border-gray-100 dark:border-[#8AC43C]/15 shadow-lg dark:shadow-[0_0_20px_rgba(138,196,60,0.1)] flex items-center transition-all duration-300 z-40">
      <div className="w-full flex items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {showMenu && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 -ml-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
          )}

          <div className="animate-fade-in min-w-0 flex-1 flex flex-col justify-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Welcome back, <span className="text-[#8AC43C]">{user.name}</span>
            </h2>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5 truncate tracking-wide uppercase opacity-90">
              {user.role === 'patient' ? "Your Health Dashboard" : "Manage Patients"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-white/10 mx-2"></div>

          <button
            onClick={onLogout}
            className="group flex items-center p-1 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-500 ease-out"
            aria-label="Log out"
          >
            <div className="relative z-10">
              {user.avatarUrl || user.avatar_url ? (
                <img
                  src={user.avatarUrl || user.avatar_url}
                  alt={user.name}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-black shadow-md transition-all duration-300"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center ring-2 ring-white dark:ring-black shadow-md font-bold text-sm transition-colors duration-300">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-black bg-green-500"></span>
            </div>

            <div className="max-w-0 group-hover:max-w-[120px] overflow-hidden transition-all duration-500 ease-out opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-2 pl-3 pr-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">
                <span>Log out</span>
                <LogoutIcon className="h-4 w-4 text-red-500" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
