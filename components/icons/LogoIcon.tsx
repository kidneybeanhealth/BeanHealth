/**
 * BeanHealth Logo Icon Component
 * 
 * Kidney bean shape with stem - representing health and vitality
 * Brand colors: Dark Brown (#3D2820), Lime Green (#7CB342)
 */

import React from 'react';

interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  showText?: boolean;
  variant?: 'full' | 'icon' | 'horizontal';
}

export const LogoIcon: React.FC<LogoIconProps> = ({
  showText = false,
  variant = 'icon',
  className = '',
  ...props
}) => {
  if (variant === 'icon') {
    // Just the bean icon
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        className={className}
        {...props}
      >
        {/* Bean shape */}
        <path
          d="M30 15 C10 25, 5 55, 25 80 C40 95, 60 85, 65 70 C70 55, 55 45, 50 50 C45 55, 55 65, 45 75 C35 85, 20 70, 25 50 C30 30, 50 25, 30 15"
          fill="#3D2820"
        />
        {/* Bean holes (eyes) */}
        <ellipse cx="35" cy="40" rx="6" ry="8" fill="#fdf8f6" />
        <ellipse cx="35" cy="60" rx="6" ry="8" fill="#fdf8f6" />
        {/* Green stem */}
        <path
          d="M65 20 C70 30, 68 50, 70 70 M70 40 C75 35, 80 38, 78 45 M70 55 C75 50, 82 52, 80 60"
          stroke="#7CB342"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  // Full logo with text
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        className="w-10 h-10"
        {...props}
      >
        {/* Bean shape */}
        <path
          d="M30 15 C10 25, 5 55, 25 80 C40 95, 60 85, 65 70 C70 55, 55 45, 50 50 C45 55, 55 65, 45 75 C35 85, 20 70, 25 50 C30 30, 50 25, 30 15"
          fill="#3D2820"
        />
        {/* Bean holes (eyes) */}
        <ellipse cx="35" cy="40" rx="6" ry="8" fill="#fdf8f6" />
        <ellipse cx="35" cy="60" rx="6" ry="8" fill="#fdf8f6" />
        {/* Green stem */}
        <path
          d="M65 20 C70 30, 68 50, 70 70 M70 40 C75 35, 80 38, 78 45 M70 55 C75 50, 82 52, 80 60"
          stroke="#7CB342"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold leading-tight">
            <span className="text-[#3D2820] dark:text-[#e6b8a3]">Bean</span>
            <span className="text-[#7CB342]"> Health</span>
          </span>
          {variant === 'full' && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Continuous. Connected. Complete.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default LogoIcon;
