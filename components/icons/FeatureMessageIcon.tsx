import React from 'react';

export const FeatureMessageIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
        <path d="M12 20.94c-2.09.06-4.18-.46-6-1.44" />
        <path d="M12 20.94c1.82-.98 3.91-1.5 6-1.44" />
        <path d="M20 12.34V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14l4-4h4" />
        <rect x="14" y="12" width="6" height="8" rx="2" />
        <path d="M17 12v-2a3 3 0 0 0-6 0v2" />
    </svg>
);
