import React from 'react';

export const NotesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M15.2 3a2 2 0 0 1 2.8 2.8L12 12l-4-4 7.2-5z" />
    <path d="M12 12l-4-4" />
    <path d="M10 21h7a2 2 0 0 0 2-2V9.5" />
    <path d="M7 11.5V17a2 2 0 0 0 2 2h1.5" />
  </svg>
);