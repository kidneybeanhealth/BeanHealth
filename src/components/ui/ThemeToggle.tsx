import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon } from '../icons/SunIcon';
import { MoonIcon } from '../icons/MoonIcon';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl saturate-150 border border-white/20 dark:border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.05)] ring-1 ring-white/20 dark:ring-white/5 hover:scale-110 hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_24px_rgba(255,255,255,0.1)] active:scale-95 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] text-gray-600 dark:text-gray-300"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {theme === 'light' ? <MoonIcon className="h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]" /> : <SunIcon className="h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]" />}
    </button>
  );
};

export default ThemeToggle;
