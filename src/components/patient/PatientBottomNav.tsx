import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export type PatientTab = 'home' | 'trends' | 'prescriptions' | 'profile';

interface Props {
  activeTab: PatientTab;
  onChange: (tab: PatientTab) => void;
  onFab?: () => void;
}

const VitalsIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
    strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const HistoryIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
    strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    <path d="M3 3l18 18" stroke="none" />
    <path d="M3 17.5l4-4 4 4 4-8 4 4" />
  </svg>
);

const TrendIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
    strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const RxIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
    strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ProfileIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
    strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const TABS: { id: PatientTab; labelEn: string; labelTa: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'home',          labelEn: 'Vitals',         labelTa: 'உடல்நிலை',  Icon: VitalsIcon },
  { id: 'trends',        labelEn: 'History',        labelTa: 'வரலாறு',    Icon: TrendIcon },
  { id: 'prescriptions', labelEn: 'Prescriptions',  labelTa: 'மருந்துசீட்டு', Icon: RxIcon },
  { id: 'profile',       labelEn: 'Profile',        labelTa: 'சுயவிவரம்', Icon: ProfileIcon },
];

const PatientBottomNav: React.FC<Props> = ({ activeTab, onChange, onFab }) => {
  const { lang } = useLanguage();

  // Split tabs around the center FAB
  const leftTabs = TABS.slice(0, 2);
  const rightTabs = TABS.slice(2);

  const renderTab = (tab: typeof TABS[number]) => {
    const active = activeTab === tab.id;
    const label = lang === 'ta' ? tab.labelTa : tab.labelEn;
    return (
      <button key={tab.id} onClick={() => onChange(tab.id)} style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, padding: '8px 0',
        border: 'none', background: 'transparent', cursor: 'pointer',
      }}>
        <div style={{
          width: 38, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
          background: active ? 'hsl(var(--accent))' : 'transparent',
          transition: 'background 0.2s ease',
        }}>
          <tab.Icon active={active} />
        </div>
        <span style={{
          fontSize: 9, fontWeight: active ? 700 : 500,
          color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          fontFamily: lang === 'ta' ? 'Noto Sans Tamil, sans-serif' : 'IBM Plex Sans, sans-serif',
          lineHeight: 1.2, textAlign: 'center',
          transition: 'color 0.2s ease',
          maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid hsl(var(--border))',
      display: 'flex', alignItems: 'center',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
    }}>
      {leftTabs.map(renderTab)}

      {/* Center FAB */}
      <div style={{ flexShrink: 0, padding: '0 8px', marginBottom: 8 }}>
        <button onClick={onFab} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'hsl(var(--primary))',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px hsl(151 22% 31% / 0.4)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {rightTabs.map(renderTab)}
    </nav>
  );
};

export default PatientBottomNav;
