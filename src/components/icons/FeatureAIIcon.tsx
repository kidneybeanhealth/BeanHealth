import React from 'react';

export const FeatureAIIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    {...props}>
        <path d="M12 8V4H8" />
        <rect x="4" y="12" width="8" height="8" rx="2" />
        <path d="M8 12v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
        <path d="M20 12h-4" />
        <path d="M16 12l2-2 2 2" />
        <path d="M16 12l2 2 2-2" />
  </svg>
);
