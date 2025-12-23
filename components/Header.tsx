import React from 'react';
import { User } from '../types';
import { LogoutIcon } from './icons/LogoutIcon';
import ThemeToggle from './ThemeToggle';
import { MenuIcon } from './icons/MenuIcon';
import { LogoIcon } from './icons/LogoIcon';
import { getInitials } from '../utils/avatarUtils';
import ProfileModal from './ProfileModal';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onMenuClick: () => void;
  showMenu?: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuClick, showMenu = true }) => {
  const initials = getInitials(user.name, user.email);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  return (
    <header className="flex-shrink-0 mx-2 sm:mx-4 mt-4 h-16 sm:h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-[#8AC43C]/15 shadow-lg dark:shadow-[0_0_20px_rgba(138,196,60,0.1)] flex items-center transition-all duration-300 z-40">
      <div className="w-full flex items-center justify-between px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          {showMenu && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              <MenuIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          {/* Logo / Brand Area - Mobile Only */}
          <div className="flex md:hidden items-center gap-2.5">
            <div className="h-9 w-9 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
              <LogoIcon className="w-9 h-9" />
            </div>
            <div className="flex flex-col justify-center">
              <h2 className="text-base font-bold leading-none tracking-tight">
                <span className="text-[#3A2524] dark:text-[#e6b8a3]">Bean</span>
                <span className="text-[#8AC43C]">Health</span>
              </h2>
              <p className="text-[8px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5 uppercase">Patient Portal</p>
            </div>
          </div>

          {/* Welcome Section - Tablet/Desktop */}
          <div className="hidden md:flex animate-fade-in min-w-0 flex-1 flex flex-col justify-center">
            <h2 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Welcome, <span className="text-[#8AC43C]">{user.name}</span>
            </h2>
            <p className="text-[9px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 truncate tracking-wide uppercase opacity-90">
              {user.role === 'patient' ? "Your Health Dashboard" : "Manage Patients"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <ThemeToggle />

          <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-1 sm:mx-2"></div>

          <button
            onClick={() => setIsProfileOpen(true)}
            className="group flex items-center p-1 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-500 ease-out"
            aria-label="View Profile"
          >
            <div className="relative z-10">
              <div className="h-10 w-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center ring-2 ring-white dark:ring-black shadow-md font-bold text-sm transition-colors duration-300 group-hover:ring-[#8AC43C]">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-black bg-green-500"></span>
            </div>

            {/* Profile Label */}
            <div className="max-w-0 group-hover:max-w-[120px] overflow-hidden transition-all duration-500 ease-out opacity-0 group-hover:opacity-100">
              <span className="pl-3 pr-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">
                My Profile
              </span>
            </div>
          </button>
        </div>
      </div>

      <ProfileModal
        user={user}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onLogout={onLogout}
      />
    </header>
  );
};

export default Header;
