/**
 * Medication Card — Groups medications by time-of-day
 * Supports Tamil (default) ↔ English
 * 
 * Data shape from DB (via PrescriptionPage):
 *   frequency: "1-0-0-1" → M-N-E-NT dose counts
 *   morningTime/noonTime/eveningTime/nightTime: specific times
 *   foodTiming: "B/F", "A/F", "nil", "S/C"
 *   instruction: "Before Food", "After Food"
 *   quantity or number: total qty
 *   dose: "OD", "BD", "TDS", "HS" etc.
 *   drugType: "TAB", "SYP", "INJ"
 *   dosage_value: "500MG"
 */
import React from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';

const PillIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.5 4.5l-15 15" />
    <path d="M16.5 1.5a4.24 4.24 0 0 1 6 6L7.5 22.5a4.24 4.24 0 0 1-6-6z" />
    <line x1="12" y1="8" x2="16" y2="12" />
  </svg>
);

// ── SVG Icons for time sections ──────────────────────────
const SunriseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="2" x2="12" y2="9" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <polyline points="8 6 12 2 16 6" />
  </svg>
);
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
  </svg>
);
const SunsetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="9" x2="12" y2="2" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <polyline points="16 5 12 9 8 5" />
  </svg>
);
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ── Parse frequency string "1-0-0-1" → { morning, noon, evening, night } ──
const parseFrequency = (med: any): { morning: string; noon: string; evening: string; night: string } => {
  // First try explicit fields (mobile format)
  if (med.morning !== undefined && med.morning !== '') {
    return {
      morning: String(med.morning || '0'),
      noon: String(med.noon || '0'),
      evening: String(med.evening || '0'),
      night: String(med.night || '0'),
    };
  }
  // Then parse frequency string (desktop format: "1-0-0-1")
  const freq = med.frequency || '';
  const parts = freq.split('-');
  if (parts.length === 4) {
    return {
      morning: parts[0] || '0',
      noon: parts[1] || '0',
      evening: parts[2] || '0',
      night: parts[3] || '0',
    };
  }
  return { morning: '0', noon: '0', evening: '0', night: '0' };
};

const isDoseActive = (val: string): boolean => {
  return val !== '' && val !== '0';
};

