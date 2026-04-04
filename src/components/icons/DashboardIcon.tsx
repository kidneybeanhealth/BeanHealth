
import React from 'react';

export const DashboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <rect width="8" height="8" x="2" y="2" rx="2.5" />
    <rect width="8" height="8" x="14" y="2" rx="2.5" />
    <rect width="8" height="8" x="2" y="14" rx="2.5" />
    <rect width="8" height="8" x="14" y="14" rx="2.5" />
  </svg>
);
