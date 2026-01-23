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
  onMenuClick?: () => void;
  onTitleClick?: () => void;
  showMenu?: boolean;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuClick, onTitleClick, showMenu = true, className = '' }) => {
  const initials = getInitials(user.name, user.email);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  return (
    <>
      <div className={`sticky top-0 z-50 flex justify-center pointer-events-none mb-6 -mx-1 sm:-mx-2 md:-mx-3 ${className}`}>
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gray-100 via-gray-100/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent" />

        <header className="pointer-events-auto relative mt-2 sm:mt-4 w-full h-16 sm:h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-xl saturate-150 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-[#8AC43C]/15 flex items-center transition-all duration-300 shadow-sm md:shadow-2xl dark:shadow-[0_0_20px_rgba(138,196,60,0.1)]">
          <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
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
              <div
                onClick={onTitleClick}
                className="flex md:hidden items-center gap-2.5 cursor-pointer active:scale-95 transition-transform"
              >
                <div className="h-9 w-9 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                  <LogoIcon className="w-9 h-9" />
                </div>
                <div className="flex flex-col justify-center">
                  <h2 className="text-base font-bold leading-none tracking-tight">
                    <span className="text-primary-500 dark:text-[#e6b8a3]">Bean</span>
                    <span className="text-secondary-500">Health</span>
                  </h2>
                  <p className="text-[8px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5 uppercase">Patient Portal</p>
                </div>
              </div>

              {/* Welcome Section - Tablet/Desktop */}
              <div
                onClick={onTitleClick}
                className="hidden md:flex animate-fade-in min-w-0 flex-1 flex-col justify-center cursor-pointer hover:opacity-80 transition-opacity"
              >
                <h2 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                  Welcome, <span className="text-secondary-500">{user.name}</span>
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
                  <div className="h-9 w-9 sm:h-10 sm:w-10 bg-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md ring-2 ring-white dark:ring-black transition-colors duration-300 group-hover:ring-secondary-500">
                    {initials}
                  </div>
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-black bg-emerald-500"></span>
                </div>

                <div className="max-w-0 group-hover:max-w-[100px] overflow-hidden transition-all duration-500 ease-out opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-2 pl-3 pr-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>My Profile</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </header>
      </div>

      <ProfileModal
        user={user}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onLogout={onLogout}
      />
    </>
  );
};

export default Header;
