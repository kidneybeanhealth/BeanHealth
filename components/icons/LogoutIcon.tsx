import React from 'react';

export const LogoutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h4" />
    <path d="M14 16l4-4-4-4" />
    <path d="M21 12H10" />
  </svg>
);