
import React from 'react';

export const RecordsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M14 2H6a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9z" />
    <path d="M14 2v5a2 2 0 0 0 2 2h5" />
    <path d="M7 13h10" />
    <path d="M7 17h10" />
    <path d="M7 9h2" />
  </svg>
);
