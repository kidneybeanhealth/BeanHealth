/**
 * Patient Trends Tab — Animated period switcher + chart transitions
 * Supports Tamil (default) ↔ English
 */
import React, { useState, useEffect, useRef } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { PatientAppService, DailyVitals, DailyIntakes } from '../../services/patientAppService';
import TrendChart from './TrendChart';

type Period = 7 | 30 | 90;

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
];

const PatientTrends: React.FC = () => {
  const { session } = usePatientApp();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>(30);
  const [vitalsHistory, setVitalsHistory] = useState<DailyVitals[]>([]);
  const [intakesHistory, setIntakesHistory] = useState<DailyIntakes[]>([]);
  const [urineHistory, setUrineHistory] = useState<{ date: string; total_ml: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartVisible, setChartVisible] = useState(true);
  const pillRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Animated pill indicator position
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const idx = PERIODS.findIndex(p => p.value === period);
    const btn = btnRefs.current[idx];
    const container = pillRef.current;
    if (btn && container) {
      const btnRect = btn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setPillStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [period]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!session?.patient.id) return;
      setLoading(true);

      const [v, i, u] = await Promise.all([
        PatientAppService.getVitalsHistory(session.patient.id, period),
        PatientAppService.getIntakesHistory(session.patient.id, period),
        PatientAppService.getUrineOutputHistory(session.patient.id, period),
      ]);

      setVitalsHistory(v);
      setIntakesHistory(i);
      setUrineHistory(u);
      setLoading(false);
    };

    fetchHistory();
  }, [session?.patient.id, period]);

  const handlePeriodChange = (p: Period) => {
    if (p === period) return;
    // Fade out charts, switch, fade in
    setChartVisible(false);
    setTimeout(() => {
      setPeriod(p);
      setTimeout(() => setChartVisible(true), 100);
    }, 200);
  };

  // Transform data for charts
  const bpData = vitalsHistory
    .filter(v => v.bp_systole || v.bp_diastole)
    .map(v => ({ date: v.recorded_date, value: v.bp_systole || 0, value2: v.bp_diastole || 0 }));

  const glucoseData = vitalsHistory
    .filter(v => v.blood_glucose)
    .map(v => ({ date: v.recorded_date, value: Number(v.blood_glucose) || 0 }));

  const weightData = vitalsHistory
    .filter(v => v.weight)
    .map(v => ({ date: v.recorded_date, value: Number(v.weight) || 0 }));

  const urineData = urineHistory.map(u => ({ date: u.date, value: u.total_ml }));

  const fluidData = intakesHistory
    .filter(i => i.fluid_intake_ml)
    .map(i => ({ date: i.recorded_date, value: Number(i.fluid_intake_ml) || 0 }));

  return (
    <div className="pa-content">
      {/* Animated Period Selector */}
      <div ref={pillRef} style={{
        display: 'flex', position: 'relative',
        background: '#F3F4F6', borderRadius: 12, padding: 3,
        margin: '0 0 16px', gap: 2,
      }}>
        {/* Sliding pill indicator */}
        <div style={{
          position: 'absolute', top: 3, height: 'calc(100% - 6px)',
          left: pillStyle.left, width: pillStyle.width,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)',
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 0,
        }} />

        {PERIODS.map((p, idx) => (
          <button
            key={p.value}
            ref={el => { btnRefs.current[idx] = el; }}
            onClick={() => handlePeriodChange(p.value)}
            style={{
              flex: 1, position: 'relative', zIndex: 1,
              padding: '10px 0', border: 'none', background: 'transparent',
              cursor: 'pointer', borderRadius: 10,
              fontSize: 13, fontWeight: period === p.value ? 800 : 600,
              color: period === p.value ? '#6EA530' : '#9CA3AF',
              transition: 'color 0.25s ease, font-weight 0.25s ease',
              fontFamily: 'inherit',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Charts with fade transition */}
      <div style={{
        opacity: chartVisible && !loading ? 1 : 0,
        transform: chartVisible && !loading ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}>
        {loading ? null : (
          <>
            <TrendChart title={t('trend.bp')} data={bpData} color="#EF4444" color2="#3B82F6"
              unit="mmHg" label1={t('trend.systole')} label2={t('trend.diastole')} referenceMax={140} referenceMin={60} />
            <TrendChart title={t('trend.glucose')} data={glucoseData} color="#F59E0B"
              unit="mg/dL" referenceMax={140} referenceMin={70} />
            <TrendChart title={t('trend.weight')} data={weightData} color="#8B5CF6" unit="kg" />
            <TrendChart title={t('trend.urine')} data={urineData} color="#06B6D4" unit="ml" />
            <TrendChart title={t('trend.fluid')} data={fluidData} color="#3B82F6" unit="ml" />
          </>
        )}
      </div>

      {/* Loading spinner */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="pa-spinner large" />
        </div>
      )}
    </div>
  );
};

export default PatientTrends;
