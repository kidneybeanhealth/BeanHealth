/**
 * Patient Bottom Navigation — 3 tabs: Home, Trends, Prescriptions
 * Supports Tamil (default) ↔ English
 */
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export type PatientTab = 'home' | 'trends' | 'prescriptions';

interface Props {
  activeTab: PatientTab;
  onChange: (tab: PatientTab) => void;
}

const HomeIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg className="pa-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const TrendsIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg className="pa-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const PrescriptionsIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg className="pa-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const TABS: { id: PatientTab; labelKey: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'home', labelKey: 'nav.home', Icon: HomeIcon },
  { id: 'trends', labelKey: 'nav.trends', Icon: TrendsIcon },
  { id: 'prescriptions', labelKey: 'nav.rx', Icon: PrescriptionsIcon },
];

const PatientBottomNav: React.FC<Props> = ({ activeTab, onChange }) => {
  const { t } = useLanguage();
  const activeIndex = TABS.findIndex(tab => tab.id === activeTab);

  return (
    <nav className="pa-bottom-nav">
      <div 
        className="pa-nav-indicator" 
        style={{ transform: `translateX(${activeIndex * 100}%)` }} 
      />
      {TABS.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          className={`pa-nav-item ${activeTab === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon active={activeTab === id} />
          <span className="pa-nav-label">{t(labelKey)}</span>
        </button>
      ))}
    </nav>
  );
};

export default PatientBottomNav;