// ── Food timing (uses t() for translated labels) ─────────
const getFoodInfo = (med: any, t: (key: string) => string) => {
  const ft = (med.foodTiming || '').toUpperCase().trim();
  const inst = (med.instruction || '').toLowerCase();

  if (ft === 'B/F' || inst.includes('before'))
    return { label: t('med.beforeFood'), short: 'B/F', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' };
  if (ft === 'A/F' || inst.includes('after'))
    return { label: t('med.afterFood'), short: 'A/F', color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' };
  if (ft === 'S/C' || ft === 'S/C B/F')
    return { label: 'S/C', short: 'S/C', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' };
  if (ft === 'S/C A/F')
    return { label: 'S/C A/F', short: 'S/C A/F', color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' };
  if (ft === 'E/S')
    return { label: t('med.emptyStomach'), short: 'E/S', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' };
  if (ft && ft !== 'NIL')
    return { label: ft, short: ft, color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' };
  return null;
};

// ── Time section config ─────────────────────────────────
const TIME_SECTIONS = [
  { key: 'morning', timeKey: 'morningTime',
    labelKey: 'med.morning', icon: SunriseIcon, color: '#92400E', bg: '#FFFBEB', headerBg: '#FEF3C7', border: '#FDE68A' },
  { key: 'noon', timeKey: 'noonTime',
    labelKey: 'med.afternoon', icon: SunIcon, color: '#1E40AF', bg: '#EFF6FF', headerBg: '#DBEAFE', border: '#BFDBFE' },
  { key: 'evening', timeKey: 'eveningTime',
    labelKey: 'med.evening', icon: SunsetIcon, color: '#C2410C', bg: '#FFF7ED', headerBg: '#FFEDD5', border: '#FED7AA' },
  { key: 'night', timeKey: 'nightTime',
    labelKey: 'med.night', icon: MoonIcon, color: '#3730A3', bg: '#EEF2FF', headerBg: '#E0E7FF', border: '#C7D2FE' },
] as const;

// ── Drug row component ──────────────────────────────────
const DrugRow: React.FC<{
  med: any; idx: number; doseCount: string;
  timeDisplay: string | null; sectionColor: string; sectionBorder: string; sectionHeaderBg: string;
  isLast: boolean; t: (key: string) => string;
}> = ({ med, idx, doseCount, timeDisplay, sectionColor, sectionBorder, sectionHeaderBg, isLast, t }) => {
  const foodInfo = getFoodInfo(med, t);
  const qty = med.quantity || med.number || '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px 10px 20px',
      borderBottom: isLast ? 'none' : '1px solid #F3F4F6',
      background: '#fff',
    }}>
      {/* Index */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#F0F7E6', color: '#6EA530',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 900, flexShrink: 0,
      }}>{idx + 1}</div>

      {/* Drug details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', textTransform: 'uppercase' as const }}>
            {med.name}
          </span>
          {med.dosage_value && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6EA530', background: '#F0F7E6', padding: '1px 6px', borderRadius: 4 }}>
              {med.dosage_value}
            </span>
          )}
          {med.drugType && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' as const }}>
              {med.drugType}
            </span>
          )}
        </div>
        {/* Time + dose frequency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          {med.dose && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>{med.dose}</span>
          )}
          {timeDisplay && (
            <span style={{ fontSize: 10, fontWeight: 600, color: sectionColor, opacity: 0.75 }}>{timeDisplay}</span>
          )}
        </div>
      </div>

      {/* Food timing badge */}
      {foodInfo && (
        <span style={{
          fontSize: 9, fontWeight: 800, color: foodInfo.color,
          background: foodInfo.bg, border: `1px solid ${foodInfo.border}`,
          padding: '3px 7px', borderRadius: 5, flexShrink: 0,
        }}>
          {foodInfo.short}
        </span>
      )}

      {/* Dose count — simple green circle */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: '#F0F7E6', border: '1.5px solid #8AC43C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#6EA530' }}>
          {doseCount}
        </span>
      </div>
    </div>
  );
};

const MedicationCard: React.FC = () => {
  const { medications, currentPrescription } = usePatientApp();
  const { t } = useLanguage();

  if (medications.length === 0) {
    return (
      <div className="pa-card">
        <div className="pa-card-header">
          <div className="pa-card-title">
            <div className="pa-card-icon purple"><PillIcon /></div>
            {t('med.title')}
          </div>
        </div>
        <div className="pa-empty" style={{ padding: '24px 16px' }}>
          <div className="pa-empty-icon"><PillIcon /></div>
          <p className="pa-empty-text">{t('med.noMeds')}</p>
          <p className="pa-empty-subtext">{t('med.emptySubtext')}</p>
        </div>
      </div>
    );
  }

  // Parse all medications
  const parsedMeds = medications.map((med: any, idx: number) => ({
    med, idx, timing: parseFrequency(med),
  }));

  // Build time sections
  const sections = TIME_SECTIONS.map(section => {
    const medsInSlot = parsedMeds
      .filter(pm => isDoseActive(pm.timing[section.key as keyof typeof pm.timing]))
      .map(pm => ({
        med: pm.med,
        idx: pm.idx,
        doseCount: pm.timing[section.key as keyof typeof pm.timing],
        timeDisplay: pm.med[section.timeKey] || null,
      }));
    return { ...section, meds: medsInSlot };
  }).filter(s => s.meds.length > 0);

  // Uncategorized meds (frequency = "0-0-0-0" or no timing at all)
  const uncategorized = parsedMeds.filter(pm =>
    !isDoseActive(pm.timing.morning) && !isDoseActive(pm.timing.noon) &&
    !isDoseActive(pm.timing.evening) && !isDoseActive(pm.timing.night)
  );

  return (
    <div className="pa-card" style={{ padding: 0 }}>
      {/* Header */}
      <div className="pa-card-header" style={{ padding: '16px 20px 12px' }}>
        <div className="pa-card-title">
          <div className="pa-card-icon purple"><PillIcon /></div>
          {t('med.title')}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginLeft: 4 }}>
            ({medications.length})
          </span>
        </div>
        {currentPrescription && (
          <span className={`pa-rx-status ${currentPrescription.status}`}>
            {currentPrescription.status}
          </span>
        )}
      </div>

      {/* Time-of-day sections */}
      {sections.map(section => {
        const IconComp = section.icon;
        return (
          <div key={section.key}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px',
              background: section.headerBg,
              borderTop: `1px solid ${section.border}`,
              borderBottom: `1px solid ${section.border}`,
            }}>
              <span style={{ color: section.color, display: 'flex' }}><IconComp /></span>
              <span style={{ fontSize: 13, fontWeight: 800, color: section.color, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                {t(section.labelKey)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: section.color, opacity: 0.6 }}>
                ({section.meds.length})
              </span>
            </div>
            {/* Drugs */}
            {section.meds.map(({ med, idx, doseCount, timeDisplay }, j) => (
              <DrugRow key={`${section.key}-${idx}`}
                med={med} idx={idx} doseCount={doseCount} timeDisplay={timeDisplay}
                sectionColor={section.color} sectionBorder={section.border} sectionHeaderBg={section.headerBg}
                isLast={j === section.meds.length - 1} t={t}
              />
            ))}
          </div>
        );
      })}

      {/* Uncategorized (no timing / external use) */}
      {uncategorized.length > 0 && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', background: '#F3F4F6',
            borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
              {t('med.otherExternal')}
            </span>
          </div>
          {uncategorized.map(({ med, idx }, j) => {
            const foodInfo = getFoodInfo(med, t);
            return (
              <div key={`other-${idx}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px 10px 20px',
                borderBottom: j < uncategorized.length - 1 ? '1px solid #F3F4F6' : 'none',
                background: '#fff',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#F0F7E6', color: '#6EA530',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 900, flexShrink: 0,
                }}>{idx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', textTransform: 'uppercase' as const }}>{med.name}</span>
                    {med.dosage_value && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6EA530', background: '#F0F7E6', padding: '1px 6px', borderRadius: 4 }}>{med.dosage_value}</span>
                    )}
                    {med.drugType && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' as const }}>{med.drugType}</span>
                    )}
                  </div>
                  {med.instruction && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginTop: 2 }}>{med.instruction}</div>
                  )}
                </div>
                {foodInfo && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: foodInfo.color, background: foodInfo.bg, border: `1px solid ${foodInfo.border}`, padding: '3px 7px', borderRadius: 5, flexShrink: 0 }}>
                    {foodInfo.short}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MedicationCard;
